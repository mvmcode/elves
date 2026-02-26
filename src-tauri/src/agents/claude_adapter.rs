// Claude Code adapter — spawns Claude CLI as a subprocess and parses its output.

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
