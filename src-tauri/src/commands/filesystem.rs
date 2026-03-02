// Filesystem commands — directory listing and git status for the file explorer.

use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

/// A single file or directory entry returned by `list_directory`.
#[derive(Debug, Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: Option<u64>,
    pub extension: Option<String>,
}

/// Directories and files to always skip when listing.
const SKIP_NAMES: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    ".git",
    "__pycache__",
    ".DS_Store",
];

/// Hidden files starting with `.` that we still want to show.
const ALLOWED_DOTFILES: &[&str] = &[".env", ".gitignore", ".github", ".eslintrc", ".prettierrc"];

/// List one level of directory entries at `path`, sorted directories-first then alphabetical.
#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    let read_dir = std::fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {path}: {e}"))?;

    let mut entries: Vec<FileEntry> = Vec::new();

    for entry_result in read_dir {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().to_string();

        // Skip entries in the deny list
        if SKIP_NAMES.contains(&name.as_str()) {
            continue;
        }

        // Skip hidden files unless they're in the allow list
        if name.starts_with('.') && !ALLOWED_DOTFILES.contains(&name.as_str()) {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_symlink = entry
            .file_type()
            .map(|ft| ft.is_symlink())
            .unwrap_or(false);
        let is_dir = metadata.is_dir();
        let size = if is_dir { None } else { Some(metadata.len()) };
        let extension = if is_dir {
            None
        } else {
            Path::new(&name)
                .extension()
                .map(|ext| ext.to_string_lossy().to_string())
        };

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            is_symlink,
            size,
            extension,
        });
    }

    // Sort: directories first, then case-insensitive alphabetical
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Query `git status --porcelain=v1` for the project and return a map of relative paths to status codes.
/// Returns an empty map if the path is not a git repo or git is not installed.
#[tauri::command]
pub fn git_status(project_path: String) -> Result<HashMap<String, String>, String> {
    let output = Command::new("git")
        .args(["-C", &project_path, "status", "--porcelain=v1", "-uall"])
        .output();

    let output = match output {
        Ok(o) => o,
        Err(_) => return Ok(HashMap::new()), // git not installed or spawn failed
    };

    if !output.status.success() {
        // Not a git repo or other git error — return empty map
        return Ok(HashMap::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut status_map: HashMap<String, String> = HashMap::new();

    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }
        // Porcelain v1 format: XY <space> path
        // First two chars are the status codes, char 2 is a space, rest is the path
        let status_code = line[..2].to_string();
        let file_path = line[3..].to_string();

        // Handle renames: "R  old -> new" — use the new path
        let actual_path = if file_path.contains(" -> ") {
            file_path
                .split(" -> ")
                .last()
                .unwrap_or(&file_path)
                .to_string()
        } else {
            file_path
        };

        status_map.insert(actual_path, status_code);
    }

    Ok(status_map)
}
