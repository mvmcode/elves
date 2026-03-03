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
///
/// If a project with the same path already exists, returns the existing row
/// (with an updated `updated_at` timestamp) instead of creating a duplicate.
pub fn create_project(
    conn: &Connection,
    id: &str,
    name: &str,
    path: &str,
) -> Result<ProjectRow, DbError> {
    // De-duplicate by path — return existing project if one already points to this directory
    if let Some(existing) = get_project_by_path(conn, path)? {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE projects SET updated_at = ?1 WHERE id = ?2",
            params![now, existing.id],
        )?;
        return get_project(conn, &existing.id)?.ok_or_else(|| {
            DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows)
        });
    }

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

/// Retrieve a single project by its directory path. Used for dedup on create.
pub fn get_project_by_path(conn: &Connection, path: &str) -> Result<Option<ProjectRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, default_runtime, created_at, updated_at, settings
         FROM projects WHERE path = ?1",
    )?;

    let result = stmt
        .query_row(params![path], |row| {
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
    fn create_project_deduplicates_by_path() {
        let conn = test_conn();
        let first = create_project(&conn, "dup-1", "First Name", "/tmp/same-path")
            .expect("Should create project");
        assert_eq!(first.id, "dup-1");

        let second = create_project(&conn, "dup-2", "Second Name", "/tmp/same-path")
            .expect("Should return existing project");
        // Returns the existing project, not a new one
        assert_eq!(second.id, "dup-1");
        assert_eq!(second.name, "First Name");

        let all = list_projects(&conn).expect("Should list");
        assert_eq!(all.len(), 1, "Should have exactly one project, not two");
    }

    #[test]
    fn get_project_by_path_returns_match() {
        let conn = test_conn();
        create_project(&conn, "path-1", "By Path", "/tmp/find-me").unwrap();

        let found = get_project_by_path(&conn, "/tmp/find-me")
            .expect("Should query")
            .expect("Should find project");
        assert_eq!(found.id, "path-1");

        let not_found = get_project_by_path(&conn, "/tmp/not-here")
            .expect("Should query");
        assert!(not_found.is_none());
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
