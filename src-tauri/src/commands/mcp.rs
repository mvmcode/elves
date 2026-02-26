// MCP server Tauri commands — manage Model Context Protocol server configurations.

use crate::db;
use crate::db::mcp::McpRow;
use super::projects::DbState;
use tauri::State;

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
