// Session-related Tauri commands — CRUD operations for task execution sessions.

use crate::db;
use crate::db::sessions::SessionRow;
use super::projects::DbState;
use tauri::State;

/// Create a new session within a project. Generates a UUID for the session ID.
///
/// Called when the user starts a new task. The session begins with status "active".
#[tauri::command]
pub fn create_session(
    db: State<'_, DbState>,
    project_id: String,
    task: String,
    runtime: String,
) -> Result<SessionRow, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = uuid::Uuid::new_v4().to_string();
    db::sessions::create_session(&conn, &id, &project_id, &task, &runtime)
        .map_err(|e| format!("Database error: {e}"))
}

/// List all sessions for a project, ordered by most recently started first.
#[tauri::command]
pub fn list_sessions(
    db: State<'_, DbState>,
    project_id: String,
) -> Result<Vec<SessionRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::sessions::list_sessions(&conn, &project_id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Retrieve a single session by ID. Returns None if the session does not exist.
#[tauri::command]
pub fn get_session(
    db: State<'_, DbState>,
    id: String,
) -> Result<Option<SessionRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::sessions::get_session(&conn, &id)
        .map_err(|e| format!("Database error: {e}"))
}
