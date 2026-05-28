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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod commands {
    use serde::Serialize;

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
}
