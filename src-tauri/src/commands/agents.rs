// Agent-related Tauri commands — runtime detection, discovery, and agent lifecycle control.

use crate::agents::claude_discovery::{self, ClaudeDiscovery};
use crate::agents::runtime::{self, RuntimeInfo};
use serde::{Deserialize, Serialize};

/// Result of a health check for a specific AI runtime binary.
/// Reports whether the binary is found, its resolved path, version, and any errors.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckResult {
    pub available: bool,
    pub binary_path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

/// Detect available AI runtimes (Claude Code, Codex) on the system.
/// Returns RuntimeInfo with version and path for each detected binary.
#[tauri::command]
pub fn detect_runtimes() -> RuntimeInfo {
    runtime::detect_runtimes()
}

/// Discover the user's Claude Code world: custom agents and settings.
/// Reads from ~/.claude/ using pure filesystem operations. Never fails.
#[tauri::command]
pub fn discover_claude() -> ClaudeDiscovery {
    claude_discovery::discover_claude_world()
}

/// Health check a specific runtime binary: resolve its path, run `--version`,
/// and return structured results the frontend can display.
///
/// Accepts "claude" or "codex" as the runtime string. Uses a 5-second timeout
/// on the version command to avoid hanging on unresponsive binaries.
#[tauri::command]
pub async fn health_check_runtime(runtime: String) -> Result<HealthCheckResult, String> {
    let binary_name = match runtime.as_str() {
        "claude" | "claude-code" => "claude",
        "codex" => "codex",
        other => return Err(format!("Unknown runtime: '{other}'. Expected 'claude' or 'codex'.")),
    };

    // Step 1: resolve the binary to an absolute path
    let binary_path = match runtime::resolve_binary(binary_name) {
        Ok(path) => path,
        Err(e) => {
            return Ok(HealthCheckResult {
                available: false,
                binary_path: None,
                version: None,
                error: Some(e),
            });
        }
    };

    let path_str = binary_path.to_string_lossy().to_string();

    // Step 2: run `<binary> --version` with a 5-second timeout
    let version_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::process::Command::new(&binary_path)
            .arg("--version")
            .output(),
    )
    .await;

    let version = match version_result {
        Ok(Ok(output)) if output.status.success() => {
            let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // Extract just the version number from output like "claude 2.1.32"
            let ver = raw.split_whitespace().last().unwrap_or(&raw).to_string();
            Some(ver)
        }
        Ok(Ok(_)) => Some("unknown".to_string()),
        Ok(Err(e)) => {
            return Ok(HealthCheckResult {
                available: true,
                binary_path: Some(path_str),
                version: None,
                error: Some(format!("Failed to run --version: {e}")),
            });
        }
        Err(_) => {
            return Ok(HealthCheckResult {
                available: true,
                binary_path: Some(path_str),
                version: None,
                error: Some("--version timed out after 5 seconds".to_string()),
            });
        }
    };

    Ok(HealthCheckResult {
        available: true,
        binary_path: Some(path_str),
        version,
        error: None,
    })
}
