// Elf CRUD operations — create, read, list, and update agent instances in SQLite.

use rusqlite::{params, Connection};
use serde::Serialize;

use super::DbError;

/// An elf row from the database, serialized to camelCase JSON for the frontend.
/// Each elf represents a single agent instance within a session.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ElfRow {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub role: Option<String>,
    pub avatar: String,
    pub color: String,
    pub quirk: Option<String>,
    pub runtime: String,
    /// One of: "spawning", "working", "done", "error".
    pub status: String,
    pub spawned_at: i64,
    pub finished_at: Option<i64>,
    pub parent_elf_id: Option<String>,
    /// JSON array string of tool names used during execution.
    pub tools_used: String,
}

/// Insert a new elf into the database. Returns the created elf row.
///
/// The elf starts with status "spawning", an empty tools_used array, and
/// `spawned_at` set to the current UTC timestamp.
pub fn create_elf(
    conn: &Connection,
    id: &str,
    session_id: &str,
    name: &str,
    role: Option<&str>,
    avatar: &str,
    color: &str,
    quirk: Option<&str>,
    runtime: &str,
) -> Result<ElfRow, DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO elves (id, session_id, name, role, avatar, color, quirk, runtime, status, spawned_at, tools_used)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'spawning', ?9, '[]')",
        params![id, session_id, name, role, avatar, color, quirk, runtime, now],
    )?;

    get_elf(conn, id)?.ok_or_else(|| {
        DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows)
    })
}

/// Update an elf's status. Sets `finished_at` to the current UTC timestamp when
/// the status transitions to a terminal state ("done" or "error").
/// Returns true if a row was updated.
pub fn update_elf_status(
    conn: &Connection,
    id: &str,
    status: &str,
) -> Result<bool, DbError> {
    let is_terminal = matches!(status, "done" | "error");
    let finished_at: Option<i64> = if is_terminal {
        Some(chrono::Utc::now().timestamp())
    } else {
        None
    };

    let rows_affected = conn.execute(
        "UPDATE elves SET status = ?1, finished_at = COALESCE(?2, finished_at) WHERE id = ?3",
        params![status, finished_at, id],
    )?;

    Ok(rows_affected > 0)
}

/// List all elves for a session, ordered by spawn time (oldest first).
pub fn list_elves(
    conn: &Connection,
    session_id: &str,
) -> Result<Vec<ElfRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, name, role, avatar, color, quirk, runtime,
                status, spawned_at, finished_at, parent_elf_id, tools_used
         FROM elves WHERE session_id = ?1 ORDER BY spawned_at ASC",
    )?;

    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(ElfRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                name: row.get(2)?,
                role: row.get(3)?,
                avatar: row.get(4)?,
                color: row.get(5)?,
                quirk: row.get(6)?,
                runtime: row.get(7)?,
                status: row.get(8)?,
                spawned_at: row.get(9)?,
                finished_at: row.get(10)?,
                parent_elf_id: row.get(11)?,
                tools_used: row.get(12)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Retrieve a single elf by ID. Returns None if the elf does not exist.
pub fn get_elf(conn: &Connection, id: &str) -> Result<Option<ElfRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, name, role, avatar, color, quirk, runtime,
                status, spawned_at, finished_at, parent_elf_id, tools_used
         FROM elves WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(ElfRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                name: row.get(2)?,
                role: row.get(3)?,
                avatar: row.get(4)?,
                color: row.get(5)?,
                quirk: row.get(6)?,
                runtime: row.get(7)?,
                status: row.get(8)?,
                spawned_at: row.get(9)?,
                finished_at: row.get(10)?,
                parent_elf_id: row.get(11)?,
                tools_used: row.get(12)?,
            })
        })
        .optional()?;

    Ok(result)
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

    /// Seed a project and session so foreign key constraints are satisfied.
    fn seed_session(conn: &Connection, project_id: &str, session_id: &str) {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT OR IGNORE INTO projects (id, name, path, default_runtime, created_at, updated_at)
             VALUES (?1, 'Test Project', '/tmp/test', 'claude-code', ?2, ?3)",
            params![project_id, now, now],
        )
        .expect("Should seed project");
        conn.execute(
            "INSERT INTO sessions (id, project_id, task, runtime, status, agent_count, started_at, tokens_used, cost_estimate)
             VALUES (?1, ?2, 'Test task', 'claude-code', 'active', 1, ?3, 0, 0.0)",
            params![session_id, project_id, now],
        )
        .expect("Should seed session");
    }

    #[test]
    fn create_and_get_elf() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let elf = create_elf(
            &conn,
            "elf-1",
            "sess-1",
            "Captain Cookie",
            Some("lead"),
            "cookie-avatar",
            "#FFD93D",
            Some("Says 'cookie' after every sentence"),
            "claude-code",
        )
        .expect("Should create elf");

        assert_eq!(elf.id, "elf-1");
        assert_eq!(elf.session_id, "sess-1");
        assert_eq!(elf.name, "Captain Cookie");
        assert_eq!(elf.role.as_deref(), Some("lead"));
        assert_eq!(elf.avatar, "cookie-avatar");
        assert_eq!(elf.color, "#FFD93D");
        assert_eq!(elf.quirk.as_deref(), Some("Says 'cookie' after every sentence"));
        assert_eq!(elf.runtime, "claude-code");
        assert_eq!(elf.status, "spawning");
        assert!(elf.finished_at.is_none());
        assert!(elf.parent_elf_id.is_none());
        assert_eq!(elf.tools_used, "[]");

        let fetched = get_elf(&conn, "elf-1")
            .expect("Should query")
            .expect("Should find elf");
        assert_eq!(fetched.name, "Captain Cookie");
    }

    #[test]
    fn create_elf_without_optional_fields() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let elf = create_elf(
            &conn, "elf-2", "sess-1", "Worker Bob", None, "bob-avatar", "#4D96FF", None, "codex",
        )
        .expect("Should create elf");

        assert!(elf.role.is_none());
        assert!(elf.quirk.is_none());
    }

    #[test]
    fn list_elves_by_session() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");
        seed_session(&conn, "proj-1", "sess-2");

        create_elf(&conn, "e1", "sess-1", "Alice", None, "a", "#FFF", None, "claude-code").unwrap();
        create_elf(&conn, "e2", "sess-1", "Bob", None, "b", "#000", None, "claude-code").unwrap();
        create_elf(&conn, "e3", "sess-2", "Carol", None, "c", "#F00", None, "codex").unwrap();

        let elves = list_elves(&conn, "sess-1").expect("Should list");
        assert_eq!(elves.len(), 2);

        let elves_s2 = list_elves(&conn, "sess-2").expect("Should list");
        assert_eq!(elves_s2.len(), 1);
        assert_eq!(elves_s2[0].name, "Carol");
    }

    #[test]
    fn list_elves_empty() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let elves = list_elves(&conn, "sess-1").expect("Should list");
        assert!(elves.is_empty());
    }

    #[test]
    fn update_elf_status_to_working() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");
        create_elf(&conn, "e1", "sess-1", "Alice", None, "a", "#FFF", None, "claude-code").unwrap();

        let updated = update_elf_status(&conn, "e1", "working").expect("Should update");
        assert!(updated);

        let elf = get_elf(&conn, "e1").unwrap().unwrap();
        assert_eq!(elf.status, "working");
        assert!(elf.finished_at.is_none(), "Non-terminal status should not set finished_at");
    }

    #[test]
    fn update_elf_status_to_done() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");
        create_elf(&conn, "e1", "sess-1", "Alice", None, "a", "#FFF", None, "claude-code").unwrap();

        update_elf_status(&conn, "e1", "done").expect("Should update");

        let elf = get_elf(&conn, "e1").unwrap().unwrap();
        assert_eq!(elf.status, "done");
        assert!(elf.finished_at.is_some(), "Terminal status should set finished_at");
    }

    #[test]
    fn update_elf_status_to_error() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");
        create_elf(&conn, "e1", "sess-1", "Alice", None, "a", "#FFF", None, "claude-code").unwrap();

        update_elf_status(&conn, "e1", "error").expect("Should update");

        let elf = get_elf(&conn, "e1").unwrap().unwrap();
        assert_eq!(elf.status, "error");
        assert!(elf.finished_at.is_some());
    }

    #[test]
    fn update_nonexistent_elf_returns_false() {
        let conn = test_conn();
        let updated = update_elf_status(&conn, "nope", "done").expect("Should not error");
        assert!(!updated);
    }

    #[test]
    fn get_nonexistent_elf_returns_none() {
        let conn = test_conn();
        let result = get_elf(&conn, "nope").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");
        let elf = create_elf(
            &conn, "e1", "sess-1", "Alice", Some("lead"), "a", "#FFF", Some("quirky"), "claude-code",
        )
        .unwrap();
        let json = serde_json::to_string(&elf).expect("Should serialize");
        assert!(json.contains("sessionId"));
        assert!(json.contains("spawnedAt"));
        assert!(json.contains("finishedAt"));
        assert!(json.contains("parentElfId"));
        assert!(json.contains("toolsUsed"));
    }
}
