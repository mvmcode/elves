// GitHub API fetcher — retrieves repo metadata, tree listings, file content, and commits.

use std::time::Duration;

use super::types::{
    GitHubCommitResponse, GitHubRepoResponse, GitHubTreeResponse, RemoteSkillResult, RepoMetadata,
    TreeEntry,
};

/// HTTP request timeout for GitHub API calls.
const FETCH_TIMEOUT: Duration = Duration::from_secs(15);

/// Build an HTTP client configured for GitHub API requests.
fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(FETCH_TIMEOUT)
        .user_agent("ELVES-Desktop/1.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))
}

/// Fetch repository metadata (default branch, description, stars) from the GitHub API.
pub async fn fetch_repo_metadata(repo_name: &str) -> Result<RepoMetadata, String> {
    let client = build_client()?;
    let url = format!("https://api.github.com/repos/{repo_name}");

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch repo metadata: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned {} for {repo_name}",
            response.status()
        ));
    }

    let repo: GitHubRepoResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse repo metadata: {e}"))?;

    Ok(RepoMetadata {
        default_branch: repo.default_branch,
        description: repo.description,
        stars: repo.stargazers_count,
        full_name: repo.full_name,
    })
}

/// Fetch the full Git tree for a repository at a given branch.
/// Returns only blob entries with `.md` extension (skill files).
pub async fn fetch_tree(repo_name: &str, branch: &str) -> Result<Vec<TreeEntry>, String> {
    let client = build_client()?;
    let url = format!(
        "https://api.github.com/repos/{repo_name}/git/trees/{branch}?recursive=1"
    );

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch tree: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned {} for tree of {repo_name}",
            response.status()
        ));
    }

    let tree_response: GitHubTreeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse tree response: {e}"))?;

    let entries: Vec<TreeEntry> = tree_response
        .tree
        .into_iter()
        .filter(|gh_entry| gh_entry.entry_type == "blob" && gh_entry.path.ends_with(".md"))
        .map(|gh_entry| TreeEntry {
            path: gh_entry.path,
        })
        .collect();

    Ok(entries)
}

/// Fetch the raw content of a single file from a GitHub repository.
pub async fn fetch_skill_content(
    repo_name: &str,
    branch: &str,
    file_path: &str,
) -> Result<String, String> {
    let client = build_client()?;
    let url = format!(
        "https://raw.githubusercontent.com/{repo_name}/{branch}/{file_path}"
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch skill content: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub returned {} for {repo_name}/{file_path}",
            response.status()
        ));
    }

    response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))
}

/// Fetch the latest commit SHA for a branch.
pub async fn fetch_latest_commit(repo_name: &str, branch: &str) -> Result<String, String> {
    let client = build_client()?;
    let url = format!("https://api.github.com/repos/{repo_name}/commits/{branch}");

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch latest commit: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned {} for commits of {repo_name}",
            response.status()
        ));
    }

    let commit: GitHubCommitResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse commit response: {e}"))?;

    Ok(commit.sha)
}

/// Search GitHub for skill repositories matching a query.
pub async fn search_github_skills(query: &str) -> Result<Vec<RemoteSkillResult>, String> {
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
        .map_err(|e| format!("Search request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        return if status == reqwest::StatusCode::FORBIDDEN {
            Err("GitHub rate limit reached — try again in a minute".to_string())
        } else {
            Err(format!("GitHub search returned {status}"))
        };
    }

    #[derive(Debug, serde::Deserialize)]
    struct SearchResponse {
        items: Vec<SearchItem>,
    }

    #[derive(Debug, serde::Deserialize)]
    struct SearchItem {
        full_name: String,
        #[serde(default)]
        description: Option<String>,
        html_url: String,
        stargazers_count: i64,
        owner: Option<SearchOwner>,
    }

    #[derive(Debug, serde::Deserialize)]
    struct SearchOwner {
        login: String,
    }

    let search_response: SearchResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub search response: {e}"))?;

    let results = search_response
        .items
        .into_iter()
        .map(|item| RemoteSkillResult {
            repo_name: item.full_name.clone(),
            description: item
                .description
                .unwrap_or_else(|| item.full_name.clone()),
            stars: item.stargazers_count,
            url: item.html_url,
            author: item
                .owner
                .map(|o| o.login)
                .unwrap_or_else(|| "unknown".to_string()),
        })
        .collect();

    Ok(results)
}
