// Runtime detection — scans PATH for Claude Code and Codex CLI binaries.

use serde::Serialize;
use std::process::Command;

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
