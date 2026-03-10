// MCP server Tauri commands — manage Model Context Protocol server configurations.

use crate::db;
use crate::db::mcp::McpRow;
use super::projects::DbState;
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// Split a command string that may contain embedded arguments (e.g., "npx -y @pkg")
/// into (binary, extra_args). If the command has no spaces, returns (command, []).
fn split_command(command: &str) -> (String, Vec<String>) {
    let parts: Vec<&str> = command.split_whitespace().collect();
    match parts.as_slice() {
        [] => (command.to_string(), vec![]),
        [binary] => (binary.to_string(), vec![]),
        [binary, rest @ ..] => (binary.to_string(), rest.iter().map(|s| s.to_string()).collect()),
    }
}

/// A tool exposed by an MCP server, returned from the tools/list JSON-RPC call.
#[derive(Debug, Clone, Serialize)]
pub struct McpTool {
    pub name: String,
    pub description: Option<String>,
}

/// List all MCP servers.
#[tauri::command]
pub fn list_mcp_servers(
    db: State<'_, DbState>,
) -> Result<Vec<McpRow>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::mcp::list_mcp_servers(&conn)
        .map_err(|e| format!("Database error: {e}"))
}

/// Add a new MCP server. Returns the created server row.
#[tauri::command]
pub fn add_mcp_server(
    db: State<'_, DbState>,
    id: String,
    name: String,
    command: String,
    args: Option<String>,
    env: Option<String>,
    scope: Option<String>,
) -> Result<McpRow, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    let args_str = args.as_deref().unwrap_or("[]");
    let env_str = env.as_deref().unwrap_or("{}");
    let scope_str = scope.as_deref().unwrap_or("global");
    db::mcp::insert_mcp_server(&conn, &id, &name, &command, args_str, env_str, scope_str)
        .map_err(|e| format!("Database error: {e}"))
}

/// Toggle an MCP server's enabled/disabled state. Returns true if updated.
#[tauri::command]
pub fn toggle_mcp_server(
    db: State<'_, DbState>,
    id: String,
    enabled: bool,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::mcp::toggle_mcp_server(&conn, &id, enabled)
        .map_err(|e| format!("Database error: {e}"))
}

/// Update the last health check timestamp for an MCP server. Returns true if updated.
#[tauri::command]
pub fn health_check_mcp(
    db: State<'_, DbState>,
    id: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::mcp::update_health_check(&conn, &id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Delete an MCP server by ID. Returns true if deleted.
#[tauri::command]
pub fn delete_mcp_server(
    db: State<'_, DbState>,
    id: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
    db::mcp::delete_mcp_server(&conn, &id)
        .map_err(|e| format!("Database error: {e}"))
}

/// Result returned from MCP import so the frontend can show feedback.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: usize,
    pub scanned: usize,
}

/// Import MCP servers from all Claude Code settings files — global settings
/// (~/.claude/settings.json, ~/.claude/settings.local.json) and project-level
/// settings (~/.claude/projects/*/settings.json, ~/.claude/projects/*/settings.local.json).
/// Deduplicates by server **name** only. Returns import count and files scanned.
#[tauri::command]
pub fn import_mcp_from_claude(
    db: State<'_, DbState>,
) -> Result<ImportResult, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let claude_dir = home.join(".claude");

    // Collect all settings paths: global + project-level
    let mut settings_paths = vec![
        claude_dir.join("settings.json"),
        claude_dir.join("settings.local.json"),
    ];

    // Scan ~/.claude/projects/*/settings.json and settings.local.json
    let projects_dir = claude_dir.join("projects");
    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                settings_paths.push(entry.path().join("settings.json"));
                settings_paths.push(entry.path().join("settings.local.json"));
            }
        }
    }

    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;

    // Collect existing server names to skip duplicates (name-only dedup)
    let existing = db::mcp::list_mcp_servers(&conn)
        .map_err(|e| format!("Database error: {e}"))?;
    let mut existing_names: std::collections::HashSet<String> =
        existing.iter().map(|s| s.name.clone()).collect();

    let mut imported = 0usize;
    let mut scanned = 0usize;

    for path in &settings_paths {
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        scanned += 1;

        let json: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let servers_obj = match json.get("mcpServers").and_then(|v| v.as_object()) {
            Some(obj) => obj,
            None => continue,
        };

        for (name, config) in servers_obj {
            if existing_names.contains(name) {
                continue;
            }
            let command = config.get("command").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if command.is_empty() {
                continue;
            }

            let args_json = config.get("args")
                .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()))
                .unwrap_or_else(|| "[]".to_string());

            let env_json = config.get("env")
                .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "{}".to_string()))
                .unwrap_or_else(|| "{}".to_string());

            let id = uuid::Uuid::new_v4().to_string();
            match db::mcp::insert_mcp_server(&conn, &id, name, &command, &args_json, &env_json, "global") {
                Ok(_) => {
                    imported += 1;
                    existing_names.insert(name.clone());
                }
                Err(e) => log::warn!("Failed to import MCP server '{name}': {e}"),
            }
        }
    }

    Ok(ImportResult { imported, scanned })
}

/// A curated MCP server entry for the built-in catalog.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpCatalogItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub command: String,
    pub args: Vec<String>,
    pub category: String,
    pub source_url: Option<String>,
    pub env_keys: Vec<String>,
}

/// Return a curated catalog of popular MCP servers. No network dependency — hardcoded list.
#[tauri::command]
pub fn load_mcp_catalog() -> Vec<McpCatalogItem> {
    vec![
        McpCatalogItem {
            id: "catalog-github".into(),
            name: "GitHub".into(),
            description: "Repository management, issues, PRs, and code search".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-github".into()],
            category: "Developer Tools".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/github".into()),
            env_keys: vec!["GITHUB_PERSONAL_ACCESS_TOKEN".into()],
        },
        McpCatalogItem {
            id: "catalog-filesystem".into(),
            name: "Filesystem".into(),
            description: "Read, write, and manage local files and directories".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-filesystem".into()],
            category: "Developer Tools".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem".into()),
            env_keys: vec![],
        },
        McpCatalogItem {
            id: "catalog-postgresql".into(),
            name: "PostgreSQL".into(),
            description: "Query and manage PostgreSQL databases".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-postgres".into()],
            category: "Databases".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/postgres".into()),
            env_keys: vec!["POSTGRES_CONNECTION_STRING".into()],
        },
        McpCatalogItem {
            id: "catalog-sqlite".into(),
            name: "SQLite".into(),
            description: "Query and manage SQLite databases".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-sqlite".into()],
            category: "Databases".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite".into()),
            env_keys: vec![],
        },
        McpCatalogItem {
            id: "catalog-brave-search".into(),
            name: "Brave Search".into(),
            description: "Web search powered by the Brave Search API".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-brave-search".into()],
            category: "Search".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search".into()),
            env_keys: vec!["BRAVE_API_KEY".into()],
        },
        McpCatalogItem {
            id: "catalog-puppeteer".into(),
            name: "Puppeteer".into(),
            description: "Browser automation for web scraping and testing".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-puppeteer".into()],
            category: "Browser".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer".into()),
            env_keys: vec![],
        },
        McpCatalogItem {
            id: "catalog-slack".into(),
            name: "Slack".into(),
            description: "Send messages, manage channels, and search Slack workspace".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-slack".into()],
            category: "Communication".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/slack".into()),
            env_keys: vec!["SLACK_BOT_TOKEN".into()],
        },
        McpCatalogItem {
            id: "catalog-google-drive".into(),
            name: "Google Drive".into(),
            description: "Access and manage files in Google Drive".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-gdrive".into()],
            category: "Productivity".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive".into()),
            env_keys: vec!["GOOGLE_CLIENT_ID".into(), "GOOGLE_CLIENT_SECRET".into()],
        },
        McpCatalogItem {
            id: "catalog-google-maps".into(),
            name: "Google Maps".into(),
            description: "Geocoding, directions, and place search via Google Maps API".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-google-maps".into()],
            category: "Search".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps".into()),
            env_keys: vec!["GOOGLE_MAPS_API_KEY".into()],
        },
        McpCatalogItem {
            id: "catalog-memory".into(),
            name: "Memory".into(),
            description: "Persistent key-value memory for AI conversations".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-memory".into()],
            category: "AI Tools".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/memory".into()),
            env_keys: vec![],
        },
        McpCatalogItem {
            id: "catalog-sequential-thinking".into(),
            name: "Sequential Thinking".into(),
            description: "Step-by-step reasoning and thought chain management".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-sequential-thinking".into()],
            category: "AI Tools".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking".into()),
            env_keys: vec![],
        },
        McpCatalogItem {
            id: "catalog-fetch".into(),
            name: "Fetch".into(),
            description: "Make HTTP requests and fetch web content".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-fetch".into()],
            category: "Developer Tools".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/fetch".into()),
            env_keys: vec![],
        },
        McpCatalogItem {
            id: "catalog-sentry".into(),
            name: "Sentry".into(),
            description: "Query error tracking data from Sentry".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-sentry".into()],
            category: "Developer Tools".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/sentry".into()),
            env_keys: vec!["SENTRY_AUTH_TOKEN".into()],
        },
        McpCatalogItem {
            id: "catalog-linear".into(),
            name: "Linear".into(),
            description: "Manage issues, projects, and teams in Linear".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-linear".into()],
            category: "Project Management".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/linear".into()),
            env_keys: vec!["LINEAR_API_KEY".into()],
        },
        McpCatalogItem {
            id: "catalog-notion".into(),
            name: "Notion".into(),
            description: "Read and manage Notion pages and databases".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-notion".into()],
            category: "Productivity".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/notion".into()),
            env_keys: vec!["NOTION_API_KEY".into()],
        },
        McpCatalogItem {
            id: "catalog-supabase".into(),
            name: "Supabase".into(),
            description: "Manage Supabase projects, databases, and storage".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "supabase-mcp-server".into()],
            category: "Databases".into(),
            source_url: Some("https://github.com/supabase/mcp-server".into()),
            env_keys: vec!["SUPABASE_ACCESS_TOKEN".into()],
        },
        McpCatalogItem {
            id: "catalog-figma".into(),
            name: "Figma".into(),
            description: "Read design files, components, and styles from Figma".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "figma-mcp-server".into()],
            category: "Design".into(),
            source_url: Some("https://github.com/nichochar/figma-mcp-server".into()),
            env_keys: vec!["FIGMA_ACCESS_TOKEN".into()],
        },
        McpCatalogItem {
            id: "catalog-playwright".into(),
            name: "Playwright".into(),
            description: "Browser automation and end-to-end testing with Playwright".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@playwright/mcp@latest".into()],
            category: "Browser".into(),
            source_url: Some("https://github.com/nichochar/playwright-mcp-server".into()),
            env_keys: vec![],
        },
        McpCatalogItem {
            id: "catalog-redis".into(),
            name: "Redis".into(),
            description: "Manage keys, data structures, and queries in Redis".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "@modelcontextprotocol/server-redis".into()],
            category: "Databases".into(),
            source_url: Some("https://github.com/modelcontextprotocol/servers/tree/main/src/redis".into()),
            env_keys: vec!["REDIS_URL".into()],
        },
        McpCatalogItem {
            id: "catalog-exa".into(),
            name: "Exa".into(),
            description: "Neural search engine for high-quality web results".into(),
            command: "npx".into(),
            args: vec!["-y".into(), "exa-mcp-server".into()],
            category: "Search".into(),
            source_url: Some("https://github.com/nichochar/exa-mcp-server".into()),
            env_keys: vec!["EXA_API_KEY".into()],
        },
    ]
}

/// Spawn an MCP server, perform the JSON-RPC initialize + tools/list handshake,
/// and return the available tools. Times out after 5 seconds.
///
/// The server process is killed after tools are retrieved (or on error/timeout).
#[tauri::command]
pub async fn list_mcp_tools(
    id: String,
    db: State<'_, DbState>,
) -> Result<Vec<McpTool>, String> {
    // Extract server config from DB quickly, then release the lock before async work
    let (command, args_json, env_json) = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let server = db::mcp::get_mcp_server(&conn, &id)
            .map_err(|e| format!("Database error: {e}"))?
            .ok_or_else(|| format!("MCP server not found: {id}"))?;
        (server.command, server.args, server.env)
    };

    let db_args: Vec<String> = serde_json::from_str(&args_json).unwrap_or_default();
    let env_map: HashMap<String, String> = serde_json::from_str(&env_json).unwrap_or_default();

    // Shell-split the command string: if it contains spaces (e.g., "npx -y @pkg"),
    // treat the first token as the binary and prepend the rest to the args list.
    let (binary, mut args) = split_command(&command);
    args.extend(db_args);

    tokio::time::timeout(
        std::time::Duration::from_secs(10),
        query_mcp_tools(binary, args, env_map),
    )
    .await
    .map_err(|_| "MCP server timed out after 5 seconds".to_string())?
}

/// Spawn the MCP server process, run the JSON-RPC initialize + tools/list handshake,
/// and parse the result into `Vec<McpTool>`. Kills the process when done.
async fn query_mcp_tools(
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
) -> Result<Vec<McpTool>, String> {
    let mut child = tokio::process::Command::new(&command)
        .args(&args)
        .envs(&env)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn MCP server `{command}`: {e}"))?;

    let stdin = child.stdin.take().ok_or("Failed to acquire MCP server stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to acquire MCP server stdout")?;

    let mut writer = tokio::io::BufWriter::new(stdin);
    let mut lines = BufReader::new(stdout).lines();

    // 1. Send initialize request (JSON-RPC id=1)
    let init_req = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"elves","version":"1.0.0"}}}"#;
    writer
        .write_all(format!("{init_req}\n").as_bytes())
        .await
        .map_err(|e| format!("Failed to send initialize: {e}"))?;
    writer.flush().await.map_err(|e| format!("Failed to flush: {e}"))?;

    // 2. Read response for id=1, skipping any notifications
    let init_resp = read_response_for_id(&mut lines, 1).await?;
    if init_resp.get("error").is_some() {
        let _ = child.kill().await;
        return Err(format!("MCP initialize error: {}", init_resp["error"]));
    }

    // 3. Send initialized notification (MCP protocol requires this before further requests)
    let notif = r#"{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}"#;
    writer
        .write_all(format!("{notif}\n").as_bytes())
        .await
        .map_err(|e| format!("Failed to send initialized notification: {e}"))?;
    writer.flush().await.map_err(|e| format!("Failed to flush: {e}"))?;

    // 4. Send tools/list request (JSON-RPC id=2)
    let tools_req = r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#;
    writer
        .write_all(format!("{tools_req}\n").as_bytes())
        .await
        .map_err(|e| format!("Failed to send tools/list: {e}"))?;
    writer.flush().await.map_err(|e| format!("Failed to flush: {e}"))?;

    // 5. Read response for id=2
    let tools_resp = read_response_for_id(&mut lines, 2).await?;
    let _ = child.kill().await;

    if tools_resp.get("error").is_some() {
        return Err(format!("MCP tools/list error: {}", tools_resp["error"]));
    }

    // 6. Parse result.tools array into Vec<McpTool>
    let tools = tools_resp
        .get("result")
        .and_then(|r| r.get("tools"))
        .and_then(|t| t.as_array())
        .ok_or("tools/list response missing result.tools array")?
        .iter()
        .filter_map(|tool| {
            let name = tool.get("name")?.as_str()?.to_string();
            let description = tool
                .get("description")
                .and_then(|d| d.as_str())
                .map(|s| s.to_string());
            Some(McpTool { name, description })
        })
        .collect();

    Ok(tools)
}

/// Read JSON-RPC lines from the server stdout, discarding notifications, until we
/// find a response matching `expected_id`. Returns an error if the stream closes.
async fn read_response_for_id(
    lines: &mut tokio::io::Lines<BufReader<tokio::process::ChildStdout>>,
    expected_id: u64,
) -> Result<serde_json::Value, String> {
    loop {
        let line = lines
            .next_line()
            .await
            .map_err(|e| format!("Read error: {e}"))?
            .ok_or("MCP server closed stdout unexpectedly")?;

        let json: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue, // Skip non-JSON lines (e.g., debug output)
        };

        if json.get("id").and_then(|v| v.as_u64()) == Some(expected_id) {
            return Ok(json);
        }
        // Otherwise it's a notification or a response for a different id — skip it
    }
}
