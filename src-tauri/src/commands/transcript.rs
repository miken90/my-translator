use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use chrono::Local;
use serde::Serialize;

/// Get the transcript directory path
fn transcript_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("transcripts");

    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create transcript dir: {}", e))?;
    Ok(dir)
}

/// Reject path-traversal filenames. Shared by every command that takes a
/// caller-provided filename.
fn is_safe_filename(filename: &str) -> bool {
    !filename.contains('/') && !filename.contains('\\') && !filename.contains("..")
}

fn is_supported_export_extension(extension: &str) -> bool {
    extension == "md" || extension == "txt"
}

/// Write to `tmp_path` then rename over `filepath` — never a partial
/// in-place write, so a crash mid-write can't corrupt an existing file.
fn write_atomic(filepath: &PathBuf, tmp_path: &PathBuf, content: &str) -> Result<(), String> {
    fs::write(tmp_path, content).map_err(|e| format!("Failed to write temp file: {}", e))?;
    fs::rename(tmp_path, filepath).map_err(|e| format!("Failed to finalize update: {}", e))?;
    Ok(())
}

/// Save a complete transcript session to a timestamped file
/// Called when user clicks "Clear", stops recording, or closes app
#[tauri::command]
pub fn save_transcript(app: AppHandle, content: String) -> Result<String, String> {
    let dir = transcript_dir(&app)?;
    let now = Local::now();
    let filename = format!("{}.md", now.format("%Y-%m-%d_%H-%M-%S"));
    let filepath = dir.join(&filename);

    fs::write(&filepath, content)
        .map_err(|e| format!("Failed to save transcript: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

/// Save in-progress transcript to a temp file (overwritten each flush)
#[tauri::command]
pub fn save_transcript_temp(app: AppHandle, content: String) -> Result<(), String> {
    let dir = transcript_dir(&app)?;
    let filepath = dir.join("_recording.md");
    fs::write(&filepath, content)
        .map_err(|e| format!("Failed to save temp transcript: {}", e))?;
    Ok(())
}

/// Delete the temp transcript file after final save
#[tauri::command]
pub fn delete_transcript_temp(app: AppHandle) -> Result<(), String> {
    let dir = transcript_dir(&app)?;
    let filepath = dir.join("_recording.md");
    if filepath.exists() {
        fs::remove_file(&filepath)
            .map_err(|e| format!("Failed to delete temp transcript: {}", e))?;
    }
    Ok(())
}

/// Open the transcript directory in Windows Explorer
#[tauri::command]
pub fn open_transcript_dir(app: AppHandle) -> Result<(), String> {
    let dir = transcript_dir(&app)?;

    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Failed to open transcript dir: {}", e))?;
    Ok(())
}

#[derive(Serialize)]
pub struct TranscriptEntry {
    filename: String,
    path: String,
    created_at: String,
    size_bytes: u64,
}

/// List all saved transcript sessions, newest first
#[tauri::command]
pub fn list_transcripts(app: AppHandle) -> Result<Vec<TranscriptEntry>, String> {
    let dir = transcript_dir(&app)?;

    let mut entries: Vec<TranscriptEntry> = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read transcript dir: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let filename = entry.file_name().to_string_lossy().to_string();
            if !filename.ends_with(".md") || filename == "_recording.md" {
                return None;
            }
            let path = entry.path().to_string_lossy().to_string();
            let size_bytes = entry.metadata().ok()?.len();
            // Parse created_at from filename: YYYY-MM-DD_HH-MM-SS.md
            let created_at = filename
                .strip_suffix(".md")
                .unwrap_or(&filename)
                .replace('_', " ")
                .replace('-', ":")
                // Fix date separator: first two colons are date separators
                // Transform "2026:03:27 10:21:05" → "2026-03-27 10:21:05"
                .to_string();
            // More accurate: split on space, fix date part
            let created_at = {
                let base = filename.strip_suffix(".md").unwrap_or(&filename);
                // base = "2026-03-27_10-21-05"
                let parts: Vec<&str> = base.splitn(2, '_').collect();
                if parts.len() == 2 {
                    let time_part = parts[1].replace('-', ":");
                    format!("{} {}", parts[0], time_part)
                } else {
                    base.to_string()
                }
            };
            Some(TranscriptEntry {
                filename,
                path,
                created_at,
                size_bytes,
            })
        })
        .collect();

    // Sort by filename descending (newest first — filenames are timestamps)
    entries.sort_by(|a, b| b.filename.cmp(&a.filename));

    Ok(entries)
}

/// Read the content of a saved transcript file
#[tauri::command]
pub fn read_transcript(app: AppHandle, filename: String) -> Result<String, String> {
    if !is_safe_filename(&filename) {
        return Err("Invalid filename".to_string());
    }
    let dir = transcript_dir(&app)?;
    let filepath = dir.join(&filename);
    fs::read_to_string(&filepath)
        .map_err(|e| format!("Failed to read transcript: {}", e))
}

/// Overwrite an existing saved transcript's content (e.g. to add/replace the
/// AI summary section). Atomic write — see `write_atomic`.
#[tauri::command]
pub fn update_transcript(app: AppHandle, filename: String, content: String) -> Result<(), String> {
    if !is_safe_filename(&filename) {
        return Err("Invalid filename".to_string());
    }
    let dir = transcript_dir(&app)?;
    let filepath = dir.join(&filename);
    let tmp_path = dir.join(format!("{}.tmp", filename));
    write_atomic(&filepath, &tmp_path, &content)
}

/// Export session content as a standalone timestamped file (.md or .txt),
/// separate from the canonical auto-saved session file.
#[tauri::command]
pub fn export_transcript(app: AppHandle, content: String, extension: String) -> Result<String, String> {
    if !is_supported_export_extension(&extension) {
        return Err(format!("Unsupported export extension: {}", extension));
    }
    let dir = transcript_dir(&app)?;
    let now = Local::now();
    let filename = format!("{}_export.{}", now.format("%Y-%m-%d_%H-%M-%S"), extension);
    let filepath = dir.join(&filename);

    fs::write(&filepath, content)
        .map_err(|e| format!("Failed to export transcript: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_traversal_filenames() {
        assert!(!is_safe_filename("../settings.json"));
        assert!(!is_safe_filename("sub/dir.md"));
        assert!(!is_safe_filename("sub\\dir.md"));
        assert!(!is_safe_filename("..\\..\\evil.md"));
    }

    #[test]
    fn accepts_normal_transcript_filenames() {
        assert!(is_safe_filename("2026-08-21_10-00-00.md"));
        assert!(is_safe_filename("_recording.md"));
        assert!(is_safe_filename("2026-08-21_10-00-00_export.txt"));
    }

    #[test]
    fn export_extension_whitelist_is_md_and_txt_only() {
        assert!(is_supported_export_extension("md"));
        assert!(is_supported_export_extension("txt"));
        assert!(!is_supported_export_extension("exe"));
        assert!(!is_supported_export_extension(""));
        assert!(!is_supported_export_extension("md "));
    }

    #[test]
    fn write_atomic_replaces_existing_file_content_and_removes_tmp() {
        let dir = std::env::temp_dir().join("my-translator-test-write-atomic");
        let _ = fs::create_dir_all(&dir);
        let filepath = dir.join("session.md");
        let tmp_path = dir.join("session.md.tmp");
        let _ = fs::remove_file(&filepath);
        let _ = fs::remove_file(&tmp_path);

        fs::write(&filepath, "original content").expect("seed original file");

        write_atomic(&filepath, &tmp_path, "updated content with ## AI Summary")
            .expect("atomic write should succeed");

        assert_eq!(
            fs::read_to_string(&filepath).expect("read back"),
            "updated content with ## AI Summary"
        );
        assert!(!tmp_path.exists(), "tmp file must not remain after rename");

        let _ = fs::remove_dir_all(&dir);
    }
}
