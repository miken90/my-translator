use std::sync::mpsc;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::audio::TARGET_SAMPLE_RATE;

use windows::Win32::Media::Audio::{
    AUDCLNT_BUFFERFLAGS_SILENT,
    IAudioCaptureClient,
    IAudioClient,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared capture loop (reused by both ALAC and legacy paths)
// ─────────────────────────────────────────────────────────────────────────────

pub(super) unsafe fn run_capture_loop(
    audio_client: &IAudioClient,
    sender: &mpsc::Sender<Vec<u8>>,
    is_capturing: &Arc<AtomicBool>,
    source_rate: u32,
    source_channels: u32,
    bits_per_sample: u16,
) {
    let capture_client: IAudioCaptureClient = match audio_client.GetService() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[wasapi] Failed to get capture client: {}", e);
            return;
        }
    };

    if let Err(e) = audio_client.Start() {
        eprintln!("[wasapi] Failed to start audio client: {}", e);
        return;
    }

    while is_capturing.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(10));

        let packet_size = match capture_client.GetNextPacketSize() {
            Ok(size) => size,
            Err(_) => continue,
        };

        if packet_size == 0 {
            continue;
        }

        let mut buffer_ptr = std::ptr::null_mut();
        let mut num_frames = 0u32;
        let mut flags = 0u32;

        if capture_client
            .GetBuffer(&mut buffer_ptr, &mut num_frames, &mut flags, None, None)
            .is_err()
        {
            continue;
        }

        if num_frames > 0 && !buffer_ptr.is_null() {
            let is_silent = (flags & (AUDCLNT_BUFFERFLAGS_SILENT.0 as u32)) != 0;

            if !is_silent {
                let pcm_data = convert_to_pcm_s16_16k(
                    buffer_ptr,
                    num_frames,
                    source_rate,
                    source_channels,
                    bits_per_sample,
                );

                if !pcm_data.is_empty() {
                    if sender.send(pcm_data).is_err() {
                        break; // Receiver dropped
                    }
                }
            }
        }

        let _ = capture_client.ReleaseBuffer(num_frames);
    }

    let _ = audio_client.Stop();
}

// ─────────────────────────────────────────────────────────────────────────────
// PCM conversion helper
// ─────────────────────────────────────────────────────────────────────────────

/// Convert raw WASAPI buffer to PCM s16le 16kHz mono
unsafe fn convert_to_pcm_s16_16k(
    buffer_ptr: *mut u8,
    num_frames: u32,
    source_rate: u32,
    source_channels: u32,
    bits_per_sample: u16,
) -> Vec<u8> {
    let frame_count = num_frames as usize;

    // Read samples as f32 (WASAPI typically delivers IEEE float)
    let f32_samples = if bits_per_sample == 32 {
        let ptr = buffer_ptr as *const f32;
        std::slice::from_raw_parts(ptr, frame_count * source_channels as usize)
    } else {
        return Vec::new(); // Unsupported format
    };

    // Take first channel only (mono)
    let mono: Vec<f32> = f32_samples
        .chunks(source_channels as usize)
        .map(|frame| frame[0])
        .collect();

    // Downsample to 16kHz
    let ratio = source_rate as f64 / TARGET_SAMPLE_RATE as f64;
    let output_len = (mono.len() as f64 / ratio) as usize;

    let mut pcm_bytes: Vec<u8> = Vec::with_capacity(output_len * 2);

    for i in 0..output_len {
        let src_idx = (i as f64 * ratio) as usize;
        if src_idx >= mono.len() {
            break;
        }
        let sample = mono[src_idx].clamp(-1.0, 1.0);
        let s16 = (sample * 32767.0) as i16;
        pcm_bytes.extend_from_slice(&s16.to_le_bytes());
    }

    pcm_bytes
}
