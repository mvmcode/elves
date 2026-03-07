// Skill source CRUD — manage curated skill repositories and their individual skill items.

use rusqlite::{params, Connection};

use super::DbError;
use crate::registry::types::{CatalogSkillItem, SkillSource, SkillSourceItem};

/// Insert or update a skill source (upsert on repo_name).
#[allow(clippy::too_many_arguments)]
pub fn upsert_source(
    conn: &Connection,
    id: &str,
    repo_name: &str,
    repo_url: &str,
    description: Option<&str>,
    stars: i64,
    default_branch: &str,
    last_commit_sha: Option<&str>,
) -> Result<(), DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO skill_sources (id, repo_name, repo_url, description, stars, default_branch, last_fetched_at, last_commit_sha, enabled)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1)
         ON CONFLICT(repo_name) DO UPDATE SET
            repo_url = excluded.repo_url,
            description = excluded.description,
            stars = excluded.stars,
            default_branch = excluded.default_branch,
            last_fetched_at = excluded.last_fetched_at,
            last_commit_sha = excluded.last_commit_sha",
        params![id, repo_name, repo_url, description, stars, default_branch, now, last_commit_sha],
    )?;
    Ok(())
}

/// Get a skill source by ID.
pub fn get_source(conn: &Connection, id: &str) -> Result<Option<SkillSource>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, repo_name, repo_url, description, stars, default_branch, last_fetched_at, last_commit_sha, enabled
         FROM skill_sources WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(SkillSource {
                id: row.get(0)?,
                repo_name: row.get(1)?,
                repo_url: row.get(2)?,
                description: row.get(3)?,
                stars: row.get(4)?,
                default_branch: row.get(5)?,
                last_fetched_at: row.get(6)?,
                last_commit_sha: row.get(7)?,
                enabled: row.get::<_, i32>(8)? != 0,
            })
        })
        .optional()?;

    Ok(result)
}

/// Get a skill source by repo_name.
pub fn get_source_by_repo(conn: &Connection, repo_name: &str) -> Result<Option<SkillSource>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, repo_name, repo_url, description, stars, default_branch, last_fetched_at, last_commit_sha, enabled
         FROM skill_sources WHERE repo_name = ?1",
    )?;

    let result = stmt
        .query_row(params![repo_name], |row| {
            Ok(SkillSource {
                id: row.get(0)?,
                repo_name: row.get(1)?,
                repo_url: row.get(2)?,
                description: row.get(3)?,
                stars: row.get(4)?,
                default_branch: row.get(5)?,
                last_fetched_at: row.get(6)?,
                last_commit_sha: row.get(7)?,
                enabled: row.get::<_, i32>(8)? != 0,
            })
        })
        .optional()?;

    Ok(result)
}

/// List all skill sources, ordered by stars descending.
pub fn list_sources(conn: &Connection) -> Result<Vec<SkillSource>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, repo_name, repo_url, description, stars, default_branch, last_fetched_at, last_commit_sha, enabled
         FROM skill_sources ORDER BY stars DESC",
    )?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SkillSource {
                id: row.get(0)?,
                repo_name: row.get(1)?,
                repo_url: row.get(2)?,
                description: row.get(3)?,
                stars: row.get(4)?,
                default_branch: row.get(5)?,
                last_fetched_at: row.get(6)?,
                last_commit_sha: row.get(7)?,
                enabled: row.get::<_, i32>(8)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Delete a skill source by ID. Cascade deletes its items via FK constraint.
#[allow(dead_code)]
pub fn delete_source(conn: &Connection, id: &str) -> Result<bool, DbError> {
    let rows_affected = conn.execute("DELETE FROM skill_sources WHERE id = ?1", params![id])?;
    Ok(rows_affected > 0)
}

/// Insert or update a skill source item (upsert on source_id + file_path).
pub fn upsert_source_item(
    conn: &Connection,
    id: &str,
    source_id: &str,
    name: &str,
    description: Option<&str>,
    file_path: &str,
    category: Option<&str>,
) -> Result<(), DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO skill_source_items (id, source_id, name, description, file_path, category, last_updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(source_id, file_path) DO UPDATE SET
            name = excluded.name,
            description = COALESCE(skill_source_items.description, excluded.description),
            category = excluded.category,
            last_updated_at = excluded.last_updated_at",
        params![id, source_id, name, description, file_path, category, now],
    )?;
    Ok(())
}

/// Get a skill source item by ID.
pub fn get_source_item(conn: &Connection, id: &str) -> Result<Option<SkillSourceItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, source_id, name, description, file_path, content, category, last_updated_at
         FROM skill_source_items WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(SkillSourceItem {
                id: row.get(0)?,
                source_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                file_path: row.get(4)?,
                content: row.get(5)?,
                category: row.get(6)?,
                last_updated_at: row.get(7)?,
            })
        })
        .optional()?;

    Ok(result)
}

/// List all source items for a given source, ordered by name.
pub fn list_source_items(conn: &Connection, source_id: &str) -> Result<Vec<SkillSourceItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, source_id, name, description, file_path, content, category, last_updated_at
         FROM skill_source_items WHERE source_id = ?1 ORDER BY name ASC",
    )?;

    let rows = stmt
        .query_map(params![source_id], |row| {
            Ok(SkillSourceItem {
                id: row.get(0)?,
                source_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                file_path: row.get(4)?,
                content: row.get(5)?,
                category: row.get(6)?,
                last_updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Search source items by name or description using LIKE. Case-insensitive.
#[allow(dead_code)]
pub fn search_source_items(
    conn: &Connection,
    query: &str,
) -> Result<Vec<SkillSourceItem>, DbError> {
    let pattern = format!("%{query}%");
    let mut stmt = conn.prepare(
        "SELECT id, source_id, name, description, file_path, content, category, last_updated_at
         FROM skill_source_items
         WHERE name LIKE ?1 OR description LIKE ?1
         ORDER BY name ASC",
    )?;

    let rows = stmt
        .query_map(params![pattern], |row| {
            Ok(SkillSourceItem {
                id: row.get(0)?,
                source_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                file_path: row.get(4)?,
                content: row.get(5)?,
                category: row.get(6)?,
                last_updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// List all source items across all sources, joined with source metadata.
/// Returns a flat list suitable for the catalog UI.
pub fn list_all_source_items(conn: &Connection) -> Result<Vec<CatalogSkillItem>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.source_id, i.name, i.description, i.file_path, i.content, i.category, i.last_updated_at,
                s.repo_name, s.repo_url, s.stars
         FROM skill_source_items i
         JOIN skill_sources s ON i.source_id = s.id
         ORDER BY s.stars DESC, i.name ASC",
    )?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CatalogSkillItem {
                id: row.get(0)?,
                source_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                file_path: row.get(4)?,
                content: row.get(5)?,
                category: row.get(6)?,
                last_updated_at: row.get(7)?,
                source_repo_name: row.get(8)?,
                source_repo_url: row.get(9)?,
                source_stars: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Update a source item's description if it is currently NULL.
/// Used for lazy description extraction from markdown content.
pub fn update_source_item_description_if_empty(
    conn: &Connection,
    id: &str,
    description: &str,
) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "UPDATE skill_source_items SET description = ?1 WHERE id = ?2 AND description IS NULL",
        params![description, id],
    )?;
    Ok(rows_affected > 0)
}

/// Update the cached content of a source item after fetching from GitHub.
pub fn update_source_item_content(
    conn: &Connection,
    id: &str,
    content: &str,
) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "UPDATE skill_source_items SET content = ?1 WHERE id = ?2",
        params![content, id],
    )?;
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
