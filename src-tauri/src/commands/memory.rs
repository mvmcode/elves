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

/// Strip ANSI escape codes from a string.
pub(crate) fn strip_ansi(input: &str) -> String {
    // Matches: ESC[ ... final_byte, ESC] ... ST, and other CSI/OSC sequences
    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            // ESC[ (CSI) sequences: consume until final byte [A-Za-z]
            if chars.peek() == Some(&'[') {
                chars.next(); // consume '['
                while let Some(&c) = chars.peek() {
                    chars.next();
                    if c.is_ascii_alphabetic() || c == '~' {
                        break;
                    }
                }
            }
            // ESC] (OSC) sequences: consume until BEL or ST
            else if chars.peek() == Some(&']') {
                chars.next();
                while let Some(&c) = chars.peek() {
                    chars.next();
                    if c == '\x07' {
                        break;
                    }
                    // String Terminator: ESC backslash
                    if c == '\x1b' && chars.peek() == Some(&'\\') {
                        chars.next();
                        break;
                    }
                }
            }
            // ESC followed by single character (e.g. ESC(B): skip one more
            else {
                chars.next();
            }
        }
        // Skip other control characters except newline, tab, carriage return
        else if ch.is_ascii_control() && ch != '\n' && ch != '\t' && ch != '\r' {
            continue;
        } else {
            result.push(ch);
        }
    }

    result
}

/// Store already-stripped terminal output as chunked "output" events in the DB.
///
/// Consolidates lines into ~500-char chunks and inserts them as events.
/// Called both from the Tauri command and from the Rust-side PTY exit handler.
/// Returns the number of chunks stored.
pub(crate) fn store_terminal_output_as_events(
    conn: &rusqlite::Connection,
    session_id: &str,
    stripped: &str,
) -> Result<usize, String> {
    if stripped.trim().is_empty() {
        return Ok(0);
    }

    // Consolidate terminal lines into meaningful chunks (~500 chars each).
    // Terminal output uses single newlines, not paragraphs, so we accumulate
    // lines into fixed-size chunks that the memory extractor can analyze.
    let lines: Vec<&str> = stripped.lines().collect();
    let mut chunks: Vec<String> = Vec::new();
    let mut current_chunk = String::new();

    for line in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            // Blank line acts as a soft break — flush if chunk is large enough
            if current_chunk.len() > 200 {
                chunks.push(std::mem::take(&mut current_chunk));
            }
            continue;
        }
        if !current_chunk.is_empty() {
            current_chunk.push('\n');
        }
        current_chunk.push_str(trimmed);

        // Flush at ~500 chars to keep chunks digestible
        if current_chunk.len() >= 500 {
            chunks.push(std::mem::take(&mut current_chunk));
        }
    }
    // Flush remainder
    if current_chunk.len() > 50 {
        chunks.push(current_chunk);
    }

    let mut stored = 0;
    // Cap at 50 chunks to avoid flooding the DB with a huge session
    for chunk in chunks.iter().take(50) {
        if let Err(e) = db::events::insert_event(
            conn,
            session_id,
            None,
            "output",
            chunk,
            None,
        ) {
            log::warn!("Failed to store PTY output chunk for session {session_id}: {e}");
        } else {
            stored += 1;
        }
    }

    log::info!(
        "[session {session_id}] Stored {stored} output chunks from PTY terminal ({} chars stripped)",
        stripped.len()
    );

    Ok(stored)
}

/// Store terminal output from a PTY session as events for memory extraction.
///
/// PTY-mode sessions stream raw terminal data (with ANSI codes) that bypasses
/// the structured event pipeline. This command bridges the gap by accepting
/// accumulated terminal text, stripping ANSI escape codes, splitting into
/// meaningful chunks, and storing them as "output" events in the events table.
///
/// Called by the frontend just before memory extraction on PTY session exit.
#[tauri::command]
pub fn store_pty_session_output(
    db: State<'_, DbState>,
    session_id: String,
    output: String,
) -> Result<usize, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let stripped = strip_ansi(&output);
    store_terminal_output_as_events(&conn, &session_id, &stripped)
}
