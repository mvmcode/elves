// Project-related Tauri commands — CRUD operations exposed to the frontend.

use crate::db;
use crate::db::projects::ProjectRow;
use std::sync::Mutex;
use tauri::State;

/// Shared database connection wrapped in a Mutex for thread-safe access.
pub struct DbState(pub Mutex<rusqlite::Connection>);

/// List all projects, ordered by most recently updated.
#[tauri::command]
pub fn list_projects(db: State<'_, DbState>) -> Result<Vec<ProjectRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::projects::list_projects(&conn).map_err(|e| format!("Database error: {e}"))
}

/// Create a new project with a generated UUID.
#[tauri::command]
pub fn create_project(
    db: State<'_, DbState>,
    name: String,
    path: String,
) -> Result<ProjectRow, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = uuid::Uuid::new_v4().to_string();
    db::projects::create_project(&conn, &id, &name, &path)
        .map_err(|e| format!("Database error: {e}"))
}

/// Open an external terminal at the given directory path.
/// When `claude_session_id` is provided, runs `claude --resume <id>` in the terminal.
///
/// Platform behavior:
/// - macOS: opens Terminal.app via osascript
/// - Windows: opens Windows Terminal (wt) with fallback to cmd.exe
#[tauri::command]
pub async fn open_project_terminal(
    path: String,
    claude_session_id: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(ref sid) = claude_session_id {
            let script = format!(
                r#"tell application "Terminal"
                    activate
                    do script "cd '{}' && claude --resume '{}'"
                end tell"#,
                path.replace('\'', "'\\''"),
                sid.replace('\'', "'\\''"),
            );
            std::process::Command::new("osascript")
                .args(["-e", &script])
                .spawn()
                .map_err(|e| format!("Failed to open terminal: {e}"))?;
        } else {
            std::process::Command::new("open")
                .args(["-a", "Terminal", &path])
                .spawn()
                .map_err(|e| format!("Failed to open terminal: {e}"))?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(ref sid) = claude_session_id {
            // Try Windows Terminal first, fall back to cmd.exe
            let wt_result = std::process::Command::new("wt")
                .args(["new-tab", "--startingDirectory", &path, "cmd", "/C",
                       &format!("claude --resume \"{}\"", sid)])
                .spawn();
            if wt_result.is_err() {
                std::process::Command::new("cmd")
                    .args(["/C", "start", "cmd", "/K",
                           &format!("cd /d \"{}\" && claude --resume \"{}\"", path, sid)])
                    .spawn()
                    .map_err(|e| format!("Failed to open terminal: {e}"))?;
            }
        } else {
            let wt_result = std::process::Command::new("wt")
                .args(["new-tab", "--startingDirectory", &path])
                .spawn();
            if wt_result.is_err() {
                std::process::Command::new("cmd")
                    .args(["/C", "start", "cmd", "/K", &format!("cd /d \"{}\"", path)])
                    .spawn()
                    .map_err(|e| format!("Failed to open terminal: {e}"))?;
            }
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // Linux: try common terminals
        let term_cmd = if let Some(ref sid) = claude_session_id {
            format!("cd '{}' && claude --resume '{}'", path, sid)
        } else {
            format!("cd '{}'", path)
        };
        // Try xterm, gnome-terminal, konsole in order
        let _ = std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .or_else(|_| {
                std::process::Command::new("gnome-terminal")
                    .args(["--working-directory", &path, "--", "bash", "-c", &term_cmd])
                    .spawn()
            })
            .map_err(|e| format!("Failed to open terminal: {e}"))?;
    }

    Ok(())
}
