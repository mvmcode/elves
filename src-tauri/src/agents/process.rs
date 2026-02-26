// Process manager — tracks active agent child processes by session ID.

use std::collections::HashMap;
use std::process::Child;
use std::sync::Mutex;

/// Tracks active agent child processes keyed by session ID.
///
/// Provides spawn registration, targeted kill, and bulk cleanup operations.
/// The Mutex ensures thread-safe access from multiple Tauri command handlers.
/// Managed as Tauri app state via `.manage(ProcessManager::new())`.
pub struct ProcessManager {
    processes: Mutex<HashMap<String, Child>>,
}

impl ProcessManager {
    /// Create an empty process manager with no tracked processes.
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    /// Register a spawned child process for the given session.
    ///
    /// If a process already exists for this session, the old process is replaced
    /// (but not killed — the caller should kill it first if needed).
    pub fn register(&self, session_id: &str, child: Child) {
        let mut processes = self.processes.lock().expect("ProcessManager lock poisoned");
        processes.insert(session_id.to_string(), child);
    }

    /// Kill the process for a specific session and remove it from tracking.
    ///
    /// Sends SIGKILL to the child and reaps the zombie via `wait()`.
    /// Returns true if a process was found and killed, false if no process
    /// existed for the given session_id.
    pub fn kill(&self, session_id: &str) -> bool {
        let mut processes = self.processes.lock().expect("ProcessManager lock poisoned");
        if let Some(mut child) = processes.remove(session_id) {
            let _ = child.kill();
            let _ = child.wait();
            true
        } else {
            false
        }
    }

    /// Kill all active processes. Called on app shutdown for cleanup.
    ///
    /// Returns the number of processes that were killed.
    pub fn kill_all(&self) -> usize {
        let mut processes = self.processes.lock().expect("ProcessManager lock poisoned");
        let count = processes.len();
        for (_, mut child) in processes.drain() {
            let _ = child.kill();
            let _ = child.wait();
        }
        count
    }

    /// Check if a session has an active (tracked) process.
    pub fn is_running(&self, session_id: &str) -> bool {
        let processes = self.processes.lock().expect("ProcessManager lock poisoned");
        processes.contains_key(session_id)
    }

    /// Get the count of currently tracked active processes.
    pub fn active_count(&self) -> usize {
        let processes = self.processes.lock().expect("ProcessManager lock poisoned");
        processes.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn new_process_manager_has_zero_active() {
        let pm = ProcessManager::new();
        assert_eq!(pm.active_count(), 0);
    }

    #[test]
    fn register_and_is_running() {
        let pm = ProcessManager::new();
        let child = Command::new("echo")
            .arg("test")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("Failed to spawn echo");

        pm.register("sess-1", child);
        assert!(pm.is_running("sess-1"));
        assert!(!pm.is_running("sess-2"));
        assert_eq!(pm.active_count(), 1);

        // Cleanup
        pm.kill("sess-1");
    }

    #[test]
    fn kill_removes_process_and_returns_true() {
        let pm = ProcessManager::new();
        let child = Command::new("sleep")
            .arg("10")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("Failed to spawn sleep");

        pm.register("sess-1", child);
        assert!(pm.is_running("sess-1"));

        let killed = pm.kill("sess-1");
        assert!(killed);
        assert!(!pm.is_running("sess-1"));
        assert_eq!(pm.active_count(), 0);
    }

    #[test]
    fn kill_nonexistent_returns_false() {
        let pm = ProcessManager::new();
        let killed = pm.kill("nonexistent-session");
        assert!(!killed);
    }

    #[test]
    fn kill_all_clears_everything() {
        let pm = ProcessManager::new();

        let child1 = Command::new("sleep")
            .arg("10")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("Failed to spawn sleep");
        let child2 = Command::new("sleep")
            .arg("10")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("Failed to spawn sleep");

        pm.register("sess-1", child1);
        pm.register("sess-2", child2);
        assert_eq!(pm.active_count(), 2);

        let count = pm.kill_all();
        assert_eq!(count, 2);
        assert_eq!(pm.active_count(), 0);
        assert!(!pm.is_running("sess-1"));
        assert!(!pm.is_running("sess-2"));
    }

    #[test]
    fn kill_all_on_empty_returns_zero() {
        let pm = ProcessManager::new();
        let count = pm.kill_all();
        assert_eq!(count, 0);
    }

    #[test]
    fn register_replaces_existing_entry() {
        let pm = ProcessManager::new();

        let child1 = Command::new("echo")
            .arg("first")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("Failed to spawn");
        let child2 = Command::new("echo")
            .arg("second")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("Failed to spawn");

        pm.register("sess-1", child1);
        pm.register("sess-1", child2);
        assert_eq!(pm.active_count(), 1);

        // Cleanup
        pm.kill("sess-1");
    }
}
