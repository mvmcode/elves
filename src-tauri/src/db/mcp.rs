// MCP server CRUD operations — manage Model Context Protocol server configurations.
//
// MCP servers provide tool integrations for agents. Each server has a command,
// args, environment variables, a scope (global or project), and an enabled flag.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::DbError;

/// An MCP server row from the database, serialized to camelCase JSON for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpRow {
    pub id: String,
    pub name: String,
    /// The command to execute (e.g., "npx", "uvx", "node").
    pub command: String,
    /// JSON array of string arguments for the command.
    pub args: String,
    /// JSON object of environment variables for the server process.
    pub env: String,
    /// "global" or a project ID for project-scoped servers.
    pub scope: String,
    /// Whether this server is currently enabled.
    pub enabled: bool,
    /// Unix timestamp of the last successful health check, or None if never checked.
    pub last_health_check: Option<i64>,
}

/// Insert a new MCP server. Returns the created row.
pub fn insert_mcp_server(
    conn: &Connection,
    id: &str,
    name: &str,
    command: &str,
    args: &str,
    env: &str,
    scope: &str,
) -> Result<McpRow, DbError> {
    conn.execute(
        "INSERT INTO mcp_servers (id, name, command, args, env, scope, enabled, last_health_check)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, NULL)",
        params![id, name, command, args, env, scope],
    )?;

    get_mcp_server(conn, id)?.ok_or_else(|| DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows))
}

/// Retrieve a single MCP server by ID. Returns None if not found.
pub fn get_mcp_server(conn: &Connection, id: &str) -> Result<Option<McpRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, command, args, env, scope, enabled, last_health_check
         FROM mcp_servers WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], map_mcp_row)
        .optional()?;

    Ok(result)
}

/// List all MCP servers, ordered by name ascending.
pub fn list_mcp_servers(conn: &Connection) -> Result<Vec<McpRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, command, args, env, scope, enabled, last_health_check
         FROM mcp_servers ORDER BY name ASC",
    )?;

    let rows = stmt
        .query_map([], map_mcp_row)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Toggle an MCP server's enabled state. Returns true if updated.
pub fn toggle_mcp_server(conn: &Connection, id: &str, enabled: bool) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "UPDATE mcp_servers SET enabled = ?1 WHERE id = ?2",
        params![enabled, id],
    )?;
    Ok(rows_affected > 0)
}

/// Update the last health check timestamp for an MCP server. Returns true if updated.
pub fn update_health_check(conn: &Connection, id: &str) -> Result<bool, DbError> {
    let now = chrono::Utc::now().timestamp();
    let rows_affected = conn.execute(
        "UPDATE mcp_servers SET last_health_check = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(rows_affected > 0)
}

/// Delete an MCP server by ID. Returns true if a row was deleted.
pub fn delete_mcp_server(conn: &Connection, id: &str) -> Result<bool, DbError> {
    let rows_affected = conn.execute("DELETE FROM mcp_servers WHERE id = ?1", params![id])?;
    Ok(rows_affected > 0)
}

/// Map a rusqlite Row to an McpRow.
fn map_mcp_row(row: &rusqlite::Row<'_>) -> Result<McpRow, rusqlite::Error> {
    Ok(McpRow {
        id: row.get(0)?,
        name: row.get(1)?,
        command: row.get(2)?,
        args: row.get(3)?,
        env: row.get(4)?,
        scope: row.get(5)?,
        enabled: row.get(6)?,
        last_health_check: row.get(7)?,
    })
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

    #[test]
    fn insert_and_get_mcp_server() {
        let conn = test_conn();

        let server = insert_mcp_server(
            &conn,
            "mcp-1",
            "filesystem",
            "npx",
            r#"["-y", "@modelcontextprotocol/server-filesystem"]"#,
            r#"{"HOME": "/tmp"}"#,
            "global",
        )
        .expect("Should insert MCP server");

        assert_eq!(server.id, "mcp-1");
        assert_eq!(server.name, "filesystem");
        assert_eq!(server.command, "npx");
        assert!(server.args.contains("server-filesystem"));
        assert!(server.env.contains("HOME"));
        assert_eq!(server.scope, "global");
        assert!(server.enabled);
        assert!(server.last_health_check.is_none());

        let fetched = get_mcp_server(&conn, "mcp-1")
            .expect("Should query")
            .expect("Should find server");
        assert_eq!(fetched.name, "filesystem");
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let conn = test_conn();
        let result = get_mcp_server(&conn, "nope").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn list_mcp_servers_returns_all() {
        let conn = test_conn();

        insert_mcp_server(&conn, "mcp-1", "filesystem", "npx", "[]", "{}", "global").unwrap();
        insert_mcp_server(&conn, "mcp-2", "github", "npx", "[]", "{}", "global").unwrap();

        let servers = list_mcp_servers(&conn).expect("Should list");
        assert_eq!(servers.len(), 2);
    }

    #[test]
    fn list_mcp_servers_empty() {
        let conn = test_conn();
        let servers = list_mcp_servers(&conn).expect("Should list");
        assert!(servers.is_empty());
    }

    #[test]
    fn list_mcp_servers_ordered_by_name() {
        let conn = test_conn();

        insert_mcp_server(&conn, "mcp-1", "Zebra", "cmd", "[]", "{}", "global").unwrap();
        insert_mcp_server(&conn, "mcp-2", "Alpha", "cmd", "[]", "{}", "global").unwrap();

        let servers = list_mcp_servers(&conn).expect("Should list");
        assert_eq!(servers[0].name, "Alpha");
        assert_eq!(servers[1].name, "Zebra");
    }

    #[test]
    fn toggle_mcp_server_disables_and_enables() {
        let conn = test_conn();
        insert_mcp_server(&conn, "mcp-1", "test", "cmd", "[]", "{}", "global").unwrap();

        // Disable
        let toggled = toggle_mcp_server(&conn, "mcp-1", false).expect("Should toggle");
        assert!(toggled);
        let server = get_mcp_server(&conn, "mcp-1").unwrap().unwrap();
        assert!(!server.enabled);

        // Re-enable
        let toggled = toggle_mcp_server(&conn, "mcp-1", true).expect("Should toggle");
        assert!(toggled);
        let server = get_mcp_server(&conn, "mcp-1").unwrap().unwrap();
        assert!(server.enabled);
    }

    #[test]
    fn toggle_nonexistent_returns_false() {
        let conn = test_conn();
        let toggled = toggle_mcp_server(&conn, "nope", false).expect("Should not error");
        assert!(!toggled);
    }

    #[test]
    fn update_health_check_sets_timestamp() {
        let conn = test_conn();
        insert_mcp_server(&conn, "mcp-1", "test", "cmd", "[]", "{}", "global").unwrap();

        let updated = update_health_check(&conn, "mcp-1").expect("Should update");
        assert!(updated);

        let server = get_mcp_server(&conn, "mcp-1").unwrap().unwrap();
        assert!(server.last_health_check.is_some());
        assert!(server.last_health_check.unwrap() > 0);
    }

    #[test]
    fn update_health_check_nonexistent_returns_false() {
        let conn = test_conn();
        let updated = update_health_check(&conn, "nope").expect("Should not error");
        assert!(!updated);
    }

    #[test]
    fn delete_mcp_server_removes_it() {
        let conn = test_conn();
        insert_mcp_server(&conn, "mcp-1", "test", "cmd", "[]", "{}", "global").unwrap();

        let deleted = delete_mcp_server(&conn, "mcp-1").expect("Should delete");
        assert!(deleted);

        let result = get_mcp_server(&conn, "mcp-1").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn delete_nonexistent_returns_false() {
        let conn = test_conn();
        let deleted = delete_mcp_server(&conn, "nope").expect("Should not error");
        assert!(!deleted);
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        let server = insert_mcp_server(&conn, "mcp-1", "test", "cmd", "[]", "{}", "global").unwrap();
        let json = serde_json::to_string(&server).expect("Should serialize");
        assert!(json.contains("lastHealthCheck"));
        assert!(!json.contains("last_health_check"));
    }
}
