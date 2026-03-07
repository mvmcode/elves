// Session-related Tauri commands — CRUD operations for task execution sessions.

use crate::db;
use crate::db::events::EventRow;
use crate::db::sessions::SessionRow;
use super::projects::DbState;
use tauri::State;

/// Create a new session within a project. Generates a UUID for the session ID.
///
/// Called when the user starts a new task. The session begins with status "active".
/// Optionally links the session to a workspace via `worktree_slug`.
#[tauri::command]
pub fn create_session(
    db: State<'_, DbState>,
    project_id: String,
    task: String,
    runtime: String,
    worktree_slug: Option<String>,
) -> Result<SessionRow, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = uuid::Uuid::new_v4().to_string();
    db::sessions::create_session(&conn, &id, &project_id, &task, &runtime, worktree_slug.as_deref())
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

/// Get the most recent session for a project + workspace slug combination.
/// Used by the frontend to offer "Resume" on workspace cards.
#[tauri::command]
pub fn get_last_workspace_session(
    db: State<'_, DbState>,
    project_id: String,
    worktree_slug: String,
) -> Result<Option<SessionRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::sessions::get_last_session_for_workspace(&conn, &project_id, &worktree_slug)
        .map_err(|e| format!("Database error: {e}"))
}

/// List all events for a session, ordered chronologically.
///
/// Used by the History tab to display session output when a session card is expanded.
#[tauri::command]
pub fn list_session_events(
    db: State<'_, DbState>,
    session_id: String,
) -> Result<Vec<EventRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::events::list_events(&conn, &session_id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Mark a session as completed in the database. Sets `ended_at` to now.
///
/// Called from the frontend when a PTY process exits, so the session status
/// persists to the DB (not just in-memory store). Without this, PTY-first
/// sessions stay "active" forever in the history view.
#[tauri::command]
pub fn complete_session(
    db: State<'_, DbState>,
    session_id: String,
    status: Option<String>,
    summary: Option<String>,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let final_status = status.as_deref().unwrap_or("completed");
    db::sessions::update_session_status(&conn, &session_id, final_status, summary.as_deref())
        .map_err(|e| format!("Database error: {e}"))
}

/// Store the Claude Code session ID for a session. Enables `claude --resume` support.
///
/// Called from the frontend when a Claude session ID is detected in PTY output.
/// PTY-first sessions cannot parse JSONL (it goes to xterm.js), so the frontend
/// must detect the session ID from terminal output patterns and save it here.
#[tauri::command]
pub fn update_claude_session_id(
    db: State<'_, DbState>,
    session_id: String,
    claude_session_id: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::sessions::update_claude_session_id(&conn, &session_id, &claude_session_id)
        .map_err(|e| format!("Database error: {e}"))
}
