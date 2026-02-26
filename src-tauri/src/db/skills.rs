// Skill CRUD operations — create, read, update, delete reusable prompt templates.
//
// Skills can be scoped to a project (project_id set) or global (project_id NULL).
// Each skill has a name, description, content (the actual prompt), and an optional
// trigger pattern for auto-activation.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::DbError;

/// A skill row from the database, serialized to camelCase JSON for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRow {
    pub id: String,
    pub project_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    /// The prompt template content — the actual skill definition.
    pub content: String,
    /// Optional regex/glob pattern that triggers this skill automatically.
    pub trigger_pattern: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Insert a new skill. Returns the created skill row.
pub fn insert_skill(
    conn: &Connection,
    id: &str,
    project_id: Option<&str>,
    name: &str,
    description: Option<&str>,
    content: &str,
    trigger_pattern: Option<&str>,
) -> Result<SkillRow, DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO skills (id, project_id, name, description, content, trigger_pattern, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, project_id, name, description, content, trigger_pattern, now, now],
    )?;

    get_skill(conn, id)?.ok_or_else(|| DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows))
}

/// Retrieve a single skill by ID. Returns None if not found.
pub fn get_skill(conn: &Connection, id: &str) -> Result<Option<SkillRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, description, content, trigger_pattern, created_at, updated_at
         FROM skills WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(SkillRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                content: row.get(4)?,
                trigger_pattern: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .optional()?;

    Ok(result)
}

/// List all skills for a project, including global skills (NULL project_id).
/// Results ordered by name ascending.
pub fn list_skills(
    conn: &Connection,
    project_id: Option<&str>,
) -> Result<Vec<SkillRow>, DbError> {
    let mut stmt = match project_id {
        Some(_) => conn.prepare(
            "SELECT id, project_id, name, description, content, trigger_pattern, created_at, updated_at
             FROM skills WHERE project_id = ?1 OR project_id IS NULL ORDER BY name ASC",
        )?,
        None => conn.prepare(
            "SELECT id, project_id, name, description, content, trigger_pattern, created_at, updated_at
             FROM skills ORDER BY name ASC",
        )?,
    };

    let rows = match project_id {
        Some(pid) => stmt
            .query_map(params![pid], map_skill_row)?
            .collect::<Result<Vec<_>, _>>()?,
        None => stmt
            .query_map([], map_skill_row)?
            .collect::<Result<Vec<_>, _>>()?,
    };

    Ok(rows)
}

/// Update a skill's name, description, content, and trigger_pattern. Returns true if updated.
pub fn update_skill(
    conn: &Connection,
    id: &str,
    name: &str,
    description: Option<&str>,
    content: &str,
    trigger_pattern: Option<&str>,
) -> Result<bool, DbError> {
    let now = chrono::Utc::now().timestamp();
    let rows_affected = conn.execute(
        "UPDATE skills SET name = ?1, description = ?2, content = ?3, trigger_pattern = ?4, updated_at = ?5
         WHERE id = ?6",
        params![name, description, content, trigger_pattern, now, id],
    )?;
    Ok(rows_affected > 0)
}

/// Delete a skill by ID. Returns true if a row was deleted.
pub fn delete_skill(conn: &Connection, id: &str) -> Result<bool, DbError> {
    let rows_affected = conn.execute("DELETE FROM skills WHERE id = ?1", params![id])?;
    Ok(rows_affected > 0)
}

/// Map a rusqlite Row to a SkillRow. Used by list queries.
fn map_skill_row(row: &rusqlite::Row<'_>) -> Result<SkillRow, rusqlite::Error> {
    Ok(SkillRow {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        content: row.get(4)?,
        trigger_pattern: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
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
    fn insert_and_get_skill() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let skill = insert_skill(
            &conn,
            "skill-1",
            Some("proj-1"),
            "Code Review",
            Some("Reviews code for bugs and style"),
            "Review the following code for bugs, style issues, and performance...",
            Some("review *"),
        )
        .expect("Should insert skill");

        assert_eq!(skill.id, "skill-1");
        assert_eq!(skill.project_id.as_deref(), Some("proj-1"));
        assert_eq!(skill.name, "Code Review");
        assert_eq!(skill.description.as_deref(), Some("Reviews code for bugs and style"));
        assert!(skill.content.contains("Review the following code"));
        assert_eq!(skill.trigger_pattern.as_deref(), Some("review *"));
        assert!(skill.created_at > 0);
        assert_eq!(skill.created_at, skill.updated_at);

        let fetched = get_skill(&conn, "skill-1")
            .expect("Should query")
            .expect("Should find skill");
        assert_eq!(fetched.name, "Code Review");
    }

    #[test]
    fn insert_global_skill_no_project() {
        let conn = test_conn();

        let skill = insert_skill(
            &conn,
            "skill-global",
            None,
            "Quick Fix",
            None,
            "Fix this issue quickly",
            None,
        )
        .expect("Should insert global skill");

        assert!(skill.project_id.is_none());
        assert!(skill.description.is_none());
        assert!(skill.trigger_pattern.is_none());
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let conn = test_conn();
        let result = get_skill(&conn, "nope").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn list_skills_includes_project_and_global() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        insert_skill(&conn, "s1", Some("proj-1"), "Project Skill", None, "content", None).unwrap();
        insert_skill(&conn, "s2", None, "Global Skill", None, "content", None).unwrap();

        let skills = list_skills(&conn, Some("proj-1")).expect("Should list");
        assert_eq!(skills.len(), 2);
    }

    #[test]
    fn list_skills_excludes_other_projects() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");
        seed_project(&conn, "proj-2");

        insert_skill(&conn, "s1", Some("proj-1"), "Alpha", None, "content", None).unwrap();
        insert_skill(&conn, "s2", Some("proj-2"), "Beta", None, "content", None).unwrap();
        insert_skill(&conn, "s3", None, "Global", None, "content", None).unwrap();

        let proj1_skills = list_skills(&conn, Some("proj-1")).expect("Should list");
        assert_eq!(proj1_skills.len(), 2); // Alpha + Global
        let names: Vec<&str> = proj1_skills.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"Alpha"));
        assert!(names.contains(&"Global"));
        assert!(!names.contains(&"Beta"));
    }

    #[test]
    fn list_skills_all_when_no_project() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        insert_skill(&conn, "s1", Some("proj-1"), "A", None, "content", None).unwrap();
        insert_skill(&conn, "s2", None, "B", None, "content", None).unwrap();

        let all = list_skills(&conn, None).expect("Should list all");
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn list_skills_empty() {
        let conn = test_conn();
        let skills = list_skills(&conn, None).expect("Should list");
        assert!(skills.is_empty());
    }

    #[test]
    fn list_skills_ordered_by_name() {
        let conn = test_conn();

        insert_skill(&conn, "s1", None, "Zebra", None, "content", None).unwrap();
        insert_skill(&conn, "s2", None, "Alpha", None, "content", None).unwrap();
        insert_skill(&conn, "s3", None, "Mango", None, "content", None).unwrap();

        let skills = list_skills(&conn, None).expect("Should list");
        assert_eq!(skills[0].name, "Alpha");
        assert_eq!(skills[1].name, "Mango");
        assert_eq!(skills[2].name, "Zebra");
    }

    #[test]
    fn update_skill_works() {
        let conn = test_conn();

        insert_skill(&conn, "s1", None, "Old Name", Some("Old desc"), "old content", None).unwrap();

        let updated = update_skill(
            &conn,
            "s1",
            "New Name",
            Some("New desc"),
            "new content",
            Some("trigger *"),
        )
        .expect("Should update");
        assert!(updated);

        let fetched = get_skill(&conn, "s1").unwrap().unwrap();
        assert_eq!(fetched.name, "New Name");
        assert_eq!(fetched.description.as_deref(), Some("New desc"));
        assert_eq!(fetched.content, "new content");
        assert_eq!(fetched.trigger_pattern.as_deref(), Some("trigger *"));
        assert!(fetched.updated_at >= fetched.created_at);
    }

    #[test]
    fn update_nonexistent_returns_false() {
        let conn = test_conn();
        let updated = update_skill(&conn, "nope", "Name", None, "content", None)
            .expect("Should not error");
        assert!(!updated);
    }

    #[test]
    fn delete_skill_removes_it() {
        let conn = test_conn();
        insert_skill(&conn, "s1", None, "To Delete", None, "content", None).unwrap();

        let deleted = delete_skill(&conn, "s1").expect("Should delete");
        assert!(deleted);

        let result = get_skill(&conn, "s1").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn delete_nonexistent_returns_false() {
        let conn = test_conn();
        let deleted = delete_skill(&conn, "nope").expect("Should not error");
        assert!(!deleted);
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        let skill = insert_skill(&conn, "s1", None, "Test", None, "content", None).unwrap();
        let json = serde_json::to_string(&skill).expect("Should serialize");
        assert!(json.contains("projectId"));
        assert!(json.contains("triggerPattern"));
        assert!(json.contains("createdAt"));
        assert!(json.contains("updatedAt"));
    }
}
