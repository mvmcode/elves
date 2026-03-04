// Project configuration stored at <project_root>/.elves/config.json.
//
// Each ELVES project has an optional `.elves/config.json` that stores per-project
// settings: default runtime, MCP server entries, and memory preferences.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Per-project configuration persisted at `.elves/config.json`.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    /// Which agent runtime to use by default ("claude" or "codex").
    pub default_runtime: String,
    /// MCP server entries configured for this project.
    pub mcp_servers: Vec<McpServerEntry>,
    /// Whether persistent memory is enabled for this project.
    pub memory_enabled: bool,
}

/// A single MCP server entry in the project configuration.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpServerEntry {
    /// Display name for the server.
    pub name: String,
    /// Command to spawn the server process.
    pub command: String,
    /// Arguments passed to the server command.
    pub args: Vec<String>,
    /// Environment variables set when spawning the server.
    pub env: HashMap<String, String>,
    /// Whether this server is currently enabled.
    pub enabled: bool,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            default_runtime: "claude".to_string(),
            mcp_servers: Vec::new(),
            memory_enabled: true,
        }
    }
}

/// Read the project config from `<project_path>/.elves/config.json`.
///
/// Returns the default config if the file does not exist. Returns an error
/// only if the file exists but cannot be read or parsed.
pub fn read_project_config(project_path: &str) -> Result<ProjectConfig, String> {
    let config_path = Path::new(project_path).join(".elves").join("config.json");

    if !config_path.exists() {
        return Ok(ProjectConfig::default());
    }

    let contents = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read .elves/config.json: {e}"))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse .elves/config.json: {e}"))
}

/// Write the project config to `<project_path>/.elves/config.json`.
///
/// Creates the `.elves/` directory if it does not exist.
pub fn write_project_config(project_path: &str, config: &ProjectConfig) -> Result<(), String> {
    let elves_dir = Path::new(project_path).join(".elves");
    if !elves_dir.exists() {
        fs::create_dir_all(&elves_dir)
            .map_err(|e| format!("Failed to create .elves/ directory: {e}"))?;
    }

    let config_path = elves_dir.join("config.json");
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    fs::write(&config_path, json)
        .map_err(|e| format!("Failed to write .elves/config.json: {e}"))
}
