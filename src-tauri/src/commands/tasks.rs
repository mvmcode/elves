// Task execution commands — start and stop agent tasks via Tauri IPC.

use crate::agents::analyzer::{self, TaskPlan};
use crate::agents::claude_adapter::{self, ClaudeSpawnOptions};
use crate::agents::codex_adapter;
use crate::agents::interop;
use crate::agents::process::ProcessManager;
use crate::commands::projects::DbState;
use crate::commands::pty::PtyManager;
use crate::db;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/// Start a task: creates a session, spawns an elf, starts the Claude process.
///
/// Emits events to the frontend via Tauri's event system as the agent works:
/// - `elf:spawned` — when the elf DB row is created and process started
/// - `session:error` — if spawning fails after DB rows are created
///
/// Returns the session ID. The frontend subscribes to Tauri events keyed by
/// this session ID to receive real-time updates from the agent.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn start_task(
    app: AppHandle,
    db: State<'_, DbState>,
    process_mgr: State<'_, ProcessManager>,
    project_id: String,
    task: String,
    runtime: String,
    options: Option<String>,
    working_dir: Option<String>,
    worktree_slug: Option<String>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let elf_id = uuid::Uuid::new_v4().to_string();

    // 1. Create session in DB
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::create_session(&conn, &session_id, &project_id, &task, &runtime, worktree_slug.as_deref())
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

    // 3. Get the working directory — use override if provided, else fall back to project path
    let working_dir = match working_dir {
        Some(dir) => dir,
        None => {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            let project = db::projects::get_project(&conn, &project_id)
                .map_err(|e| format!("Database error: {e}"))?
                .ok_or("Project not found")?;
            project.path.clone()
        }
    };

    // 4. Emit elf:spawned event to frontend
    let _ = app.emit(
        "elf:spawned",
        serde_json::json!({
            "sessionId": &session_id,
            "elfId": &elf_id,
        }),
    );

    // 5. Build runtime-specific memory context for injection
    let memory_context = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        interop::prepare_context_for_runtime(&conn, &project_id, &runtime)
            .unwrap_or_else(|e| {
                log::warn!("Failed to prepare memory context: {e}");
                String::new()
            })
    };

    // 6. Spawn the agent process — branch on runtime
    let is_codex = runtime == "codex";

    let mut child = if is_codex {
        // For Codex, prepend memory context to the task prompt
        let codex_task = if memory_context.is_empty() {
            task.clone()
        } else {
            format!("{memory_context}\n\n---\n\n{task}")
        };
        codex_adapter::spawn_codex(&codex_task, &working_dir)
            .map_err(|e| format!("Failed to spawn codex: {e}"))?
    } else {
        // For Claude Code, inject memory via append_system_prompt
        let mut spawn_options: ClaudeSpawnOptions = match options {
            Some(ref json) => match serde_json::from_str(json) {
                Ok(opts) => opts,
                Err(e) => {
                    log::warn!("Failed to parse spawn options: {e}, json={json}");
                    ClaudeSpawnOptions::default()
                }
            },
            None => ClaudeSpawnOptions::default(),
        };
        if !memory_context.is_empty() {
            spawn_options.append_system_prompt = Some(match spawn_options.append_system_prompt {
                Some(existing) => format!("{existing}\n\n{memory_context}"),
                None => memory_context,
            });
        }
        claude_adapter::spawn_claude(&task, &working_dir, &spawn_options)
            .map_err(|e| format!("Failed to spawn claude: {e}"))?
    };

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
        if is_codex {
            std::thread::spawn(move || {
                stream_codex_output(stdout, &app_handle, &sid, None);
            });
        } else {
            std::thread::spawn(move || {
                stream_claude_output(stdout, &app_handle, &sid);
            });
        }
    }

    Ok(session_id)
}

/// Result returned from start_task_pty — contains both session and PTY identifiers.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTaskPtyResult {
    pub session_id: String,
    pub pty_id: String,
}

/// Start a task in PTY-first mode: creates a session, spawns an elf, and launches
/// Claude directly in an interactive PTY (no --print mode).
///
/// The frontend gets both a session ID (for event routing and DB) and a PTY ID
/// (for wiring xterm.js). The PTY reader thread in pty.rs handles all output
/// via `pty:data:{ptyId}` events — no stdout streaming thread needed here.
///
/// When `resume_session_id` is present in spawn options, launches `claude --resume <id>`
/// instead of a new task. DB session/elf creation is skipped for resume — reuses existing rows.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn start_task_pty(
    app: AppHandle,
    db: State<'_, DbState>,
    pty_mgr: State<'_, PtyManager>,
    project_id: String,
    task: String,
    runtime: String,
    working_dir: Option<String>,
    options: Option<String>,
    worktree_slug: Option<String>,
) -> Result<StartTaskPtyResult, String> {
    // Parse spawn options early — we need to check for resume_session_id
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

    let is_resume = spawn_options.resume_session_id.is_some();

    // For resume: reuse existing session. For new task: create DB rows.
    let session_id = if is_resume {
        // Use the task string as the ELVES session ID for resume
        // (the frontend passes the existing ELVES session ID as the task param)
        uuid::Uuid::new_v4().to_string()
    } else {
        uuid::Uuid::new_v4().to_string()
    };

    if !is_resume {
        let elf_id = uuid::Uuid::new_v4().to_string();

        // 1. Create session in DB
        {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            db::sessions::create_session(&conn, &session_id, &project_id, &task, &runtime, worktree_slug.as_deref())
                .map_err(|e| format!("Database error: {e}"))?;
        }

        // 2. Create elf in DB
        {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            db::elves::create_elf(
                &conn,
                &elf_id,
                &session_id,
                "Elf",
                None,
                "\u{1F916}",
                "#FFD93D",
                None,
                &runtime,
            )
            .map_err(|e| format!("Database error: {e}"))?;
        }

        // Emit elf:spawned event
        let _ = app.emit(
            "elf:spawned",
            serde_json::json!({
                "sessionId": &session_id,
                "elfId": &elf_id,
            }),
        );
    }

    // 3. Resolve working directory
    let working_dir = match working_dir {
        Some(dir) => dir,
        None => {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            let project = db::projects::get_project(&conn, &project_id)
                .map_err(|e| format!("Database error: {e}"))?
                .ok_or("Project not found")?;
            project.path.clone()
        }
    };

    // 4. Build memory context for injection (skip for resume — context already loaded)
    let memory_context = if is_resume {
        String::new()
    } else {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        interop::prepare_context_for_runtime(&conn, &project_id, &runtime)
            .unwrap_or_else(|e| {
                log::warn!("Failed to prepare memory context: {e}");
                String::new()
            })
    };

    // 5. Select binary and build CLI args based on runtime
    let is_codex = runtime == "codex";
    let binary = if is_codex { "codex" } else { "claude" };
    let mut args: Vec<String> = Vec::new();

    if is_codex {
        // Codex CLI: `codex --approval-mode full-auto "<task>"`
        // Codex has no --append-system-prompt, so prepend memory to the task text
        args.push("--approval-mode".to_string());
        args.push("full-auto".to_string());
        if memory_context.is_empty() {
            args.push(task.clone());
        } else {
            args.push(format!("{memory_context}\n\n---\n\n{task}"));
        }
    } else {
        // Claude Code CLI
        if let Some(ref resume_id) = spawn_options.resume_session_id {
            args.push("--resume".to_string());
            args.push(resume_id.clone());
        } else {
            args.push(task.clone());
        }

        // Apply spawn options as CLI flags (Claude Code only)
        if let Some(ref agent) = spawn_options.agent {
            args.push("--agent".to_string());
            args.push(agent.clone());
        }
        if let Some(ref model) = spawn_options.model {
            args.push("--model".to_string());
            args.push(model.clone());
        }
        if let Some(ref mode) = spawn_options.permission_mode {
            args.push("--permission-mode".to_string());
            args.push(mode.clone());
        }
        if let Some(budget) = spawn_options.max_budget_usd {
            args.push("--max-budget-usd".to_string());
            args.push(budget.to_string());
        }
        if let Some(ref effort) = spawn_options.effort {
            args.push("--effort".to_string());
            args.push(effort.clone());
        }

        // Inject memory context via --append-system-prompt (skip for resume)
        if !is_resume {
            let combined_system_prompt = match (&spawn_options.append_system_prompt, memory_context.is_empty()) {
                (Some(existing), false) => Some(format!("{existing}\n\n{memory_context}")),
                (Some(existing), true) => Some(existing.clone()),
                (None, false) => Some(memory_context),
                (None, true) => None,
            };
            if let Some(ref prompt) = combined_system_prompt {
                args.push("--append-system-prompt".to_string());
                args.push(prompt.clone());
            }
        }
    }

    // 6. Spawn via PtyManager — reuses existing PTY infrastructure
    let pty_id = pty_mgr.spawn_with_app(binary, &args, &working_dir, &app)
        .map_err(|e| format!("Failed to spawn PTY: {e}"))?;

    log::info!(
        "[session {session_id}] Started PTY-first task (resume={}): pty_id={pty_id}, working_dir={working_dir}",
        is_resume,
    );

    Ok(StartTaskPtyResult { session_id, pty_id })
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
    let is_interactive = process_mgr.is_interactive(&session_id);

    if killed || is_interactive {
        process_mgr.clear_interactive(&session_id);
    }

    // Always update DB and emit event so the frontend syncs — even if the process
    // already exited (crash, race condition). Skip DB write only if already terminal.
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let already_terminal = db::sessions::get_session(&conn, &session_id)
            .ok()
            .flatten()
            .map(|s| matches!(s.status.as_str(), "completed" | "cancelled" | "error"))
            .unwrap_or(false);

        if !already_terminal {
            db::sessions::update_session_status(
                &conn,
                &session_id,
                "cancelled",
                Some("Task stopped by user"),
            )
            .map_err(|e| format!("Database error: {e}"))?;
        }
    }

    // Always emit so the frontend transitions out of "active" state
    let _ = app.emit(
        "session:cancelled",
        serde_json::json!({
            "sessionId": &session_id,
        }),
    );

    Ok(killed || is_interactive)
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
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn start_team_task(
    app: AppHandle,
    db: State<'_, DbState>,
    process_mgr: State<'_, ProcessManager>,
    project_id: String,
    task: String,
    plan: TaskPlan,
    options: Option<String>,
    working_dir: Option<String>,
    worktree_slug: Option<String>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let runtime = plan.runtime_recommendation.clone();

    // 1. Create session in DB with agent count from plan
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::create_session(&conn, &session_id, &project_id, &task, &runtime, worktree_slug.as_deref())
            .map_err(|e| format!("Database error: {e}"))?;
    }

    // 2. Get working directory — use override if provided, else fall back to project path
    let working_dir = match working_dir {
        Some(dir) => dir,
        None => {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            let project = db::projects::get_project(&conn, &project_id)
                .map_err(|e| format!("Database error: {e}"))?
                .ok_or("Project not found")?;
            project.path.clone()
        }
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

    // 4. Build runtime-specific memory context for injection
    let memory_context = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        interop::prepare_context_for_runtime(&conn, &project_id, &runtime)
            .unwrap_or_else(|e| {
                log::warn!("Failed to prepare team memory context: {e}");
                String::new()
            })
    };

    // 5. Spawn the agent process — branch on runtime
    let is_codex = runtime == "codex";

    let mut child = if is_codex {
        // For Codex team, prepend memory context to the task prompt
        let codex_task = if memory_context.is_empty() {
            task.clone()
        } else {
            format!("{memory_context}\n\n---\n\n{task}")
        };
        codex_adapter::spawn_codex_team(&codex_task, &working_dir, &plan)
            .map_err(|e| format!("Failed to spawn codex team: {e}"))?
    } else {
        // For Claude Code team, inject memory via append_system_prompt
        let mut spawn_options: ClaudeSpawnOptions = match options {
            Some(ref json) => match serde_json::from_str(json) {
                Ok(opts) => opts,
                Err(e) => {
                    log::warn!("Failed to parse team spawn options: {e}, json={json}");
                    ClaudeSpawnOptions::default()
                }
            },
            None => ClaudeSpawnOptions::default(),
        };
        if !memory_context.is_empty() {
            spawn_options.append_system_prompt = Some(match spawn_options.append_system_prompt {
                Some(existing) => format!("{existing}\n\n{memory_context}"),
                None => memory_context,
            });
        }
        claude_adapter::spawn_claude_team(&task, &working_dir, &plan, &spawn_options)
            .map_err(|e| format!("Failed to spawn claude team: {e}"))?
    };

    // Take stdout and stderr before registering
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    process_mgr.register(&session_id, child);

    // 6. Drain stderr to prevent pipe buffer deadlock
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
        if is_codex {
            std::thread::spawn(move || {
                stream_codex_output(stdout, &app_handle, &sid, Some(elf_ids));
            });
        } else {
            std::thread::spawn(move || {
                stream_claude_output(stdout, &app_handle, &sid);
            });
        }
    }

    Ok(session_id)
}

/// One PTY entry in a team deployment — returned to the frontend per role.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamPtyInfo {
    pub role: String,
    pub pty_id: String,
    pub elf_id: String,
}

/// Result from start_team_task_pty — session ID plus one PTY per role.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTeamTaskPtyResult {
    pub session_id: String,
    pub pty_entries: Vec<TeamPtyInfo>,
}

/// Start a team task in PTY-first mode: one interactive PTY per role.
///
/// Creates a single session, one elf per role, and spawns separate Claude
/// processes in interactive PTY mode. Each role gets a role-scoped prompt.
/// Returns session ID + a list of PTY entries for the frontend to render
/// in a split terminal grid.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn start_team_task_pty(
    app: AppHandle,
    db: State<'_, DbState>,
    pty_mgr: State<'_, PtyManager>,
    project_id: String,
    task: String,
    plan: TaskPlan,
    options: Option<String>,
    working_dir: Option<String>,
    worktree_slug: Option<String>,
) -> Result<StartTeamTaskPtyResult, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let runtime = plan.runtime_recommendation.clone();

    // 1. Create session in DB
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        db::sessions::create_session(&conn, &session_id, &project_id, &task, &runtime, worktree_slug.as_deref())
            .map_err(|e| format!("Database error: {e}"))?;
    }

    // 2. Resolve working directory
    let working_dir = match working_dir {
        Some(dir) => dir,
        None => {
            let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
            let project = db::projects::get_project(&conn, &project_id)
                .map_err(|e| format!("Database error: {e}"))?
                .ok_or("Project not found")?;
            project.path.clone()
        }
    };

    // 3. Build memory context once (shared across all roles)
    let memory_context = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        interop::prepare_context_for_runtime(&conn, &project_id, &runtime)
            .unwrap_or_else(|e| {
                log::warn!("Failed to prepare team memory context: {e}");
                String::new()
            })
    };

    // 4. Parse spawn options
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

    // Budget splitting: divide total budget by number of roles
    let per_role_budget = spawn_options.max_budget_usd.map(|b| b / plan.roles.len() as f64);

    // 5. Create elves and spawn PTYs for each role
    let mut pty_entries: Vec<TeamPtyInfo> = Vec::with_capacity(plan.roles.len());

    for (i, role) in plan.roles.iter().enumerate() {
        let elf_id = uuid::Uuid::new_v4().to_string();
        let avatar = ELF_AVATARS.get(i % ELF_AVATARS.len()).unwrap_or(&"\u{1F9DD}");
        let color = ELF_COLORS.get(i % ELF_COLORS.len()).unwrap_or(&"#FFD93D");

        // Create elf in DB
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

        // Build role-scoped prompt
        let role_prompt = format!(
            "You are the {}. Your focus: {}\n\nTask: {}",
            role.name, role.focus, task
        );

        // Build CLI args — runtime-aware (same pattern as start_task_pty)
        let is_codex = runtime == "codex";
        let binary = if is_codex { "codex" } else { "claude" };
        let mut args: Vec<String> = Vec::new();

        if is_codex {
            // Codex has no --append-system-prompt, so prepend memory to the prompt
            args.push("--approval-mode".to_string());
            args.push("full-auto".to_string());
            if memory_context.is_empty() {
                args.push(role_prompt);
            } else {
                args.push(format!("{memory_context}\n\n---\n\n{role_prompt}"));
            }
        } else {
            args.push(role_prompt);

            if let Some(ref agent) = spawn_options.agent {
                args.push("--agent".to_string());
                args.push(agent.clone());
            }
            if let Some(ref model) = spawn_options.model {
                args.push("--model".to_string());
                args.push(model.clone());
            }
            if let Some(ref mode) = spawn_options.permission_mode {
                args.push("--permission-mode".to_string());
                args.push(mode.clone());
            }
            if let Some(budget) = per_role_budget {
                args.push("--max-budget-usd".to_string());
                args.push(budget.to_string());
            }
            if let Some(ref effort) = spawn_options.effort {
                args.push("--effort".to_string());
                args.push(effort.clone());
            }

            // Inject memory context via --append-system-prompt
            let combined_system_prompt = match (&spawn_options.append_system_prompt, memory_context.is_empty()) {
                (Some(existing), false) => Some(format!("{existing}\n\n{memory_context}")),
                (Some(existing), true) => Some(existing.clone()),
                (None, false) => Some(memory_context.clone()),
                (None, true) => None,
            };
            if let Some(ref prompt) = combined_system_prompt {
                args.push("--append-system-prompt".to_string());
                args.push(prompt.clone());
            }
        }

        // Spawn PTY for this role
        let pty_id = pty_mgr.spawn_with_app(binary, &args, &working_dir, &app)
            .map_err(|e| format!("Failed to spawn PTY for role {}: {e}", role.name))?;

        log::info!(
            "[session {session_id}] Spawned team PTY for role '{}': pty_id={pty_id}",
            role.name,
        );

        pty_entries.push(TeamPtyInfo {
            role: role.name.clone(),
            pty_id,
            elf_id,
        });
    }

    log::info!(
        "[session {session_id}] Started team PTY task with {} roles",
        pty_entries.len(),
    );

    Ok(StartTeamTaskPtyResult { session_id, pty_entries })
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
    let is_interactive = process_mgr.is_interactive(&session_id);
    let any_killed = single_killed || team_killed > 0 || is_interactive;

    if any_killed {
        process_mgr.clear_interactive(&session_id);
    }

    // Always update DB and emit event so the frontend syncs — even if all processes
    // already exited. Skip DB write only if session is already in a terminal state.
    {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;
        let already_terminal = db::sessions::get_session(&conn, &session_id)
            .ok()
            .flatten()
            .map(|s| matches!(s.status.as_str(), "completed" | "cancelled" | "error"))
            .unwrap_or(false);

        if !already_terminal {
            db::sessions::update_session_status(
                &conn,
                &session_id,
                "cancelled",
                Some("Team task stopped by user"),
            )
            .map_err(|e| format!("Database error: {e}"))?;
        }
    }

    // Always emit so the frontend transitions out of "active" state
    let _ = app.emit(
        "session:cancelled",
        serde_json::json!({
            "sessionId": &session_id,
        }),
    );

    Ok(any_killed)
}

/// Transition a session from non-interactive `--print` mode to interactive terminal.
///
/// Marks the session as interactive (so the stdout reader suppresses the false
/// `session:completed` event), then kills the `--print` child process. After this,
/// the frontend spawns `claude --resume <claudeSessionId>` in a PTY for the user
/// to interact with directly.
///
/// Emits `session:interactive` to the frontend so the UI can switch to terminal mode.
#[tauri::command]
pub async fn transition_to_interactive(
    app: AppHandle,
    process_mgr: State<'_, ProcessManager>,
    session_id: String,
) -> Result<bool, String> {
    process_mgr.mark_interactive(&session_id);
    let killed = process_mgr.kill(&session_id);

    let _ = app.emit(
        "session:interactive",
        serde_json::json!({
            "sessionId": &session_id,
        }),
    );

    log::info!("[session {session_id}] Transitioned to interactive mode (process killed: {killed})");
    Ok(killed)
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

                    // Also capture session_id from result events as fallback —
                    // result events reliably include it even if the system event was missed
                    if event.event_type == "result" {
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

    // If this session transitioned to interactive terminal mode, the process was
    // killed intentionally. Do NOT emit session:completed — the PTY terminal
    // now owns the session lifecycle.
    let process_mgr = app.state::<ProcessManager>();
    if process_mgr.is_interactive(session_id) {
        log::info!("[session {session_id}] Skipping completion — session transitioned to interactive mode");
        process_mgr.clear_interactive(session_id);
        return;
    }

    // Check if session was already cancelled by stop_task (prevents double-event race).
    // Without this guard, stop_task emits session:cancelled and then this function
    // sees EOF and emits session:completed — leaving the frontend in an inconsistent state.
    if let Ok(conn) = db_state.0.lock() {
        if let Ok(Some(session)) = db::sessions::get_session(&conn, session_id) {
            if session.status == "cancelled" {
                log::info!("[session {session_id}] Skipping completion — session already cancelled");
                return;
            }
        }
    }

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

/// Read Codex's stdout line-by-line, parse and normalize events, emit to frontend.
///
/// Runs in a background thread. For each parsed line:
/// 1. Parses the JSONL output into a CodexEvent via `parse_codex_output`
/// 2. Normalizes into the unified ElfEvent format via `normalize_codex_event`
/// 3. Detects "Phase N" transitions (when `elf_ids` is Some) to attribute events to the correct elf
/// 4. Emits `elf:event` to the frontend for real-time display (with elfId when in team mode)
/// 5. Persists the event to SQLite for history and replay
///
/// Pass `elf_ids = None` for solo Codex runs, `Some(elf_ids)` for team runs.
/// When `Some`, a `CodexTeamParser` tracks phase transitions and tags each event
/// with the elf ID for the active phase.
///
/// When stdout closes (process finished), marks the session as completed.
fn stream_codex_output(
    stdout: std::process::ChildStdout,
    app: &AppHandle,
    session_id: &str,
    elf_ids: Option<Vec<String>>,
) {
    use std::io::BufRead;

    eprintln!("[ELVES] Starting Codex stdout stream for session {session_id}");
    log::info!("[session {session_id}] Starting Codex stdout stream reader");

    let db_state = app.state::<DbState>();
    let reader = std::io::BufReader::new(stdout);
    let mut event_count: u32 = 0;

    // Create a phase parser for team runs, None for solo runs
    let mut team_parser = elf_ids.map(codex_adapter::CodexTeamParser::new);

    for line in reader.lines() {
        match line {
            Ok(line) => {
                if let Some(codex_event) = codex_adapter::parse_codex_output(&line) {
                    let normalized = codex_adapter::normalize_codex_event(codex_event);
                    event_count += 1;

                    if event_count <= 3 || normalized.event_type == "error" {
                        log::info!(
                            "[session {session_id}] Codex event #{event_count}: type={}, payload_len={}",
                            normalized.event_type,
                            line.len(),
                        );
                    }

                    // Detect phase transitions and resolve the current elf ID for attribution
                    let elf_id: Option<String> = team_parser.as_mut().and_then(|parser| {
                        parser.detect_phase_transition(&line);
                        parser.current_elf_id().map(|id| id.to_string())
                    });

                    // 1. Emit to frontend for real-time display (with elfId when in team mode)
                    let _ = app.emit(
                        "elf:event",
                        serde_json::json!({
                            "sessionId": session_id,
                            "elfId": elf_id.as_deref(),
                            "eventType": &normalized.event_type,
                            "payload": &normalized.payload,
                            "timestamp": normalized.timestamp,
                            "runtime": "codex",
                        }),
                    );

                    // 2. Persist to SQLite for history and replay (with elf attribution)
                    if let Ok(conn) = db_state.0.lock() {
                        let payload_str = serde_json::to_string(&normalized.payload).unwrap_or_default();
                        if let Err(e) = db::events::insert_event(
                            &conn,
                            session_id,
                            elf_id.as_deref(),
                            &normalized.event_type,
                            &payload_str,
                            None,
                        ) {
                            log::warn!("Failed to store Codex event for session {session_id}: {e}");
                        }
                    }
                }
            }
            Err(error) => {
                log::warn!("[session {session_id}] Codex stdout read error: {error}");
                break;
            }
        }
    }

    eprintln!("[ELVES] Codex stdout closed for session {session_id} after {event_count} events");
    log::info!("[session {session_id}] Codex stdout closed after {event_count} events");

    // stdout closed — the Codex process has finished.
    if let Ok(conn) = db_state.0.lock() {
        let _ = db::sessions::update_session_status(
            &conn,
            session_id,
            "completed",
            Some("Task completed"),
        );
    }

    let _ = app.emit(
        "session:completed",
        serde_json::json!({
            "sessionId": session_id,
        }),
    );
}

