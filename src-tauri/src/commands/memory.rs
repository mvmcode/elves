// Memory-related Tauri commands — CRUD, search, pin, decay operations exposed to the frontend.

use crate::agents::context_builder;
use crate::agents::memory_extractor::{self, ExtractionResult};
use crate::db;
use crate::db::memory::{MemoryQuery, MemoryRow};
use super::projects::DbState;
use tauri::State;

/// List memories for a project with optional filters.
///
/// Accepts optional category, min_relevance, limit, and sort_by parameters.
/// Returns project-scoped memories plus global memories (NULL project_id).
#[tauri::command]
pub fn list_memories(
    db: State<'_, DbState>,
    project_id: Option<String>,
    category: Option<String>,
    min_relevance: Option<f64>,
    limit: Option<i64>,
    sort_by: Option<String>,
) -> Result<Vec<MemoryRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let query = MemoryQuery {
        category,
        min_relevance,
        limit,
        sort_by,
    };
    db::memory::query_memories(&conn, project_id.as_deref(), &query)
        .map_err(|e| format!("Database error: {e}"))
}

/// Create a new memory entry. Returns the created memory row.
#[tauri::command]
pub fn create_memory(
    db: State<'_, DbState>,
    project_id: Option<String>,
    category: String,
    content: String,
    source: Option<String>,
    tags: Option<String>,
) -> Result<MemoryRow, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let tags_str = tags.as_deref().unwrap_or("[]");
    db::memory::insert_memory(
        &conn,
        project_id.as_deref(),
        &category,
        &content,
        source.as_deref(),
        tags_str,
    )
    .map_err(|e| format!("Database error: {e}"))
}

/// Update a memory's content. Returns true if the memory was found and updated.
#[tauri::command]
pub fn update_memory(
    db: State<'_, DbState>,
    id: i64,
    content: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::memory::update_memory_content(&conn, id, &content)
        .map_err(|e| format!("Database error: {e}"))
}

/// Delete a memory by ID. Returns true if a memory was deleted.
#[tauri::command]
pub fn delete_memory(
    db: State<'_, DbState>,
    id: i64,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::memory::delete_memory(&conn, id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Pin a memory: sets relevance to 1.0 and prevents decay.
#[tauri::command]
pub fn pin_memory(
    db: State<'_, DbState>,
    id: i64,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::memory::pin_memory(&conn, id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Unpin a memory: removes pinned status and allows decay to resume.
#[tauri::command]
pub fn unpin_memory(
    db: State<'_, DbState>,
    id: i64,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::memory::unpin_memory(&conn, id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Full-text search over memories using FTS5.
///
/// Searches content, category, and tags. Results ranked by FTS5 bm25 relevance.
#[tauri::command]
pub fn search_memories(
    db: State<'_, DbState>,
    project_id: Option<String>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<MemoryRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::memory::search_memories(&conn, project_id.as_deref(), &query, limit.unwrap_or(20))
        .map_err(|e| format!("Database error: {e}"))
}

/// Decay all non-pinned memory relevance scores. Called periodically (e.g., on app start).
///
/// Returns the number of memories whose scores were adjusted.
#[tauri::command]
pub fn decay_memories(
    db: State<'_, DbState>,
) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::memory::decay_memories(&conn)
        .map_err(|e| format!("Database error: {e}"))
}

/// Get the total count of memories for a project (including global memories).
#[tauri::command]
pub fn get_memory_count(
    db: State<'_, DbState>,
    project_id: Option<String>,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::memory::count_memories(&conn, project_id.as_deref())
        .map_err(|e| format!("Database error: {e}"))
}

/// Extract memories from a completed session's event stream.
///
/// Reads all events, applies heuristic pattern matching to categorize content,
/// deduplicates, and inserts new memory entries. Returns the extraction result
/// including created memories and a session summary.
#[tauri::command]
pub fn extract_session_memories(
    db: State<'_, DbState>,
    session_id: String,
) -> Result<ExtractionResult, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    memory_extractor::extract_memories(&conn, &session_id)
        .map_err(|e| format!("Extraction error: {e}"))
}

/// Build a markdown context block from project memories for agent injection.
///
/// Queries top memories by relevance, recent decisions, and pinned entries.
/// Formats into a structured markdown document with labeled sections.
/// Boosts relevance for each memory used, keeping useful memories fresh.
///
/// Returns the markdown string, or an empty string if no memories exist.
#[tauri::command]
pub fn build_project_context(
    db: State<'_, DbState>,
    project_id: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    context_builder::build_context(&conn, &project_id)
        .map_err(|e| format!("Context build error: {e}"))
}

/// Write a string to a file at the given path. Used for memory export.
#[tauri::command]
pub fn write_text_to_file(
    file_path: String,
    content: String,
) -> Result<(), String> {
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file {file_path}: {e}"))
}

/// Read a file as a string. Used for memory import.
#[tauri::command]
pub fn read_text_from_file(
    file_path: String,
) -> Result<String, String> {
    std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file {file_path}: {e}"))
}
