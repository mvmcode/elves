// PTY management commands — spawn, write, resize, and kill pseudo-terminal processes.
//
// Bridges xterm.js on the frontend to real PTY processes via Tauri IPC.
// Each PTY instance gets a unique ID. Output is streamed via Tauri events
// (`pty:data:{id}` for stdout, `pty:exit:{id}` for process exit).

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

use crate::agents::runtime::ensure_full_path;

/// Resolve a command name to an absolute path using `which`.
/// When portable-pty receives an absolute path, it skips its internal PATH search
/// (which snapshots env vars at CommandBuilder construction time and can miss the
/// fixed-up PATH). This is belt-and-suspenders on top of `ensure_full_path()`.
fn resolve_command(command: &str) -> String {
    match which::which(command) {
        Ok(abs_path) => {
            let resolved = abs_path.to_string_lossy().to_string();
            log::info!("Resolved command '{command}' -> {resolved}");
            resolved
        }
        Err(_) => {
            log::warn!("Could not resolve '{command}' to absolute path, using bare name");
            command.to_string()
        }
    }
}

/// Holds the writable master handle and child process for a single PTY session.
struct PtyInstance {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

/// Shared state tracking all active PTY instances by their unique ID.
pub struct PtyManager(Mutex<HashMap<String, PtyInstance>>);

impl PtyManager {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }

    /// Spawn a new PTY process programmatically (from another Tauri command).
    ///
    /// Same as the `spawn_pty` command but callable directly with an AppHandle reference.
    /// Starts a background reader thread that emits `pty:data:{id}` and `pty:exit:{id}` events.
    /// Returns the unique pty_id string.
    pub fn spawn_with_app(
        &self,
        command: &str,
        args: &[String],
        cwd: &str,
        app: &AppHandle,
    ) -> Result<String, String> {
        // Ensure full PATH is available (macOS .app bundles get minimal PATH)
        ensure_full_path();
        let resolved = resolve_command(command);
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {e}"))?;

        let mut cmd = CommandBuilder::new(&resolved);
        for arg in args {
            cmd.arg(arg);
        }
        cmd.cwd(cwd);
        // Clear Claude Code env vars so the child process doesn't detect nested execution.
        // Without this, spawning `claude` from within a Claude Code session fails because
        // CLAUDE_CODE_ENTRYPOINT causes the child to enter a non-interactive nested mode.
        cmd.env_remove("CLAUDECODE");
        cmd.env_remove("CLAUDE_CODE_ENTRYPOINT");
        cmd.env_remove("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS");
        // Ensure TERM is set for proper TUI rendering in the PTY
        if std::env::var("TERM").is_err() {
            cmd.env("TERM", "xterm-256color");
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {e}"))?;

        drop(pair.slave);

        let pty_id = uuid::Uuid::new_v4().to_string();
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

        let instance = PtyInstance {
            writer,
            master: pair.master,
            child,
        };
        self.0
            .lock()
            .map_err(|e| format!("Failed to lock PTY state: {e}"))?
            .insert(pty_id.clone(), instance);

        let pty_id_clone = pty_id.clone();
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_clone.emit(&format!("pty:data:{}", pty_id_clone), data);
                    }
                    Err(_) => break,
                }
            }
            let _ = app_clone.emit(&format!("pty:exit:{}", pty_id_clone), 0i32);
        });

        log::info!("Spawned PTY {pty_id}: {command} {}", args.join(" "));
        Ok(pty_id)
    }
}

/// Spawn a new PTY process. Returns a unique pty_id string.
/// Starts a background thread that reads PTY output and emits `pty:data:{pty_id}` events.
/// When the reader gets EOF (process exited), it emits `pty:exit:{pty_id}`.
#[tauri::command]
pub fn spawn_pty(
    command: String,
    args: Vec<String>,
    cwd: String,
    app: AppHandle,
    state: State<'_, PtyManager>,
) -> Result<String, String> {
    // Ensure full PATH is available (macOS .app bundles get minimal PATH)
    ensure_full_path();
    let resolved = resolve_command(&command);
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let mut cmd = CommandBuilder::new(&resolved);
    for arg in &args {
        cmd.arg(arg);
    }
    cmd.cwd(&cwd);
    // Clear Claude Code env vars so the child process doesn't detect nested execution.
    cmd.env_remove("CLAUDECODE");
    cmd.env_remove("CLAUDE_CODE_ENTRYPOINT");
    cmd.env_remove("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS");
    // Ensure TERM is set for proper TUI rendering in the PTY
    if std::env::var("TERM").is_err() {
        cmd.env("TERM", "xterm-256color");
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {e}"))?;

    // Drop the slave handle — the child process owns it now
    drop(pair.slave);

    let pty_id = uuid::Uuid::new_v4().to_string();
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

    // Clone a reader from the master for background reading
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

    // Store the instance for write/resize/kill operations
    let instance = PtyInstance {
        writer,
        master: pair.master,
        child,
    };
    state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock PTY state: {e}"))?
        .insert(pty_id.clone(), instance);

    // Spawn a background thread to read PTY output and emit events.
    // When the read loop ends (EOF = process exited), emit exit event.
    let pty_id_clone = pty_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(&format!("pty:data:{}", pty_id_clone), data);
                }
                Err(_) => break,
            }
        }
        // Process exited — emit exit event with code 0 (we can't easily get the real code
        // without blocking on child.wait(), and the child is behind a Mutex in PtyManager)
        let _ = app.emit(&format!("pty:exit:{}", pty_id_clone), 0i32);
    });

    log::info!("Spawned PTY {pty_id}: {command} {}", args.join(" "));
    Ok(pty_id)
}

/// Write data to a PTY's stdin.
#[tauri::command]
pub fn write_pty(pty_id: String, data: String, state: State<'_, PtyManager>) -> Result<(), String> {
    let mut map = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock PTY state: {e}"))?;

    let instance = map
        .get_mut(&pty_id)
        .ok_or_else(|| format!("PTY {pty_id} not found"))?;

    instance
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {e}"))?;

    instance
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {e}"))?;

    Ok(())
}

/// Resize a PTY viewport.
#[tauri::command]
pub fn resize_pty(
    pty_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    let map = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock PTY state: {e}"))?;

    let instance = map
        .get(&pty_id)
        .ok_or_else(|| format!("PTY {pty_id} not found"))?;

    instance
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {e}"))?;

    Ok(())
}

/// Check whether a PTY ID is still alive in the manager.
/// Used by the frontend to detect stale references after tab close or app restart.
#[tauri::command]
pub fn check_pty_exists(pty_id: String, state: State<'_, PtyManager>) -> bool {
    state
        .0
        .lock()
        .map(|map| map.contains_key(&pty_id))
        .unwrap_or(false)
}

/// Kill a PTY process and remove it from the manager.
#[tauri::command]
pub fn kill_pty(pty_id: String, state: State<'_, PtyManager>) -> Result<(), String> {
    let mut map = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock PTY state: {e}"))?;

    if let Some(mut instance) = map.remove(&pty_id) {
        // Kill the child process; ignore errors if already exited
        let _ = instance.child.kill();
        // Drop the writer to close stdin, causing the reader thread to detect EOF
        drop(instance.writer);
        log::info!("Killed PTY {pty_id}");
    }

    Ok(())
}
