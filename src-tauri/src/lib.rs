// MINIONS Tauri backend — agent orchestration, local storage, and process management.

mod agents;
mod commands;
mod db;

use commands::projects::DbState;
use std::sync::Mutex;

/// Bootstrap the Tauri application with all plugins, state, and command handlers.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = db::default_db_path();
    let conn = db::open_database(&db_path).expect("Failed to open MINIONS database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            commands::agents::detect_runtimes,
            commands::projects::list_projects,
            commands::projects::create_project,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running MINIONS application");
}
