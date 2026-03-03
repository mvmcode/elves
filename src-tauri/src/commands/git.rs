// Git commands — branch info, commit history, staging, diffs, and branch switching via git CLI.

use serde::Serialize;
use std::process::Command;

/// Branch information: current branch name plus lists of local and remote branches.
#[derive(Debug, Serialize, Clone)]
pub struct GitBranchInfo {
    pub current: String,
    pub local: Vec<String>,
    pub remote: Vec<String>,
}

/// A single commit entry from `git log`.
#[derive(Debug, Serialize, Clone)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

/// Run a git command in the given project directory and return stdout as a String.
/// Returns Err with a descriptive message on failure.
fn run_git(project_path: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["-C", project_path];
    cmd_args.extend_from_slice(args);

    let output = Command::new("git")
        .args(&cmd_args)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git error: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get current branch name, local branches, and remote branches.
#[tauri::command]
pub fn git_branch(project_path: String) -> Result<GitBranchInfo, String> {
    let output = run_git(&project_path, &["branch", "-a"])?;

    let mut current = String::new();
    let mut local = Vec::new();
    let mut remote = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let is_current = trimmed.starts_with("* ");
        let name = if is_current {
            trimmed.strip_prefix("* ").unwrap_or(trimmed)
        } else {
            trimmed
        };

        if name.starts_with("remotes/") {
            // Skip HEAD pointer entries like "remotes/origin/HEAD -> origin/main"
            if !name.contains(" -> ") {
                remote.push(name.to_string());
            }
        } else {
            local.push(name.to_string());
            if is_current {
                current = name.to_string();
            }
        }
    }

    // Fallback if `git branch -a` didn't show a current branch (detached HEAD, etc.)
    if current.is_empty() {
        let rev_output = run_git(&project_path, &["rev-parse", "--abbrev-ref", "HEAD"]);
        current = rev_output
            .unwrap_or_else(|_| "HEAD".to_string())
            .trim()
            .to_string();
    }

    Ok(GitBranchInfo {
        current,
        local,
        remote,
    })
}

/// Get recent commit history. Defaults to 50 entries if `max_count` is None.
#[tauri::command]
pub fn git_log(project_path: String, max_count: Option<u32>) -> Result<Vec<GitCommit>, String> {
    let count = max_count.unwrap_or(50);
    let count_str = format!("--max-count={count}");
    let format_str = "--format=%H|%h|%s|%an|%ar";

    let output = run_git(&project_path, &["log", &count_str, format_str])?;

    let mut commits = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(5, '|').collect();
        if parts.len() < 5 {
            continue;
        }
        commits.push(GitCommit {
            hash: parts[0].to_string(),
            short_hash: parts[1].to_string(),
            message: parts[2].to_string(),
            author: parts[3].to_string(),
            date: parts[4].to_string(),
        });
    }

    Ok(commits)
}

/// Get unified diff of unstaged changes. Optionally scoped to a single file.
#[tauri::command]
pub fn git_diff(project_path: String, file_path: Option<String>) -> Result<String, String> {
    let mut args = vec!["diff"];
    if let Some(ref path) = file_path {
        args.push("--");
        args.push(path);
    }
    run_git(&project_path, &args)
}

/// Get unified diff of staged (index) changes.
#[tauri::command]
pub fn git_diff_staged(project_path: String) -> Result<String, String> {
    run_git(&project_path, &["diff", "--staged"])
}

/// Stage one or more files via `git add`.
#[tauri::command]
pub fn git_stage(project_path: String, file_paths: Vec<String>) -> Result<bool, String> {
    if file_paths.is_empty() {
        return Ok(false);
    }
    let mut args: Vec<&str> = vec!["add", "--"];
    for path in &file_paths {
        args.push(path);
    }
    run_git(&project_path, &args)?;
    Ok(true)
}

/// Unstage one or more files via `git restore --staged`.
#[tauri::command]
pub fn git_unstage(project_path: String, file_paths: Vec<String>) -> Result<bool, String> {
    if file_paths.is_empty() {
        return Ok(false);
    }
    let mut args: Vec<&str> = vec!["restore", "--staged", "--"];
    for path in &file_paths {
        args.push(path);
    }
    run_git(&project_path, &args)?;
    Ok(true)
}

/// Create a commit with the given message.
#[tauri::command]
pub fn git_commit(project_path: String, message: String) -> Result<bool, String> {
    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }
    run_git(&project_path, &["commit", "-m", &message])?;
    Ok(true)
}

/// Push the current branch to its remote.
#[tauri::command]
pub fn git_push(project_path: String) -> Result<String, String> {
    run_git(&project_path, &["push"])
}

/// Pull from the remote for the current branch.
#[tauri::command]
pub fn git_pull(project_path: String) -> Result<String, String> {
    run_git(&project_path, &["pull"])
}

/// Switch to a different local branch.
#[tauri::command]
pub fn git_switch_branch(project_path: String, branch_name: String) -> Result<bool, String> {
    if branch_name.trim().is_empty() {
        return Err("Branch name cannot be empty".to_string());
    }
    run_git(&project_path, &["switch", &branch_name])?;
    Ok(true)
}

/// Information about a single git worktree, parsed from `git worktree list --porcelain`.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: String,
    pub commit_hash: String,
    pub is_main: bool,
    pub is_locked: bool,
}

/// Aggregate git state for a project — combines branch, worktree, dirty, and ahead/behind info.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitState {
    pub current_branch: String,
    pub branches: Vec<BranchSummary>,
    pub worktrees: Vec<WorktreeInfo>,
    pub is_dirty: bool,
    pub ahead_behind: Option<AheadBehind>,
}

/// Summary info for a single branch.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BranchSummary {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub last_commit_hash: String,
    pub last_commit_message: String,
}

/// Ahead/behind count relative to upstream.
#[derive(Debug, Serialize, Clone)]
pub struct AheadBehind {
    pub ahead: u32,
    pub behind: u32,
}

/// List all git worktrees for a project, parsed from `git worktree list --porcelain`.
///
/// Porcelain format: blocks separated by blank lines, each block has fields like
/// `worktree <path>`, `HEAD <hash>`, `branch refs/heads/<name>`, and optionally `locked`.
/// The first worktree listed is always the main (primary) worktree.
#[tauri::command]
pub fn git_worktree_list(project_path: String) -> Result<Vec<WorktreeInfo>, String> {
    let output = run_git(&project_path, &["worktree", "list", "--porcelain"])?;
    let mut worktrees = Vec::new();
    let mut is_first = true;

    for block in output.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let mut path = String::new();
        let mut branch = String::new();
        let mut commit_hash = String::new();
        let mut is_locked = false;

        for line in block.lines() {
            if let Some(p) = line.strip_prefix("worktree ") {
                path = p.to_string();
            } else if let Some(h) = line.strip_prefix("HEAD ") {
                commit_hash = h.to_string();
            } else if let Some(b) = line.strip_prefix("branch ") {
                // Strip refs/heads/ prefix to get the short branch name
                branch = b.strip_prefix("refs/heads/").unwrap_or(b).to_string();
            } else if line == "locked" {
                is_locked = true;
            }
        }

        if !path.is_empty() {
            worktrees.push(WorktreeInfo {
                path,
                branch,
                commit_hash,
                is_main: is_first,
                is_locked,
            });
            is_first = false;
        }
    }

    Ok(worktrees)
}

/// Create a new git worktree with a new branch.
///
/// Runs: `git worktree add -b <branch_name> .claude/worktrees/<branch_name> [base_ref]`
/// The worktree is placed under `.claude/worktrees/` to match Claude Code conventions.
/// Returns the absolute path to the new worktree.
#[tauri::command]
pub fn git_worktree_add(
    project_path: String,
    branch_name: String,
    base_ref: Option<String>,
) -> Result<String, String> {
    if branch_name.trim().is_empty() {
        return Err("Branch name cannot be empty".to_string());
    }

    let worktree_path = format!(".claude/worktrees/{}", branch_name);
    let mut args = vec!["worktree", "add", "-b", &branch_name, &worktree_path];

    let base = base_ref.unwrap_or_default();
    if !base.is_empty() {
        args.push(&base);
    }

    run_git(&project_path, &args)?;

    // Return the absolute path
    let abs_path = std::path::Path::new(&project_path).join(&worktree_path);
    Ok(abs_path.to_string_lossy().to_string())
}

/// Remove a git worktree.
///
/// Runs: `git worktree remove <worktree_path> --force`
/// The --force flag handles worktrees with uncommitted changes.
#[tauri::command]
pub fn git_worktree_remove(project_path: String, worktree_path: String) -> Result<bool, String> {
    if worktree_path.trim().is_empty() {
        return Err("Worktree path cannot be empty".to_string());
    }
    run_git(&project_path, &["worktree", "remove", &worktree_path, "--force"])?;
    Ok(true)
}

/// Get aggregate git state for a project in a single call.
///
/// Combines: current branch, branch list with commit info, worktree list,
/// dirty check (via `git status --porcelain`), and ahead/behind count
/// (via `git rev-list --left-right --count HEAD...@{u}`).
#[tauri::command]
pub fn get_git_state(project_path: String) -> Result<GitState, String> {
    // 1. Get current branch
    let branch_info = git_branch(project_path.clone())?;

    // 2. Build branch summaries with last commit info
    let mut branches = Vec::new();
    for name in &branch_info.local {
        let commit_info = run_git(&project_path, &["log", "-1", "--format=%H|%s", name])
            .unwrap_or_default();
        let parts: Vec<&str> = commit_info.trim().splitn(2, '|').collect();
        branches.push(BranchSummary {
            name: name.clone(),
            is_current: *name == branch_info.current,
            is_remote: false,
            last_commit_hash: parts.first().unwrap_or(&"").to_string(),
            last_commit_message: parts.get(1).unwrap_or(&"").to_string(),
        });
    }
    for name in &branch_info.remote {
        let commit_info = run_git(&project_path, &["log", "-1", "--format=%H|%s", name])
            .unwrap_or_default();
        let parts: Vec<&str> = commit_info.trim().splitn(2, '|').collect();
        branches.push(BranchSummary {
            name: name.clone(),
            is_current: false,
            is_remote: true,
            last_commit_hash: parts.first().unwrap_or(&"").to_string(),
            last_commit_message: parts.get(1).unwrap_or(&"").to_string(),
        });
    }

    // 3. Get worktree list
    let worktrees = git_worktree_list(project_path.clone())?;

    // 4. Check if dirty
    let status_output = run_git(&project_path, &["status", "--porcelain"])?;
    let is_dirty = !status_output.trim().is_empty();

    // 5. Get ahead/behind count (may fail if no upstream is configured)
    let ahead_behind = run_git(
        &project_path,
        &["rev-list", "--left-right", "--count", "HEAD...@{u}"],
    )
    .ok()
    .and_then(|output| {
        let parts: Vec<&str> = output.trim().split('\t').collect();
        if parts.len() == 2 {
            let ahead = parts[0].parse::<u32>().ok()?;
            let behind = parts[1].parse::<u32>().ok()?;
            Some(AheadBehind { ahead, behind })
        } else {
            None
        }
    });

    Ok(GitState {
        current_branch: branch_info.current,
        branches,
        worktrees,
        is_dirty,
        ahead_behind,
    })
}
