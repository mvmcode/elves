// Project CRUD operations — create, read, update, delete projects in SQLite.

use rusqlite::{params, Connection};
use serde::Serialize;

use super::DbError;

/// A project row as returned from the database, matching the frontend Project type.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub path: String,
    pub default_runtime: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub settings: String,
}

/// Insert a new project into the database. Returns the created project row.
pub fn create_project(
    conn: &Connection,
    id: &str,
    name: &str,
    path: &str,
) -> Result<ProjectRow, DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO projects (id, name, path, default_runtime, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'claude-code', ?4, ?5)",
        params![id, name, path, now, now],
    )?;

    get_project(conn, id)?.ok_or_else(|| {
        DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows)
    })
}

/// Retrieve a single project by ID.
pub fn get_project(conn: &Connection, id: &str) -> Result<Option<ProjectRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, default_runtime, created_at, updated_at, settings
         FROM projects WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                default_runtime: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                settings: row.get(6)?,
            })
        })
        .optional()?;

    Ok(result)
}

/// List all projects ordered by most recently updated.
pub fn list_projects(conn: &Connection) -> Result<Vec<ProjectRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, default_runtime, created_at, updated_at, settings
         FROM projects ORDER BY updated_at DESC",
    )?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                default_runtime: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                settings: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Delete a project by ID. Returns true if a row was deleted.
#[allow(dead_code)]
pub fn delete_project(conn: &Connection, id: &str) -> Result<bool, DbError> {
    let rows_affected = conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(rows_affected > 0)
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
    fn create_and_get_project() {
        let conn = test_conn();
        let project = create_project(&conn, "test-1", "My Project", "/tmp/my-project")
            .expect("Should create project");

        assert_eq!(project.id, "test-1");
        assert_eq!(project.name, "My Project");
        assert_eq!(project.path, "/tmp/my-project");
        assert_eq!(project.default_runtime, "claude-code");
        assert_eq!(project.settings, "{}");

        let fetched = get_project(&conn, "test-1")
            .expect("Should query")
            .expect("Should find project");
        assert_eq!(fetched.name, "My Project");
    }

    #[test]
    fn list_projects_returns_all() {
        let conn = test_conn();
        create_project(&conn, "p1", "First", "/tmp/first").unwrap();
        create_project(&conn, "p2", "Second", "/tmp/second").unwrap();

        let projects = list_projects(&conn).expect("Should list projects");
        assert_eq!(projects.len(), 2);
    }

    #[test]
    fn list_projects_empty() {
        let conn = test_conn();
        let projects = list_projects(&conn).expect("Should list");
        assert!(projects.is_empty());
    }

    #[test]
    fn delete_project_removes_it() {
        let conn = test_conn();
        create_project(&conn, "del-1", "To Delete", "/tmp/delete").unwrap();

        let deleted = delete_project(&conn, "del-1").expect("Should delete");
        assert!(deleted);

        let result = get_project(&conn, "del-1").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn delete_nonexistent_returns_false() {
        let conn = test_conn();
        let deleted = delete_project(&conn, "nope").expect("Should not error");
        assert!(!deleted);
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let conn = test_conn();
        let result = get_project(&conn, "nope").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        let project = create_project(&conn, "json-1", "JSON Test", "/tmp/json").unwrap();
        let json = serde_json::to_string(&project).expect("Should serialize");
        assert!(json.contains("defaultRuntime"));
        assert!(json.contains("createdAt"));
        assert!(json.contains("updatedAt"));
    }
}
