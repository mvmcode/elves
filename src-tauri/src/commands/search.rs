// Search commands — query npm registry and GitHub for MCP servers and skills.
// Replaces the slow `claude -p` LLM approach with fast, direct HTTP API calls.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tauri::Emitter;

/// HTTP request timeout for registry searches.
const SEARCH_TIMEOUT: Duration = Duration::from_secs(10);

// ---------------------------------------------------------------------------
// Public result types (returned to the frontend)
// ---------------------------------------------------------------------------

/// A single MCP server search result, sourced from the npm registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpSearchResult {
    pub name: String,
    pub description: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: Option<HashMap<String, String>>,
    pub source_url: Option<String>,
    pub author: Option<String>,
    /// Weekly download count from npm, used for "popular" ranking in the UI.
    #[serde(default)]
    pub downloads: Option<u64>,
}

/// A single skill search result, sourced from GitHub repository search.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSearchResult {
    pub name: String,
    pub description: String,
    pub install_url: Option<String>,
    pub author: Option<String>,
    pub content: Option<String>,
    pub category: Option<String>,
    /// GitHub star count, used for ranking in the UI.
    #[serde(default)]
    pub stars: Option<u64>,
}

// ---------------------------------------------------------------------------
// Progress event payload
// ---------------------------------------------------------------------------

/// Payload emitted via `search:progress` events so the frontend can show phase and timing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchProgress {
    search_id: String,
    phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

// ---------------------------------------------------------------------------
// npm registry response types (for MCP server search)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct NpmSearchResponse {
    objects: Vec<NpmSearchObject>,
}

#[derive(Debug, Deserialize)]
struct NpmSearchObject {
    package: NpmPackage,
}

#[derive(Debug, Deserialize)]
struct NpmPackage {
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    links: Option<NpmLinks>,
    #[serde(default)]
    publisher: Option<NpmPublisher>,
    #[serde(default)]
    author: Option<NpmAuthor>,
}

#[derive(Debug, Deserialize)]
struct NpmLinks {
    #[serde(default)]
    repository: Option<String>,
    #[serde(default)]
    homepage: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NpmPublisher {
    #[serde(default)]
    username: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NpmAuthor {
    #[serde(default)]
    name: Option<String>,
}

// ---------------------------------------------------------------------------
// GitHub search response types (for skill search)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct GitHubSearchResponse {
    items: Vec<GitHubRepo>,
}

#[derive(Debug, Deserialize)]
struct GitHubRepo {
    #[serde(default)]
    name: String,
    #[serde(default)]
    full_name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    html_url: String,
    #[serde(default)]
    stargazers_count: u64,
    #[serde(default)]
    owner: Option<GitHubOwner>,
    #[serde(default)]
    topics: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubOwner {
    #[serde(default)]
    login: String,
}

// ---------------------------------------------------------------------------
// Shared HTTP client builder
// ---------------------------------------------------------------------------

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(SEARCH_TIMEOUT)
        .user_agent("ELVES-Desktop/1.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))
}

/// Emit a progress event to the frontend.
fn emit_progress(app: &tauri::AppHandle, search_id: &str, phase: &str) {
    let _ = app.emit(
        "search:progress",
        SearchProgress {
            search_id: search_id.to_string(),
            phase: phase.to_string(),
            result_count: None,
            error: None,
        },
    );
}

// ---------------------------------------------------------------------------
// MCP server search — npm registry
// ---------------------------------------------------------------------------

/// Search for MCP servers on the npm registry.
/// Uses `keywords:mcp-server` with the user query, sorted by popularity.
#[tauri::command]
pub async fn search_mcp_servers(
    query: String,
    app: tauri::AppHandle,
) -> Result<Vec<McpSearchResult>, String> {
    let search_id = uuid::Uuid::new_v4().to_string();
    emit_progress(&app, &search_id, "fetching");

    let client = build_client()?;
    let search_text = format!("keywords:mcp-server {query}");

    let response = client
        .get("https://registry.npmjs.org/-/v1/search")
        .query(&[
            ("text", search_text.as_str()),
            ("size", "12"),
            ("popularity", "1.0"),
        ])
        .send()
        .await
        .map_err(|e| {
            let msg = if e.is_timeout() {
                "Search timed out — check your internet connection".to_string()
            } else {
                format!("Search request failed: {e}")
            };
            let _ = app.emit(
                "search:progress",
                SearchProgress {
                    search_id: search_id.clone(),
                    phase: "error".to_string(),
                    result_count: None,
                    error: Some(msg.clone()),
                },
            );
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error = format!("npm registry returned {status}");
        let _ = app.emit(
            "search:progress",
            SearchProgress {
                search_id,
                phase: "error".to_string(),
                result_count: None,
                error: Some(error.clone()),
            },
        );
        return Err(error);
    }

    let npm_response: NpmSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse npm response: {e}"))?;

    let results: Vec<McpSearchResult> = npm_response
        .objects
        .into_iter()
        .map(|obj| {
            let pkg = obj.package;
            let author = pkg
                .publisher
                .and_then(|p| p.username)
                .or_else(|| pkg.author.and_then(|a| a.name));
            let source_url = pkg
                .links
                .as_ref()
                .and_then(|l| l.repository.clone().or_else(|| l.homepage.clone()));

            McpSearchResult {
                command: "npx".to_string(),
                args: vec!["-y".to_string(), pkg.name.clone()],
                name: pkg.name,
                description: pkg.description.unwrap_or_default(),
                env: None,
                source_url,
                author,
                downloads: None,
            }
        })
        .collect();

    let _ = app.emit(
        "search:progress",
        SearchProgress {
            search_id,
            phase: "done".to_string(),
            result_count: Some(results.len()),
            error: None,
        },
    );

    Ok(results)
}

// ---------------------------------------------------------------------------
// Skill search — GitHub repository search
// ---------------------------------------------------------------------------

/// Search for Claude Code skills/commands on GitHub.
/// Queries for repos related to "claude code" + the user query, sorted by stars.
#[tauri::command]
pub async fn search_skills(
    query: String,
    app: tauri::AppHandle,
) -> Result<Vec<SkillSearchResult>, String> {
    let search_id = uuid::Uuid::new_v4().to_string();
    emit_progress(&app, &search_id, "fetching");

    let client = build_client()?;
    let search_query = format!("{query} claude code commands OR skill OR slash-command");

    let response = client
        .get("https://api.github.com/search/repositories")
        .query(&[
            ("q", search_query.as_str()),
            ("sort", "stars"),
            ("order", "desc"),
            ("per_page", "12"),
        ])
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| {
            let msg = if e.is_timeout() {
                "Search timed out — check your internet connection".to_string()
            } else {
                format!("Search request failed: {e}")
            };
            let _ = app.emit(
                "search:progress",
                SearchProgress {
                    search_id: search_id.clone(),
                    phase: "error".to_string(),
                    result_count: None,
                    error: Some(msg.clone()),
                },
            );
            msg
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error = if status == reqwest::StatusCode::FORBIDDEN {
            "GitHub rate limit reached — try again in a minute".to_string()
        } else {
            format!("GitHub search returned {status}")
        };
        let _ = app.emit(
            "search:progress",
            SearchProgress {
                search_id,
                phase: "error".to_string(),
                result_count: None,
                error: Some(error.clone()),
            },
        );
        return Err(error);
    }

    let gh_response: GitHubSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {e}"))?;

    let results: Vec<SkillSearchResult> = gh_response
        .items
        .into_iter()
        .map(|repo| {
            let category = repo.topics.first().cloned();
            let author = repo.owner.map(|o| o.login);

            SkillSearchResult {
                name: repo.name,
                description: repo.description.unwrap_or_else(|| repo.full_name.clone()),
                install_url: Some(repo.html_url),
                author,
                content: None,
                category,
                stars: Some(repo.stargazers_count),
            }
        })
        .collect();

    let _ = app.emit(
        "search:progress",
        SearchProgress {
            search_id,
            phase: "done".to_string(),
            result_count: Some(results.len()),
            error: None,
        },
    );

    Ok(results)
}

// ---------------------------------------------------------------------------
// Skill installation (unchanged — still uses git clone)
// ---------------------------------------------------------------------------

/// Install a skill from a git URL by cloning into ~/.claude/commands/.
#[tauri::command]
pub async fn install_skill_from_url(
    url: String,
    project_path: Option<String>,
) -> Result<bool, String> {
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

    let output = tokio::process::Command::new("git")
        .args(["clone", "--depth", "1", &url])
        .current_dir(&target_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run git clone: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {stderr}"));
    }

    Ok(true)
}
