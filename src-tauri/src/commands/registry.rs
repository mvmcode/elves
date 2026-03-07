// Registry commands — curated skill catalog, installation, and update checking.

use crate::commands::projects::DbState;
use crate::db;
use crate::db::skills::SkillRow;
use crate::registry::catalog;
use crate::registry::fetcher;
use crate::registry::types::{CatalogSkillItem, SkillSource, SkillSourceItem, SkillUpdateInfo, RemoteSkillResult};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

/// Progress event payload for registry operations.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegistryProgress {
    phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

/// Emit a progress event to the frontend.
fn emit_progress(app: &tauri::AppHandle, phase: &str, detail: Option<&str>) {
    let _ = app.emit(
        "registry:progress",
        RegistryProgress {
            phase: phase.to_string(),
            detail: detail.map(|s| s.to_string()),
        },
    );
}

/// Combined search results from local, catalog, and remote tiers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultsV2 {
    pub local: Vec<SkillRow>,
    pub catalog: Vec<SkillSourceItem>,
    pub remote: Vec<RemoteSkillResult>,
}

/// Refresh the skill catalog by fetching metadata and tree listings from curated sources.
#[tauri::command]
pub async fn refresh_skill_catalog(
    db: State<'_, DbState>,
    app: tauri::AppHandle,
) -> Result<Vec<SkillSource>, String> {
    let sources = catalog::curated_sources();
    let mut result_sources = Vec::new();

    for (i, curated) in sources.iter().enumerate() {
        emit_progress(
            &app,
            "fetching",
            Some(&format!("{}/{}: {}", i + 1, sources.len(), curated.repo_name)),
        );

        // Fetch repo metadata
        let metadata = match fetcher::fetch_repo_metadata(&curated.repo_name).await {
            Ok(m) => m,
            Err(e) => {
                log::warn!("Failed to fetch metadata for {}: {e}", curated.repo_name);
                continue;
            }
        };

        let source_id = uuid::Uuid::new_v4().to_string();
        let repo_url = format!("https://github.com/{}", curated.repo_name);

        // Fetch latest commit
        let latest_commit = fetcher::fetch_latest_commit(&curated.repo_name, &metadata.default_branch)
            .await
            .ok();

        // Upsert the source
        {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            db::skill_sources::upsert_source(
                &conn,
                &source_id,
                &curated.repo_name,
                &repo_url,
                metadata.description.as_deref(),
                metadata.stars,
                &metadata.default_branch,
                latest_commit.as_deref(),
            )
            .map_err(|e| format!("DB error: {e}"))?;
        }

        // Fetch tree and upsert items
        match fetcher::fetch_tree(&curated.repo_name, &metadata.default_branch).await {
            Ok(entries) => {
                let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;

                // Look up the actual source ID (upsert may have used existing row)
                let actual_source = db::skill_sources::get_source_by_repo(&conn, &curated.repo_name)
                    .map_err(|e| format!("DB error: {e}"))?;
                let actual_id = actual_source
                    .as_ref()
                    .map(|s| s.id.as_str())
                    .unwrap_or(&source_id);

                for entry in &entries {
                    let name = entry
                        .path
                        .rsplit('/')
                        .next()
                        .unwrap_or(&entry.path)
                        .trim_end_matches(".md")
                        .to_string();

                    let category = entry
                        .path
                        .split('/')
                        .next()
                        .filter(|seg| *seg != entry.path.as_str())
                        .map(|s| s.to_string());

                    let item_id = uuid::Uuid::new_v4().to_string();
                    let _ = db::skill_sources::upsert_source_item(
                        &conn,
                        &item_id,
                        actual_id,
                        &name,
                        None,
                        &entry.path,
                        category.as_deref(),
                    );
                }

                if let Some(src) = actual_source {
                    result_sources.push(src);
                }
            }
            Err(e) => {
                log::warn!("Failed to fetch tree for {}: {e}", curated.repo_name);
            }
        }
    }

    emit_progress(&app, "done", None);
    Ok(result_sources)
}

/// List all tracked skill sources.
#[tauri::command]
pub fn list_skill_sources(db: State<'_, DbState>) -> Result<Vec<SkillSource>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skill_sources::list_sources(&conn).map_err(|e| format!("Database error: {e}"))
}

/// Browse individual skill items within a source.
#[tauri::command]
pub fn browse_source_skills(
    db: State<'_, DbState>,
    source_id: String,
) -> Result<Vec<SkillSourceItem>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skill_sources::list_source_items(&conn, &source_id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Install selected skills by their source item IDs.
#[tauri::command]
pub async fn install_selected_skills(
    db: State<'_, DbState>,
    item_ids: Vec<String>,
    project_path: Option<String>,
) -> Result<Vec<String>, String> {
    let mut installed = Vec::new();

    for item_id in &item_ids {
        let (item, source) = {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            let item = db::skill_sources::get_source_item(&conn, item_id)
                .map_err(|e| format!("DB error: {e}"))?
                .ok_or_else(|| format!("Source item {item_id} not found"))?;
            let source = db::skill_sources::get_source(&conn, &item.source_id)
                .map_err(|e| format!("DB error: {e}"))?
                .ok_or_else(|| format!("Source {} not found", item.source_id))?;
            (item, source)
        };

        let target_dir = if let Some(ref path) = project_path {
            std::path::PathBuf::from(path).join(".claude").join("commands")
        } else {
            dirs::home_dir()
                .ok_or("Could not determine home directory")?
                .join(".claude")
                .join("commands")
        };

        tokio::fs::create_dir_all(&target_dir)
            .await
            .map_err(|e| format!("Failed to create commands directory: {e}"))?;

        let content = if let Some(ref cached) = item.content {
            cached.clone()
        } else {
            let branch = &source.default_branch;
            fetcher::fetch_skill_content(&source.repo_name, branch, &item.file_path).await?
        };

        let filename = sanitize_filename(&item.name);
        let file_path = target_dir.join(format!("{filename}.md"));
        tokio::fs::write(&file_path, &content)
            .await
            .map_err(|e| format!("Failed to write skill file: {e}"))?;

        // Create a skill DB entry
        let skill_id = uuid::Uuid::new_v4().to_string();
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::skills::insert_skill(
            &conn,
            &skill_id,
            None,
            &item.name,
            item.description.as_deref(),
            &content,
            None,
        )
        .map_err(|e| format!("DB error creating skill: {e}"))?;

        // Cache content in source item
        let _ = db::skill_sources::update_source_item_content(&conn, &item.id, &content);

        installed.push(item.name.clone());
    }

    Ok(installed)
}

/// Toggle a skill source's enabled state.
#[tauri::command]
pub fn toggle_skill(db: State<'_, DbState>, source_id: String) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let rows_affected = conn
        .execute(
            "UPDATE skill_sources SET enabled = NOT enabled WHERE id = ?1",
            rusqlite::params![source_id],
        )
        .map_err(|e| format!("DB error: {e}"))?;
    Ok(rows_affected > 0)
}

/// Check for updates to installed skills by comparing commit SHAs.
#[tauri::command]
pub async fn check_skill_updates(
    db: State<'_, DbState>,
) -> Result<Vec<SkillUpdateInfo>, String> {
    let skills_with_sources = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn
            .prepare(
                "SELECT s.id, s.name, s.source_item_id, s.installed_commit, ss.repo_name, ss.default_branch
                 FROM skills s
                 JOIN skill_source_items si ON s.source_item_id = si.id
                 JOIN skill_sources ss ON si.source_id = ss.id
                 WHERE s.source_item_id IS NOT NULL",
            )
            .map_err(|e| format!("DB error: {e}"))?;

        let rows: Vec<(String, String, String, Option<String>, String, String)> = stmt
            .query_map([], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            })
            .map_err(|e| format!("DB error: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("DB error: {e}"))?;

        rows
    };

    let mut updates = Vec::new();

    for (skill_id, skill_name, source_item_id, current_commit, repo_name, branch) in
        &skills_with_sources
    {
        if let Ok(latest) = fetcher::fetch_latest_commit(repo_name, branch).await {
            let needs_update = match current_commit {
                Some(current) => current != &latest,
                None => true,
            };
            if needs_update {
                updates.push(SkillUpdateInfo {
                    skill_id: skill_id.clone(),
                    skill_name: skill_name.clone(),
                    source_item_id: source_item_id.clone(),
                    current_commit: current_commit.clone(),
                    latest_commit: latest,
                    source_repo_name: repo_name.clone(),
                });
            }
        }
    }

    Ok(updates)
}

/// List all catalog skills from all sources as a flat list.
#[tauri::command]
pub fn list_all_catalog_skills(db: State<'_, DbState>) -> Result<Vec<CatalogSkillItem>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skill_sources::list_all_source_items(&conn).map_err(|e| format!("Database error: {e}"))
}

/// Install a single skill from the catalog by its source item ID.
#[tauri::command]
pub async fn install_skill(
    db: State<'_, DbState>,
    item_id: String,
    project_path: Option<String>,
) -> Result<bool, String> {
    // Load the source item and its parent source
    let (item, source) = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let item = db::skill_sources::get_source_item(&conn, &item_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Source item {item_id} not found"))?;
        let source = db::skill_sources::get_source(&conn, &item.source_id)
            .map_err(|e| format!("DB error: {e}"))?
            .ok_or_else(|| format!("Source {} not found", item.source_id))?;
        (item, source)
    };

    // Determine target directory
    let target_dir = if let Some(ref path) = project_path {
        std::path::PathBuf::from(path)
            .join(".claude")
            .join("commands")
    } else {
        dirs::home_dir()
            .ok_or("Could not determine home directory")?
            .join(".claude")
            .join("commands")
    };

    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|e| format!("Failed to create commands directory: {e}"))?;

    let metadata = fetcher::fetch_repo_metadata(&source.repo_name).await?;
    let branch = &metadata.default_branch;

    // Fetch content
    let content = if let Some(ref cached) = item.content {
        cached.clone()
    } else {
        fetcher::fetch_skill_content(&source.repo_name, branch, &item.file_path).await?
    };

    // Fetch latest commit for source tracking
    let latest_commit = fetcher::fetch_latest_commit(&source.repo_name, branch)
        .await
        .unwrap_or_default();

    let now = chrono::Utc::now().timestamp();

    // Write the .md file
    let filename = sanitize_filename(&item.name);
    let file_path = target_dir.join(format!("{filename}.md"));
    tokio::fs::write(&file_path, &content)
        .await
        .map_err(|e| format!("Failed to write skill file: {e}"))?;

    // Create a skill DB entry with source tracking
    let skill_id = uuid::Uuid::new_v4().to_string();
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::skills::insert_skill_full(
        &conn,
        &skill_id,
        None, // global scope
        &item.name,
        item.description.as_deref(),
        &content,
        None, // no trigger pattern
        Some(&source.repo_url),
        Some(&item.id),
        Some(now),
        if latest_commit.is_empty() {
            None
        } else {
            Some(latest_commit.as_str())
        },
    )
    .map_err(|e| format!("DB error creating skill: {e}"))?;

    // Cache content in source item
    let _ = db::skill_sources::update_source_item_content(&conn, &item.id, &content);

    Ok(true)
}

/// Fetch and return the raw content of a skill file from GitHub.
/// Caches the content and extracts a description if the item has none.
#[tauri::command]
pub async fn preview_skill_content(
    db: State<'_, DbState>,
    repo_name: String,
    file_path: String,
) -> Result<String, String> {
    // Try to determine the branch — default to "main"
    let branch = match fetcher::fetch_repo_metadata(&repo_name).await {
        Ok(meta) => meta.default_branch,
        Err(_) => "main".to_string(),
    };

    let content = fetcher::fetch_skill_content(&repo_name, &branch, &file_path).await?;

    // Try to cache in DB — find a matching source item by file_path
    if let Ok(conn) = db.0.lock() {
        let item_id: Option<String> = conn
            .prepare("SELECT id FROM skill_source_items WHERE file_path = ?1 LIMIT 1")
            .ok()
            .and_then(|mut stmt| {
                stmt.query_row(rusqlite::params![file_path], |row| row.get(0))
                    .ok()
            });

        if let Some(id) = item_id {
            let _ = db::skill_sources::update_source_item_content(&conn, &id, &content);
            // Extract and cache description if empty
            let description = extract_description_from_markdown(&content);
            if let Some(desc) = description {
                let _ = db::skill_sources::update_source_item_description_if_empty(&conn, &id, &desc);
            }
        }
    }

    Ok(content)
}

/// Search installed skills only (local tier). Catalog and GitHub discovery
/// are handled by the catalog tab's unified search bar instead.
#[tauri::command]
pub async fn search_skills_v2(
    db: State<'_, DbState>,
    app: tauri::AppHandle,
    query: String,
) -> Result<SearchResultsV2, String> {
    emit_progress(&app, "searching", Some("local"));

    let local = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let all_local = db::skills::list_skills(&conn, None)
            .map_err(|e| format!("DB error: {e}"))?;
        let query_lower = query.to_lowercase();
        all_local
            .into_iter()
            .filter(|s| {
                s.name.to_lowercase().contains(&query_lower)
                    || s.description
                        .as_ref()
                        .map(|d| d.to_lowercase().contains(&query_lower))
                        .unwrap_or(false)
                    || s.content.to_lowercase().contains(&query_lower)
            })
            .collect::<Vec<SkillRow>>()
    };

    emit_progress(&app, "done", None);

    Ok(SearchResultsV2 {
        local,
        catalog: vec![],
        remote: vec![],
    })
}

/// Search the GitHub API for skill repositories matching a query.
/// Used by the catalog tab's unified search bar for the "From GitHub" section.
#[tauri::command]
pub async fn search_github_catalog(query: String) -> Result<Vec<RemoteSkillResult>, String> {
    fetcher::search_github_skills(&query).await
}

/// Extract a description from markdown content.
/// Returns the first non-heading, non-empty, non-frontmatter line, truncated to 120 chars.
fn extract_description_from_markdown(content: &str) -> Option<String> {
    let mut in_frontmatter = false;
    let mut frontmatter_started = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // Handle YAML frontmatter (--- delimited)
        if trimmed == "---" {
            if !frontmatter_started {
                frontmatter_started = true;
                in_frontmatter = true;
                continue;
            } else if in_frontmatter {
                in_frontmatter = false;
                continue;
            }
        }
        if in_frontmatter {
            continue;
        }

        // Skip empty lines
        if trimmed.is_empty() {
            continue;
        }

        // Skip headings
        if trimmed.starts_with('#') {
            continue;
        }

        // Skip HTML comments
        if trimmed.starts_with("<!--") {
            continue;
        }

        // Found a content line — truncate and return
        let desc = if trimmed.len() > 120 {
            format!("{}...", &trimmed[..117])
        } else {
            trimmed.to_string()
        };
        return Some(desc);
    }

    None
}

/// Sanitize a string for use as a filename. Replaces non-alphanumeric characters with hyphens.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
        .to_lowercase()
}
