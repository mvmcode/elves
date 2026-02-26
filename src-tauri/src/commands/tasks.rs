// Task execution commands — start and stop agent tasks via Tauri IPC.

use crate::agents::claude_adapter;
use crate::agents::process::ProcessManager;
use crate::commands::projects::DbState;
use crate::db;
use tauri::{AppHandle, Emitter, State};

/// Start a task: creates a session, spawns a minion, starts the Claude process.
///
/// Emits events to the frontend via Tauri's event system as the agent works:
/// - `minion:spawned` — when the minion DB row is created and process started
/// - `session:error` — if spawning fails after DB rows are created
///
/// Returns the session ID. The frontend subscribes to Tauri events keyed by
/// this session ID to receive real-time updates from the agent.
#[tauri::command]
pub async fn start_task(
    app: AppHandle,
    db: State<'_, DbState>,
    process_mgr: State<'_, ProcessManager>,
    project_id: String,
    task: String,
    runtime: String,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let minion_id = uuid::Uuid::new_v4().to_string();

    // 1. Create session in DB
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::create_session(&conn, &session_id, &project_id, &task, &runtime)
            .map_err(|e| format!("Database error: {e}"))?;
    }

    // 2. Create minion in DB (placeholder personality — frontend assigns the real one)
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::minions::create_minion(
            &conn,
            &minion_id,
            &session_id,
            "Minion",
            None,
            "\u{1F916}", // Robot emoji
            "#FFD93D",
            None,
            &runtime,
        )
        .map_err(|e| format!("Database error: {e}"))?;
    }

    // 3. Get the project's working directory
    let working_dir = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let project = db::projects::get_project(&conn, &project_id)
            .map_err(|e| format!("Database error: {e}"))?
            .ok_or("Project not found")?;
        project.path.clone()
    };

    // 4. Emit minion:spawned event to frontend
    let _ = app.emit(
        "minion:spawned",
        serde_json::json!({
            "sessionId": &session_id,
            "minionId": &minion_id,
        }),
    );

    // 5. Spawn Claude process
    let child = claude_adapter::spawn_claude(&task, &working_dir)
        .map_err(|e| format!("Failed to spawn claude: {e}"))?;

    process_mgr.register(&session_id, child);

    Ok(session_id)
}

/// Stop a running task. Kills the agent process and marks the session as cancelled.
///
/// Returns true if a process was found and killed, false if no process was
/// running for the given session (e.g., it already completed).
#[tauri::command]
pub async fn stop_task(
    app: AppHandle,
    db: State<'_, DbState>,
    process_mgr: State<'_, ProcessManager>,
    session_id: String,
) -> Result<bool, String> {
    let killed = process_mgr.kill(&session_id);

    if killed {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::update_session_status(
            &conn,
            &session_id,
            "cancelled",
            Some("Task stopped by user"),
        )
        .map_err(|e| format!("Database error: {e}"))?;

        let _ = app.emit(
            "session:cancelled",
            serde_json::json!({
                "sessionId": &session_id,
            }),
        );
    }

    Ok(killed)
}
