// PTY management commands — spawn, write, resize, and kill pseudo-terminal processes.
//
// Bridges xterm.js on the frontend to real PTY processes via Tauri IPC.
// Each PTY instance gets a unique ID. Output is streamed via Tauri events
// (`pty:data:{id}` for stdout, `pty:exit:{id}` for process exit).

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, State};

use crate::agents::runtime::{ensure_full_path, resolve_binary};

/// Resolve a command name to an absolute path, falling back to the bare name.
/// Uses `runtime::resolve_binary` for consistent resolution across the codebase.
/// PTY spawning falls back to the bare name (instead of erroring) because
/// portable-pty may still find it via its own PATH search.
fn resolve_command(command: &str) -> String {
    match resolve_binary(command) {
        Ok(abs_path) => {
            let resolved = abs_path.to_string_lossy().to_string();
            log::debug!("Resolved command '{command}' -> {resolved}");
            resolved
        }
        Err(e) => {
            log::warn!("{e} — falling back to bare name for PTY spawn");
            command.to_string()
        }
    }
}


/// Coalescing pause to batch rapid PTY writes. Half a 60fps frame.
const COALESCE_DELAY_MS: u64 = 8;

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

    /// Spawn a new PTY process. Starts a background reader thread that emits
    /// `pty:data:{id}` and `pty:exit:{id}` events. Returns the unique pty_id.
    ///
    /// Callable both from Tauri commands and directly from other Rust code
    /// via an AppHandle reference.
    pub fn spawn_with_app(
        &self,
        command: &str,
        args: &[String],
        cwd: &str,
        app: &AppHandle,
        output_channel: Option<Channel<String>>,
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
        // Ensure TERM is set for proper TUI rendering in the PTY.
        // On Windows with ConPTY, TERM is not typically set — set it for tools that check.
        if std::env::var("TERM").is_err() {
            cmd.env("TERM", "xterm-256color");
        }
        // On Windows, ensure the ConPTY virtual terminal processing is enabled
        // by setting COLORTERM (some CLI tools check this for color support).
        #[cfg(target_os = "windows")]
        {
            if std::env::var("COLORTERM").is_err() {
                cmd.env("COLORTERM", "truecolor");
            }
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

        let reader = pair
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
            pty_reader_loop(reader, &app_clone, &pty_id_clone, output_channel);
        });

        log::info!("Spawned PTY {pty_id}: {command} {}", args.join(" "));
        Ok(pty_id)
    }
}

/// Shared reader loop for PTY output with coalescing.
///
/// Reads from the PTY master in chunks with a brief pause between reads to let
/// the kernel PTY buffer accumulate data. This naturally batches rapid sequential
/// writes (compilation output, large file dumps) into fewer, larger IPC events,
/// reducing frontend jitter.
///
/// The 8ms pause is below human perception (~30ms threshold) but long enough for
/// high-throughput processes to fill the kernel buffer. The subsequent `read()`
/// returns immediately with all accumulated data, achieving natural coalescing
/// without non-blocking fd tricks.
///
/// UTF-8 safety: tracks incomplete multi-byte sequences at chunk boundaries to
/// prevent corruption from `from_utf8_lossy` replacing partial codepoints.
fn pty_reader_loop(
    mut reader: Box<dyn Read + Send>,
    app: &AppHandle,
    pty_id: &str,
    channel: Option<Channel<String>>,
) {
    let mut buf = [0u8; 8192];
    // Tracks incomplete UTF-8 trailing bytes across iterations
    let mut pending: Vec<u8> = Vec::new();
    let event_name = format!("pty:data:{}", pty_id);
    let exit_event = format!("pty:exit:{}", pty_id);

    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                // Prepend any pending incomplete UTF-8 bytes from the previous chunk
                let chunk = if pending.is_empty() {
                    &buf[..n]
                } else {
                    pending.extend_from_slice(&buf[..n]);
                    pending.as_slice()
                };

                // Find the last valid UTF-8 boundary to avoid corrupting multi-byte chars
                let valid_len = find_utf8_boundary(chunk);
                if valid_len > 0 {
                    let data = String::from_utf8_lossy(&chunk[..valid_len]).to_string();
                    if let Some(ref ch) = channel {
                        let _ = ch.send(data);
                    } else {
                        let _ = app.emit(&event_name, data);
                    }
                }

                // Save any incomplete trailing bytes for the next iteration
                let remainder = chunk[valid_len..].to_vec();
                pending.clear();
                if !remainder.is_empty() {
                    pending.extend_from_slice(&remainder);
                }

                // Only coalesce when reading bulk output (compilation, file dumps).
                // Small reads (<= 256 bytes) are typically interactive keystrokes —
                // adding latency there degrades typing responsiveness.
                if n > 256 {
                    std::thread::sleep(std::time::Duration::from_millis(COALESCE_DELAY_MS));
                }
            }
            Err(_) => break,
        }
    }

    // Flush any remaining pending bytes (lossy is fine at EOF)
    if !pending.is_empty() {
        let data = String::from_utf8_lossy(&pending).to_string();
        if let Some(ref ch) = channel {
            let _ = ch.send(data);
        } else {
            let _ = app.emit(&event_name, data);
        }
    }
    let _ = app.emit(&exit_event, 0i32);
}

/// Find the last valid UTF-8 boundary in a byte slice.
/// Returns the number of bytes that form complete UTF-8 sequences.
/// Any trailing incomplete multi-byte sequence is excluded.
fn find_utf8_boundary(bytes: &[u8]) -> usize {
    if bytes.is_empty() {
        return 0;
    }

    // Check from the end for incomplete multi-byte sequences.
    // UTF-8 continuation bytes start with 10xxxxxx (0x80..0xBF).
    // A leading byte tells us how many continuation bytes to expect:
    //   110xxxxx = 2-byte (1 continuation)
    //   1110xxxx = 3-byte (2 continuations)
    //   11110xxx = 4-byte (3 continuations)
    let len = bytes.len();

    // Walk backward up to 3 bytes from the end to find a potential leading byte
    let check_start = len.saturating_sub(4);
    for i in (check_start..len).rev() {
        let b = bytes[i];
        if b & 0x80 == 0 {
            // ASCII byte — everything up to and including this is valid
            return len;
        }
        if b & 0xC0 == 0xC0 {
            // This is a leading byte. Check if the sequence is complete.
            let expected_len = if b & 0xF8 == 0xF0 {
                4
            } else if b & 0xF0 == 0xE0 {
                3
            } else if b & 0xE0 == 0xC0 {
                2
            } else {
                // Invalid leading byte — treat as boundary
                return len;
            };
            let available = len - i;
            if available >= expected_len {
                // Sequence is complete — all bytes are valid
                return len;
            } else {
                // Incomplete sequence — exclude it
                return i;
            }
        }
        // Continuation byte (10xxxxxx) — keep walking backward
    }

    // All trailing bytes are continuations with no leading byte — corrupted, emit as-is
    len
}

/// Spawn a new PTY process. Returns a unique pty_id string.
/// Thin Tauri command wrapper around `PtyManager::spawn_with_app`.
/// Accepts a Channel for streaming output directly to the frontend caller.
#[tauri::command]
pub fn spawn_pty(
    command: String,
    args: Vec<String>,
    cwd: String,
    on_output: Channel<String>,
    _app: AppHandle,
    state: State<'_, PtyManager>,
) -> Result<String, String> {
    state.spawn_with_app(&command, &args, &cwd, &_app, Some(on_output))
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
