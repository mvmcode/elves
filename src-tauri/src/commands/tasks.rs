// Task execution commands — start and stop agent tasks via Tauri IPC.

use crate::agents::analyzer::{self, TaskPlan};
use crate::agents::claude_adapter;
use crate::agents::process::ProcessManager;
use crate::commands::projects::DbState;
use crate::db;
use tauri::{AppHandle, Emitter, State};

/// Start a task: creates a session, spawns an elf, starts the Claude process.
///
/// Emits events to the frontend via Tauri's event system as the agent works:
/// - `elf:spawned` — when the elf DB row is created and process started
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
    let elf_id = uuid::Uuid::new_v4().to_string();

    // 1. Create session in DB
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::create_session(&conn, &session_id, &project_id, &task, &runtime)
            .map_err(|e| format!("Database error: {e}"))?;
    }

    // 2. Create elf in DB (placeholder personality — frontend assigns the real one)
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::elves::create_elf(
            &conn,
            &elf_id,
            &session_id,
            "Elf",
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

    // 4. Emit elf:spawned event to frontend
    let _ = app.emit(
        "elf:spawned",
        serde_json::json!({
            "sessionId": &session_id,
            "elfId": &elf_id,
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

/// Analyze a task to determine deployment strategy (solo vs team).
///
/// Uses heuristic analysis of the task description to produce a TaskPlan.
/// Reads project context from the database if available. The frontend uses
/// the returned plan to render the Plan Preview card before execution begins.
#[tauri::command]
pub fn analyze_task(
    db: State<'_, DbState>,
    task: String,
    project_id: String,
) -> Result<TaskPlan, String> {
    // Build project context from DB (project name + path for now)
    let project_context = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        match db::projects::get_project(&conn, &project_id) {
            Ok(Some(project)) => {
                format!("project: {} path: {}", project.name, project.path)
            }
            Ok(None) => String::new(),
            Err(e) => {
                log::warn!("Failed to read project context: {e}");
                String::new()
            }
        }
    };

    analyzer::analyze_task(&task, &project_context)
        .map_err(|e| format!("Analysis failed: {e}"))
}

/// Elf personality palette — used to assign distinct visual identities to team members.
const ELF_AVATARS: &[&str] = &["\u{1F9DD}", "\u{1F9D9}", "\u{1F9DA}", "\u{1F9DE}", "\u{1F916}", "\u{1F47E}"];
const ELF_COLORS: &[&str] = &["#FFD93D", "#FF6B6B", "#6BCB77", "#4D96FF", "#FF8B3D", "#C084FC"];

/// Start a team task: creates a session, spawns elves for each role, starts Claude in team mode.
///
/// Expects a TaskPlan (as JSON) that was previously generated by `analyze_task`.
/// Creates one elf DB row per role in the plan, emits `elf:spawned` events for each,
/// then spawns Claude Code in team mode with the full team prompt.
///
/// Returns the session ID. The frontend subscribes to events keyed by this ID.
#[tauri::command]
pub async fn start_team_task(
    app: AppHandle,
    db: State<'_, DbState>,
    process_mgr: State<'_, ProcessManager>,
    project_id: String,
    task: String,
    plan: TaskPlan,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let runtime = plan.runtime_recommendation.clone();

    // 1. Create session in DB with agent count from plan
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::create_session(&conn, &session_id, &project_id, &task, &runtime)
            .map_err(|e| format!("Database error: {e}"))?;
    }

    // 2. Get project working directory
    let working_dir = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let project = db::projects::get_project(&conn, &project_id)
            .map_err(|e| format!("Database error: {e}"))?
            .ok_or("Project not found")?;
        project.path.clone()
    };

    // 3. Create elf rows for each role in the plan
    let mut elf_ids: Vec<String> = Vec::with_capacity(plan.roles.len());
    for (i, role) in plan.roles.iter().enumerate() {
        let elf_id = uuid::Uuid::new_v4().to_string();
        let avatar = ELF_AVATARS.get(i % ELF_AVATARS.len()).unwrap_or(&"\u{1F9DD}");
        let color = ELF_COLORS.get(i % ELF_COLORS.len()).unwrap_or(&"#FFD93D");

        {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            db::elves::create_elf(
                &conn,
                &elf_id,
                &session_id,
                &role.name,
                Some(&role.name),
                avatar,
                color,
                None,
                &role.runtime,
            )
            .map_err(|e| format!("Database error creating elf: {e}"))?;
        }

        let _ = app.emit(
            "elf:spawned",
            serde_json::json!({
                "sessionId": &session_id,
                "elfId": &elf_id,
                "role": &role.name,
                "focus": &role.focus,
            }),
        );

        elf_ids.push(elf_id);
    }

    // 4. Spawn Claude in team mode
    let child = claude_adapter::spawn_claude_team(&task, &working_dir, &plan)
        .map_err(|e| format!("Failed to spawn claude team: {e}"))?;

    process_mgr.register(&session_id, child);

    Ok(session_id)
}

/// Stop a team task. Kills all agent processes and marks the session as cancelled.
///
/// Attempts to kill both single and team processes for the session.
/// Returns true if any process was killed.
#[tauri::command]
pub async fn stop_team_task(
    app: AppHandle,
    db: State<'_, DbState>,
    process_mgr: State<'_, ProcessManager>,
    session_id: String,
) -> Result<bool, String> {
    // Try both single-process and team kill paths
    let single_killed = process_mgr.kill(&session_id);
    let team_killed = process_mgr.kill_team(&session_id);
    let any_killed = single_killed || team_killed > 0;

    if any_killed {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::update_session_status(
            &conn,
            &session_id,
            "cancelled",
            Some("Team task stopped by user"),
        )
        .map_err(|e| format!("Database error: {e}"))?;

        let _ = app.emit(
            "session:cancelled",
            serde_json::json!({
                "sessionId": &session_id,
            }),
        );
    }

    Ok(any_killed)
}
