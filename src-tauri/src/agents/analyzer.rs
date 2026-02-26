// Task analyzer — classifies task complexity and generates deployment plans.

use serde::{Deserialize, Serialize};

/// Task complexity classification: solo agent or team of agents.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskComplexity {
    Solo,
    Team,
}

/// A recommended role for an agent in a team deployment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleDef {
    /// Human-readable role name (e.g., "Researcher", "Implementer").
    pub name: String,
    /// What this agent should focus on within the task.
    pub focus: String,
    /// Which runtime to use for this agent.
    pub runtime: String,
}

/// A node in the task dependency graph.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskNode {
    /// Unique identifier for this task node.
    pub id: String,
    /// Short label describing the task.
    pub label: String,
    /// Role name of the agent assigned to this task.
    pub assignee: String,
    /// IDs of tasks that must complete before this one can start.
    pub depends_on: Vec<String>,
    /// Current status of this task node.
    pub status: TaskNodeStatus,
}

/// Status of a single task node in the dependency graph.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskNodeStatus {
    Pending,
    Active,
    Done,
    Error,
}

/// Output of the task analyzer: a full deployment plan.
///
/// Contains complexity classification, recommended agent count and roles,
/// a task dependency graph, runtime recommendation, and time estimate.
/// The frontend uses this to render the Plan Preview card.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlan {
    /// Whether this task needs one agent or a team.
    pub complexity: TaskComplexity,
    /// Recommended number of agents (1-6).
    pub agent_count: u8,
    /// Role definitions for each agent.
    pub roles: Vec<RoleDef>,
    /// Dependency graph of sub-tasks.
    pub task_graph: Vec<TaskNode>,
    /// Suggested runtime (e.g., "claude-code" or "codex").
    pub runtime_recommendation: String,
    /// Human-readable time estimate (e.g., "~3 minutes").
    pub estimated_duration: String,
}

/// Error returned when task analysis fails.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzerError {
    pub message: String,
}

impl std::fmt::Display for AnalyzerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "AnalyzerError: {}", self.message)
    }
}

impl std::error::Error for AnalyzerError {}

/// Heuristic keywords that suggest a task needs multiple agents.
///
/// Each entry is a pair of (pattern, weight). Higher weight means stronger
/// signal for team decomposition. A task crosses the team threshold when the
/// sum of matched weights reaches TEAM_THRESHOLD or when sentence count >= 3.
const TEAM_SIGNALS: &[(&str, u8)] = &[
    // Conjunctions that imply multi-step work
    (" and ", 2),
    (" then ", 3),
    (" also ", 2),
    (" plus ", 2),
    // Explicit parallel/team language
    ("parallel", 4),
    ("team", 4),
    ("concurrent", 4),
    ("simultaneously", 4),
    // Multi-phase indicators
    ("research", 2),
    ("analyze", 2),
    ("compare", 2),
    ("investigate", 2),
    // Deliverable multipliers
    ("report", 2),
    ("document", 1),
    ("write tests", 2),
    ("refactor", 1),
    // Quantity indicators
    ("multiple", 3),
    ("several", 3),
    ("each", 2),
    ("all of", 2),
];

/// Score threshold above which a task is classified as needing a team.
const TEAM_THRESHOLD: u8 = 5;

/// Maximum number of agents in an auto-generated team plan.
const MAX_TEAM_AGENTS: u8 = 6;

/// Analyze a task description and produce a deployment plan.
///
/// Uses heuristics (keyword matching and sentence counting) to classify task
/// complexity. Simple tasks get a solo plan; complex tasks get a team plan
/// with roles derived from the task text. The `project_context` parameter is
/// reserved for future use (project memory injection) and currently unused.
///
/// # Errors
///
/// Returns `AnalyzerError` if the task is empty.
pub fn analyze_task(task: &str, project_context: &str) -> Result<TaskPlan, AnalyzerError> {
    let trimmed = task.trim();
    if trimmed.is_empty() {
        return Err(AnalyzerError {
            message: "Task description cannot be empty".to_string(),
        });
    }

    let runtime = detect_runtime_from_context(project_context);
    let complexity_score = score_task_complexity(trimmed);

    if complexity_score >= TEAM_THRESHOLD {
        Ok(build_team_plan(trimmed, &runtime))
    } else {
        Ok(build_solo_plan(trimmed, &runtime))
    }
}

/// Score a task description for complexity using keyword matching and structure analysis.
///
/// Returns a u8 score. Values >= TEAM_THRESHOLD indicate team-level complexity.
fn score_task_complexity(task: &str) -> u8 {
    let lower = task.to_lowercase();
    let mut score: u8 = 0;

    // Keyword signal accumulation
    for &(pattern, weight) in TEAM_SIGNALS {
        if lower.contains(pattern) {
            score = score.saturating_add(weight);
        }
    }

    // Sentence count heuristic: 3+ sentences suggest multi-step work
    let sentence_count = task
        .split(|c: char| c == '.' || c == '!' || c == '?' || c == ';')
        .filter(|s| s.trim().len() > 3)
        .count();
    if sentence_count >= 3 {
        score = score.saturating_add(3);
    } else if sentence_count >= 2 {
        score = score.saturating_add(1);
    }

    // Numbered list detection (e.g., "1. do X 2. do Y")
    let has_numbered_list = lower.contains("1.") && lower.contains("2.");
    if has_numbered_list {
        score = score.saturating_add(3);
    }

    score
}

/// Extract runtime preference from project context string.
///
/// Looks for "codex" in the context to choose codex runtime; defaults to "claude-code".
fn detect_runtime_from_context(context: &str) -> String {
    let lower = context.to_lowercase();
    if lower.contains("codex") {
        "codex".to_string()
    } else {
        "claude-code".to_string()
    }
}

/// Build a team plan by decomposing the task into roles.
///
/// Analyzes the task text to identify relevant role types (researcher, implementer,
/// tester, writer) and creates a dependency graph between them.
fn build_team_plan(task: &str, runtime: &str) -> TaskPlan {
    let lower = task.to_lowercase();
    let mut roles: Vec<RoleDef> = Vec::new();
    let mut nodes: Vec<TaskNode> = Vec::new();
    let mut node_id: u32 = 1;

    // Detect roles from task keywords
    let needs_research = lower.contains("research")
        || lower.contains("investigate")
        || lower.contains("analyze")
        || lower.contains("compare")
        || lower.contains("find");

    let needs_implementation = lower.contains("implement")
        || lower.contains("build")
        || lower.contains("create")
        || lower.contains("fix")
        || lower.contains("add")
        || lower.contains("write code")
        || lower.contains("develop");

    let needs_testing = lower.contains("test")
        || lower.contains("verify")
        || lower.contains("validate")
        || lower.contains("check");

    let needs_writing = lower.contains("write")
        || lower.contains("document")
        || lower.contains("report")
        || lower.contains("summarize");

    // Always need at least a lead
    let mut dependency_chain: Vec<String> = Vec::new();

    if needs_research {
        let task_id = format!("task-{node_id}");
        roles.push(RoleDef {
            name: "Researcher".to_string(),
            focus: extract_focus_for_role(&lower, "research"),
            runtime: runtime.to_string(),
        });
        nodes.push(TaskNode {
            id: task_id.clone(),
            label: "Research and gather information".to_string(),
            assignee: "Researcher".to_string(),
            depends_on: vec![],
            status: TaskNodeStatus::Pending,
        });
        dependency_chain.push(task_id);
        node_id += 1;
    }

    if needs_implementation {
        let task_id = format!("task-{node_id}");
        roles.push(RoleDef {
            name: "Implementer".to_string(),
            focus: extract_focus_for_role(&lower, "implement"),
            runtime: runtime.to_string(),
        });
        nodes.push(TaskNode {
            id: task_id.clone(),
            label: "Implement the solution".to_string(),
            assignee: "Implementer".to_string(),
            depends_on: dependency_chain.last().cloned().into_iter().collect(),
            status: TaskNodeStatus::Pending,
        });
        dependency_chain.push(task_id);
        node_id += 1;
    }

    if needs_testing {
        let task_id = format!("task-{node_id}");
        roles.push(RoleDef {
            name: "Tester".to_string(),
            focus: "Verify correctness and write tests".to_string(),
            runtime: runtime.to_string(),
        });
        nodes.push(TaskNode {
            id: task_id.clone(),
            label: "Test and verify results".to_string(),
            assignee: "Tester".to_string(),
            depends_on: dependency_chain.last().cloned().into_iter().collect(),
            status: TaskNodeStatus::Pending,
        });
        dependency_chain.push(task_id);
        node_id += 1;
    }

    if needs_writing {
        let task_id = format!("task-{node_id}");
        roles.push(RoleDef {
            name: "Writer".to_string(),
            focus: extract_focus_for_role(&lower, "write"),
            runtime: runtime.to_string(),
        });
        nodes.push(TaskNode {
            id: task_id.clone(),
            label: "Write documentation or report".to_string(),
            assignee: "Writer".to_string(),
            depends_on: dependency_chain.last().cloned().into_iter().collect(),
            status: TaskNodeStatus::Pending,
        });
        dependency_chain.push(task_id);
        node_id += 1;
    }

    // Fallback: if no specific roles detected, create a generic lead + worker split
    if roles.is_empty() {
        roles.push(RoleDef {
            name: "Lead".to_string(),
            focus: "Coordinate and plan the approach".to_string(),
            runtime: runtime.to_string(),
        });
        roles.push(RoleDef {
            name: "Worker".to_string(),
            focus: task.chars().take(80).collect(),
            runtime: runtime.to_string(),
        });
        nodes.push(TaskNode {
            id: "task-1".to_string(),
            label: "Plan the approach".to_string(),
            assignee: "Lead".to_string(),
            depends_on: vec![],
            status: TaskNodeStatus::Pending,
        });
        nodes.push(TaskNode {
            id: "task-2".to_string(),
            label: task.chars().take(80).collect(),
            assignee: "Worker".to_string(),
            depends_on: vec!["task-1".to_string()],
            status: TaskNodeStatus::Pending,
        });
        let _ = node_id; // suppress unused warning
    }

    let agent_count = (roles.len() as u8).min(MAX_TEAM_AGENTS);
    let estimated_minutes = agent_count as u32 * 2;

    TaskPlan {
        complexity: TaskComplexity::Team,
        agent_count,
        roles,
        task_graph: nodes,
        runtime_recommendation: runtime.to_string(),
        estimated_duration: format!("~{estimated_minutes} minutes"),
    }
}

/// Extract a focus description for a role from the task text.
///
/// Returns a condensed phrase relevant to the given role type.
fn extract_focus_for_role(lower_task: &str, role_type: &str) -> String {
    match role_type {
        "research" => {
            if lower_task.contains("competitor") {
                "Research and analyze competitors".to_string()
            } else if lower_task.contains("compare") {
                "Research options and gather comparison data".to_string()
            } else {
                "Gather information and analyze findings".to_string()
            }
        }
        "implement" => {
            if lower_task.contains("fix") {
                "Diagnose and implement the fix".to_string()
            } else if lower_task.contains("refactor") {
                "Refactor and restructure the code".to_string()
            } else {
                "Build and implement the solution".to_string()
            }
        }
        "write" => {
            if lower_task.contains("report") {
                "Write the final report".to_string()
            } else if lower_task.contains("document") {
                "Write documentation".to_string()
            } else {
                "Write and format the deliverable".to_string()
            }
        }
        _ => "Execute assigned work".to_string(),
    }
}

/// Build a solo plan for simple tasks that don't need team decomposition.
///
/// Returns a TaskPlan with one agent and a single task node.
pub fn build_solo_plan(task: &str, runtime: &str) -> TaskPlan {
    TaskPlan {
        complexity: TaskComplexity::Solo,
        agent_count: 1,
        roles: vec![RoleDef {
            name: "Worker".to_string(),
            focus: task.to_string(),
            runtime: runtime.to_string(),
        }],
        task_graph: vec![TaskNode {
            id: "task-1".to_string(),
            label: task.chars().take(80).collect(),
            assignee: "Worker".to_string(),
            depends_on: vec![],
            status: TaskNodeStatus::Pending,
        }],
        runtime_recommendation: runtime.to_string(),
        estimated_duration: "~1 minute".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_complexity_serializes_lowercase() {
        let solo = serde_json::to_string(&TaskComplexity::Solo).unwrap();
        assert_eq!(solo, "\"solo\"");
        let team = serde_json::to_string(&TaskComplexity::Team).unwrap();
        assert_eq!(team, "\"team\"");
    }

    #[test]
    fn task_node_status_serializes_lowercase() {
        assert_eq!(
            serde_json::to_string(&TaskNodeStatus::Pending).unwrap(),
            "\"pending\""
        );
        assert_eq!(
            serde_json::to_string(&TaskNodeStatus::Active).unwrap(),
            "\"active\""
        );
        assert_eq!(
            serde_json::to_string(&TaskNodeStatus::Done).unwrap(),
            "\"done\""
        );
        assert_eq!(
            serde_json::to_string(&TaskNodeStatus::Error).unwrap(),
            "\"error\""
        );
    }

    #[test]
    fn role_def_serializes_to_camel_case() {
        let role = RoleDef {
            name: "Researcher".to_string(),
            focus: "Find competitors".to_string(),
            runtime: "claude-code".to_string(),
        };
        let json = serde_json::to_string(&role).unwrap();
        assert!(json.contains("\"name\""));
        assert!(json.contains("\"focus\""));
        assert!(json.contains("\"runtime\""));
    }

    #[test]
    fn task_node_serializes_to_camel_case() {
        let node = TaskNode {
            id: "t1".to_string(),
            label: "Research".to_string(),
            assignee: "Researcher".to_string(),
            depends_on: vec!["t0".to_string()],
            status: TaskNodeStatus::Pending,
        };
        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("\"dependsOn\""));
        assert!(json.contains("\"assignee\""));
    }

    #[test]
    fn task_plan_serializes_to_camel_case() {
        let plan = TaskPlan {
            complexity: TaskComplexity::Team,
            agent_count: 3,
            roles: vec![],
            task_graph: vec![],
            runtime_recommendation: "claude-code".to_string(),
            estimated_duration: "~3 minutes".to_string(),
        };
        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains("\"agentCount\""));
        assert!(json.contains("\"taskGraph\""));
        assert!(json.contains("\"runtimeRecommendation\""));
        assert!(json.contains("\"estimatedDuration\""));
    }

    #[test]
    fn task_plan_round_trips_through_json() {
        let plan = TaskPlan {
            complexity: TaskComplexity::Team,
            agent_count: 2,
            roles: vec![
                RoleDef {
                    name: "Implementer".to_string(),
                    focus: "Write the code".to_string(),
                    runtime: "claude-code".to_string(),
                },
                RoleDef {
                    name: "Tester".to_string(),
                    focus: "Write tests".to_string(),
                    runtime: "claude-code".to_string(),
                },
            ],
            task_graph: vec![
                TaskNode {
                    id: "t1".to_string(),
                    label: "Implement feature".to_string(),
                    assignee: "Implementer".to_string(),
                    depends_on: vec![],
                    status: TaskNodeStatus::Active,
                },
                TaskNode {
                    id: "t2".to_string(),
                    label: "Write tests".to_string(),
                    assignee: "Tester".to_string(),
                    depends_on: vec!["t1".to_string()],
                    status: TaskNodeStatus::Pending,
                },
            ],
            runtime_recommendation: "claude-code".to_string(),
            estimated_duration: "~5 minutes".to_string(),
        };

        let json = serde_json::to_string(&plan).unwrap();
        let deserialized: TaskPlan = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.complexity, TaskComplexity::Team);
        assert_eq!(deserialized.agent_count, 2);
        assert_eq!(deserialized.roles.len(), 2);
        assert_eq!(deserialized.task_graph.len(), 2);
        assert_eq!(deserialized.task_graph[1].depends_on, vec!["t1"]);
    }

    #[test]
    fn build_solo_plan_produces_valid_plan() {
        let plan = build_solo_plan("Fix the login bug", "claude-code");

        assert_eq!(plan.complexity, TaskComplexity::Solo);
        assert_eq!(plan.agent_count, 1);
        assert_eq!(plan.roles.len(), 1);
        assert_eq!(plan.roles[0].name, "Worker");
        assert_eq!(plan.task_graph.len(), 1);
        assert!(plan.task_graph[0].depends_on.is_empty());
        assert_eq!(plan.runtime_recommendation, "claude-code");
    }

    #[test]
    fn build_solo_plan_truncates_long_task_labels() {
        let long_task = "a".repeat(200);
        let plan = build_solo_plan(&long_task, "codex");
        assert!(plan.task_graph[0].label.len() <= 80);
    }

    #[test]
    fn analyzer_error_display() {
        let err = AnalyzerError {
            message: "API call failed".to_string(),
        };
        assert_eq!(format!("{err}"), "AnalyzerError: API call failed");
    }

    // --- analyze_task tests ---

    #[test]
    fn analyze_simple_task_returns_solo() {
        let plan = analyze_task("Fix the login bug", "").expect("Should analyze");
        assert_eq!(plan.complexity, TaskComplexity::Solo);
        assert_eq!(plan.agent_count, 1);
        assert_eq!(plan.roles.len(), 1);
        assert_eq!(plan.task_graph.len(), 1);
        assert_eq!(plan.runtime_recommendation, "claude-code");
    }

    #[test]
    fn analyze_complex_task_returns_team() {
        let plan = analyze_task(
            "Research 5 competitors and write a comparison report",
            "",
        )
        .expect("Should analyze");
        assert_eq!(plan.complexity, TaskComplexity::Team);
        assert!(plan.agent_count >= 2, "Team should have at least 2 agents");
        assert!(plan.agent_count <= MAX_TEAM_AGENTS);
        assert!(!plan.roles.is_empty());
        assert!(!plan.task_graph.is_empty());
    }

    #[test]
    fn analyze_complex_task_has_researcher_and_writer() {
        let plan = analyze_task(
            "Research 5 competitors and write a comparison report",
            "",
        )
        .expect("Should analyze");
        let role_names: Vec<&str> = plan.roles.iter().map(|r| r.name.as_str()).collect();
        assert!(role_names.contains(&"Researcher"), "Should have Researcher role");
        assert!(role_names.contains(&"Writer"), "Should have Writer role");
    }

    #[test]
    fn analyze_team_task_has_dependency_chain() {
        let plan = analyze_task(
            "Research the API, implement the integration, then write tests",
            "",
        )
        .expect("Should analyze");
        assert_eq!(plan.complexity, TaskComplexity::Team);

        // Later nodes should depend on earlier ones
        for (i, node) in plan.task_graph.iter().enumerate() {
            if i == 0 {
                assert!(node.depends_on.is_empty(), "First node has no dependencies");
            } else {
                assert!(
                    !node.depends_on.is_empty(),
                    "Node {} should have dependencies",
                    node.id,
                );
            }
        }
    }

    #[test]
    fn analyze_empty_task_returns_error() {
        let result = analyze_task("", "");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.message.contains("empty"));
    }

    #[test]
    fn analyze_whitespace_only_task_returns_error() {
        let result = analyze_task("   \t\n  ", "");
        assert!(result.is_err());
    }

    #[test]
    fn analyze_with_codex_context_recommends_codex() {
        let plan = analyze_task("Fix the bug", "runtime: codex")
            .expect("Should analyze");
        assert_eq!(plan.runtime_recommendation, "codex");
    }

    #[test]
    fn analyze_numbered_list_returns_team() {
        let plan = analyze_task(
            "1. Set up the database schema. 2. Build the API endpoints. 3. Write integration tests.",
            "",
        )
        .expect("Should analyze");
        assert_eq!(plan.complexity, TaskComplexity::Team);
    }

    #[test]
    fn analyze_parallel_keyword_returns_team() {
        let plan = analyze_task("Run linting and tests in parallel", "")
            .expect("Should analyze");
        assert_eq!(plan.complexity, TaskComplexity::Team);
    }

    #[test]
    fn score_task_complexity_simple_tasks_below_threshold() {
        assert!(score_task_complexity("Fix the login bug") < TEAM_THRESHOLD);
        assert!(score_task_complexity("Update the README") < TEAM_THRESHOLD);
        assert!(score_task_complexity("Rename the variable") < TEAM_THRESHOLD);
    }

    #[test]
    fn score_task_complexity_complex_tasks_at_or_above_threshold() {
        assert!(score_task_complexity("Research competitors and write a report") >= TEAM_THRESHOLD);
        assert!(score_task_complexity("Run linting and testing in parallel") >= TEAM_THRESHOLD);
        assert!(score_task_complexity("Investigate the bug. Implement a fix. Write tests. Document the change.") >= TEAM_THRESHOLD);
    }

    #[test]
    fn build_team_plan_caps_at_max_agents() {
        // Even with many role keywords, agent count should not exceed MAX_TEAM_AGENTS
        let plan = build_team_plan(
            "research and investigate and implement and build and test and verify and write and document the entire system",
            "claude-code",
        );
        assert!(plan.agent_count <= MAX_TEAM_AGENTS);
    }

    #[test]
    fn build_team_plan_fallback_when_no_roles_detected() {
        // A generic complex task with no specific role keywords
        let plan = build_team_plan("do multiple things simultaneously for the team", "claude-code");
        assert!(plan.roles.len() >= 2, "Fallback should produce at least Lead + Worker");
        assert_eq!(plan.roles[0].name, "Lead");
        assert_eq!(plan.roles[1].name, "Worker");
    }

    #[test]
    fn detect_runtime_defaults_to_claude_code() {
        assert_eq!(detect_runtime_from_context(""), "claude-code");
        assert_eq!(detect_runtime_from_context("some project context"), "claude-code");
    }

    #[test]
    fn detect_runtime_picks_codex_from_context() {
        assert_eq!(detect_runtime_from_context("preferred runtime: codex"), "codex");
        assert_eq!(detect_runtime_from_context("CODEX project"), "codex");
    }
}
