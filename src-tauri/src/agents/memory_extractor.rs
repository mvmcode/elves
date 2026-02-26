// Memory extractor — heuristic post-session summarizer that extracts memories from events.

use rusqlite::Connection;
use serde::Serialize;

use crate::db::events::{self, EventRow};
use crate::db::memory::{self, MemoryRow};
use crate::db::DbError;

/// Result of a memory extraction pass on a completed session.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionResult {
    /// Newly created memory entries from this session.
    pub memories: Vec<MemoryRow>,
    /// Human-readable summary of the session.
    pub session_summary: String,
    /// Number of events processed.
    pub events_processed: usize,
}

/// Keyword patterns that signal a decision was made.
const DECISION_KEYWORDS: &[&str] = &[
    "decided",
    "chose",
    "selected",
    "picked",
    "went with",
    "opted for",
    "settled on",
    "choosing",
    "decision:",
];

/// Keyword patterns that signal a lesson was learned (error + resolution).
const LEARNING_KEYWORDS: &[&str] = &[
    "learned",
    "realized",
    "discovered",
    "found out",
    "turns out",
    "the fix was",
    "the solution was",
    "resolved by",
    "fixed by",
    "worked around",
    "the issue was",
    "root cause",
];

/// Extract memories from a completed session's event stream.
///
/// Reads all events for the session, applies heuristic pattern matching to
/// categorize content, deduplicates, and inserts new memory entries. Also
/// generates a session summary.
///
/// Categories extracted:
/// - `context`: General output and tool usage patterns
/// - `decision`: Events containing decision-related keywords
/// - `learning`: Error events followed by resolution patterns
///
/// Returns an `ExtractionResult` with the created memories and summary.
pub fn extract_memories(
    conn: &Connection,
    session_id: &str,
) -> Result<ExtractionResult, DbError> {
    let session_events = events::list_events(conn, session_id)?;
    let events_processed = session_events.len();

    if session_events.is_empty() {
        return Ok(ExtractionResult {
            memories: Vec::new(),
            session_summary: "No events recorded in this session.".to_string(),
            events_processed: 0,
        });
    }

    // Look up the project_id for this session so memories are scoped correctly
    let project_id: Option<String> = conn
        .query_row(
            "SELECT project_id FROM sessions WHERE id = ?1",
            rusqlite::params![session_id],
            |row| row.get(0),
        )
        .ok();

    let mut extracted: Vec<ExtractedEntry> = Vec::new();

    for event in &session_events {
        extract_from_event(event, &mut extracted);
    }

    // Deduplicate by normalized content
    deduplicate(&mut extracted);

    // Insert memories into the database
    let source = format!("session:{session_id}");
    let mut created_memories: Vec<MemoryRow> = Vec::new();

    for entry in &extracted {
        let tags = serde_json::to_string(&entry.tags).unwrap_or_else(|_| "[]".to_string());
        let mem = memory::insert_memory(
            conn,
            project_id.as_deref(),
            &entry.category,
            &entry.content,
            Some(&source),
            &tags,
        )?;
        created_memories.push(mem);
    }

    // Generate session summary
    let session_summary = build_session_summary(&session_events, &extracted);

    Ok(ExtractionResult {
        memories: created_memories,
        session_summary,
        events_processed,
    })
}

/// Internal representation of a memory candidate before insertion.
struct ExtractedEntry {
    category: String,
    content: String,
    tags: Vec<String>,
}

/// Extract memory candidates from a single event based on type and content patterns.
fn extract_from_event(event: &EventRow, entries: &mut Vec<ExtractedEntry>) {
    let payload_lower = event.payload.to_lowercase();

    match event.event_type.as_str() {
        // Output events contain agent reasoning — extract as context
        "output" | "assistant" | "text" => {
            // Check for decision patterns first (higher priority)
            if contains_any(&payload_lower, DECISION_KEYWORDS) {
                entries.push(ExtractedEntry {
                    category: "decision".to_string(),
                    content: truncate_content(&event.payload, 500),
                    tags: vec!["auto-extracted".to_string()],
                });
            }
            // Check for learning patterns
            else if contains_any(&payload_lower, LEARNING_KEYWORDS) {
                entries.push(ExtractedEntry {
                    category: "learning".to_string(),
                    content: truncate_content(&event.payload, 500),
                    tags: vec!["auto-extracted".to_string()],
                });
            }
            // Long output events are likely substantive context
            else if event.payload.len() > 100 {
                entries.push(ExtractedEntry {
                    category: "context".to_string(),
                    content: truncate_content(&event.payload, 300),
                    tags: vec!["auto-extracted".to_string()],
                });
            }
        }

        // Tool calls reveal what the agent did — useful context
        "tool_use" | "tool_call" => {
            entries.push(ExtractedEntry {
                category: "context".to_string(),
                content: format!("Tool used: {}", truncate_content(&event.payload, 200)),
                tags: vec!["auto-extracted".to_string(), "tool-usage".to_string()],
            });
        }

        // Error events paired with subsequent resolution → learning
        "error" => {
            entries.push(ExtractedEntry {
                category: "learning".to_string(),
                content: format!("Error encountered: {}", truncate_content(&event.payload, 300)),
                tags: vec!["auto-extracted".to_string(), "error".to_string()],
            });
        }

        _ => {}
    }
}

/// Check if text contains any of the given keyword patterns.
fn contains_any(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|kw| text.contains(kw))
}

/// Truncate content to a maximum length, adding "..." if truncated.
fn truncate_content(content: &str, max_len: usize) -> String {
    if content.len() <= max_len {
        content.to_string()
    } else {
        let truncated: String = content.chars().take(max_len).collect();
        format!("{truncated}...")
    }
}

/// Remove duplicate entries by comparing normalized content.
///
/// Two entries are considered duplicates if their first 100 characters match
/// after lowercasing and whitespace normalization.
fn deduplicate(entries: &mut Vec<ExtractedEntry>) {
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    entries.retain(|entry| {
        let normalized: String = entry
            .content
            .to_lowercase()
            .chars()
            .take(100)
            .filter(|c| !c.is_whitespace())
            .collect();
        seen.insert(normalized)
    });
}

/// Build a human-readable session summary from events and extracted entries.
fn build_session_summary(events: &[EventRow], extracted: &[ExtractedEntry]) -> String {
    let total_events = events.len();
    let tool_uses = events
        .iter()
        .filter(|e| e.event_type == "tool_use" || e.event_type == "tool_call")
        .count();
    let errors = events
        .iter()
        .filter(|e| e.event_type == "error")
        .count();

    let decision_count = extracted.iter().filter(|e| e.category == "decision").count();
    let learning_count = extracted.iter().filter(|e| e.category == "learning").count();
    let context_count = extracted.iter().filter(|e| e.category == "context").count();

    let mut summary_parts: Vec<String> = Vec::new();
    summary_parts.push(format!("Session processed {total_events} events"));

    if tool_uses > 0 {
        summary_parts.push(format!("{tool_uses} tool calls"));
    }
    if errors > 0 {
        summary_parts.push(format!("{errors} errors"));
    }

    let mut memory_parts: Vec<String> = Vec::new();
    if context_count > 0 {
        memory_parts.push(format!("{context_count} context"));
    }
    if decision_count > 0 {
        memory_parts.push(format!("{decision_count} decisions"));
    }
    if learning_count > 0 {
        memory_parts.push(format!("{learning_count} learnings"));
    }

    if memory_parts.is_empty() {
        format!("{}. No memories extracted.", summary_parts.join(", "))
    } else {
        format!(
            "{}. Extracted {} memories: {}.",
            summary_parts.join(", "),
            extracted.len(),
            memory_parts.join(", ")
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{events, schema};
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::run_migrations(&conn).expect("Migrations should succeed");
        conn
    }

    fn seed_session(conn: &Connection, project_id: &str, session_id: &str) {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT OR IGNORE INTO projects (id, name, path, default_runtime, created_at, updated_at)
             VALUES (?1, 'Test Project', '/tmp/test', 'claude-code', ?2, ?3)",
            rusqlite::params![project_id, now, now],
        )
        .expect("Should seed project");
        conn.execute(
            "INSERT INTO sessions (id, project_id, task, runtime, status, agent_count, started_at, tokens_used, cost_estimate)
             VALUES (?1, ?2, 'Test task', 'claude-code', 'completed', 1, ?3, 0, 0.0)",
            rusqlite::params![session_id, project_id, now],
        )
        .expect("Should seed session");
    }

    #[test]
    fn extract_from_empty_session() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert!(result.memories.is_empty());
        assert_eq!(result.events_processed, 0);
        assert!(result.session_summary.contains("No events"));
    }

    #[test]
    fn extract_context_from_output_events() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        // Insert an output event with substantial content (>100 chars)
        let long_payload = "x".repeat(150);
        events::insert_event(&conn, "sess-1", None, "output", &long_payload, None).unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories.len(), 1);
        assert_eq!(result.memories[0].category, "context");
        assert_eq!(result.events_processed, 1);
    }

    #[test]
    fn extract_decision_from_output_events() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        events::insert_event(
            &conn,
            "sess-1",
            None,
            "output",
            "We decided to use PostgreSQL for the main database because of its JSON support",
            None,
        )
        .unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories.len(), 1);
        assert_eq!(result.memories[0].category, "decision");
    }

    #[test]
    fn extract_learning_from_output_events() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        events::insert_event(
            &conn,
            "sess-1",
            None,
            "output",
            "We learned that the API rate limit is 100 requests per minute and discovered the retry-after header",
            None,
        )
        .unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories.len(), 1);
        assert_eq!(result.memories[0].category, "learning");
    }

    #[test]
    fn extract_context_from_tool_calls() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        events::insert_event(
            &conn,
            "sess-1",
            None,
            "tool_use",
            r#"{"tool":"read_file","path":"src/main.rs"}"#,
            None,
        )
        .unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories.len(), 1);
        assert_eq!(result.memories[0].category, "context");
        assert!(result.memories[0].content.contains("Tool used:"));
    }

    #[test]
    fn extract_learning_from_error_events() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        events::insert_event(
            &conn,
            "sess-1",
            None,
            "error",
            "Connection refused: port 5432 not available",
            None,
        )
        .unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories.len(), 1);
        assert_eq!(result.memories[0].category, "learning");
        assert!(result.memories[0].content.contains("Error encountered:"));
    }

    #[test]
    fn extract_deduplicates_similar_content() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        // Two output events with nearly identical content
        let content = "a".repeat(150);
        events::insert_event(&conn, "sess-1", None, "output", &content, None).unwrap();
        events::insert_event(&conn, "sess-1", None, "output", &content, None).unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories.len(), 1, "Duplicates should be removed");
    }

    #[test]
    fn extract_multiple_categories() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        events::insert_event(
            &conn,
            "sess-1",
            None,
            "output",
            "We chose React over Vue for the frontend framework because of ecosystem maturity",
            None,
        )
        .unwrap();
        events::insert_event(
            &conn,
            "sess-1",
            None,
            "tool_use",
            r#"{"tool":"write_file","path":"src/App.tsx"}"#,
            None,
        )
        .unwrap();
        events::insert_event(
            &conn,
            "sess-1",
            None,
            "error",
            "Module not found: react-router-dom",
            None,
        )
        .unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories.len(), 3);

        let categories: Vec<&str> = result.memories.iter().map(|m| m.category.as_str()).collect();
        assert!(categories.contains(&"decision"));
        assert!(categories.contains(&"context"));
        assert!(categories.contains(&"learning"));
    }

    #[test]
    fn extract_sets_correct_source() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let content = "b".repeat(150);
        events::insert_event(&conn, "sess-1", None, "output", &content, None).unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories[0].source.as_deref(), Some("session:sess-1"));
    }

    #[test]
    fn extract_scopes_to_project() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let content = "c".repeat(150);
        events::insert_event(&conn, "sess-1", None, "output", &content, None).unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert_eq!(result.memories[0].project_id.as_deref(), Some("proj-1"));
    }

    #[test]
    fn session_summary_includes_counts() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        events::insert_event(&conn, "sess-1", None, "output", &"d".repeat(150), None).unwrap();
        events::insert_event(
            &conn,
            "sess-1",
            None,
            "tool_use",
            r#"{"tool":"read"}"#,
            None,
        )
        .unwrap();
        events::insert_event(&conn, "sess-1", None, "error", "Oops", None).unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert!(result.session_summary.contains("3 events"));
        assert!(result.session_summary.contains("1 tool calls"));
        assert!(result.session_summary.contains("1 errors"));
    }

    #[test]
    fn short_output_events_are_skipped() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        // Short output (<= 100 chars, no keywords) should not produce a memory
        events::insert_event(&conn, "sess-1", None, "output", "ok", None).unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert!(result.memories.is_empty());
    }

    #[test]
    fn unknown_event_types_are_skipped() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        events::insert_event(&conn, "sess-1", None, "heartbeat", "{}", None).unwrap();

        let result = extract_memories(&conn, "sess-1").expect("Should extract");
        assert!(result.memories.is_empty());
    }

    #[test]
    fn truncate_content_long_payload() {
        let long = "a".repeat(600);
        let truncated = truncate_content(&long, 500);
        assert_eq!(truncated.len(), 503); // 500 + "..."
        assert!(truncated.ends_with("..."));
    }

    #[test]
    fn truncate_content_short_payload() {
        let short = "hello";
        let result = truncate_content(short, 500);
        assert_eq!(result, "hello");
    }

    #[test]
    fn contains_any_finds_patterns() {
        assert!(contains_any("we decided to use rust", DECISION_KEYWORDS));
        assert!(contains_any("we chose postgresql", DECISION_KEYWORDS));
        assert!(!contains_any("we wrote some code", DECISION_KEYWORDS));
    }

    #[test]
    fn extraction_result_serializes_to_camel_case() {
        let result = ExtractionResult {
            memories: Vec::new(),
            session_summary: "Summary".to_string(),
            events_processed: 5,
        };
        let json = serde_json::to_string(&result).expect("Should serialize");
        assert!(json.contains("sessionSummary"));
        assert!(json.contains("eventsProcessed"));
    }
}
