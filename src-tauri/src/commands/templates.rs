// Template Tauri commands — manage saved task plan templates.

use crate::db;
use crate::db::templates::TemplateRow;
use super::projects::DbState;
use tauri::State;

/// List all templates, built-in first then user-created.
#[tauri::command]
pub fn list_templates(
    db: State<'_, DbState>,
) -> Result<Vec<TemplateRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::templates::list_templates(&conn)
        .map_err(|e| format!("Database error: {e}"))
}

/// Save a new template (user-created). Returns the created template row.
#[tauri::command]
pub fn save_template(
    db: State<'_, DbState>,
    id: String,
    name: String,
    description: Option<String>,
    plan: String,
) -> Result<TemplateRow, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::templates::insert_template(&conn, &id, &name, description.as_deref(), &plan, false)
        .map_err(|e| format!("Database error: {e}"))
}

/// Delete a user-created template by ID. Built-in templates cannot be deleted.
/// Returns true if a template was deleted.
#[tauri::command]
pub fn delete_template(
    db: State<'_, DbState>,
    id: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::templates::delete_template(&conn, &id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Load a template by ID. Returns the template row with its full plan JSON.
#[tauri::command]
pub fn load_template(
    db: State<'_, DbState>,
    id: String,
) -> Result<Option<TemplateRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::templates::get_template(&conn, &id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Seed built-in templates if they don't exist yet. Returns count of newly seeded templates.
#[tauri::command]
pub fn seed_templates(
    db: State<'_, DbState>,
) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::templates::seed_builtin_templates(&conn)
        .map_err(|e| format!("Database error: {e}"))
}
