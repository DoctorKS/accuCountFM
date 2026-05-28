// accuCountFM — Rust backend entry.
//
// Plugins registered:
//   - tauri-plugin-log      → bridges `log` macros to Tauri devtools / stdout
//   - tauri-plugin-sql      → SQLite via sqlx; runs migrations at first connect
//   - tauri-plugin-dialog   → native file open/save dialogs
//   - tauri-plugin-fs       → scoped fs access (writes to %APPDATA% only)
//
// The calc module is the single source of truth for pay computation. UI mirrors
// it in TS for live preview, but persisted totals must come from here.

pub mod calc;
pub mod excel;
pub mod keys;
pub mod ocr;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial schema",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:accucountfm.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::get_api_key,
            commands::set_api_key,
            commands::clear_api_key,
            commands::has_api_key,
            commands::ocr_run,
            commands::export_month_xlsx,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod commands {
    use crate::{excel, keys, ocr};
    use serde::Serialize;
    use std::path::PathBuf;

    #[derive(Serialize)]
    pub struct AppInfo {
        pub version: &'static str,
        pub name: &'static str,
    }

    #[tauri::command]
    pub fn app_info() -> AppInfo {
        AppInfo {
            version: env!("CARGO_PKG_VERSION"),
            name: env!("CARGO_PKG_NAME"),
        }
    }

    // ─── Keyring (API key in Windows Credential Manager) ────────────────────

    #[tauri::command]
    pub fn get_api_key() -> Result<Option<String>, String> {
        keys::get_api_key()
    }

    #[tauri::command]
    pub fn has_api_key() -> Result<bool, String> {
        keys::get_api_key().map(|v| v.is_some())
    }

    #[tauri::command]
    pub fn set_api_key(value: String) -> Result<(), String> {
        let v = value.trim();
        if v.is_empty() {
            return Err("API key ว่าง — ไม่บันทึก".into());
        }
        keys::set_api_key(v)
    }

    #[tauri::command]
    pub fn clear_api_key() -> Result<(), String> {
        keys::clear_api_key()
    }

    // ─── OCR ────────────────────────────────────────────────────────────────

    #[tauri::command]
    pub async fn ocr_run(
        image_path: String,
        year_month: String,
        holidays: Option<Vec<u32>>,
    ) -> Result<ocr::OcrResult, String> {
        let key = keys::get_api_key()?
            .ok_or_else(|| "ยังไม่ได้ตั้ง Anthropic API Key — ไปที่หน้า ตั้งค่า".to_string())?;
        let path = PathBuf::from(image_path);
        if !path.exists() {
            return Err(format!("ไม่พบไฟล์: {}", path.display()));
        }
        ocr::run_ocr(&path, &year_month, &key, holidays.as_deref().unwrap_or(&[])).await
    }

    // ─── Excel export ───────────────────────────────────────────────────────

    #[tauri::command]
    pub fn export_month_xlsx(payload: excel::ExportPayload) -> Result<excel::ExportResult, String> {
        excel::write_workbook(&payload)
    }
}
