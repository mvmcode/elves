// Types for the skill registry — sources, items, catalog entries, and GitHub API responses.

use serde::{Deserialize, Serialize};

/// A curated skill source repository entry from the built-in catalog.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CuratedSource {
    pub repo_name: String,
    pub description: String,
    pub categories: Vec<String>,
}

/// A skill source (GitHub repository) tracked in the local database.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSource {
    pub id: String,
    pub repo_name: String,
    pub repo_url: String,
    pub description: Option<String>,
    pub stars: i64,
    pub default_branch: String,
    pub last_fetched_at: i64,
    pub last_commit_sha: Option<String>,
    pub enabled: bool,
}

/// A single skill file within a source repository.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSourceItem {
    pub id: String,
    pub source_id: String,
    pub name: String,
    pub description: Option<String>,
    pub file_path: String,
    pub content: Option<String>,
    pub category: Option<String>,
    pub last_updated_at: i64,
}

/// A flattened catalog skill item — combines SkillSourceItem fields with source metadata.
/// Used by the flat catalog UI to display all skills from all curated repos in one list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSkillItem {
    pub id: String,
    pub source_id: String,
    pub name: String,
    pub description: Option<String>,
    pub file_path: String,
    pub content: Option<String>,
    pub category: Option<String>,
    pub last_updated_at: i64,
    pub source_repo_name: String,
    pub source_repo_url: String,
    pub source_stars: i64,
}

/// Information about an available update for a skill.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillUpdateInfo {
    pub skill_id: String,
    pub skill_name: String,
    pub source_item_id: String,
    pub current_commit: Option<String>,
    pub latest_commit: String,
    pub source_repo_name: String,
}

/// A single entry from a GitHub tree listing. Only the path is used downstream.
#[derive(Debug, Clone)]
pub struct TreeEntry {
    pub path: String,
}

/// Repository metadata returned by the GitHub API.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoMetadata {
    pub default_branch: String,
    pub description: Option<String>,
    pub stars: i64,
    pub full_name: String,
}

/// Raw GitHub tree entry from the API response.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub(crate) struct GitHubTreeEntry {
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub sha: String,
}

/// GitHub tree API response.
#[derive(Debug, Deserialize)]
pub(crate) struct GitHubTreeResponse {
    pub tree: Vec<GitHubTreeEntry>,
    #[allow(dead_code)]
    pub truncated: bool,
}

/// GitHub repo API response for metadata.
#[derive(Debug, Deserialize)]
pub(crate) struct GitHubRepoResponse {
    pub default_branch: String,
    pub description: Option<String>,
    pub stargazers_count: i64,
    pub full_name: String,
}

/// GitHub commit API response (minimal).
#[derive(Debug, Deserialize)]
pub(crate) struct GitHubCommitResponse {
    pub sha: String,
}

/// A remote skill result from GitHub search (used by search_github_skills).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSkillResult {
    pub repo_name: String,
    pub description: String,
    pub stars: i64,
    pub url: String,
    pub author: String,
}
