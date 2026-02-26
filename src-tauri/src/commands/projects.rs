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
