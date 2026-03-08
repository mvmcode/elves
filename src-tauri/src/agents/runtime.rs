// Runtime detection — scans PATH for Claude Code and Codex CLI binaries.
// macOS .app bundles get a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin), so we
// resolve the user's login shell PATH before searching for binaries.

use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Once;

/// Version and path information for a detected runtime binary.
#[derive(Debug, Clone, Serialize)]
pub struct RuntimeVersion {
    pub version: String,
    pub path: String,
}

/// Combined detection results for all supported AI runtimes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub claude_code: Option<RuntimeVersion>,
    pub codex: Option<RuntimeVersion>,
}

static FIX_PATH: Once = Once::new();

/// Augment the process PATH with the user's login shell PATH.
/// macOS .app bundles launched from Finder/Dock get a minimal PATH that doesn't
/// include /opt/homebrew/bin, nvm paths, cargo bin, etc. This function runs the
/// user's default shell as an interactive login shell to resolve the real PATH
/// (sourcing .zshenv, .zprofile, AND .zshrc), then appends well-known fallback
/// directories as a safety net.
/// Called once before runtime detection or PTY spawning.
pub fn ensure_full_path() {
    FIX_PATH.call_once(|| {
        let current = std::env::var("PATH").unwrap_or_default();
        let shell_path = resolve_shell_path();
        let fallback_dirs = resolve_fallback_dirs();

        // Merge: shell PATH first, then current, then fallbacks
        let mut parts: Vec<&str> = Vec::new();
        if let Some(ref sp) = shell_path {
            parts.push(sp);
        }
        if !current.is_empty() {
            parts.push(&current);
        }
        if !fallback_dirs.is_empty() {
            parts.push(&fallback_dirs);
        }

        let merged = parts.join(":");
        if merged != current {
            // SAFETY: called once at startup via `Once`, before any multithreaded work
            #[allow(deprecated)]
            std::env::set_var("PATH", &merged);
            log::debug!("Resolved PATH: {merged}");
        }
    });
}

/// Run the user's login shell interactively to capture their real PATH.
/// Uses `-ilc` so that .zshrc is sourced (not just .zprofile/.zshenv).
/// Redirects stderr to suppress motd/warnings that would contaminate stdout.
fn resolve_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    // Detect shell type from the path (e.g. /bin/zsh, /usr/local/bin/fish)
    let shell_name = std::path::Path::new(&shell)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    // Build the appropriate command based on shell type:
    // - fish: does not support -i with -c, use -lc and fish's $PATH variable directly
    // - bash/zsh: use -ilc so .zshrc/.bashrc are sourced (not just .zprofile/.bash_profile)
    // - unknown: skip shell resolution entirely, rely on fallback dirs
    let output = match shell_name {
        "fish" => Command::new(&shell)
            .args(["-lc", "printf '%s' $PATH"])
            .stderr(std::process::Stdio::null())
            .output(),
        "bash" | "zsh" => Command::new(&shell)
            .args(["-ilc", "printf '%s' \"$PATH\""])
            .stderr(std::process::Stdio::null())
            .output(),
        _ => {
            log::info!("Unknown shell '{shell_name}' — skipping shell PATH resolution");
            return None;
        }
    };

    match output {
        Ok(out) if out.status.success() => {
            let path = String::from_utf8_lossy(&out.stdout).to_string();
            // If the output contains newlines, the shell printed extra output (motd, etc.)
            // — take only the last line which is the actual PATH
            let path = path.lines().last().unwrap_or("").to_string();
            if path.is_empty() {
                log::warn!("Shell PATH resolution returned empty output");
                None
            } else {
                Some(path)
            }
        }
        Ok(out) => {
            log::warn!(
                "Shell PATH resolution failed with exit code {:?}",
                out.status.code()
            );
            None
        }
        Err(e) => {
            log::warn!("Failed to run shell for PATH resolution: {e}");
            None
        }
    }
}

/// Build a colon-separated string of well-known binary directories that exist on disk.
/// Acts as a safety net when the shell PATH resolution fails or misses directories.
fn resolve_fallback_dirs() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/unknown".to_string());
    let candidates = [
        "/opt/homebrew/bin".to_string(),
        "/opt/homebrew/sbin".to_string(),
        "/usr/local/bin".to_string(),
        format!("{home}/.cargo/bin"),
        format!("{home}/.npm/bin"),
        format!("{home}/.nvm/current/bin"),
        // n (node version manager) installs to /usr/local/n/versions/node/<ver>/bin
        // but /usr/local/bin is already covered above — n symlinks there
        format!("{home}/.local/bin"),
        format!("{home}/go/bin"),
        format!("{home}/.nix-profile/bin"),
        format!("{home}/.asdf/shims"),
        format!("{home}/.local/share/mise/shims"),
    ];

    candidates
        .into_iter()
        .filter(|dir| std::path::Path::new(dir).is_dir())
        .collect::<Vec<_>>()
        .join(":")
}

/// Resolve a CLI binary to its absolute path, ensuring PATH is fully populated first.
///
/// Call this before spawning any child process to guarantee the binary path is
/// resolved against the user's real PATH — not the minimal PATH that macOS .app
/// bundles receive from Finder/Dock.
///
/// Returns the absolute PathBuf on success, or a user-friendly error message
/// with installation hints for known binaries (claude, codex).
pub fn resolve_binary(name: &str) -> Result<PathBuf, String> {
    ensure_full_path();
    which::which(name).map_err(|_| {
        let install_hint = match name {
            "claude" => " Install it with: npm install -g @anthropic-ai/claude-code",
            "codex" => " Install it with: npm install -g @openai/codex",
            _ => "",
        };
        format!("'{name}' CLI not found on PATH.{install_hint}")
    })
}

/// Detect a runtime binary by name. Looks up the binary in PATH using `which`,
/// then runs `<binary> --version` to extract the version string.
fn detect_binary(name: &str) -> Option<RuntimeVersion> {
    let binary_path = which::which(name).ok()?;
    let path_str = binary_path.to_string_lossy().to_string();

    let output = Command::new(&binary_path)
        .arg("--version")
        .output()
        .ok()?;

    if !output.status.success() {
        // Binary exists but --version failed — still report it with unknown version
        return Some(RuntimeVersion {
            version: "unknown".to_string(),
            path: path_str,
        });
    }

    let version_output = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Extract just the version number from output like "claude 2.1.32" or "codex 1.4.2"
    let version = version_output
        .split_whitespace()
        .last()
        .unwrap_or(&version_output)
        .to_string();

    Some(RuntimeVersion {
        version,
        path: path_str,
    })
}

/// Scan the system for available AI runtimes (Claude Code CLI and Codex CLI).
/// Returns detection results for each runtime, with None for binaries not found.
pub fn detect_runtimes() -> RuntimeInfo {
    ensure_full_path();
    RuntimeInfo {
        claude_code: detect_binary("claude"),
        codex: detect_binary("codex"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_runtimes_returns_struct() {
        // This test verifies the function runs without panicking and returns
        // a valid RuntimeInfo. On CI or machines without claude/codex installed,
        // both fields will be None — that's the expected behavior.
        let info = detect_runtimes();
        // Serialize to JSON to verify serde derives work correctly
        let json = serde_json::to_string(&info).expect("RuntimeInfo should serialize");
        assert!(json.contains("claudeCode"));
        assert!(json.contains("codex"));
    }

    #[test]
    fn detect_nonexistent_binary_returns_none() {
        let result = detect_binary("this_binary_definitely_does_not_exist_xyz_123");
        assert!(result.is_none());
    }

    #[test]
    fn detect_existing_binary_returns_some() {
        // `ls` exists on all Unix systems — use it to verify the detection logic works
        let result = detect_binary("ls");
        assert!(result.is_some());
        let version = result.unwrap();
        assert!(!version.path.is_empty());
    }
}
