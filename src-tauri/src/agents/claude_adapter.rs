// Claude Code adapter — spawns Claude CLI as a subprocess and parses its output.

use crate::agents::analyzer::TaskPlan;
use serde::{Deserialize, Serialize};

/// A parsed event from Claude Code's output stream.
/// These are normalized into the ElfEvent format for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeEvent {
    /// The type of event (e.g., "output", "tool_use", "result").
    pub event_type: String,
    /// Raw JSON payload from Claude Code's output.
    pub payload: serde_json::Value,
    /// Unix timestamp (seconds since epoch) when the event was received.
    pub timestamp: i64,
}

/// Spawn a Claude Code CLI process in non-interactive (print) mode.
///
/// Runs: `claude --print --output-format json "<task>"`
/// in the given working directory.
///
/// Returns the child process handle for the caller to manage stdout/stderr.
/// The caller is responsible for reading stdout line-by-line and passing each
/// line to `parse_claude_output` for event extraction.
pub fn spawn_claude(
    task: &str,
    working_dir: &str,
) -> Result<std::process::Child, std::io::Error> {
    std::process::Command::new("claude")
        .arg("--print")
        .arg("--output-format")
        .arg("json")
        .arg(task)
        .current_dir(working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
}

/// Parse a single line of output from the Claude Code CLI into a ClaudeEvent.
///
/// Claude Code in `--print --output-format json` mode emits JSON objects.
/// Lines that are valid JSON with a "type" field use that as the event_type.
/// Lines that are valid JSON without a "type" field default to "output".
/// Non-JSON lines are wrapped as plain text output events.
/// Empty lines return None.
pub fn parse_claude_output(line: &str) -> Option<ClaudeEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let now = chrono::Utc::now().timestamp();

    match serde_json::from_str::<serde_json::Value>(trimmed) {
        Ok(value) => {
            let event_type = value
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("output")
                .to_string();

            Some(ClaudeEvent {
                event_type,
                payload: value,
                timestamp: now,
            })
        }
        Err(_) => {
            // Non-JSON output — wrap as plain text
            Some(ClaudeEvent {
                event_type: "output".to_string(),
                payload: serde_json::json!({ "text": trimmed }),
                timestamp: now,
            })
        }
    }
}

/// Spawn a Claude Code CLI process in team mode.
///
/// Sets `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and constructs a team prompt
/// from the TaskPlan, describing each role, its focus, and task dependencies.
/// Claude Code's native team support coordinates the agents internally.
///
/// Returns the child process handle. The caller manages stdout/stderr.
pub fn spawn_claude_team(
    task: &str,
    working_dir: &str,
    plan: &TaskPlan,
) -> Result<std::process::Child, std::io::Error> {
    let team_prompt = build_team_prompt(task, plan);

    std::process::Command::new("claude")
        .arg("--print")
        .arg("--output-format")
        .arg("json")
        .arg(&team_prompt)
        .current_dir(working_dir)
        .env("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
}

/// Build a structured team prompt from a TaskPlan.
///
/// The prompt describes the overall task, each team role with its focus,
/// and the task dependency graph so the lead agent can coordinate work.
pub fn build_team_prompt(task: &str, plan: &TaskPlan) -> String {
    let mut prompt = String::with_capacity(1024);

    prompt.push_str("You are leading a team to complete the following task:\n\n");
    prompt.push_str(&format!("## Task\n{task}\n\n"));

    prompt.push_str(&format!(
        "## Team ({} agents)\n\n",
        plan.agent_count
    ));

    for role in &plan.roles {
        prompt.push_str(&format!(
            "- **{}**: {}\n",
            role.name, role.focus
        ));
    }

    if !plan.task_graph.is_empty() {
        prompt.push_str("\n## Task Graph\n\n");
        for node in &plan.task_graph {
            let deps = if node.depends_on.is_empty() {
                "none".to_string()
            } else {
                node.depends_on.join(", ")
            };
            prompt.push_str(&format!(
                "- [{}] {} (assigned: {}, depends on: {})\n",
                node.id, node.label, node.assignee, deps
            ));
        }
    }

    prompt.push_str("\n## Instructions\n");
    prompt.push_str("Spawn teammates for each role above. ");
    prompt.push_str("Coordinate their work following the dependency graph. ");
    prompt.push_str("Each teammate should focus solely on their assigned role. ");
    prompt.push_str("Report progress as each sub-task completes.\n");

    prompt
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::analyzer::{
        RoleDef, TaskComplexity, TaskNode, TaskNodeStatus, TaskPlan,
    };

    #[test]
    fn parse_valid_json_with_type_field() {
        let line = r#"{"type": "tool_use", "tool": "read_file", "path": "src/main.rs"}"#;
        let event = parse_claude_output(line).expect("Should parse valid JSON");

        assert_eq!(event.event_type, "tool_use");
        assert_eq!(event.payload["tool"], "read_file");
        assert_eq!(event.payload["path"], "src/main.rs");
        assert!(event.timestamp > 0);
    }

    #[test]
    fn parse_valid_json_without_type_defaults_to_output() {
        let line = r#"{"message": "hello", "tokens": 42}"#;
        let event = parse_claude_output(line).expect("Should parse JSON without type");

        assert_eq!(event.event_type, "output");
        assert_eq!(event.payload["message"], "hello");
        assert_eq!(event.payload["tokens"], 42);
    }

    #[test]
    fn parse_plain_text_wraps_as_output() {
        let line = "Some non-JSON output from Claude";
        let event = parse_claude_output(line).expect("Should wrap plain text");

        assert_eq!(event.event_type, "output");
        assert_eq!(event.payload["text"], "Some non-JSON output from Claude");
    }

    #[test]
    fn parse_empty_line_returns_none() {
        assert!(parse_claude_output("").is_none());
        assert!(parse_claude_output("   ").is_none());
        assert!(parse_claude_output("\n").is_none());
        assert!(parse_claude_output("\t  \n").is_none());
    }

    #[test]
    fn parse_result_type_event() {
        let line = r#"{"type": "result", "result": "Task completed successfully", "cost": 0.05}"#;
        let event = parse_claude_output(line).expect("Should parse result event");

        assert_eq!(event.event_type, "result");
        assert_eq!(event.payload["result"], "Task completed successfully");
    }

    #[test]
    fn parse_preserves_nested_json() {
        let line = r#"{"type": "tool_use", "input": {"path": "/src", "content": "fn main(){}"}}"#;
        let event = parse_claude_output(line).expect("Should parse nested JSON");

        assert_eq!(event.event_type, "tool_use");
        assert!(event.payload["input"].is_object());
        assert_eq!(event.payload["input"]["path"], "/src");
    }

    #[test]
    fn parse_trims_whitespace_before_parsing() {
        let line = "  {\"type\": \"thinking\", \"content\": \"analyzing...\"}  ";
        let event = parse_claude_output(line).expect("Should parse after trimming");

        assert_eq!(event.event_type, "thinking");
    }

    #[test]
    fn claude_event_serializes_to_camel_case() {
        let event = ClaudeEvent {
            event_type: "test".to_string(),
            payload: serde_json::json!({"key": "value"}),
            timestamp: 1700000000,
        };
        let json = serde_json::to_string(&event).expect("Should serialize");
        assert!(json.contains("eventType"));
        assert!(!json.contains("event_type"));
    }

    // --- Team prompt tests ---

    fn sample_team_plan() -> TaskPlan {
        TaskPlan {
            complexity: TaskComplexity::Team,
            agent_count: 3,
            roles: vec![
                RoleDef {
                    name: "Researcher".to_string(),
                    focus: "Research competitors".to_string(),
                    runtime: "claude-code".to_string(),
                },
                RoleDef {
                    name: "Implementer".to_string(),
                    focus: "Build the integration".to_string(),
                    runtime: "claude-code".to_string(),
                },
                RoleDef {
                    name: "Tester".to_string(),
                    focus: "Write and run tests".to_string(),
                    runtime: "claude-code".to_string(),
                },
            ],
            task_graph: vec![
                TaskNode {
                    id: "task-1".to_string(),
                    label: "Research and gather info".to_string(),
                    assignee: "Researcher".to_string(),
                    depends_on: vec![],
                    status: TaskNodeStatus::Pending,
                },
                TaskNode {
                    id: "task-2".to_string(),
                    label: "Implement the solution".to_string(),
                    assignee: "Implementer".to_string(),
                    depends_on: vec!["task-1".to_string()],
                    status: TaskNodeStatus::Pending,
                },
                TaskNode {
                    id: "task-3".to_string(),
                    label: "Test and verify".to_string(),
                    assignee: "Tester".to_string(),
                    depends_on: vec!["task-2".to_string()],
                    status: TaskNodeStatus::Pending,
                },
            ],
            runtime_recommendation: "claude-code".to_string(),
            estimated_duration: "~6 minutes".to_string(),
        }
    }

    #[test]
    fn build_team_prompt_includes_task() {
        let plan = sample_team_plan();
        let prompt = build_team_prompt("Research and build API integration", &plan);
        assert!(prompt.contains("Research and build API integration"));
    }

    #[test]
    fn build_team_prompt_includes_all_roles() {
        let plan = sample_team_plan();
        let prompt = build_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("**Researcher**"));
        assert!(prompt.contains("**Implementer**"));
        assert!(prompt.contains("**Tester**"));
        assert!(prompt.contains("Research competitors"));
        assert!(prompt.contains("Build the integration"));
    }

    #[test]
    fn build_team_prompt_includes_agent_count() {
        let plan = sample_team_plan();
        let prompt = build_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("3 agents"));
    }

    #[test]
    fn build_team_prompt_includes_dependency_graph() {
        let plan = sample_team_plan();
        let prompt = build_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("[task-1]"));
        assert!(prompt.contains("[task-2]"));
        assert!(prompt.contains("[task-3]"));
        assert!(prompt.contains("depends on: none"));
        assert!(prompt.contains("depends on: task-1"));
        assert!(prompt.contains("depends on: task-2"));
    }

    #[test]
    fn build_team_prompt_includes_coordination_instructions() {
        let plan = sample_team_plan();
        let prompt = build_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("Spawn teammates"));
        assert!(prompt.contains("dependency graph"));
    }

    #[test]
    fn build_team_prompt_handles_empty_graph() {
        let plan = TaskPlan {
            complexity: TaskComplexity::Solo,
            agent_count: 1,
            roles: vec![RoleDef {
                name: "Worker".to_string(),
                focus: "Do the work".to_string(),
                runtime: "claude-code".to_string(),
            }],
            task_graph: vec![],
            runtime_recommendation: "claude-code".to_string(),
            estimated_duration: "~1 minute".to_string(),
        };
        let prompt = build_team_prompt("Simple task", &plan);
        assert!(prompt.contains("Simple task"));
        assert!(prompt.contains("**Worker**"));
        assert!(!prompt.contains("Task Graph"));
    }
}
