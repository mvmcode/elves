// Task execution commands — start and stop agent tasks via Tauri IPC.

use crate::agents::analyzer::{self, TaskPlan};
use crate::agents::claude_adapter::{self, ClaudeSpawnOptions};
use crate::agents::process::ProcessManager;
use crate::commands::projects::DbState;
use crate::db;
use tauri::{AppHandle, Emitter, Manager, State};

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
    options: Option<String>,
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

    // 5. Parse spawn options and spawn Claude process
    let spawn_options: ClaudeSpawnOptions = match options {
        Some(ref json) => match serde_json::from_str(json) {
            Ok(opts) => opts,
            Err(e) => {
                log::warn!("Failed to parse spawn options: {e}, json={json}");
                ClaudeSpawnOptions::default()
            }
        },
        None => ClaudeSpawnOptions::default(),
    };
    let mut child = claude_adapter::spawn_claude(&task, &working_dir, &spawn_options)
        .map_err(|e| format!("Failed to spawn claude: {e}"))?;

    // Take stdout and stderr before registering — we read them in background threads
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    process_mgr.register(&session_id, child);

    // 6. Drain stderr in a background thread to prevent pipe buffer deadlock.
    // If stderr fills up (64KB), the child process blocks on writes and stdout stalls.
    if let Some(stderr) = stderr {
        let sid_err = session_id.clone();
        std::thread::spawn(move || {
            drain_stderr(stderr, &sid_err);
        });
    }

    // 7. Stream stdout events to the frontend in a background thread
    if let Some(stdout) = stdout {
        let app_handle = app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            stream_claude_output(stdout, &app_handle, &sid);
        });
    }

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
    options: Option<String>,
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

    // 4. Parse spawn options and spawn Claude in team mode
    let spawn_options: ClaudeSpawnOptions = match options {
        Some(ref json) => match serde_json::from_str(json) {
            Ok(opts) => opts,
            Err(e) => {
                log::warn!("Failed to parse team spawn options: {e}, json={json}");
                ClaudeSpawnOptions::default()
            }
        },
        None => ClaudeSpawnOptions::default(),
    };
    let mut child = claude_adapter::spawn_claude_team(&task, &working_dir, &plan, &spawn_options)
        .map_err(|e| format!("Failed to spawn claude team: {e}"))?;

    // Take stdout and stderr before registering
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    process_mgr.register(&session_id, child);

    // 5. Drain stderr to prevent pipe buffer deadlock
    if let Some(stderr) = stderr {
        let sid_err = session_id.clone();
        std::thread::spawn(move || {
            drain_stderr(stderr, &sid_err);
        });
    }

    // 6. Stream stdout events to the frontend in a background thread
    if let Some(stdout) = stdout {
        let app_handle = app.clone();
        let sid = session_id.clone();
        std::thread::spawn(move || {
            stream_claude_output(stdout, &app_handle, &sid);
        });
    }

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

/// Drain stderr from the Claude process to prevent pipe buffer deadlock.
///
/// Reads stderr line-by-line and logs each line at warn level. Without this,
/// if Claude writes enough to stderr to fill the OS pipe buffer (~64KB on macOS),
/// the process blocks on stderr writes and stdout stalls — deadlocking the stream.
fn drain_stderr(stderr: std::process::ChildStderr, session_id: &str) {
    use std::io::BufRead;
    let reader = std::io::BufReader::new(stderr);
    for line in reader.lines() {
        match line {
            Ok(line) if !line.trim().is_empty() => {
                // Use both log and eprintln to ensure visibility
                log::warn!("[session {session_id}] claude stderr: {line}");
                eprintln!("[ELVES] claude stderr [{session_id}]: {line}");
            }
            Err(e) => {
                log::warn!("[session {session_id}] stderr read error: {e}");
                break;
            }
            _ => {}
        }
    }
}

/// Read Claude's stdout line-by-line, parse events, and emit them to the frontend.
///
/// Runs in a background thread. For each parsed line:
/// 1. Emits `elf:event` to the frontend for real-time display
/// 2. Persists the event to SQLite for history and replay
///
/// When stdout closes (process finished):
/// 1. Extracts token/cost data from the last `result` event
/// 2. Updates session usage stats in the database
/// 3. Updates session status to "completed" with a summary from the result
/// 4. Emits `session:completed` to the frontend
fn stream_claude_output(
    stdout: std::process::ChildStdout,
    app: &AppHandle,
    session_id: &str,
) {
    use std::io::BufRead;

    eprintln!("[ELVES] Starting stdout stream for session {session_id}");
    log::info!("[session {session_id}] Starting stdout stream reader");

    let db_state = app.state::<DbState>();
    let reader = std::io::BufReader::new(stdout);
    let mut last_result_payload: Option<serde_json::Value> = None;
    let mut event_count: u32 = 0;

    for line in reader.lines() {
        match line {
            Ok(line) => {
                if let Some(event) = claude_adapter::parse_claude_output(&line) {
                    event_count += 1;

                    if event_count <= 3 || event.event_type == "result" {
                        log::info!(
                            "[session {session_id}] Event #{event_count}: type={}, payload_len={}",
                            event.event_type,
                            line.len(),
                        );
                    }

                    // Capture Claude Code's session ID from system events for resume support
                    if event.event_type == "system" {
                        if let Some(claude_sid) = event.payload.get("session_id").and_then(|v| v.as_str()) {
                            if let Ok(conn) = db_state.0.lock() {
                                let _ = db::sessions::update_claude_session_id(&conn, session_id, claude_sid);
                            }
                            let _ = app.emit(
                                "session:claude_id",
                                serde_json::json!({
                                    "sessionId": session_id,
                                    "claudeSessionId": claude_sid,
                                }),
                            );
                        }
                    }

                    // 1. Emit to frontend for real-time display
                    let _ = app.emit(
                        "elf:event",
                        serde_json::json!({
                            "sessionId": session_id,
                            "eventType": &event.event_type,
                            "payload": &event.payload,
                            "timestamp": event.timestamp,
                        }),
                    );

                    // 2. Persist to SQLite for history and replay
                    if let Ok(conn) = db_state.0.lock() {
                        let payload_str = serde_json::to_string(&event.payload).unwrap_or_default();
                        if let Err(e) = db::events::insert_event(
                            &conn,
                            session_id,
                            None,
                            &event.event_type,
                            &payload_str,
                            None,
                        ) {
                            log::warn!("Failed to store event for session {session_id}: {e}");
                        }
                    }

                    // 3. Track the last result event for usage extraction
                    if event.event_type == "result" {
                        last_result_payload = Some(event.payload.clone());
                    }
                }
            }
            Err(error) => {
                log::warn!("[session {session_id}] stdout read error: {error}");
                break;
            }
        }
    }

    eprintln!("[ELVES] stdout closed for session {session_id} after {event_count} events");
    log::info!("[session {session_id}] stdout closed after {event_count} events");

    // stdout closed — the Claude process has finished.
    if let Ok(conn) = db_state.0.lock() {
        // Extract token/cost data from the result event if available
        if let Some(ref result) = last_result_payload {
            let cost = result.get("cost_usd")
                .and_then(|v| v.as_f64())
                .or_else(|| result.get("cost").and_then(|v| v.as_f64()))
                .unwrap_or(0.0);

            let tokens = result.get("total_tokens")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    // Sum input + output tokens if total not provided
                    let input = result.get("input_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
                    let output = result.get("output_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
                    if input > 0 || output > 0 { Some(input + output) } else { None }
                })
                .unwrap_or(0);

            log::info!("[session {session_id}] Result: tokens={tokens}, cost={cost}");

            if tokens > 0 || cost > 0.0 {
                let _ = db::sessions::update_session_usage(&conn, session_id, tokens, cost);
            }
        }

        // Extract summary from the result event's text content
        let summary = last_result_payload.as_ref()
            .and_then(|r| {
                r.get("result").and_then(|v| v.as_str())
                    .or_else(|| r.get("text").and_then(|v| v.as_str()))
                    .or_else(|| r.get("content").and_then(|v| v.as_str()))
            })
            .map(|text| {
                if text.len() > 500 { format!("{}...", &text[..497]) } else { text.to_string() }
            });

        log::info!("[session {session_id}] Summary: {:?}", summary.as_deref().unwrap_or("(none)"));

        let _ = db::sessions::update_session_status(
            &conn,
            session_id,
            "completed",
            summary.as_deref().or(Some("Task completed")),
        );
    }

    let _ = app.emit(
        "session:completed",
        serde_json::json!({
            "sessionId": session_id,
        }),
    );
}
