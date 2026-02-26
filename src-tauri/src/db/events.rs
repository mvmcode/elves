// Event log operations — insert and query the full event stream for session replay.

use rusqlite::{params, Connection};
use serde::Serialize;

use super::DbError;

/// An event row from the database, serialized to camelCase JSON for the frontend.
/// Events capture every action during a session for replay and debugging.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventRow {
    pub id: i64,
    pub session_id: String,
    pub elf_id: Option<String>,
    pub event_type: String,
    /// JSON string containing the event-specific payload.
    pub payload: String,
    /// Optional personality-driven status message for the UI.
    pub funny_status: Option<String>,
    pub timestamp: i64,
}

/// Insert a new event into the session event log. Returns the created event row.
///
/// The `timestamp` is set to the current UTC time. The `id` is auto-incremented by SQLite.
pub fn insert_event(
    conn: &Connection,
    session_id: &str,
    elf_id: Option<&str>,
    event_type: &str,
    payload: &str,
    funny_status: Option<&str>,
) -> Result<EventRow, DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO events (session_id, elf_id, event_type, payload, funny_status, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![session_id, elf_id, event_type, payload, funny_status, now],
    )?;

    let row_id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "SELECT id, session_id, elf_id, event_type, payload, funny_status, timestamp
         FROM events WHERE id = ?1",
    )?;

    let event = stmt.query_row(params![row_id], |row| {
        Ok(EventRow {
            id: row.get(0)?,
            session_id: row.get(1)?,
            elf_id: row.get(2)?,
            event_type: row.get(3)?,
            payload: row.get(4)?,
            funny_status: row.get(5)?,
            timestamp: row.get(6)?,
        })
    })?;

    Ok(event)
}

/// List all events for a session, ordered chronologically (oldest first).
/// Secondary sort by ID ensures stable ordering for events with the same timestamp.
pub fn list_events(
    conn: &Connection,
    session_id: &str,
) -> Result<Vec<EventRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, elf_id, event_type, payload, funny_status, timestamp
         FROM events WHERE session_id = ?1 ORDER BY timestamp ASC, id ASC",
    )?;

    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(EventRow {
                id: row.get(0)?,
                session_id: row.get(1)?,
                elf_id: row.get(2)?,
                event_type: row.get(3)?,
                payload: row.get(4)?,
                funny_status: row.get(5)?,
                timestamp: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Count the total number of events in a session.
pub fn count_events(conn: &Connection, session_id: &str) -> Result<i64, DbError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM events WHERE session_id = ?1",
        params![session_id],
        |row| row.get(0),
    )?;
    Ok(count)
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
    fn insert_and_list_events() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let event = insert_event(
            &conn,
            "sess-1",
            Some("elf-1"),
            "tool_use",
            r#"{"tool":"read_file","path":"src/main.rs"}"#,
            Some("Reading source code with great enthusiasm"),
        )
        .expect("Should insert event");

        assert_eq!(event.session_id, "sess-1");
        assert_eq!(event.elf_id.as_deref(), Some("elf-1"));
        assert_eq!(event.event_type, "tool_use");
        assert!(event.payload.contains("read_file"));
        assert_eq!(
            event.funny_status.as_deref(),
            Some("Reading source code with great enthusiasm")
        );
        assert!(event.id > 0);

        let events = list_events(&conn, "sess-1").expect("Should list events");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].id, event.id);
    }

    #[test]
    fn insert_event_without_elf_id() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let event = insert_event(
            &conn,
            "sess-1",
            None,
            "session_start",
            r#"{"task":"Fix bugs"}"#,
            None,
        )
        .expect("Should insert");

        assert!(event.elf_id.is_none());
        assert!(event.funny_status.is_none());
    }

    #[test]
    fn list_events_empty() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let events = list_events(&conn, "sess-1").expect("Should list");
        assert!(events.is_empty());
    }

    #[test]
    fn list_events_ordered_chronologically() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        // Insert events with manually controlled timestamps for deterministic ordering
        conn.execute(
            "INSERT INTO events (session_id, elf_id, event_type, payload, funny_status, timestamp)
             VALUES ('sess-1', NULL, 'second', '{}', NULL, 2000)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO events (session_id, elf_id, event_type, payload, funny_status, timestamp)
             VALUES ('sess-1', NULL, 'first', '{}', NULL, 1000)",
            [],
        ).unwrap();

        let events = list_events(&conn, "sess-1").unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event_type, "first");
        assert_eq!(events[1].event_type, "second");
    }

    #[test]
    fn count_events_returns_correct_count() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        assert_eq!(count_events(&conn, "sess-1").unwrap(), 0);

        insert_event(&conn, "sess-1", None, "type_a", "{}", None).unwrap();
        insert_event(&conn, "sess-1", None, "type_b", "{}", None).unwrap();
        insert_event(&conn, "sess-1", None, "type_c", "{}", None).unwrap();

        assert_eq!(count_events(&conn, "sess-1").unwrap(), 3);
    }

    #[test]
    fn events_scoped_to_session() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");
        seed_session(&conn, "proj-1", "sess-2");

        insert_event(&conn, "sess-1", None, "type_a", "{}", None).unwrap();
        insert_event(&conn, "sess-1", None, "type_b", "{}", None).unwrap();
        insert_event(&conn, "sess-2", None, "type_c", "{}", None).unwrap();

        assert_eq!(count_events(&conn, "sess-1").unwrap(), 2);
        assert_eq!(count_events(&conn, "sess-2").unwrap(), 1);

        let events = list_events(&conn, "sess-1").unwrap();
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        seed_session(&conn, "proj-1", "sess-1");

        let event = insert_event(&conn, "sess-1", Some("e1"), "test", "{}", Some("status"))
            .unwrap();
        let json = serde_json::to_string(&event).expect("Should serialize");
        assert!(json.contains("sessionId"));
        assert!(json.contains("elfId"));
        assert!(json.contains("eventType"));
        assert!(json.contains("funnyStatus"));
    }
}
