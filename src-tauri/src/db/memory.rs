// Memory CRUD operations — create, read, update, delete, search, pin, and decay memory entries.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::DbError;

/// A memory row from the database, serialized to camelCase JSON for the frontend.
/// Memories persist cross-session context: decisions, learnings, preferences, and facts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRow {
    pub id: i64,
    pub project_id: Option<String>,
    /// One of: "context", "decision", "learning", "preference".
    pub category: String,
    pub content: String,
    /// Where this memory came from (e.g., session ID, "user", "pinned").
    pub source: Option<String>,
    /// JSON array of string tags for filtering.
    pub tags: String,
    pub created_at: i64,
    pub accessed_at: i64,
    /// Relevance score in [0.0, 1.0]. Decays over time, boosted on access.
    pub relevance_score: f64,
}

/// Optional filters for querying memories.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryQuery {
    pub category: Option<String>,
    pub min_relevance: Option<f64>,
    pub limit: Option<i64>,
    pub sort_by: Option<String>,
}

/// Insert a new memory entry. Returns the created row.
pub fn insert_memory(
    conn: &Connection,
    project_id: Option<&str>,
    category: &str,
    content: &str,
    source: Option<&str>,
    tags: &str,
) -> Result<MemoryRow, DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1.0)",
        params![project_id, category, content, source, tags, now, now],
    )?;

    let row_id = conn.last_insert_rowid();
    get_memory(conn, row_id)?.ok_or_else(|| DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows))
}

/// Retrieve a single memory by ID. Returns None if it does not exist.
pub fn get_memory(conn: &Connection, id: i64) -> Result<Option<MemoryRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, category, content, source, tags, created_at, accessed_at, relevance_score
         FROM memory WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(MemoryRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                category: row.get(2)?,
                content: row.get(3)?,
                source: row.get(4)?,
                tags: row.get(5)?,
                created_at: row.get(6)?,
                accessed_at: row.get(7)?,
                relevance_score: row.get(8)?,
            })
        })
        .optional()?;

    Ok(result)
}

/// Query memories with optional filters. Returns matching rows sorted by the given field.
///
/// Supported sort_by values: "relevance" (default), "created_at", "accessed_at".
/// Results are scoped to the given project_id (or global if None).
pub fn query_memories(
    conn: &Connection,
    project_id: Option<&str>,
    query: &MemoryQuery,
) -> Result<Vec<MemoryRow>, DbError> {
    let mut sql = String::from(
        "SELECT id, project_id, category, content, source, tags, created_at, accessed_at, relevance_score
         FROM memory WHERE 1=1",
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut param_idx = 1;

    // Scope to project (NULL project_id means global memories, include those too)
    if let Some(pid) = project_id {
        sql.push_str(&format!(
            " AND (project_id = ?{param_idx} OR project_id IS NULL)"
        ));
        param_values.push(Box::new(pid.to_string()));
        param_idx += 1;
    }

    if let Some(ref category) = query.category {
        sql.push_str(&format!(" AND category = ?{param_idx}"));
        param_values.push(Box::new(category.clone()));
        param_idx += 1;
    }

    if let Some(min_rel) = query.min_relevance {
        sql.push_str(&format!(" AND relevance_score >= ?{param_idx}"));
        param_values.push(Box::new(min_rel));
        param_idx += 1;
    }

    let order = match query.sort_by.as_deref() {
        Some("created_at") => "created_at DESC",
        Some("accessed_at") => "accessed_at DESC",
        _ => "relevance_score DESC",
    };
    sql.push_str(&format!(" ORDER BY {order}"));

    let limit = query.limit.unwrap_or(50);
    sql.push_str(&format!(" LIMIT ?{param_idx}"));
    param_values.push(Box::new(limit));
    let _ = param_idx;

    let mut stmt = conn.prepare(&sql)?;
    let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(params_ref.as_slice(), |row| {
            Ok(MemoryRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                category: row.get(2)?,
                content: row.get(3)?,
                source: row.get(4)?,
                tags: row.get(5)?,
                created_at: row.get(6)?,
                accessed_at: row.get(7)?,
                relevance_score: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Update a memory's content. Returns true if a row was updated.
pub fn update_memory_content(
    conn: &Connection,
    id: i64,
    content: &str,
) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "UPDATE memory SET content = ?1 WHERE id = ?2",
        params![content, id],
    )?;
    Ok(rows_affected > 0)
}

/// Delete a memory by ID. Returns true if a row was deleted.
pub fn delete_memory(conn: &Connection, id: i64) -> Result<bool, DbError> {
    let rows_affected = conn.execute("DELETE FROM memory WHERE id = ?1", params![id])?;
    Ok(rows_affected > 0)
}

/// Bump a memory's relevance: update accessed_at to now and boost score by 0.1, capped at 1.0.
pub fn update_relevance(conn: &Connection, id: i64) -> Result<bool, DbError> {
    let now = chrono::Utc::now().timestamp();
    let rows_affected = conn.execute(
        "UPDATE memory SET accessed_at = ?1, relevance_score = MIN(relevance_score + 0.1, 1.0) WHERE id = ?2",
        params![now, id],
    )?;
    Ok(rows_affected > 0)
}

/// Decay all non-pinned memories: score *= 0.995^days_since_last_access.
///
/// Pinned memories (source = 'pinned') are excluded from decay.
/// Computes decay in Rust to avoid dependency on SQLite math extensions.
/// Returns the number of rows updated.
pub fn decay_memories(conn: &Connection) -> Result<usize, DbError> {
    let now = chrono::Utc::now().timestamp();
    let decay_base: f64 = 0.995;
    let seconds_per_day: f64 = 86400.0;

    let mut stmt = conn.prepare(
        "SELECT id, accessed_at, relevance_score FROM memory
         WHERE (source IS NULL OR source != 'pinned') AND relevance_score > 0.01",
    )?;

    let entries: Vec<(i64, i64, f64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut update_stmt = conn.prepare(
        "UPDATE memory SET relevance_score = ?1 WHERE id = ?2",
    )?;

    let mut updated = 0usize;
    for (id, accessed_at, score) in &entries {
        let days_since_access = (now - accessed_at) as f64 / seconds_per_day;
        let new_score = score * decay_base.powf(days_since_access);
        update_stmt.execute(params![new_score, id])?;
        updated += 1;
    }

    Ok(updated)
}

/// Pin a memory: set score to 1.0 and source to 'pinned'.
pub fn pin_memory(conn: &Connection, id: i64) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "UPDATE memory SET relevance_score = 1.0, source = 'pinned' WHERE id = ?1",
        params![id],
    )?;
    Ok(rows_affected > 0)
}

/// Unpin a memory: revert source from 'pinned' to NULL. Score stays at current value.
pub fn unpin_memory(conn: &Connection, id: i64) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "UPDATE memory SET source = NULL WHERE id = ?1 AND source = 'pinned'",
        params![id],
    )?;
    Ok(rows_affected > 0)
}

/// Full-text search over memory content, category, and tags using FTS5 MATCH.
///
/// Returns memories ranked by FTS5 relevance (bm25), limited to the given count.
pub fn search_memories(
    conn: &Connection,
    project_id: Option<&str>,
    query: &str,
    limit: i64,
) -> Result<Vec<MemoryRow>, DbError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let sql = match project_id {
        Some(_) => {
            "SELECT m.id, m.project_id, m.category, m.content, m.source, m.tags,
                    m.created_at, m.accessed_at, m.relevance_score
             FROM memory_fts f
             JOIN memory m ON m.id = f.rowid
             WHERE memory_fts MATCH ?1 AND (m.project_id = ?2 OR m.project_id IS NULL)
             ORDER BY bm25(memory_fts)
             LIMIT ?3"
        }
        None => {
            "SELECT m.id, m.project_id, m.category, m.content, m.source, m.tags,
                    m.created_at, m.accessed_at, m.relevance_score
             FROM memory_fts f
             JOIN memory m ON m.id = f.rowid
             WHERE memory_fts MATCH ?1
             ORDER BY bm25(memory_fts)
             LIMIT ?2"
        }
    };

    let mut stmt = conn.prepare(sql)?;

    let rows = match project_id {
        Some(pid) => stmt
            .query_map(params![trimmed, pid, limit], |row| {
                Ok(MemoryRow {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    category: row.get(2)?,
                    content: row.get(3)?,
                    source: row.get(4)?,
                    tags: row.get(5)?,
                    created_at: row.get(6)?,
                    accessed_at: row.get(7)?,
                    relevance_score: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?,
        None => stmt
            .query_map(params![trimmed, limit], |row| {
                Ok(MemoryRow {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    category: row.get(2)?,
                    content: row.get(3)?,
                    source: row.get(4)?,
                    tags: row.get(5)?,
                    created_at: row.get(6)?,
                    accessed_at: row.get(7)?,
                    relevance_score: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?,
    };

    Ok(rows)
}

/// Count all memories for a project (including global memories with NULL project_id).
pub fn count_memories(conn: &Connection, project_id: Option<&str>) -> Result<i64, DbError> {
    let count: i64 = match project_id {
        Some(pid) => conn.query_row(
            "SELECT COUNT(*) FROM memory WHERE project_id = ?1 OR project_id IS NULL",
            params![pid],
            |row| row.get(0),
        )?,
        None => conn.query_row("SELECT COUNT(*) FROM memory", [], |row| row.get(0))?,
    };
    Ok(count)
}

/// Use rusqlite's optional() extension for query_row.
trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::run_migrations(&conn).expect("Migrations should succeed");
        conn
    }

    /// Seed a project so foreign key constraints are satisfied.
    fn seed_project(conn: &Connection, id: &str) {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT OR IGNORE INTO projects (id, name, path, default_runtime, created_at, updated_at)
             VALUES (?1, 'Test Project', '/tmp/test', 'claude-code', ?2, ?3)",
            params![id, now, now],
        )
        .expect("Should seed project");
    }

    #[test]
    fn insert_and_get_memory() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let mem = insert_memory(
            &conn,
            Some("proj-1"),
            "context",
            "The API uses REST with JSON payloads",
            Some("session-abc"),
            r#"["api", "rest"]"#,
        )
        .expect("Should insert memory");

        assert!(mem.id > 0);
        assert_eq!(mem.project_id.as_deref(), Some("proj-1"));
        assert_eq!(mem.category, "context");
        assert_eq!(mem.content, "The API uses REST with JSON payloads");
        assert_eq!(mem.source.as_deref(), Some("session-abc"));
        assert_eq!(mem.tags, r#"["api", "rest"]"#);
        assert_eq!(mem.relevance_score, 1.0);

        let fetched = get_memory(&conn, mem.id)
            .expect("Should query")
            .expect("Should find memory");
        assert_eq!(fetched.content, mem.content);
    }

    #[test]
    fn insert_global_memory_no_project() {
        let conn = test_conn();

        let mem = insert_memory(&conn, None, "preference", "User prefers dark mode", None, "[]")
            .expect("Should insert global memory");

        assert!(mem.project_id.is_none());
        assert_eq!(mem.category, "preference");
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let conn = test_conn();
        let result = get_memory(&conn, 9999).expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn query_memories_by_category() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        insert_memory(&conn, Some("proj-1"), "context", "Context A", None, "[]").unwrap();
        insert_memory(&conn, Some("proj-1"), "decision", "Decision B", None, "[]").unwrap();
        insert_memory(&conn, Some("proj-1"), "context", "Context C", None, "[]").unwrap();

        let query = MemoryQuery {
            category: Some("context".to_string()),
            ..Default::default()
        };
        let results = query_memories(&conn, Some("proj-1"), &query).expect("Should query");
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|m| m.category == "context"));
    }

    #[test]
    fn query_memories_with_min_relevance() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let mem = insert_memory(&conn, Some("proj-1"), "context", "High relevance", None, "[]").unwrap();
        // Manually lower relevance on a second entry
        insert_memory(&conn, Some("proj-1"), "context", "Low relevance", None, "[]").unwrap();
        conn.execute("UPDATE memory SET relevance_score = 0.3 WHERE id != ?1", params![mem.id]).unwrap();

        let query = MemoryQuery {
            min_relevance: Some(0.5),
            ..Default::default()
        };
        let results = query_memories(&conn, Some("proj-1"), &query).expect("Should query");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "High relevance");
    }

    #[test]
    fn query_memories_with_limit() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        for i in 0..10 {
            insert_memory(&conn, Some("proj-1"), "context", &format!("Memory {i}"), None, "[]").unwrap();
        }

        let query = MemoryQuery {
            limit: Some(3),
            ..Default::default()
        };
        let results = query_memories(&conn, Some("proj-1"), &query).expect("Should query");
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn query_memories_sort_by_created_at() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        // Insert with manual timestamps for deterministic ordering
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES ('proj-1', 'context', 'Older', NULL, '[]', 1000, 1000, 1.0)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES ('proj-1', 'context', 'Newer', NULL, '[]', 2000, 2000, 1.0)",
            [],
        ).unwrap();

        let query = MemoryQuery {
            sort_by: Some("created_at".to_string()),
            ..Default::default()
        };
        let results = query_memories(&conn, Some("proj-1"), &query).expect("Should query");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].content, "Newer"); // DESC order
        assert_eq!(results[1].content, "Older");
    }

    #[test]
    fn query_memories_includes_global() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        insert_memory(&conn, Some("proj-1"), "context", "Project-scoped", None, "[]").unwrap();
        insert_memory(&conn, None, "preference", "Global pref", None, "[]").unwrap();

        let query = MemoryQuery::default();
        let results = query_memories(&conn, Some("proj-1"), &query).expect("Should query");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn update_memory_content_works() {
        let conn = test_conn();
        let mem = insert_memory(&conn, None, "context", "Original content", None, "[]").unwrap();

        let updated = update_memory_content(&conn, mem.id, "Updated content").expect("Should update");
        assert!(updated);

        let fetched = get_memory(&conn, mem.id).unwrap().unwrap();
        assert_eq!(fetched.content, "Updated content");
    }

    #[test]
    fn update_nonexistent_memory_returns_false() {
        let conn = test_conn();
        let updated = update_memory_content(&conn, 9999, "New").expect("Should not error");
        assert!(!updated);
    }

    #[test]
    fn delete_memory_removes_it() {
        let conn = test_conn();
        let mem = insert_memory(&conn, None, "context", "To delete", None, "[]").unwrap();

        let deleted = delete_memory(&conn, mem.id).expect("Should delete");
        assert!(deleted);

        let result = get_memory(&conn, mem.id).expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn delete_nonexistent_returns_false() {
        let conn = test_conn();
        let deleted = delete_memory(&conn, 9999).expect("Should not error");
        assert!(!deleted);
    }

    #[test]
    fn update_relevance_bumps_score_and_accessed_at() {
        let conn = test_conn();
        // Insert with a known low score
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES (NULL, 'context', 'Test', NULL, '[]', 1000, 1000, 0.5)",
            [],
        ).unwrap();
        let id = conn.last_insert_rowid();

        let bumped = update_relevance(&conn, id).expect("Should bump");
        assert!(bumped);

        let mem = get_memory(&conn, id).unwrap().unwrap();
        assert!((mem.relevance_score - 0.6).abs() < 0.001);
        assert!(mem.accessed_at > 1000);
    }

    #[test]
    fn update_relevance_caps_at_one() {
        let conn = test_conn();
        let mem = insert_memory(&conn, None, "context", "Already max", None, "[]").unwrap();
        assert_eq!(mem.relevance_score, 1.0);

        update_relevance(&conn, mem.id).expect("Should bump");

        let fetched = get_memory(&conn, mem.id).unwrap().unwrap();
        assert!(fetched.relevance_score <= 1.0);
    }

    #[test]
    fn decay_memories_reduces_scores() {
        let conn = test_conn();
        // Insert memory with accessed_at 30 days ago
        let thirty_days_ago = chrono::Utc::now().timestamp() - (30 * 86400);
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES (NULL, 'context', 'Old memory', NULL, '[]', ?1, ?1, 1.0)",
            params![thirty_days_ago],
        ).unwrap();
        let id = conn.last_insert_rowid();

        let affected = decay_memories(&conn).expect("Should decay");
        assert!(affected > 0);

        let mem = get_memory(&conn, id).unwrap().unwrap();
        // 0.995^30 ≈ 0.860 — should be noticeably decayed
        assert!(mem.relevance_score < 0.9, "Score should have decayed: {}", mem.relevance_score);
        assert!(mem.relevance_score > 0.8, "Score should not decay too much: {}", mem.relevance_score);
    }

    #[test]
    fn decay_memories_skips_pinned() {
        let conn = test_conn();
        let thirty_days_ago = chrono::Utc::now().timestamp() - (30 * 86400);
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES (NULL, 'context', 'Pinned memory', 'pinned', '[]', ?1, ?1, 1.0)",
            params![thirty_days_ago],
        ).unwrap();
        let id = conn.last_insert_rowid();

        decay_memories(&conn).expect("Should decay");

        let mem = get_memory(&conn, id).unwrap().unwrap();
        assert_eq!(mem.relevance_score, 1.0, "Pinned memory should not decay");
    }

    #[test]
    fn pin_memory_sets_score_and_source() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO memory (project_id, category, content, source, tags, created_at, accessed_at, relevance_score)
             VALUES (NULL, 'context', 'To pin', NULL, '[]', 1000, 1000, 0.5)",
            [],
        ).unwrap();
        let id = conn.last_insert_rowid();

        let pinned = pin_memory(&conn, id).expect("Should pin");
        assert!(pinned);

        let mem = get_memory(&conn, id).unwrap().unwrap();
        assert_eq!(mem.relevance_score, 1.0);
        assert_eq!(mem.source.as_deref(), Some("pinned"));
    }

    #[test]
    fn unpin_memory_clears_pinned_source() {
        let conn = test_conn();
        let mem = insert_memory(&conn, None, "context", "To pin/unpin", None, "[]").unwrap();
        pin_memory(&conn, mem.id).unwrap();

        let unpinned = unpin_memory(&conn, mem.id).expect("Should unpin");
        assert!(unpinned);

        let fetched = get_memory(&conn, mem.id).unwrap().unwrap();
        assert!(fetched.source.is_none());
    }

    #[test]
    fn unpin_non_pinned_returns_false() {
        let conn = test_conn();
        let mem = insert_memory(&conn, None, "context", "Not pinned", Some("session-1"), "[]").unwrap();

        let unpinned = unpin_memory(&conn, mem.id).expect("Should not error");
        assert!(!unpinned);
    }

    #[test]
    fn search_memories_finds_by_content() {
        let conn = test_conn();
        insert_memory(&conn, None, "context", "Rust is a systems programming language", None, "[]").unwrap();
        insert_memory(&conn, None, "context", "TypeScript is great for frontend", None, "[]").unwrap();

        let results = search_memories(&conn, None, "Rust systems", 10).expect("Should search");
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
    }

    #[test]
    fn search_memories_finds_by_category() {
        let conn = test_conn();
        insert_memory(&conn, None, "decision", "We chose PostgreSQL", None, "[]").unwrap();
        insert_memory(&conn, None, "learning", "SQLite is faster for local", None, "[]").unwrap();

        let results = search_memories(&conn, None, "decision", 10).expect("Should search");
        assert!(!results.is_empty());
    }

    #[test]
    fn search_memories_empty_query_returns_empty() {
        let conn = test_conn();
        insert_memory(&conn, None, "context", "Something", None, "[]").unwrap();

        let results = search_memories(&conn, None, "  ", 10).expect("Should handle empty");
        assert!(results.is_empty());
    }

    #[test]
    fn search_memories_scoped_to_project() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        seed_project(&conn, "proj-2");

        insert_memory(&conn, Some("proj-1"), "context", "Alpha project secret", None, "[]").unwrap();
        insert_memory(&conn, Some("proj-2"), "context", "Beta project secret", None, "[]").unwrap();

        let results = search_memories(&conn, Some("proj-1"), "secret", 10).expect("Should search");
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Alpha"));
    }

    #[test]
    fn count_memories_returns_correct_count() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        assert_eq!(count_memories(&conn, Some("proj-1")).unwrap(), 0);

        insert_memory(&conn, Some("proj-1"), "context", "One", None, "[]").unwrap();
        insert_memory(&conn, Some("proj-1"), "context", "Two", None, "[]").unwrap();
        insert_memory(&conn, None, "preference", "Global", None, "[]").unwrap();

        // Project count includes project-scoped + global (NULL project_id)
        assert_eq!(count_memories(&conn, Some("proj-1")).unwrap(), 3);
        // Total count (no project filter)
        assert_eq!(count_memories(&conn, None).unwrap(), 3);
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        let mem = insert_memory(&conn, None, "context", "Test", None, "[]").unwrap();
        let json = serde_json::to_string(&mem).expect("Should serialize");
        assert!(json.contains("projectId"));
        assert!(json.contains("createdAt"));
        assert!(json.contains("accessedAt"));
        assert!(json.contains("relevanceScore"));
    }
}
