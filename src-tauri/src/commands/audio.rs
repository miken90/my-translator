use crate::audio::microphone::MicCapture;
use crate::audio::SystemAudioCapture;
use serde::Serialize;
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tauri::{ipc::Channel, State};

/// Bound on how long stop_capture waits for forwarder threads to exit before
/// giving up and detaching them. Prevents a stuck capture read from hanging
/// the UI on stop.
const JOIN_TIMEOUT: Duration = Duration::from_secs(2);

/// State for tracking active audio captures
pub struct AudioState {
    pub system_audio: Mutex<SystemAudioCapture>,
    pub microphone: Mutex<MicCapture>,
    pub active_receiver: Mutex<Option<AudioForwarder>>,
}

/// Forwards audio from a receiver to a Tauri IPC channel
pub struct AudioForwarder {
    /// Handle to signal stop
    stop_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    /// Threads to join on stop: the main buffer-forward thread, plus the two
    /// source-merge threads spawned in "both" mode.
    handles: Vec<JoinHandle<()>>,
}

#[derive(Serialize, Clone)]
pub struct PermissionStatus {
    pub screen_recording: String,
    pub microphone: String,
}

/// Start audio capture and forward data to the frontend via IPC channel
#[tauri::command]
pub fn start_capture(
    source: String,
    channel: Channel<Vec<u8>>,
    state: State<'_, AudioState>,
) -> Result<(), String> {
    // Stop any existing capture first
    stop_capture_inner(&state);

    let mut handles: Vec<JoinHandle<()>> = Vec::new();

    let receiver: mpsc::Receiver<Vec<u8>> = match source.as_str() {
        "system" => {
            let sys = state.system_audio.lock().map_err(|e| e.to_string())?;
            sys.start()?
        }
        "microphone" => {
            let mut mic = state.microphone.lock().map_err(|e| e.to_string())?;
            mic.start()?
        }
        "both" => {
            // Start both sources and merge into a single receiver
            let sys = state.system_audio.lock().map_err(|e| e.to_string())?;
            let sys_rx = sys.start()?;
            let mut mic = state.microphone.lock().map_err(|e| e.to_string())?;
            let mic_rx = mic.start()?;

            let (merged_tx, merged_rx) = mpsc::channel::<Vec<u8>>();
            let tx1 = merged_tx.clone();
            let tx2 = merged_tx;

            // Forward system audio to merged channel. Exits once sys_rx
            // disconnects (system_audio.stop()) or the merged receiver is
            // dropped (main forwarder thread below has exited).
            handles.push(std::thread::spawn(move || {
                while let Ok(data) = sys_rx.recv() {
                    if let Err(e) = tx1.send(data) {
                        eprintln!("[Audio] System-audio merge forward stopped: {}", e);
                        break;
                    }
                }
            }));
            // Forward mic audio to merged channel — same shutdown coupling as above.
            handles.push(std::thread::spawn(move || {
                while let Ok(data) = mic_rx.recv() {
                    if let Err(e) = tx2.send(data) {
                        eprintln!("[Audio] Microphone merge forward stopped: {}", e);
                        break;
                    }
                }
            }));

            merged_rx
        }
        _ => return Err(format!("Unknown source: {}", source)),
    };

    // Spawn a thread to forward audio data from receiver to IPC channel
    let stop_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stop_flag_clone = stop_flag.clone();

    handles.push(std::thread::spawn(move || {
        let mut buffer: Vec<u8> = Vec::with_capacity(16000); // ~0.5 sec at 16kHz s16le
        let batch_interval = std::time::Duration::from_millis(100);
        let mut last_flush = std::time::Instant::now();

        loop {
            if stop_flag_clone.load(std::sync::atomic::Ordering::SeqCst) {
                // Flush remaining buffer before exit
                if !buffer.is_empty() {
                    if let Err(e) = channel.send(buffer.clone()) {
                        eprintln!("[Audio] Final flush on stop failed (channel closed): {}", e);
                    }
                }
                break;
            }

            match receiver.recv_timeout(std::time::Duration::from_millis(10)) {
                Ok(data) => {
                    buffer.extend_from_slice(&data);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    if !buffer.is_empty() {
                        if let Err(e) = channel.send(buffer.clone()) {
                            eprintln!("[Audio] Final flush on disconnect failed (channel closed): {}", e);
                        }
                    }
                    break;
                }
            }

            // Flush buffer every 100ms
            if last_flush.elapsed() >= batch_interval && !buffer.is_empty() {
                if let Err(e) = channel.send(buffer.clone()) {
                    eprintln!("[Audio] Forwarder stopping, channel send failed: {}", e);
                    break; // Channel closed
                }
                buffer.clear();
                last_flush = std::time::Instant::now();
            }
        }
    }));

    // Store the forwarder so we can stop it later
    let forwarder = AudioForwarder { stop_flag, handles };
    let mut active = state.active_receiver.lock().map_err(|e| e.to_string())?;
    *active = Some(forwarder);

    Ok(())
}

/// Stop audio capture
#[tauri::command]
pub fn stop_capture(state: State<'_, AudioState>) -> Result<(), String> {
    stop_capture_inner(&state);
    Ok(())
}

fn stop_capture_inner(state: &AudioState) {
    // Signal the main forwarder thread to stop. Don't join yet — in "both"
    // mode the two source-merge threads only exit once system_audio.stop()
    // / microphone.stop() below drop their underlying senders.
    let forwarder = state
        .active_receiver
        .lock()
        .ok()
        .and_then(|mut active| active.take());
    if let Some(ref f) = forwarder {
        f.stop_flag.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    // Stop system audio
    if let Ok(sys) = state.system_audio.lock() {
        sys.stop();
    }

    // Stop microphone
    if let Ok(mut mic) = state.microphone.lock() {
        mic.stop();
    }

    // Now join forwarder threads with a bounded total timeout so a stuck
    // capture read cannot hang the UI. Any thread still running past the
    // deadline is detached (dropped without joining) and logged.
    if let Some(forwarder) = forwarder {
        join_handles_with_timeout(forwarder.handles, JOIN_TIMEOUT);
    }
}

/// Join each handle, waiting no longer than `timeout` in total across all of
/// them. A handle that hasn't finished by its share of the deadline is
/// dropped without joining (detached) and logged, rather than blocking.
fn join_handles_with_timeout(handles: Vec<JoinHandle<()>>, timeout: Duration) {
    let deadline = Instant::now() + timeout;
    for handle in handles {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if !wait_until_finished(&handle, remaining) {
            eprintln!(
                "[Audio] Forwarder thread did not stop within {:?}, detaching",
                timeout
            );
            continue;
        }
        if let Err(e) = handle.join() {
            eprintln!("[Audio] Forwarder thread panicked: {:?}", e);
        }
    }
}

fn wait_until_finished(handle: &JoinHandle<()>, timeout: Duration) -> bool {
    let start = Instant::now();
    loop {
        if handle.is_finished() {
            return true;
        }
        if start.elapsed() >= timeout {
            return false;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// Check audio capture permissions
#[tauri::command]
pub fn check_permissions() -> PermissionStatus {
    // Note: Actual permission checking on macOS requires Objective-C interop
    // For now, we return "unknown" and permissions will be prompted on first use
    PermissionStatus {
        screen_recording: "unknown".to_string(),
        microphone: "unknown".to_string(),
    }
}
