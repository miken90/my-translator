use std::sync::mpsc;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use super::capture_loop::run_capture_loop;

use windows::Win32::Media::Audio::{
    ActivateAudioInterfaceAsync,
    AUDIOCLIENT_ACTIVATION_PARAMS,
    AUDIOCLIENT_ACTIVATION_PARAMS_0,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
    AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS,
    AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_LOOPBACK,
    IActivateAudioInterfaceAsyncOperation,
    IActivateAudioInterfaceCompletionHandler,
    IActivateAudioInterfaceCompletionHandler_Impl,
    IAudioClient,
    IMMDeviceEnumerator,
    MMDeviceEnumerator,
    PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
    eConsole,
    eRender,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::core::{implement, Interface, IUnknown, PCWSTR};

// ─────────────────────────────────────────────────────────────────────────────
// COM completion handler for ActivateAudioInterfaceAsync
// ─────────────────────────────────────────────────────────────────────────────

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct CompletionHandler {
    sender: mpsc::SyncSender<Result<IAudioClient, String>>,
}

impl IActivateAudioInterfaceCompletionHandler_Impl for CompletionHandler_Impl {
    fn ActivateCompleted(
        &self,
        activate_operation: Option<&IActivateAudioInterfaceAsyncOperation>,
    ) -> windows::core::Result<()> {
        let result: Result<IAudioClient, String> = (|| {
            let op =
                activate_operation.ok_or_else(|| "No operation provided".to_string())?;
            let mut hr = windows::core::HRESULT(0);
            let mut activated: Option<IUnknown> = None;
            unsafe {
                op.GetActivateResult(&mut hr, &mut activated)
                    .map_err(|e| e.to_string())?;
            }
            hr.ok().map_err(|e| e.to_string())?;
            let client: IAudioClient = activated
                .ok_or_else(|| "No audio client returned".to_string())?
                .cast()
                .map_err(|e| e.to_string())?;
            Ok(client)
        })();
        let _ = self.sender.send(result);
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a VT_BLOB PROPVARIANT pointing at AUDIOCLIENT_ACTIVATION_PARAMS.
//
// windows::core::PROPVARIANT is repr(transparent) over a private inner type.
// Layout (matching the Windows SDK PROPVARIANT structure):
//   offset 0: vt (u16)
//   offset 2: wReserved1/2/3 (u16 x3)
//   offset 8: cbSize (u32)  [blob.cbSize]
//   offset 16: pBlobData (*mut u8) [blob.pBlobData, 8-byte aligned on 64-bit]
//
// VT_BLOB = 65 (0x41)
//
// The returned PROPVARIANT must be forgotten (not dropped) because pBlobData
// points to stack memory, not heap — PropVariantClear must not free it.
// ─────────────────────────────────────────────────────────────────────────────

unsafe fn build_activation_propvariant(
    params: &AUDIOCLIENT_ACTIVATION_PARAMS,
) -> windows::core::PROPVARIANT {
    const VT_BLOB: u16 = 65u16; // VT_BLOB value from propidlbase.h

    // PROPVARIANT is repr(transparent) wrapping the inner raw struct.
    // Both share the same memory layout, so we can zero-init via PROPVARIANT
    // and then write into its bytes directly via pointer arithmetic.
    let mut pv = windows::core::PROPVARIANT::new();
    let pv_ptr = &mut pv as *mut windows::core::PROPVARIANT as *mut u8;

    // vt field is at offset 0, size 2
    (pv_ptr as *mut u16).write(VT_BLOB);

    // blob.cbSize is at offset 8 on both 32-bit and 64-bit Windows
    // (vt:u16, wReserved1:u16, wReserved2:u16, wReserved3:u16 = 8 bytes total padding)
    let cbsize_ptr = pv_ptr.add(8) as *mut u32;
    cbsize_ptr.write(std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32);

    // blob.pBlobData is at offset 16 on 64-bit (cbSize:u32 + 4 bytes padding + ptr)
    // On 32-bit it would be at offset 12, but Tauri targets 64-bit Windows.
    let pblobdata_ptr = pv_ptr.add(16) as *mut *mut u8;
    pblobdata_ptr.write(params as *const _ as *mut u8);

    pv
}

// ─────────────────────────────────────────────────────────────────────────────
// ALAC path: Windows 10 20H2+ — excludes own PID from captured audio
// ─────────────────────────────────────────────────────────────────────────────

pub(super) fn start_app_loopback(
    own_pid: u32,
    sender: mpsc::Sender<Vec<u8>>,
    is_capturing: Arc<AtomicBool>,
) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        // Build activation params to exclude own process
        let params = AUDIOCLIENT_ACTIVATION_PARAMS {
            ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
            Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
                ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                    TargetProcessId: own_pid,
                    ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
                },
            },
        };

        // params must outlive prop_variant
        let prop_variant = build_activation_propvariant(&params);

        // Sync channel for async completion handler
        let (tx, rx) = mpsc::sync_channel::<Result<IAudioClient, String>>(1);
        let handler = CompletionHandler { sender: tx };
        let handler_com: IActivateAudioInterfaceCompletionHandler = handler.into();

        // VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK = "VAD\\Process_Loopback"
        let device_id: PCWSTR = windows::core::w!("VAD\\Process_Loopback");

        ActivateAudioInterfaceAsync(
            device_id,
            &IAudioClient::IID,
            Some(&prop_variant),
            &handler_com,
        )
        .map_err(|e| format!("ActivateAudioInterfaceAsync failed: {}", e))?;

        // Wait for async activation to complete (timeout = 5s)
        let audio_client = rx
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| "Timeout waiting for ALAC audio activation".to_string())??;

        // Get the mix format to determine source rate/channels
        let mix_format_ptr = audio_client
            .GetMixFormat()
            .map_err(|e| format!("GetMixFormat failed: {}", e))?;
        let mix_format = &*mix_format_ptr;

        let source_rate = mix_format.nSamplesPerSec;
        let source_channels = mix_format.nChannels as u32;
        let bits_per_sample = mix_format.wBitsPerSample;

        // ALAC is already a loopback stream — no AUDCLNT_STREAMFLAGS_LOOPBACK needed
        audio_client
            .Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                0,
                10_000_000, // 1 second buffer in 100ns units
                0,
                mix_format_ptr,
                None,
            )
            .map_err(|e| format!("AudioClient Initialize failed: {}", e))?;

        eprintln!(
            "[wasapi] Using Application Loopback (process exclusion) — own PID {} excluded",
            own_pid
        );

        run_capture_loop(
            &audio_client,
            &sender,
            &is_capturing,
            source_rate,
            source_channels,
            bits_per_sample,
        );

        // prop_variant drop would call PropVariantClear — we must forget it since
        // pBlobData points to stack memory (params), not heap-allocated data.
        std::mem::forget(prop_variant);

        CoUninitialize();
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy WASAPI loopback path (captures all system audio, no exclusion)
// ─────────────────────────────────────────────────────────────────────────────

pub(super) fn start_legacy_loopback(sender: mpsc::Sender<Vec<u8>>, is_capturing: Arc<AtomicBool>) {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator = match CoCreateInstance(
            &MMDeviceEnumerator,
            None,
            CLSCTX_ALL,
        ) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[wasapi] Failed to create device enumerator: {}", e);
                return;
            }
        };

        let device = match enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[wasapi] Failed to get default audio endpoint: {}", e);
                return;
            }
        };

        let audio_client: IAudioClient = match device.Activate(CLSCTX_ALL, None) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[wasapi] Failed to activate audio client: {}", e);
                return;
            }
        };

        let mix_format_ptr = match audio_client.GetMixFormat() {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[wasapi] Failed to get mix format: {}", e);
                return;
            }
        };
        let mix_format = &*mix_format_ptr;

        let source_rate = mix_format.nSamplesPerSec;
        let source_channels = mix_format.nChannels as u32;
        let bits_per_sample = mix_format.wBitsPerSample;

        if let Err(e) = audio_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            10_000_000,
            0,
            mix_format_ptr,
            None,
        ) {
            eprintln!(
                "[wasapi] Failed to initialize audio client in loopback mode: {}",
                e
            );
            return;
        }

        eprintln!("[wasapi] Using legacy WASAPI loopback (no process exclusion)");

        run_capture_loop(
            &audio_client,
            &sender,
            &is_capturing,
            source_rate,
            source_channels,
            bits_per_sample,
        );

        CoUninitialize();
    }
}
