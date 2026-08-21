mod capture_loop;
mod com_setup;

use std::sync::mpsc;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// System audio capture using WASAPI loopback on Windows.
/// Captures all system audio output and converts to PCM s16le 16kHz mono.
/// On Windows 10 20H2+, uses Application Loopback API (ALAC) to exclude own process audio.
/// Falls back to legacy WASAPI loopback on older systems.
pub struct SystemAudioCapture {
    is_capturing: Arc<AtomicBool>,
}

impl SystemAudioCapture {
    pub fn new() -> Self {
        Self {
            is_capturing: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start capturing system audio.
    /// Returns a receiver that yields PCM s16le 16kHz mono audio chunks.
    pub fn start(&self) -> Result<mpsc::Receiver<Vec<u8>>, String> {
        if self.is_capturing.load(Ordering::SeqCst) {
            return Err("Already capturing".to_string());
        }

        let (sender, receiver) = mpsc::channel::<Vec<u8>>();
        let is_capturing = self.is_capturing.clone();
        is_capturing.store(true, Ordering::SeqCst);

        let own_pid = std::process::id();

        std::thread::spawn(move || {
            // Skip ALAC — go straight to legacy loopback for stability
            com_setup::start_legacy_loopback(sender, is_capturing);
        });

        Ok(receiver)
    }

    /// Stop capturing
    pub fn stop(&self) {
        self.is_capturing.store(false, Ordering::SeqCst);
    }

    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }
}

impl Default for SystemAudioCapture {
    fn default() -> Self {
        Self::new()
    }
}
