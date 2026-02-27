// Agent-related Tauri commands — runtime detection, discovery, and agent lifecycle control.

use crate::agents::claude_discovery::{self, ClaudeDiscovery};
use crate::agents::runtime::{self, RuntimeInfo};

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
