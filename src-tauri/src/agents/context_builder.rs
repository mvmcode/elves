// Context builder — assembles project memory into a markdown block for agent injection.

use rusqlite::Connection;
use std::collections::HashSet;

use crate::db::memory::{self, MemoryQuery, MemoryRow};
use crate::db::DbError;

/// Build a markdown context block from project memories for agent injection.
///
/// Queries the top memories by relevance, recent decisions, and all pinned entries.
/// Deduplicates, formats into labeled sections, and boosts relevance for each
/// memory used (so frequently injected memories stay relevant).
///
/// Returns a formatted markdown string with sections:
/// - **What We Know**: General context entries
/// - **Past Decisions**: Decision-category memories
/// - **Lessons Learned**: Learning-category memories
/// - **Preferences**: Preference-category memories
///
/// Returns an empty string if no memories exist for the project.
pub fn build_context(conn: &Connection, project_id: &str) -> Result<String, DbError> {
    // 1. Query top 10 by relevance (any category)
    let top_relevant = memory::query_memories(
        conn,
        Some(project_id),
        &MemoryQuery {
            min_relevance: Some(0.1),
            limit: Some(10),
            sort_by: Some("relevance".to_string()),
            ..Default::default()
        },
    )?;

    // 2. Query top 5 recent decisions
    let recent_decisions = memory::query_memories(
        conn,
        Some(project_id),
        &MemoryQuery {
            category: Some("decision".to_string()),
            limit: Some(5),
            sort_by: Some("created_at".to_string()),
            ..Default::default()
        },
    )?;

    // 3. Query all pinned memories (source = 'pinned')
    let all_project = memory::query_memories(
        conn,
        Some(project_id),
        &MemoryQuery {
            limit: Some(100),
            ..Default::default()
        },
    )?;
    let pinned: Vec<MemoryRow> = all_project
        .into_iter()
        .filter(|m| m.source.as_deref() == Some("pinned"))
        .collect();

    // Merge all sources: pinned first (highest priority), then top relevant, then recent decisions.
    // Deduplicate by ID — first occurrence wins.
    let mut seen_ids: HashSet<i64> = HashSet::new();
    let mut all_memories: Vec<MemoryRow> = Vec::new();

    for source_list in [pinned, top_relevant, recent_decisions] {
        for mem in source_list {
            if seen_ids.insert(mem.id) {
                all_memories.push(mem);
            }
        }
    }

    if all_memories.is_empty() {
        return Ok(String::new());
    }

    // Boost relevance for each used memory
    for mem in &all_memories {
        let _ = memory::update_relevance(conn, mem.id);
    }

    // Categorize into sections
    let mut context_entries: Vec<&MemoryRow> = Vec::new();
    let mut decision_entries: Vec<&MemoryRow> = Vec::new();
    let mut learning_entries: Vec<&MemoryRow> = Vec::new();
    let mut preference_entries: Vec<&MemoryRow> = Vec::new();

    for mem in &all_memories {
        match mem.category.as_str() {
            "decision" => decision_entries.push(mem),
            "learning" => learning_entries.push(mem),
            "preference" => preference_entries.push(mem),
            _ => context_entries.push(mem),
        }
    }

    // Build markdown sections
    let mut sections: Vec<String> = Vec::new();
    sections.push("# Project Memory".to_string());

    if !context_entries.is_empty() {
        sections.push("\n## What We Know".to_string());
        for mem in &context_entries {
            sections.push(format!("- {}", mem.content));
        }
    }

    if !decision_entries.is_empty() {
        sections.push("\n## Past Decisions".to_string());
        for mem in &decision_entries {
            sections.push(format!("- {}", mem.content));
        }
    }

    if !learning_entries.is_empty() {
        sections.push("\n## Lessons Learned".to_string());
        for mem in &learning_entries {
            sections.push(format!("- {}", mem.content));
        }
    }

    if !preference_entries.is_empty() {
        sections.push("\n## Preferences".to_string());
        for mem in &preference_entries {
            sections.push(format!("- {}", mem.content));
        }
    }

    Ok(sections.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{memory, schema};
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::run_migrations(&conn).expect("Migrations should succeed");
        conn
    }

    fn seed_project(conn: &Connection, id: &str) {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT OR IGNORE INTO projects (id, name, path, default_runtime, created_at, updated_at)
             VALUES (?1, 'Test Project', '/tmp/test', 'claude-code', ?2, ?3)",
            rusqlite::params![id, now, now],
        )
        .expect("Should seed project");
    }

    #[test]
    fn empty_project_returns_empty_string() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.is_empty());
    }

    #[test]
    fn builds_context_section() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "context",
            "The API uses REST with JSON payloads",
            None,
            "[]",
        )
        .unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("# Project Memory"));
        assert!(context.contains("## What We Know"));
        assert!(context.contains("The API uses REST with JSON payloads"));
    }

    #[test]
    fn builds_decisions_section() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "decision",
            "We chose PostgreSQL for the database",
            None,
            "[]",
        )
        .unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("## Past Decisions"));
        assert!(context.contains("We chose PostgreSQL"));
    }

    #[test]
    fn builds_learnings_section() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "learning",
            "Rate limit is 100 req/min",
            None,
            "[]",
        )
        .unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("## Lessons Learned"));
        assert!(context.contains("Rate limit is 100 req/min"));
    }

    #[test]
    fn builds_preferences_section() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "preference",
            "User prefers dark mode",
            None,
            "[]",
        )
        .unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("## Preferences"));
        assert!(context.contains("User prefers dark mode"));
    }

    #[test]
    fn builds_multiple_sections() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(&conn, Some("proj-1"), "context", "API is REST", None, "[]").unwrap();
        memory::insert_memory(&conn, Some("proj-1"), "decision", "Chose React", None, "[]").unwrap();
        memory::insert_memory(&conn, Some("proj-1"), "learning", "Cache helps", None, "[]").unwrap();
        memory::insert_memory(&conn, Some("proj-1"), "preference", "Dark mode", None, "[]").unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("## What We Know"));
        assert!(context.contains("## Past Decisions"));
        assert!(context.contains("## Lessons Learned"));
        assert!(context.contains("## Preferences"));
    }

    #[test]
    fn deduplicates_across_queries() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        // This decision will appear in both top-relevant AND recent-decisions queries
        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "decision",
            "Unique decision content",
            None,
            "[]",
        )
        .unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        let count = context.matches("Unique decision content").count();
        assert_eq!(count, 1, "Decision should appear exactly once");
    }

    #[test]
    fn pinned_memories_always_included() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let mem = memory::insert_memory(
            &conn,
            Some("proj-1"),
            "context",
            "Pinned important fact",
            None,
            "[]",
        )
        .unwrap();

        // Lower its relevance to ensure it would be excluded by relevance alone
        conn.execute(
            "UPDATE memory SET relevance_score = 0.01 WHERE id = ?1",
            rusqlite::params![mem.id],
        )
        .unwrap();

        // Pin it
        memory::pin_memory(&conn, mem.id).unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("Pinned important fact"));
    }

    #[test]
    fn boosts_relevance_for_used_memories() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        // Insert with low relevance
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES ('proj-1', 'context', 'Boost me', NULL, '[]', 1000, 1000, 0.5)",
            [],
        ).unwrap();
        let id = conn.last_insert_rowid();

        build_context(&conn, "proj-1").expect("Should build");

        let mem = memory::get_memory(&conn, id).unwrap().unwrap();
        assert!(
            mem.relevance_score > 0.5,
            "Relevance should have been boosted: {}",
            mem.relevance_score
        );
    }

    #[test]
    fn includes_global_memories() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        // Global memory (no project_id)
        memory::insert_memory(&conn, None, "preference", "Always use TypeScript", None, "[]").unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("Always use TypeScript"));
    }

    #[test]
    fn respects_relevance_threshold() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        // Insert memory with very low relevance
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES ('proj-1', 'context', 'Very stale memory', NULL, '[]', 1000, 1000, 0.05)",
            [],
        ).unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(!context.contains("Very stale memory"), "Low-relevance memory should be excluded");
    }

    #[test]
    fn formats_as_markdown_list() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(&conn, Some("proj-1"), "context", "Fact one", None, "[]").unwrap();
        memory::insert_memory(&conn, Some("proj-1"), "context", "Fact two", None, "[]").unwrap();

        let context = build_context(&conn, "proj-1").expect("Should build");
        assert!(context.contains("- Fact one"));
        assert!(context.contains("- Fact two"));
    }
}
