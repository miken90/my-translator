use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Translation term: source → target mapping for Soniox
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TranslationTerm {
    pub source: String,
    pub target: String,
}

/// Custom context for Soniox — provides domain-specific hints
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(default)]
pub struct CustomContext {
    pub domain: Option<String>,
    pub translation_terms: Vec<TranslationTerm>,
}

/// App settings — persisted to JSON
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(default)]
pub struct Settings {
    /// Soniox API key
    pub soniox_api_key: String,
    /// Source language: "auto" or ISO 639-1 code
    pub source_language: String,
    /// Target language: ISO 639-1 code
    pub target_language: String,
    /// Audio source: "system" | "microphone" | "both"
    pub audio_source: String,
    /// Overlay opacity: 0.0 - 1.0
    pub overlay_opacity: f64,
    /// Font size in px
    pub font_size: u32,
    /// Max transcript lines to display
    pub max_lines: u32,
    /// Export file format: "md" | "txt"
    pub export_format: String,
    /// Whether to show original text alongside translation
    pub show_original: bool,
    /// Translation mode: "soniox" (cloud API)
    pub translation_mode: String,
    /// Optional custom context for better transcription
    pub custom_context: Option<CustomContext>,
    /// ElevenLabs API key for TTS narration
    pub elevenlabs_api_key: String,
    /// Whether TTS narration is enabled
    pub tts_enabled: bool,
    /// TTS provider: "edge" | "elevenlabs" | "google"
    pub tts_provider: String,
    /// ElevenLabs voice ID
    pub tts_voice_id: String,
    /// TTS speed multiplier (Web Speech)
    pub tts_speed: f64,
    /// Edge TTS voice name
    pub edge_tts_voice: String,
    /// Edge TTS speed percentage
    pub edge_tts_speed: i32,
    /// Auto-read new translations aloud
    pub tts_auto_read: bool,
    /// Google Cloud TTS API key
    pub google_tts_api_key: String,
    /// Google TTS voice name
    pub google_tts_voice: String,
    /// Google TTS speaking rate
    pub google_tts_speed: f64,
    /// AI summary endpoint URL (OpenAI-compatible)
    pub ai_endpoint: String,
    /// AI summary API key
    pub ai_api_key: String,
    /// AI summary model name
    pub ai_model: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            soniox_api_key: String::new(),
            source_language: "auto".to_string(),
            target_language: "vi".to_string(),
            audio_source: "system".to_string(),
            overlay_opacity: 0.85,
            font_size: 16,
            max_lines: 5,
            export_format: "md".to_string(),
            show_original: true,
            translation_mode: "soniox".to_string(),
            custom_context: None,
            elevenlabs_api_key: String::new(),
            tts_enabled: false,
            tts_provider: "edge".to_string(),
            tts_voice_id: "21m00Tcm4TlvDq8ikWAM".to_string(),
            tts_speed: 1.2,
            edge_tts_voice: "vi-VN-HoaiMyNeural".to_string(),
            edge_tts_speed: 50,
            tts_auto_read: true,
            google_tts_api_key: String::new(),
            google_tts_voice: "vi-VN-Chirp3-HD-Aoede".to_string(),
            google_tts_speed: 1.0,
            ai_endpoint: String::new(),
            ai_api_key: String::new(),
            ai_model: String::new(),
        }
    }
}

/// Get the settings file path
/// %APPDATA%/com.personal.translator/settings.json
fn settings_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("com.personal.translator");
    path.push("settings.json");
    path
}

impl Settings {
    /// Load settings from disk, or return defaults
    pub fn load() -> Self {
        let path = settings_path();
        if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => Self::parse_or_backup(&path, &content),
                Err(_) => Self::default(),
            }
        } else {
            Self::default()
        }
    }

    /// Parse settings JSON content. On corrupt content, back up the original
    /// bytes to `<path>.bak`, log, and fall back to defaults — a corrupt
    /// settings.json is never silently discarded.
    fn parse_or_backup(path: &Path, content: &str) -> Self {
        match serde_json::from_str(content) {
            Ok(settings) => settings,
            Err(e) => {
                eprintln!(
                    "[Settings] Corrupt settings.json ({}), backing up and using defaults",
                    e
                );
                let backup_path = path.with_extension("json.bak");
                match fs::write(&backup_path, content) {
                    Ok(()) => eprintln!(
                        "[Settings] Backed up corrupt settings.json to {:?}",
                        backup_path
                    ),
                    Err(write_err) => eprintln!(
                        "[Settings] Failed to write corrupt-settings backup to {:?}: {}",
                        backup_path, write_err
                    ),
                }
                Self::default()
            }
        }
    }

    /// Save settings to disk
    pub fn save(&self) -> Result<(), String> {
        let path = settings_path();

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {}", e))?;
        }

        let json =
            serde_json::to_string_pretty(self).map_err(|e| format!("Failed to serialize: {}", e))?;

        fs::write(&path, json).map_err(|e| format!("Failed to write settings: {}", e))?;

        Ok(())
    }
}

/// Thread-safe settings state managed by Tauri
pub struct SettingsState(pub Mutex<Settings>);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_have_expected_baseline_values() {
        let s = Settings::default();
        assert_eq!(s.source_language, "auto");
        assert_eq!(s.target_language, "vi");
        assert_eq!(s.audio_source, "system");
        assert_eq!(s.translation_mode, "soniox");
        assert_eq!(s.tts_provider, "edge");
        assert!(s.tts_auto_read);
        assert!(!s.tts_enabled);
        assert!(s.custom_context.is_none());
    }

    #[test]
    fn settings_survive_a_serde_json_round_trip() {
        let original = Settings::default();
        let json = serde_json::to_string_pretty(&original).expect("serialize");
        let restored: Settings = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(original, restored);
    }

    #[test]
    fn missing_fields_in_stored_json_fall_back_to_defaults() {
        // #[serde(default)] means a partial settings.json (e.g. from an older
        // version) still deserializes, filling in only the missing fields.
        let partial = r#"{"soniox_api_key": "sk-abc", "font_size": 22}"#;
        let restored: Settings = serde_json::from_str(partial).expect("deserialize partial");
        assert_eq!(restored.soniox_api_key, "sk-abc");
        assert_eq!(restored.font_size, 22);
        // Everything else falls back to Default::default() field values.
        assert_eq!(restored.target_language, Settings::default().target_language);
    }

    #[test]
    fn corrupt_json_falls_back_to_default_settings() {
        // Characterizes the underlying serde fallback pattern
        // (serde_json::from_str(...).unwrap_or_default()) that
        // Settings::parse_or_backup() builds on.
        let corrupt = "{ this is not valid json ";
        let restored: Settings = serde_json::from_str(corrupt).unwrap_or_default();
        assert_eq!(restored, Settings::default());
    }

    #[test]
    fn corrupt_settings_are_backed_up_before_falling_back_to_defaults() {
        // Uses a temp dir (not the real settings_path()) so the test never
        // touches an actual user's settings.json.
        let dir = std::env::temp_dir().join("my-translator-test-corrupt-settings-backup");
        let _ = fs::create_dir_all(&dir);
        let settings_path = dir.join("settings.json");
        let backup_path = dir.join("settings.json.bak");
        let _ = fs::remove_file(&backup_path); // clean slate from any previous run

        let corrupt = "{ not valid json ";
        let restored = Settings::parse_or_backup(&settings_path, corrupt);

        assert_eq!(restored, Settings::default());
        let backup_content = fs::read_to_string(&backup_path).expect("backup file should exist");
        assert_eq!(backup_content, corrupt);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn valid_settings_json_does_not_create_a_backup_file() {
        let dir = std::env::temp_dir().join("my-translator-test-valid-settings-no-backup");
        let _ = fs::create_dir_all(&dir);
        let settings_path = dir.join("settings.json");
        let backup_path = dir.join("settings.json.bak");
        let _ = fs::remove_file(&backup_path);

        let valid = serde_json::to_string(&Settings::default()).expect("serialize");
        let restored = Settings::parse_or_backup(&settings_path, &valid);

        assert_eq!(restored, Settings::default());
        assert!(!backup_path.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn custom_context_round_trips_with_translation_terms() {
        let ctx = CustomContext {
            domain: Some("medical".to_string()),
            translation_terms: vec![TranslationTerm {
                source: "sin".to_string(),
                target: "tội".to_string(),
            }],
        };
        let settings = Settings {
            custom_context: Some(ctx.clone()),
            ..Settings::default()
        };

        let json = serde_json::to_string(&settings).expect("serialize");
        let restored: Settings = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.custom_context, Some(ctx));
    }
}
