// ELVES Tauri backend — agent orchestration, local storage, and process management.

mod agents;
mod commands;
mod db;

use agents::process::ProcessManager;
use commands::projects::DbState;
use std::sync::Mutex;

/// Bootstrap the Tauri application with all plugins, state, and command handlers.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = db::default_db_path();
    let conn = db::open_database(&db_path).expect("Failed to open ELVES database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DbState(Mutex::new(conn)))
        .manage(ProcessManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::agents::detect_runtimes,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::sessions::create_session,
            commands::sessions::list_sessions,
            commands::sessions::get_session,
            commands::tasks::start_task,
            commands::tasks::stop_task,
            commands::tasks::analyze_task,
            commands::tasks::start_team_task,
            commands::tasks::stop_team_task,
            commands::memory::list_memories,
            commands::memory::create_memory,
            commands::memory::update_memory,
            commands::memory::delete_memory,
            commands::memory::pin_memory,
            commands::memory::unpin_memory,
            commands::memory::search_memories,
            commands::memory::decay_memories,
            commands::memory::get_memory_count,
            commands::memory::extract_session_memories,
            commands::memory::build_project_context,
            commands::skills::list_skills,
            commands::skills::create_skill,
            commands::skills::update_skill,
            commands::skills::delete_skill,
            commands::mcp::list_mcp_servers,
            commands::mcp::add_mcp_server,
            commands::mcp::toggle_mcp_server,
            commands::mcp::health_check_mcp,
            commands::mcp::delete_mcp_server,
            commands::templates::list_templates,
            commands::templates::save_template,
            commands::templates::delete_template,
            commands::templates::load_template,
            commands::templates::seed_templates,
            commands::export::export_session_html,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running ELVES application");
}
