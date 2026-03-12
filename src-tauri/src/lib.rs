// ELVES Tauri backend — agent orchestration, local storage, and process management.

mod agents;
mod commands;
mod db;
mod project;
mod registry;

use agents::process::ProcessManager;
use commands::projects::DbState;
use commands::pty::PtyManager;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
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

    // Resolve full user PATH for macOS .app bundles (Finder/Dock get minimal PATH)
    agents::runtime::ensure_full_path();

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DbState(Mutex::new(conn)))
        .manage(ProcessManager::new())
        .manage(PtyManager::new())
        .setup(|app| {
            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;

            // Workaround for WKWebView bug where the webview gets stuck at the wrong
            // size after minimize/restore on macOS (tauri-apps/tauri#14843).
            // On re-focus, nudge the window size by 1px and immediately restore it,
            // forcing WKWebView to recalculate its layout.
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let was_unfocused = Arc::new(AtomicBool::new(false));
                    let flag = was_unfocused.clone();
                    let win = window.clone();

                    window.on_window_event(move |event| {
                        match event {
                            tauri::WindowEvent::Focused(false) => {
                                flag.store(true, Ordering::Relaxed);
                            }
                            tauri::WindowEvent::Focused(true) => {
                                if !flag.swap(false, Ordering::Relaxed) {
                                    return;
                                }
                                // Spawn a thread to avoid blocking the main event loop.
                                // The 16ms sleep (one frame) lets WKWebView process the
                                // first set_size before we restore the original.
                                let win2 = win.clone();
                                std::thread::spawn(move || {
                                    if let Ok(size) = win2.outer_size() {
                                        let nudged = tauri::PhysicalSize::new(
                                            size.width.saturating_sub(1),
                                            size.height,
                                        );
                                        let _ = win2.set_size(tauri::Size::Physical(nudged));
                                        std::thread::sleep(std::time::Duration::from_millis(16));
                                        let _ = win2.set_size(tauri::Size::Physical(size));
                                    }
                                });
                            }
                            _ => {}
                        }
                    });
                }
            }

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
            commands::agents::health_check_runtime,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::open_project_terminal,
            commands::sessions::create_session,
            commands::sessions::list_sessions,
            commands::sessions::get_session,
            commands::sessions::get_last_workspace_session,
            commands::sessions::list_session_events,
            commands::sessions::complete_session,
            commands::sessions::update_claude_session_id,
            commands::tasks::start_task,
            commands::tasks::start_task_pty,
            commands::tasks::stop_task,
            commands::tasks::analyze_task,
            commands::tasks::start_team_task,
            commands::tasks::start_team_task_pty,
            commands::tasks::stop_team_task,
            commands::tasks::transition_to_interactive,
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
            commands::memory::store_pty_session_output,
            commands::memory::build_project_context,
            commands::memory::write_text_to_file,
            commands::memory::read_text_from_file,
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
            commands::mcp::import_mcp_from_claude,
            commands::mcp::load_mcp_catalog,
            commands::mcp::list_mcp_tools,
            commands::templates::list_templates,
            commands::templates::save_template,
            commands::templates::delete_template,
            commands::templates::load_template,
            commands::templates::seed_templates,
            commands::export::export_session_html,
            commands::export::save_session_replay,
            commands::pty::spawn_pty,
            commands::pty::register_pty_for_memory,
            commands::pty::write_pty,
            commands::pty::resize_pty,
            commands::pty::kill_pty,
            commands::pty::check_pty_exists,
            commands::filesystem::list_directory,
            commands::filesystem::git_status,
            commands::git::git_branch,
            commands::git::git_log,
            commands::git::git_diff,
            commands::git::git_diff_staged,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_switch_branch,
            commands::git::git_worktree_list,
            commands::git::git_worktree_add,
            commands::git::git_worktree_remove,
            commands::git::get_git_state,
            commands::git::create_branch,
            commands::git::delete_branch,
            commands::git::get_branch_diff,
            commands::workspace::create_workspace,
            commands::workspace::list_workspaces,
            commands::workspace::get_workspace_diff,
            commands::workspace::push_workspace,
            commands::workspace::create_pr_from_workspace,
            commands::workspace::merge_workspace,
            commands::workspace::remove_workspace,
            commands::workspace::complete_workspace,
            commands::workspace::init_elves_dir,
            commands::workspace::read_project_config,
            commands::workspace::write_project_config,
            commands::workspace::discover_git_repos,
            commands::workspace::create_multi_repo_workspace,
            commands::workspace::list_multi_repo_workspaces,
            commands::workspace::get_multi_repo_workspace_diff,
            commands::workspace::complete_multi_repo_workspace,
            commands::workspace::remove_multi_repo_workspace,
            commands::workspace::push_multi_repo_workspace,
            commands::search::search_mcp_servers,
            commands::updates::check_homebrew_update,
            commands::registry::refresh_skill_catalog,
            commands::registry::list_skill_sources,
            commands::registry::browse_source_skills,
            commands::registry::preview_skill_content,
            commands::registry::install_selected_skills,
            commands::registry::toggle_skill,
            commands::registry::check_skill_updates,
            commands::registry::search_skills_v2,
            commands::registry::list_all_catalog_skills,
            commands::registry::install_skill,
            commands::registry::search_github_catalog,
            commands::insights::load_insights,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running ELVES application");
}
