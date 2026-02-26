// Agent-related Tauri commands — runtime detection and agent lifecycle control.

use crate::agents::runtime::{self, RuntimeInfo};

/// Detect available AI runtimes (Claude Code, Codex) on the system.
/// Returns RuntimeInfo with version and path for each detected binary.
#[tauri::command]
pub fn detect_runtimes() -> RuntimeInfo {
    runtime::detect_runtimes()
}
