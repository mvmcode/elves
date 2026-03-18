// Runtime detection — scans PATH for Claude Code and Codex CLI binaries.
//
// Platform-specific PATH resolution:
// - macOS: .app bundles get a minimal PATH, so we resolve the user's login shell PATH.
// - Windows: PATH is already fully available system-wide; we just append known install dirs.
// - Linux: Same approach as macOS (login shell PATH resolution).

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

/// Platform PATH separator — semicolon on Windows, colon on Unix.
#[cfg(target_os = "windows")]
const PATH_SEP: &str = ";";
#[cfg(not(target_os = "windows"))]
const PATH_SEP: &str = ":";

/// Augment the process PATH with additional directories where CLI tools may be installed.
///
/// On macOS/Linux: runs the user's login shell to resolve the real PATH, then appends
/// well-known fallback directories.
/// On Windows: PATH is already globally available, so we only append well-known
/// installation directories (npm global, cargo, scoop, etc.) as a safety net.
///
/// Called once before runtime detection or PTY spawning.
pub fn ensure_full_path() {
    FIX_PATH.call_once(|| {
        let current = std::env::var("PATH").unwrap_or_default();

        #[cfg(not(target_os = "windows"))]
        let shell_path = resolve_shell_path();
        #[cfg(target_os = "windows")]
        let shell_path: Option<String> = None; // Windows PATH is already complete

        let fallback_dirs = resolve_fallback_dirs();

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

        let merged = parts.join(PATH_SEP);
        if merged != current {
            // SAFETY: called once at startup via `Once`, before any multithreaded work
            #[allow(deprecated)]
            std::env::set_var("PATH", &merged);
            log::info!("Resolved PATH: {merged}");
        }
    });
}

/// Run the user's login shell interactively to capture their real PATH.
/// Uses `-ilc` so that .zshrc is sourced (not just .zprofile/.zshenv).
/// Redirects stderr to suppress motd/warnings that would contaminate stdout.
///
/// Only compiled on Unix — Windows does not need shell PATH resolution.
#[cfg(not(target_os = "windows"))]
fn resolve_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let shell_name = std::path::Path::new(&shell)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

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

/// Build a separated string of well-known binary directories that exist on disk.
/// Acts as a safety net when shell PATH resolution fails or misses directories.
///
/// Returns platform-appropriate paths joined by the platform's PATH separator.
fn resolve_fallback_dirs() -> String {
    #[cfg(target_os = "windows")]
    let candidates = resolve_fallback_dirs_windows();

    #[cfg(not(target_os = "windows"))]
    let candidates = resolve_fallback_dirs_unix();

    candidates
        .into_iter()
        .filter(|dir| std::path::Path::new(dir).is_dir())
        .collect::<Vec<_>>()
        .join(PATH_SEP)
}

/// Windows-specific fallback directories for CLI tool discovery.
#[cfg(target_os = "windows")]
fn resolve_fallback_dirs_windows() -> Vec<String> {
    let userprofile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\unknown".to_string());
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| format!("{userprofile}\\AppData\\Roaming"));
    let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{userprofile}\\AppData\\Local"));
    let programfiles = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());

    vec![
        // npm global installs
        format!("{appdata}\\npm"),
        // Cargo (Rust) binaries
        format!("{userprofile}\\.cargo\\bin"),
        // Scoop installs
        format!("{userprofile}\\scoop\\shims"),
        // Node.js (default install location)
        format!("{programfiles}\\nodejs"),
        // fnm (Fast Node Manager)
        format!("{localappdata}\\fnm_multishells"),
        // nvm-windows
        format!("{appdata}\\nvm"),
        // Volta (Node version manager)
        format!("{localappdata}\\Volta\\bin"),
        // Go binaries
        format!("{userprofile}\\go\\bin"),
        // Python scripts
        format!("{localappdata}\\Programs\\Python\\Python312\\Scripts"),
        format!("{localappdata}\\Programs\\Python\\Python311\\Scripts"),
        // GitHub CLI (winget/msi default)
        format!("{programfiles}\\GitHub CLI"),
    ]
}

/// Unix-specific fallback directories for CLI tool discovery.
#[cfg(not(target_os = "windows"))]
fn resolve_fallback_dirs_unix() -> Vec<String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/unknown".to_string());
    vec![
        "/opt/homebrew/bin".to_string(),
        "/opt/homebrew/sbin".to_string(),
        "/usr/local/bin".to_string(),
        format!("{home}/.cargo/bin"),
        format!("{home}/.npm/bin"),
        format!("{home}/.nvm/current/bin"),
        format!("{home}/.local/bin"),
        format!("{home}/go/bin"),
        format!("{home}/.nix-profile/bin"),
        format!("{home}/.asdf/shims"),
        format!("{home}/.local/share/mise/shims"),
    ]
}

/// Resolve a CLI binary to its absolute path, ensuring PATH is fully populated first.
///
/// Call this before spawning any child process to guarantee the binary path is
/// resolved against the user's real PATH — not the minimal PATH that macOS .app
/// bundles receive from Finder/Dock.
///
/// On Windows, also tries `<name>.cmd` and `<name>.exe` variants since npm global
/// installs create `.cmd` wrapper scripts on Windows.
///
/// Returns the absolute PathBuf on success, or a user-friendly error message
/// with installation hints for known binaries (claude, codex).
pub fn resolve_binary(name: &str) -> Result<PathBuf, String> {
    ensure_full_path();

    // On Windows, npm global installs create .cmd wrappers (e.g. claude.cmd).
    // Try the bare name first (which crate handles PATHEXT on Windows), then
    // explicit .cmd variant as a fallback.
    which::which(name).or_else(|_| {
        #[cfg(target_os = "windows")]
        {
            let cmd_name = format!("{name}.cmd");
            which::which(&cmd_name)
        }
        #[cfg(not(target_os = "windows"))]
        {
            Err(which::Error::CannotFindBinaryPath)
        }
    }).map_err(|_| {
        let install_hint = match name {
            "claude" => " Install it with: npm install -g @anthropic-ai/claude-code",
            "codex" => " Install it with: npm install -g @openai/codex",
            _ => "",
        };
        format!("'{name}' CLI not found on PATH.{install_hint}")
    })
}

/// Detect a runtime binary by name. Looks up the binary in PATH using
/// `resolve_binary` (which handles Windows .cmd variants), then runs
/// `<binary> --version` to extract the version string.
///
/// Uses a 5-second timeout for the --version check to avoid hanging on
/// broken installations.
fn detect_binary(name: &str) -> Option<RuntimeVersion> {
    let binary_path = resolve_binary(name).ok()?;
    let path_str = binary_path.to_string_lossy().to_string();

    // Spawn with a timeout to handle broken installs that hang
    let mut child = Command::new(&binary_path)
        .arg("--version")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;

    // Wait up to 5 seconds for --version to complete
    let timeout = std::time::Duration::from_secs(5);
    let start = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Some(RuntimeVersion {
                        version: "unknown".to_string(),
                        path: path_str,
                    });
                }
                break;
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    log::warn!("'{name}' --version timed out after 5s — binary may be broken");
                    return Some(RuntimeVersion {
                        version: "unresponsive".to_string(),
                        path: path_str,
                    });
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(_) => return None,
        }
    }

    let output = child.wait_with_output().ok()?;
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
        // Use a binary that exists on both Unix and Windows
        #[cfg(target_os = "windows")]
        let binary_name = "cmd";
        #[cfg(not(target_os = "windows"))]
        let binary_name = "ls";

        let result = detect_binary(binary_name);
        assert!(result.is_some());
        let version = result.unwrap();
        assert!(!version.path.is_empty());
    }

    #[test]
    fn path_separator_is_correct() {
        #[cfg(target_os = "windows")]
        assert_eq!(PATH_SEP, ";");
        #[cfg(not(target_os = "windows"))]
        assert_eq!(PATH_SEP, ":");
    }
}
