// ELVES Tauri backend — agent orchestration, local storage, and process management.

mod agents;
mod commands;
mod db;

use agents::process::ProcessManager;
use commands::projects::DbState;
use commands::pty::PtyManager;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

/// Build the native macOS/desktop menu bar with File, Edit, View, and Help menus.
/// Menu item clicks emit `menu:<id>` events to the frontend for dispatch.
fn build_app_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    // File menu
    let new_floor = MenuItem::with_id(app, "new_floor", "New Floor", true, Some("CmdOrCtrl+T"))?;
    let close_floor =
        MenuItem::with_id(app, "close_floor", "Close Floor", true, Some("CmdOrCtrl+W"))?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit ELVES"))?;
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&new_floor, &close_floor, &PredefinedMenuItem::separator(app)?, &quit],
    )?;

    // Edit menu — standard items required for text input to work with native menus
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // View menu
    let toggle_workshop =
        MenuItem::with_id(app, "toggle_workshop", "Toggle Workshop/Cards", true, None::<&str>)?;
    let toggle_activity =
        MenuItem::with_id(app, "toggle_activity", "Toggle Activity Feed", true, Some("CmdOrCtrl+B"))?;
    let toggle_terminal =
        MenuItem::with_id(app, "toggle_terminal", "Toggle Terminal", true, Some("CmdOrCtrl+`"))?;
    let toggle_settings =
        MenuItem::with_id(app, "toggle_settings", "Settings", true, Some("CmdOrCtrl+,"))?;
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &toggle_workshop,
            &toggle_activity,
            &toggle_terminal,
            &PredefinedMenuItem::separator(app)?,
            &toggle_settings,
        ],
    )?;

    // Help menu
    let shortcuts =
        MenuItem::with_id(app, "keyboard_shortcuts", "Keyboard Shortcuts", true, Some("CmdOrCtrl+/"))?;
    let about = MenuItem::with_id(app, "about_elves", "About ELVES", true, None::<&str>)?;
    let help_menu = Submenu::with_items(app, "Help", true, &[&shortcuts, &about])?;

    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &help_menu])
}

/// Bootstrap the Tauri application with all plugins, state, and command handlers.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_secs()
        .init();

    let db_path = db::default_db_path();
    let conn = db::open_database(&db_path).expect("Failed to open ELVES database");

    // Clean up any sessions left "active" from a previous run (crash, force quit, etc.)
    if let Ok(count) = db::sessions::cleanup_stale_sessions(&conn) {
        if count > 0 {
            log::info!("Cleaned up {count} stale active session(s) from previous run");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DbState(Mutex::new(conn)))
        .manage(ProcessManager::new())
        .manage(PtyManager::new())
        .setup(|app| {
            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            // Emit custom menu events to the frontend for those that aren't handled natively
            match id {
                "new_floor" | "close_floor" | "toggle_workshop" | "toggle_activity"
                | "toggle_terminal" | "toggle_settings" | "keyboard_shortcuts" | "about_elves" => {
                    let _ = app.emit(&format!("menu:{id}"), ());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::agents::detect_runtimes,
            commands::agents::discover_claude,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::open_project_terminal,
            commands::sessions::create_session,
            commands::sessions::list_sessions,
            commands::sessions::get_session,
            commands::sessions::list_session_events,
            commands::tasks::start_task,
            commands::tasks::stop_task,
            commands::tasks::analyze_task,
            commands::tasks::start_team_task,
            commands::tasks::stop_team_task,
            commands::tasks::transition_to_interactive,
            commands::tasks::continue_task,
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
            commands::skills::discover_skills_from_claude,
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
            commands::export::save_session_replay,
            commands::pty::spawn_pty,
            commands::pty::write_pty,
            commands::pty::resize_pty,
            commands::pty::kill_pty,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running ELVES application");
}
