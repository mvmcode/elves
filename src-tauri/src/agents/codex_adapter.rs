// Codex CLI adapter — spawns Codex CLI as a subprocess and parses its JSONL output.
//
// Codex emits structured JSONL events to stdout. This adapter parses those events
// into CodexEvent structs and normalizes them into the unified ElfEvent format
// so the frontend never knows which runtime is underneath.

use crate::agents::analyzer::TaskPlan;
use serde::{Deserialize, Serialize};

/// A parsed event from the Codex CLI's JSONL output stream.
/// These are normalized into the ElfEvent format for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexEvent {
    /// The type of event (e.g., "plan", "patch", "message", "tool_call").
    pub event_type: String,
    /// Raw JSON payload from Codex CLI's JSONL output.
    pub payload: serde_json::Value,
    /// Unix timestamp (seconds since epoch) when the event was received.
    pub timestamp: i64,
}

/// Normalized event for the unified ElfEvent stream consumed by the frontend.
/// This matches the TypeScript ElfEvent interface field-for-field.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedEvent {
    /// The unified event type: thinking, tool_call, tool_result, output, error, etc.
    pub event_type: String,
    /// Payload containing event-specific data, matching the frontend's Record<string, unknown>.
    pub payload: serde_json::Value,
    /// Unix timestamp (seconds since epoch).
    pub timestamp: i64,
    /// The originating runtime identifier.
    pub runtime: String,
}

/// Spawn a Codex CLI process for a single-agent task.
///
/// Runs: `codex --approval-mode full-auto "<task>"`
/// in the given working directory.
///
/// Returns the child process handle. The caller reads stdout line-by-line
/// and passes each line to `parse_codex_output` for event extraction.
pub fn spawn_codex(
    task: &str,
    working_dir: &str,
) -> Result<std::process::Child, std::io::Error> {
    std::process::Command::new("codex")
        .arg("--approval-mode")
        .arg("full-auto")
        .arg(task)
        .current_dir(working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
}

/// Parse a single line of JSONL output from the Codex CLI into a CodexEvent.
///
/// Codex emits one JSON object per line. Lines with a "type" field use that
/// as the event_type. Lines without "type" default to "message".
/// Non-JSON lines are wrapped as plain text message events.
/// Empty lines return None.
pub fn parse_codex_output(line: &str) -> Option<CodexEvent> {
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
                .unwrap_or("message")
                .to_string();

            Some(CodexEvent {
                event_type,
                payload: value,
                timestamp: now,
            })
        }
        Err(_) => {
            // Non-JSON output — wrap as plain text message
            Some(CodexEvent {
                event_type: "message".to_string(),
                payload: serde_json::json!({ "text": trimmed }),
                timestamp: now,
            })
        }
    }
}

/// Normalize a CodexEvent into the unified ElfEvent format.
///
/// Maps Codex-specific event types to the unified protocol types:
/// - "plan" / "thinking"  → "thinking" (agent reasoning)
/// - "tool_call" / "exec" → "tool_call" (tool invocation)
/// - "tool_result"        → "tool_result" (tool response)
/// - "patch" / "apply"    → "file_change" (file modifications)
/// - "error"              → "error" (runtime error)
/// - everything else      → "output" (generic content)
pub fn normalize_codex_event(event: CodexEvent) -> NormalizedEvent {
    let unified_type = match event.event_type.as_str() {
        "plan" | "thinking" => "thinking",
        "tool_call" | "exec" | "function_call" => "tool_call",
        "tool_result" | "function_result" => "tool_result",
        "patch" | "apply" | "file_edit" => "file_change",
        "error" => "error",
        _ => "output",
    };

    NormalizedEvent {
        event_type: unified_type.to_string(),
        payload: event.payload,
        timestamp: event.timestamp,
        runtime: "codex".to_string(),
    }
}

/// Spawn a Codex CLI process in team mode.
///
/// Constructs a team prompt from the TaskPlan describing each role and its focus,
/// then spawns Codex with the composite prompt.
///
/// Returns the child process handle. The caller manages stdout/stderr.
pub fn spawn_codex_team(
    task: &str,
    working_dir: &str,
    plan: &TaskPlan,
) -> Result<std::process::Child, std::io::Error> {
    let team_prompt = build_codex_team_prompt(task, plan);

    std::process::Command::new("codex")
        .arg("--approval-mode")
        .arg("full-auto")
        .arg(&team_prompt)
        .current_dir(working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
}

/// Build a structured team prompt from a TaskPlan, formatted for Codex.
///
/// Codex does not have native team support like Claude Code, so the prompt
/// embeds role instructions and the dependency graph directly. Codex handles
/// coordination via its plan mode, treating roles as sequential plan steps.
pub fn build_codex_team_prompt(task: &str, plan: &TaskPlan) -> String {
    let mut prompt = String::with_capacity(1024);

    prompt.push_str("Complete the following task with a structured approach:\n\n");
    prompt.push_str(&format!("## Task\n{task}\n\n"));

    prompt.push_str(&format!(
        "## Approach ({} phases)\n\n",
        plan.roles.len()
    ));

    for (index, role) in plan.roles.iter().enumerate() {
        prompt.push_str(&format!(
            "### Phase {} — {}\n{}\n\n",
            index + 1,
            role.name,
            role.focus
        ));
    }

    if !plan.task_graph.is_empty() {
        prompt.push_str("## Execution Order\n\n");
        for node in &plan.task_graph {
            let deps = if node.depends_on.is_empty() {
                "start immediately".to_string()
            } else {
                format!("after {}", node.depends_on.join(", "))
            };
            prompt.push_str(&format!(
                "- [{}] {} ({})\n",
                node.id, node.label, deps
            ));
        }
    }

    prompt.push_str("\n## Instructions\n");
    prompt.push_str("Execute each phase in order. ");
    prompt.push_str("Complete all dependencies before starting the next phase. ");
    prompt.push_str("Report progress after each phase completes.\n");

    prompt
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::analyzer::{
        RoleDef, TaskComplexity, TaskNode, TaskNodeStatus, TaskPlan,
    };

    // --- parse_codex_output tests ---

    #[test]
    fn parse_valid_json_with_type_field() {
        let line = r#"{"type": "tool_call", "tool": "write_file", "path": "src/lib.rs"}"#;
        let event = parse_codex_output(line).expect("Should parse valid JSON");

        assert_eq!(event.event_type, "tool_call");
        assert_eq!(event.payload["tool"], "write_file");
        assert_eq!(event.payload["path"], "src/lib.rs");
        assert!(event.timestamp > 0);
    }

    #[test]
    fn parse_valid_json_without_type_defaults_to_message() {
        let line = r#"{"content": "analyzing codebase", "tokens": 100}"#;
        let event = parse_codex_output(line).expect("Should parse JSON without type");

        assert_eq!(event.event_type, "message");
        assert_eq!(event.payload["content"], "analyzing codebase");
        assert_eq!(event.payload["tokens"], 100);
    }

    #[test]
    fn parse_plain_text_wraps_as_message() {
        let line = "Processing your request...";
        let event = parse_codex_output(line).expect("Should wrap plain text");

        assert_eq!(event.event_type, "message");
        assert_eq!(event.payload["text"], "Processing your request...");
    }

    #[test]
    fn parse_empty_line_returns_none() {
        assert!(parse_codex_output("").is_none());
        assert!(parse_codex_output("   ").is_none());
        assert!(parse_codex_output("\n").is_none());
        assert!(parse_codex_output("\t  \n").is_none());
    }

    #[test]
    fn parse_plan_event() {
        let line = r#"{"type": "plan", "steps": ["step1", "step2"]}"#;
        let event = parse_codex_output(line).expect("Should parse plan event");

        assert_eq!(event.event_type, "plan");
        assert!(event.payload["steps"].is_array());
    }

    #[test]
    fn parse_patch_event() {
        let line = r#"{"type": "patch", "file": "src/main.rs", "diff": "+new line"}"#;
        let event = parse_codex_output(line).expect("Should parse patch event");

        assert_eq!(event.event_type, "patch");
        assert_eq!(event.payload["file"], "src/main.rs");
    }

    #[test]
    fn parse_preserves_nested_json() {
        let line = r#"{"type": "exec", "command": {"bin": "cargo", "args": ["test"]}}"#;
        let event = parse_codex_output(line).expect("Should parse nested JSON");

        assert_eq!(event.event_type, "exec");
        assert!(event.payload["command"].is_object());
        assert_eq!(event.payload["command"]["bin"], "cargo");
    }

    #[test]
    fn parse_trims_whitespace_before_parsing() {
        let line = "  {\"type\": \"thinking\", \"content\": \"planning...\"}  ";
        let event = parse_codex_output(line).expect("Should parse after trimming");

        assert_eq!(event.event_type, "thinking");
    }

    #[test]
    fn codex_event_serializes_to_camel_case() {
        let event = CodexEvent {
            event_type: "test".to_string(),
            payload: serde_json::json!({"key": "value"}),
            timestamp: 1700000000,
        };
        let json = serde_json::to_string(&event).expect("Should serialize");
        assert!(json.contains("eventType"));
        assert!(!json.contains("event_type"));
    }

    // --- normalize_codex_event tests ---

    fn make_codex_event(event_type: &str) -> CodexEvent {
        CodexEvent {
            event_type: event_type.to_string(),
            payload: serde_json::json!({"data": "test"}),
            timestamp: 1700000000,
        }
    }

    #[test]
    fn normalize_plan_to_thinking() {
        let normalized = normalize_codex_event(make_codex_event("plan"));
        assert_eq!(normalized.event_type, "thinking");
        assert_eq!(normalized.runtime, "codex");
    }

    #[test]
    fn normalize_thinking_to_thinking() {
        let normalized = normalize_codex_event(make_codex_event("thinking"));
        assert_eq!(normalized.event_type, "thinking");
    }

    #[test]
    fn normalize_tool_call_to_tool_call() {
        let normalized = normalize_codex_event(make_codex_event("tool_call"));
        assert_eq!(normalized.event_type, "tool_call");
    }

    #[test]
    fn normalize_exec_to_tool_call() {
        let normalized = normalize_codex_event(make_codex_event("exec"));
        assert_eq!(normalized.event_type, "tool_call");
    }

    #[test]
    fn normalize_function_call_to_tool_call() {
        let normalized = normalize_codex_event(make_codex_event("function_call"));
        assert_eq!(normalized.event_type, "tool_call");
    }

    #[test]
    fn normalize_tool_result_to_tool_result() {
        let normalized = normalize_codex_event(make_codex_event("tool_result"));
        assert_eq!(normalized.event_type, "tool_result");
    }

    #[test]
    fn normalize_function_result_to_tool_result() {
        let normalized = normalize_codex_event(make_codex_event("function_result"));
        assert_eq!(normalized.event_type, "tool_result");
    }

    #[test]
    fn normalize_patch_to_file_change() {
        let normalized = normalize_codex_event(make_codex_event("patch"));
        assert_eq!(normalized.event_type, "file_change");
    }

    #[test]
    fn normalize_apply_to_file_change() {
        let normalized = normalize_codex_event(make_codex_event("apply"));
        assert_eq!(normalized.event_type, "file_change");
    }

    #[test]
    fn normalize_file_edit_to_file_change() {
        let normalized = normalize_codex_event(make_codex_event("file_edit"));
        assert_eq!(normalized.event_type, "file_change");
    }

    #[test]
    fn normalize_error_to_error() {
        let normalized = normalize_codex_event(make_codex_event("error"));
        assert_eq!(normalized.event_type, "error");
    }

    #[test]
    fn normalize_unknown_to_output() {
        let normalized = normalize_codex_event(make_codex_event("message"));
        assert_eq!(normalized.event_type, "output");
    }

    #[test]
    fn normalize_preserves_payload_and_timestamp() {
        let event = CodexEvent {
            event_type: "plan".to_string(),
            payload: serde_json::json!({"steps": [1, 2, 3]}),
            timestamp: 1700000000,
        };
        let normalized = normalize_codex_event(event);

        assert_eq!(normalized.payload["steps"], serde_json::json!([1, 2, 3]));
        assert_eq!(normalized.timestamp, 1700000000);
    }

    #[test]
    fn normalized_event_serializes_to_camel_case() {
        let normalized = NormalizedEvent {
            event_type: "thinking".to_string(),
            payload: serde_json::json!({}),
            timestamp: 1700000000,
            runtime: "codex".to_string(),
        };
        let json = serde_json::to_string(&normalized).expect("Should serialize");
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
                    runtime: "codex".to_string(),
                },
                RoleDef {
                    name: "Implementer".to_string(),
                    focus: "Build the integration".to_string(),
                    runtime: "codex".to_string(),
                },
                RoleDef {
                    name: "Tester".to_string(),
                    focus: "Write and run tests".to_string(),
                    runtime: "codex".to_string(),
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
            runtime_recommendation: "codex".to_string(),
            estimated_duration: "~6 minutes".to_string(),
        }
    }

    #[test]
    fn build_codex_team_prompt_includes_task() {
        let plan = sample_team_plan();
        let prompt = build_codex_team_prompt("Research and build API integration", &plan);
        assert!(prompt.contains("Research and build API integration"));
    }

    #[test]
    fn build_codex_team_prompt_includes_all_phases() {
        let plan = sample_team_plan();
        let prompt = build_codex_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("Phase 1 — Researcher"));
        assert!(prompt.contains("Phase 2 — Implementer"));
        assert!(prompt.contains("Phase 3 — Tester"));
        assert!(prompt.contains("Research competitors"));
        assert!(prompt.contains("Build the integration"));
    }

    #[test]
    fn build_codex_team_prompt_includes_phase_count() {
        let plan = sample_team_plan();
        let prompt = build_codex_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("3 phases"));
    }

    #[test]
    fn build_codex_team_prompt_includes_execution_order() {
        let plan = sample_team_plan();
        let prompt = build_codex_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("[task-1]"));
        assert!(prompt.contains("[task-2]"));
        assert!(prompt.contains("[task-3]"));
        assert!(prompt.contains("start immediately"));
        assert!(prompt.contains("after task-1"));
        assert!(prompt.contains("after task-2"));
    }

    #[test]
    fn build_codex_team_prompt_includes_instructions() {
        let plan = sample_team_plan();
        let prompt = build_codex_team_prompt("Do the thing", &plan);
        assert!(prompt.contains("Execute each phase in order"));
        assert!(prompt.contains("dependencies"));
    }

    #[test]
    fn build_codex_team_prompt_handles_empty_graph() {
        let plan = TaskPlan {
            complexity: TaskComplexity::Solo,
            agent_count: 1,
            roles: vec![RoleDef {
                name: "Worker".to_string(),
                focus: "Do the work".to_string(),
                runtime: "codex".to_string(),
            }],
            task_graph: vec![],
            runtime_recommendation: "codex".to_string(),
            estimated_duration: "~1 minute".to_string(),
        };
        let prompt = build_codex_team_prompt("Simple task", &plan);
        assert!(prompt.contains("Simple task"));
        assert!(prompt.contains("Phase 1 — Worker"));
        assert!(!prompt.contains("Execution Order"));
    }

    // --- Round-trip serialization ---

    #[test]
    fn codex_event_round_trips_through_json() {
        let event = CodexEvent {
            event_type: "patch".to_string(),
            payload: serde_json::json!({"file": "src/main.rs", "diff": "+hello"}),
            timestamp: 1700000000,
        };
        let json = serde_json::to_string(&event).expect("Should serialize");
        let deserialized: CodexEvent = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.event_type, "patch");
        assert_eq!(deserialized.payload["file"], "src/main.rs");
        assert_eq!(deserialized.timestamp, 1700000000);
    }

    #[test]
    fn normalized_event_round_trips_through_json() {
        let event = NormalizedEvent {
            event_type: "file_change".to_string(),
            payload: serde_json::json!({"path": "/src/lib.rs"}),
            timestamp: 1700000000,
            runtime: "codex".to_string(),
        };
        let json = serde_json::to_string(&event).expect("Should serialize");
        let deserialized: NormalizedEvent = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.event_type, "file_change");
        assert_eq!(deserialized.runtime, "codex");
    }
}
