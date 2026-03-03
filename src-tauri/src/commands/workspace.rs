// Workspace commands — manage worktree-based workspaces with lifecycle operations.
//
// A workspace is a git worktree under `.claude/worktrees/<slug>` with a branch
// named `worktree-<slug>`. These commands handle creation, listing, diffing,
// pushing, PR creation, merging, removal, and the full "Ship It" completion flow.

use serde::Serialize;
use std::fs;
use std::path::Path;

use super::git::run_git;
use crate::project::config::{self, ProjectConfig};

/// Information about a single workspace (worktree + session metadata).
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    /// URL-safe identifier derived from the worktree directory name.
    pub slug: String,
    /// Absolute filesystem path to the worktree directory.
    pub path: String,
    /// Git branch name associated with this workspace.
    pub branch: String,
    /// Current status: "active", "idle", "paused", or "stale".
    pub status: String,
    /// Number of files with uncommitted changes in the worktree.
    pub files_changed: u32,
    /// ISO-8601 timestamp of the most recent commit, if available.
    pub last_modified: Option<String>,
}

/// Diff statistics between a workspace branch and its base branch.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDiff {
    /// Total number of files changed.
    pub files_changed: u32,
    /// Total lines inserted.
    pub insertions: u32,
    /// Total lines deleted.
    pub deletions: u32,
    /// Per-file diff breakdown.
    pub files: Vec<DiffFile>,
}

/// Per-file diff statistics.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffFile {
    /// Relative file path.
    pub path: String,
    /// Lines inserted in this file.
    pub insertions: u32,
    /// Lines deleted in this file.
    pub deletions: u32,
    /// Change type: "added", "modified", or "deleted".
    pub status: String,
}

/// Validate that a slug contains only alphanumeric characters and hyphens.
fn validate_slug(slug: &str) -> Result<(), String> {
    if slug.is_empty() {
        return Err("Workspace slug cannot be empty".to_string());
    }
    if !slug
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err(
            "Workspace slug must contain only alphanumeric characters and hyphens".to_string(),
        );
    }
    Ok(())
}

/// Resolve the worktree directory path for a given slug.
fn worktree_dir(project_path: &str, slug: &str) -> String {
    Path::new(project_path)
        .join(".claude")
        .join("worktrees")
        .join(slug)
        .to_string_lossy()
        .to_string()
}

/// Resolve the relative worktree path (used in git commands run from project root).
fn worktree_relative(slug: &str) -> String {
    format!(".claude/worktrees/{slug}")
}

/// Create a new workspace backed by a git worktree.
///
/// Validates the slug, creates a worktree at `.claude/worktrees/<slug>` with branch
/// `worktree-<slug>`, and ensures the `.elves/` project directory exists.
/// Returns the new workspace info with status "idle".
#[tauri::command]
pub fn create_workspace(
    project_path: String,
    slug: String,
    base_branch: Option<String>,
) -> Result<WorkspaceInfo, String> {
    validate_slug(&slug)?;

    let branch_name = format!("worktree-{slug}");
    let relative_path = worktree_relative(&slug);
    let mut args = vec!["worktree", "add", &relative_path, "-b", &branch_name];

    let base = base_branch.unwrap_or_default();
    if !base.is_empty() {
        args.push(&base);
    }

    run_git(&project_path, &args)?;

    // Ensure .elves/ directory exists in the project root
    let elves_dir = Path::new(&project_path).join(".elves");
    if !elves_dir.exists() {
        fs::create_dir_all(&elves_dir)
            .map_err(|e| format!("Failed to create .elves/ directory: {e}"))?;
    }

    let abs_path = worktree_dir(&project_path, &slug);

    Ok(WorkspaceInfo {
        slug,
        path: abs_path,
        branch: branch_name,
        status: "idle".to_string(),
        files_changed: 0,
        last_modified: None,
    })
}

/// List all workspaces (worktrees under `.claude/worktrees/`).
///
/// Parses `git worktree list --porcelain`, filters to managed worktrees,
/// checks each for uncommitted changes, and returns workspace metadata.
#[tauri::command]
pub fn list_workspaces(project_path: String) -> Result<Vec<WorkspaceInfo>, String> {
    let output = run_git(&project_path, &["worktree", "list", "--porcelain"])?;
    let worktrees_prefix = Path::new(&project_path)
        .join(".claude")
        .join("worktrees")
        .to_string_lossy()
        .to_string();

    let mut workspaces = Vec::new();

    for block in output.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let mut path = String::new();
        let mut branch = String::new();

        for line in block.lines() {
            if let Some(p) = line.strip_prefix("worktree ") {
                path = p.to_string();
            } else if let Some(b) = line.strip_prefix("branch ") {
                branch = b.strip_prefix("refs/heads/").unwrap_or(b).to_string();
            }
        }

        // Only include worktrees under .claude/worktrees/
        if path.is_empty() || !path.starts_with(&worktrees_prefix) {
            continue;
        }

        // Extract slug from the last path segment
        let slug = Path::new(&path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        if slug.is_empty() {
            continue;
        }

        // Count uncommitted changes
        let files_changed = if Path::new(&path).exists() {
            let status = run_git(&path, &["status", "--porcelain"]).unwrap_or_default();
            status.lines().filter(|l| !l.trim().is_empty()).count() as u32
        } else {
            0
        };

        // Get last commit date (ISO 8601)
        let last_modified = run_git(&path, &["log", "-1", "--format=%aI"])
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        // Determine status based on worktree state
        let status = if files_changed > 0 {
            "active".to_string()
        } else {
            "idle".to_string()
        };

        workspaces.push(WorkspaceInfo {
            slug,
            path,
            branch,
            status,
            files_changed,
            last_modified,
        });
    }

    Ok(workspaces)
}

/// Get diff statistics between a workspace branch and the base branch (main/master).
///
/// Uses `git diff --numstat` for machine-parseable per-file stats and
/// `git diff --stat` summary line for totals.
#[tauri::command]
pub fn get_workspace_diff(
    project_path: String,
    slug: String,
) -> Result<WorkspaceDiff, String> {
    validate_slug(&slug)?;

    let branch_name = format!("worktree-{slug}");

    // Determine base branch — try "main", then "master"
    let base = if run_git(&project_path, &["rev-parse", "--verify", "main"]).is_ok() {
        "main"
    } else if run_git(&project_path, &["rev-parse", "--verify", "master"]).is_ok() {
        "master"
    } else {
        "HEAD"
    };

    let range = format!("{base}...{branch_name}");

    // Get per-file stats with --numstat (machine-readable: insertions \t deletions \t path)
    let numstat_output = run_git(&project_path, &["diff", "--numstat", &range])
        .unwrap_or_default();

    let mut files = Vec::new();
    let mut total_insertions: u32 = 0;
    let mut total_deletions: u32 = 0;

    for line in numstat_output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() < 3 {
            continue;
        }

        // Binary files show "-" for insertions/deletions
        let insertions = parts[0].parse::<u32>().unwrap_or(0);
        let deletions = parts[1].parse::<u32>().unwrap_or(0);
        let file_path = parts[2].to_string();

        // Determine status from the change pattern
        let status = if insertions > 0 && deletions == 0 {
            "added".to_string()
        } else if insertions == 0 && deletions > 0 {
            "deleted".to_string()
        } else {
            "modified".to_string()
        };

        total_insertions += insertions;
        total_deletions += deletions;

        files.push(DiffFile {
            path: file_path,
            insertions,
            deletions,
            status,
        });
    }

    Ok(WorkspaceDiff {
        files_changed: files.len() as u32,
        insertions: total_insertions,
        deletions: total_deletions,
        files,
    })
}

/// Push the workspace branch to the remote with upstream tracking.
///
/// Runs `git push -u origin worktree-<slug>` from within the worktree directory.
#[tauri::command]
pub fn push_workspace(project_path: String, slug: String) -> Result<String, String> {
    validate_slug(&slug)?;

    let wt_path = worktree_dir(&project_path, &slug);
    if !Path::new(&wt_path).exists() {
        return Err(format!("Workspace directory not found: {wt_path}"));
    }

    let branch_name = format!("worktree-{slug}");
    run_git(&wt_path, &["push", "-u", "origin", &branch_name])
}

/// Create a pull request from the workspace branch using the `gh` CLI.
///
/// Runs `gh pr create` from the worktree directory. Requires the GitHub CLI
/// to be installed and authenticated. Returns the PR URL on success.
#[tauri::command]
pub fn create_pr_from_workspace(
    project_path: String,
    slug: String,
    title: String,
    body: String,
) -> Result<String, String> {
    validate_slug(&slug)?;

    let wt_path = worktree_dir(&project_path, &slug);
    if !Path::new(&wt_path).exists() {
        return Err(format!("Workspace directory not found: {wt_path}"));
    }

    let branch_name = format!("worktree-{slug}");

    let output = std::process::Command::new("gh")
        .args([
            "pr", "create",
            "--title", &title,
            "--body", &body,
            "--base", "main",
            "--head", &branch_name,
        ])
        .current_dir(&wt_path)
        .output()
        .map_err(|e| format!("Failed to run gh CLI: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh pr create failed: {}", stderr.trim()));
    }

    let pr_url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(pr_url)
}

/// Merge a workspace branch into a target branch using the specified strategy.
///
/// Supported strategies: "merge" (standard merge), "rebase", or "squash"
/// (merge --squash). Operates on the project root, not the worktree.
/// Returns true on success.
#[tauri::command]
pub fn merge_workspace(
    project_path: String,
    slug: String,
    target_branch: String,
    strategy: String,
) -> Result<bool, String> {
    validate_slug(&slug)?;

    if target_branch.trim().is_empty() {
        return Err("Target branch cannot be empty".to_string());
    }

    let branch_name = format!("worktree-{slug}");

    // Checkout the target branch first
    run_git(&project_path, &["checkout", &target_branch])?;

    match strategy.as_str() {
        "merge" => {
            run_git(&project_path, &["merge", &branch_name])?;
        }
        "rebase" => {
            run_git(&project_path, &["rebase", &branch_name])?;
        }
        "squash" => {
            run_git(&project_path, &["merge", "--squash", &branch_name])?;
        }
        _ => {
            return Err(format!(
                "Unknown merge strategy '{strategy}'. Use 'merge', 'rebase', or 'squash'."
            ));
        }
    }

    Ok(true)
}

/// Remove a workspace and optionally force-remove the worktree.
///
/// Removes the worktree via `git worktree remove`, then attempts to delete
/// the associated branch with `git branch -d` (safe delete, failure ignored).
/// Returns true on success.
#[tauri::command]
pub fn remove_workspace(
    project_path: String,
    slug: String,
    force: Option<bool>,
) -> Result<bool, String> {
    validate_slug(&slug)?;

    let relative_path = worktree_relative(&slug);
    let mut args = vec!["worktree", "remove", &relative_path];
    if force.unwrap_or(false) {
        args.push("--force");
    }

    run_git(&project_path, &args)?;

    // Best-effort branch cleanup — ignore errors (branch may not be fully merged)
    let branch_name = format!("worktree-{slug}");
    let _ = run_git(&project_path, &["branch", "-d", &branch_name]);

    Ok(true)
}

/// Complete a workspace: push, merge, remove worktree, and clean up the branch.
///
/// This is the "Ship It" flow:
/// 1. Push the branch to origin from the worktree directory.
/// 2. Checkout the main branch in the project root.
/// 3. Merge using the specified strategy ("merge", "rebase", or "squash").
/// 4. Remove the worktree.
/// 5. Delete the local branch.
///
/// The `extract_memory` flag is accepted for protocol compatibility but memory
/// extraction is handled separately by the frontend calling existing memory commands.
#[tauri::command]
pub fn complete_workspace(
    project_path: String,
    slug: String,
    strategy: String,
    #[allow(unused_variables)] extract_memory: bool,
) -> Result<bool, String> {
    validate_slug(&slug)?;

    let branch_name = format!("worktree-{slug}");
    let wt_path = worktree_dir(&project_path, &slug);

    // 1. Push the branch
    if Path::new(&wt_path).exists() {
        let _ = run_git(&wt_path, &["push", "-u", "origin", &branch_name]);
    }

    // 2. Switch to main
    run_git(&project_path, &["checkout", "main"])?;

    // 3. Merge using strategy
    match strategy.as_str() {
        "merge" => {
            run_git(&project_path, &["merge", &branch_name])?;
        }
        "rebase" => {
            run_git(&project_path, &["rebase", &branch_name])?;
        }
        "squash" => {
            run_git(&project_path, &["merge", "--squash", &branch_name])?;
        }
        _ => {
            return Err(format!(
                "Unknown merge strategy '{strategy}'. Use 'merge', 'rebase', or 'squash'."
            ));
        }
    }

    // 4. Remove worktree
    let relative_path = worktree_relative(&slug);
    let _ = run_git(&project_path, &["worktree", "remove", &relative_path, "--force"]);

    // 5. Delete branch
    let _ = run_git(&project_path, &["branch", "-d", &branch_name]);

    Ok(true)
}

/// Initialize the `.elves/` directory in a project root.
///
/// Creates `<project_path>/.elves/` if it does not already exist.
/// Returns true on success.
#[tauri::command]
pub fn init_elves_dir(project_path: String) -> Result<bool, String> {
    let elves_dir = Path::new(&project_path).join(".elves");
    if !elves_dir.exists() {
        fs::create_dir_all(&elves_dir)
            .map_err(|e| format!("Failed to create .elves/ directory: {e}"))?;
    }
    Ok(true)
}

/// Read the per-project configuration from `.elves/config.json`.
///
/// Returns default values if the file does not exist yet.
#[tauri::command]
pub fn read_project_config(project_path: String) -> Result<ProjectConfig, String> {
    config::read_project_config(&project_path)
}

/// Write the per-project configuration to `.elves/config.json`.
///
/// Accepts a JSON string, deserializes it into a `ProjectConfig`, and writes it.
/// Creates the `.elves/` directory if needed. Returns true on success.
#[tauri::command]
pub fn write_project_config(project_path: String, config: String) -> Result<bool, String> {
    let parsed: ProjectConfig = serde_json::from_str(&config)
        .map_err(|e| format!("Invalid project config JSON: {e}"))?;

    config::write_project_config(&project_path, &parsed)?;
    Ok(true)
}
