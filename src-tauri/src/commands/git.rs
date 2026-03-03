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
