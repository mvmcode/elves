// Session CRUD operations — create, read, list, and update task execution sessions in SQLite.

use rusqlite::{params, Connection};
use serde::Serialize;

use super::DbError;

/// A session row from the database, serialized to camelCase JSON for the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub project_id: String,
    pub task: String,
    pub runtime: String,
    /// One of: "active", "completed", "error", "cancelled".
    pub status: String,
    /// Optional JSON string representing the agent execution plan.
    pub plan: Option<String>,
    pub agent_count: i32,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub tokens_used: i64,
    pub cost_estimate: f64,
    pub summary: Option<String>,
    /// Claude Code's internal session ID, used for `claude --resume`.
    pub claude_session_id: Option<String>,
}

/// Insert a new session into the database. Returns the created session row.
///
/// The session starts with status "active", agent_count 1, and zero token usage.
/// The `started_at` timestamp is set to the current UTC time.
pub fn create_session(
    conn: &Connection,
    id: &str,
    project_id: &str,
    task: &str,
    runtime: &str,
) -> Result<SessionRow, DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO sessions (id, project_id, task, runtime, status, agent_count, started_at, tokens_used, cost_estimate)
         VALUES (?1, ?2, ?3, ?4, 'active', 1, ?5, 0, 0.0)",
        params![id, project_id, task, runtime, now],
    )?;

    get_session(conn, id)?.ok_or_else(|| {
        DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows)
    })
}

/// Retrieve a single session by ID. Returns None if the session does not exist.
pub fn get_session(conn: &Connection, id: &str) -> Result<Option<SessionRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, task, runtime, status, plan, agent_count,
                started_at, ended_at, tokens_used, cost_estimate, summary, claude_session_id
         FROM sessions WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(SessionRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                task: row.get(2)?,
                runtime: row.get(3)?,
                status: row.get(4)?,
                plan: row.get(5)?,
                agent_count: row.get(6)?,
                started_at: row.get(7)?,
                ended_at: row.get(8)?,
                tokens_used: row.get(9)?,
                cost_estimate: row.get(10)?,
                summary: row.get(11)?,
                claude_session_id: row.get(12)?,
            })
        })
        .optional()?;

    Ok(result)
}

/// List all sessions for a project, ordered by most recently started first.
pub fn list_sessions(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<SessionRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, task, runtime, status, plan, agent_count,
                started_at, ended_at, tokens_used, cost_estimate, summary, claude_session_id
         FROM sessions WHERE project_id = ?1 ORDER BY started_at DESC",
    )?;

    let rows = stmt
        .query_map(params![project_id], |row| {
            Ok(SessionRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                task: row.get(2)?,
                runtime: row.get(3)?,
                status: row.get(4)?,
                plan: row.get(5)?,
                agent_count: row.get(6)?,
                started_at: row.get(7)?,
                ended_at: row.get(8)?,
                tokens_used: row.get(9)?,
                cost_estimate: row.get(10)?,
                summary: row.get(11)?,
                claude_session_id: row.get(12)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Update a session's status. Sets `ended_at` to the current UTC timestamp when the
/// status transitions to a terminal state ("completed", "error", or "cancelled").
/// Optionally sets a summary. Returns true if a row was updated.
pub fn update_session_status(
    conn: &Connection,
    id: &str,
    status: &str,
    summary: Option<&str>,
) -> Result<bool, DbError> {
    let is_terminal = matches!(status, "completed" | "error" | "cancelled");
    let ended_at: Option<i64> = if is_terminal {
        Some(chrono::Utc::now().timestamp())
    } else {
        None
    };

    let rows_affected = conn.execute(
        "UPDATE sessions SET status = ?1, ended_at = COALESCE(?2, ended_at), summary = COALESCE(?3, summary)
         WHERE id = ?4",
        params![status, ended_at, summary, id],
    )?;

    Ok(rows_affected > 0)
}

/// Update a session's token usage and cost estimate. Called when the Claude process
/// finishes and we extract usage data from the final `result` event.
/// Returns true if a row was updated.
pub fn update_session_usage(
    conn: &Connection,
    id: &str,
    tokens_used: i64,
    cost_estimate: f64,
) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "UPDATE sessions SET tokens_used = ?1, cost_estimate = ?2 WHERE id = ?3",
        params![tokens_used, cost_estimate, id],
    )?;
    Ok(rows_affected > 0)
}

/// Store the Claude Code session ID for a session. Used for `claude --resume` support.
/// Returns true if a row was updated.
pub fn update_claude_session_id(
    conn: &Connection,
    id: &str,
    claude_session_id: &str,
) -> Result<bool, DbError> {
    let rows = conn.execute(
        "UPDATE sessions SET claude_session_id = ?1 WHERE id = ?2",
        params![claude_session_id, id],
    )?;
    Ok(rows > 0)
}

/// Mark all "active" sessions as "failed" — called on app startup to clean up
/// sessions from previous runs that were never completed (e.g., app crash, force quit).
/// Returns the number of sessions cleaned up.
pub fn cleanup_stale_sessions(conn: &Connection) -> Result<usize, DbError> {
    let now = chrono::Utc::now().timestamp();
    let rows = conn.execute(
        "UPDATE sessions SET status = 'failed', ended_at = ?1, summary = 'Session interrupted (app restarted)'
         WHERE status = 'active'",
        params![now],
    )?;
    Ok(rows)
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

    /// Insert a project so foreign key constraints are satisfied.
    fn seed_project(conn: &Connection, id: &str) {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT INTO projects (id, name, path, default_runtime, created_at, updated_at)
             VALUES (?1, 'Test Project', '/tmp/test', 'claude-code', ?2, ?3)",
            params![id, now, now],
        )
        .expect("Should seed project");
    }

    #[test]
    fn create_and_get_session() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let session = create_session(&conn, "sess-1", "proj-1", "Fix the login bug", "claude-code")
            .expect("Should create session");

        assert_eq!(session.id, "sess-1");
        assert_eq!(session.project_id, "proj-1");
        assert_eq!(session.task, "Fix the login bug");
        assert_eq!(session.runtime, "claude-code");
        assert_eq!(session.status, "active");
        assert!(session.plan.is_none());
        assert_eq!(session.agent_count, 1);
        assert!(session.ended_at.is_none());
        assert_eq!(session.tokens_used, 0);
        assert_eq!(session.cost_estimate, 0.0);
        assert!(session.summary.is_none());

        let fetched = get_session(&conn, "sess-1")
            .expect("Should query")
            .expect("Should find session");
        assert_eq!(fetched.task, "Fix the login bug");
    }

    #[test]
    fn list_sessions_by_project() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        seed_project(&conn, "proj-2");

        create_session(&conn, "s1", "proj-1", "Task A", "claude-code").unwrap();
        create_session(&conn, "s2", "proj-1", "Task B", "claude-code").unwrap();
        create_session(&conn, "s3", "proj-2", "Task C", "codex").unwrap();

        let sessions = list_sessions(&conn, "proj-1").expect("Should list sessions");
        assert_eq!(sessions.len(), 2);

        let sessions_proj2 = list_sessions(&conn, "proj-2").expect("Should list");
        assert_eq!(sessions_proj2.len(), 1);
        assert_eq!(sessions_proj2[0].runtime, "codex");
    }

    #[test]
    fn list_sessions_empty() {
        let conn = test_conn();
        seed_project(&conn, "proj-empty");

        let sessions = list_sessions(&conn, "proj-empty").expect("Should list");
        assert!(sessions.is_empty());
    }

    #[test]
    fn update_session_status_to_completed() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        create_session(&conn, "s1", "proj-1", "Task A", "claude-code").unwrap();

        let updated = update_session_status(&conn, "s1", "completed", Some("All done"))
            .expect("Should update");
        assert!(updated);

        let session = get_session(&conn, "s1")
            .expect("Should query")
            .expect("Should find");
        assert_eq!(session.status, "completed");
        assert!(session.ended_at.is_some());
        assert_eq!(session.summary.as_deref(), Some("All done"));
    }

    #[test]
    fn update_session_status_to_error() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        create_session(&conn, "s1", "proj-1", "Task A", "claude-code").unwrap();

        update_session_status(&conn, "s1", "error", Some("Something broke"))
            .expect("Should update");

        let session = get_session(&conn, "s1").unwrap().unwrap();
        assert_eq!(session.status, "error");
        assert!(session.ended_at.is_some());
        assert_eq!(session.summary.as_deref(), Some("Something broke"));
    }

    #[test]
    fn update_session_status_to_cancelled() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        create_session(&conn, "s1", "proj-1", "Task A", "claude-code").unwrap();

        update_session_status(&conn, "s1", "cancelled", None).expect("Should update");

        let session = get_session(&conn, "s1").unwrap().unwrap();
        assert_eq!(session.status, "cancelled");
        assert!(session.ended_at.is_some());
    }

    #[test]
    fn update_nonexistent_session_returns_false() {
        let conn = test_conn();
        let updated = update_session_status(&conn, "nope", "completed", None)
            .expect("Should not error");
        assert!(!updated);
    }

    #[test]
    fn get_nonexistent_session_returns_none() {
        let conn = test_conn();
        let result = get_session(&conn, "nope").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        let session = create_session(&conn, "s1", "proj-1", "Task A", "claude-code").unwrap();
        let json = serde_json::to_string(&session).expect("Should serialize");
        assert!(json.contains("projectId"));
        assert!(json.contains("startedAt"));
        assert!(json.contains("endedAt"));
        assert!(json.contains("agentCount"));
        assert!(json.contains("tokensUsed"));
        assert!(json.contains("costEstimate"));
    }

    #[test]
    fn update_session_usage() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        create_session(&conn, "s1", "proj-1", "Task A", "claude-code").unwrap();

        let updated = super::update_session_usage(&conn, "s1", 1500, 0.0342)
            .expect("Should update usage");
        assert!(updated);

        let session = get_session(&conn, "s1").unwrap().unwrap();
        assert_eq!(session.tokens_used, 1500);
        assert!((session.cost_estimate - 0.0342).abs() < f64::EPSILON);
    }

    #[test]
    fn update_session_usage_nonexistent_returns_false() {
        let conn = test_conn();
        let updated = super::update_session_usage(&conn, "nope", 100, 0.01)
            .expect("Should not error");
        assert!(!updated);
    }

    #[test]
    fn list_sessions_ordered_by_started_at_desc() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        // Insert sessions with manually controlled timestamps
        let ts1 = 1000i64;
        let ts2 = 2000i64;
        conn.execute(
            "INSERT INTO sessions (id, project_id, task, runtime, status, agent_count, started_at, tokens_used, cost_estimate)
             VALUES ('older', 'proj-1', 'Old task', 'claude-code', 'active', 1, ?1, 0, 0.0)",
            params![ts1],
        ).unwrap();
        conn.execute(
            "INSERT INTO sessions (id, project_id, task, runtime, status, agent_count, started_at, tokens_used, cost_estimate)
             VALUES ('newer', 'proj-1', 'New task', 'claude-code', 'active', 1, ?1, 0, 0.0)",
            params![ts2],
        ).unwrap();

        let sessions = list_sessions(&conn, "proj-1").unwrap();
        assert_eq!(sessions[0].id, "newer");
        assert_eq!(sessions[1].id, "older");
    }
}
