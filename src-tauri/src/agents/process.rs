// Process manager — tracks active agent child processes by session ID.
//
// Supports both single-agent sessions (one process per session) and team sessions
// (multiple processes per session). The `teams` map handles multi-process tracking.

use std::collections::HashMap;
use std::process::Child;
use std::sync::Mutex;

/// Tracks active agent child processes keyed by session ID.
///
/// Provides spawn registration, targeted kill, and bulk cleanup operations.
/// Supports both single-process sessions and team sessions with multiple processes.
/// The Mutex ensures thread-safe access from multiple Tauri command handlers.
/// Managed as Tauri app state via `.manage(ProcessManager::new())`.
pub struct ProcessManager {
    /// Single-process sessions: one child per session.
    processes: Mutex<HashMap<String, Child>>,
    /// Team sessions: multiple children per session.
    teams: Mutex<HashMap<String, Vec<Child>>>,
}

impl ProcessManager {
    /// Create an empty process manager with no tracked processes.
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
            teams: Mutex::new(HashMap::new()),
        }
    }

    /// Register a spawned child process for the given session (single-agent mode).
    ///
    /// If a process already exists for this session, the old process is replaced
    /// (but not killed — the caller should kill it first if needed).
    pub fn register(&self, session_id: &str, child: Child) {
        let mut processes = self.processes.lock().expect("ProcessManager lock poisoned");
        processes.insert(session_id.to_string(), child);
    }

    /// Register a team of child processes for the given session.
    ///
    /// If processes already exist for this session, the old ones are replaced
    /// (but not killed — the caller should kill them first if needed).
    pub fn register_team(&self, session_id: &str, children: Vec<Child>) {
        let mut teams = self.teams.lock().expect("ProcessManager teams lock poisoned");
        teams.insert(session_id.to_string(), children);
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

    /// Kill all processes for a team session and remove them from tracking.
    ///
    /// Returns the number of child processes that were killed. Returns 0 if
    /// no team was registered for the given session_id.
    pub fn kill_team(&self, session_id: &str) -> usize {
        let mut teams = self.teams.lock().expect("ProcessManager teams lock poisoned");
        if let Some(children) = teams.remove(session_id) {
            let count = children.len();
            for mut child in children {
                let _ = child.kill();
                let _ = child.wait();
            }
            count
        } else {
            0
        }
    }

    /// Kill all active processes (both single and team). Called on app shutdown.
    ///
    /// Returns the total number of processes that were killed.
    pub fn kill_all(&self) -> usize {
        let mut count = 0;

        {
            let mut processes = self.processes.lock().expect("ProcessManager lock poisoned");
            count += processes.len();
            for (_, mut child) in processes.drain() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        {
            let mut teams = self.teams.lock().expect("ProcessManager teams lock poisoned");
            for (_, children) in teams.drain() {
                count += children.len();
                for mut child in children {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }

        count
    }

    /// Check if a session has an active (tracked) process (single or team).
    pub fn is_running(&self, session_id: &str) -> bool {
        let processes = self.processes.lock().expect("ProcessManager lock poisoned");
        if processes.contains_key(session_id) {
            return true;
        }
        drop(processes);

        let teams = self.teams.lock().expect("ProcessManager teams lock poisoned");
        teams.contains_key(session_id)
    }

    /// Get the total count of currently tracked active processes (single + team).
    pub fn active_count(&self) -> usize {
        let processes = self.processes.lock().expect("ProcessManager lock poisoned");
        let single_count = processes.len();
        drop(processes);

        let teams = self.teams.lock().expect("ProcessManager teams lock poisoned");
        let team_count: usize = teams.values().map(|v| v.len()).sum();

        single_count + team_count
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

    // --- Team session tests ---

    fn spawn_sleep() -> Child {
        Command::new("sleep")
            .arg("10")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("Failed to spawn sleep")
    }

    #[test]
    fn register_team_and_is_running() {
        let pm = ProcessManager::new();
        let children = vec![spawn_sleep(), spawn_sleep()];

        pm.register_team("team-1", children);
        assert!(pm.is_running("team-1"));
        assert_eq!(pm.active_count(), 2);

        // Cleanup
        pm.kill_team("team-1");
    }

    #[test]
    fn kill_team_removes_all_processes() {
        let pm = ProcessManager::new();
        let children = vec![spawn_sleep(), spawn_sleep(), spawn_sleep()];

        pm.register_team("team-1", children);
        assert_eq!(pm.active_count(), 3);

        let killed = pm.kill_team("team-1");
        assert_eq!(killed, 3);
        assert!(!pm.is_running("team-1"));
        assert_eq!(pm.active_count(), 0);
    }

    #[test]
    fn kill_team_nonexistent_returns_zero() {
        let pm = ProcessManager::new();
        assert_eq!(pm.kill_team("nope"), 0);
    }

    #[test]
    fn active_count_includes_both_single_and_team() {
        let pm = ProcessManager::new();

        let single = spawn_sleep();
        pm.register("solo-1", single);

        let team = vec![spawn_sleep(), spawn_sleep()];
        pm.register_team("team-1", team);

        assert_eq!(pm.active_count(), 3);

        // Cleanup
        pm.kill("solo-1");
        pm.kill_team("team-1");
    }

    #[test]
    fn kill_all_clears_both_single_and_team() {
        let pm = ProcessManager::new();

        let single = spawn_sleep();
        pm.register("solo-1", single);

        let team = vec![spawn_sleep(), spawn_sleep()];
        pm.register_team("team-1", team);

        let count = pm.kill_all();
        assert_eq!(count, 3);
        assert_eq!(pm.active_count(), 0);
        assert!(!pm.is_running("solo-1"));
        assert!(!pm.is_running("team-1"));
    }

    #[test]
    fn is_running_detects_team_sessions() {
        let pm = ProcessManager::new();
        assert!(!pm.is_running("team-x"));

        let team = vec![spawn_sleep()];
        pm.register_team("team-x", team);
        assert!(pm.is_running("team-x"));

        pm.kill_team("team-x");
        assert!(!pm.is_running("team-x"));
    }
}
