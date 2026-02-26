// Skill-related Tauri commands — CRUD operations exposed to the frontend.

use crate::db;
use crate::db::skills::SkillRow;
use super::projects::DbState;
use tauri::State;

/// List skills for a project (including global skills with NULL project_id).
#[tauri::command]
pub fn list_skills(
    db: State<'_, DbState>,
    project_id: Option<String>,
) -> Result<Vec<SkillRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skills::list_skills(&conn, project_id.as_deref())
        .map_err(|e| format!("Database error: {e}"))
}

/// Create a new skill. Returns the created skill row.
#[tauri::command]
pub fn create_skill(
    db: State<'_, DbState>,
    id: String,
    project_id: Option<String>,
    name: String,
    description: Option<String>,
    content: String,
    trigger_pattern: Option<String>,
) -> Result<SkillRow, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skills::insert_skill(
        &conn,
        &id,
        project_id.as_deref(),
        &name,
        description.as_deref(),
        &content,
        trigger_pattern.as_deref(),
    )
    .map_err(|e| format!("Database error: {e}"))
}

/// Update a skill's name, description, content, and trigger pattern.
/// Returns true if the skill was found and updated.
#[tauri::command]
pub fn update_skill(
    db: State<'_, DbState>,
    id: String,
    name: String,
    description: Option<String>,
    content: String,
    trigger_pattern: Option<String>,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skills::update_skill(
        &conn,
        &id,
        &name,
        description.as_deref(),
        &content,
        trigger_pattern.as_deref(),
    )
    .map_err(|e| format!("Database error: {e}"))
}

/// Delete a skill by ID. Returns true if a skill was deleted.
#[tauri::command]
pub fn delete_skill(
    db: State<'_, DbState>,
    id: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skills::delete_skill(&conn, &id)
        .map_err(|e| format!("Database error: {e}"))
}
