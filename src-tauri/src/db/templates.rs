// Template CRUD operations — saved task plans for reuse.
//
// Templates store pre-configured TaskPlan role definitions that can be loaded
// into the plan preview editor. Built-in templates are seeded on first run and
// cannot be deleted by users.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use super::DbError;

/// A template row from the database, serialized to camelCase JSON for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateRow {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    /// JSON-serialized TaskPlan defining agent roles and task graph.
    pub plan: String,
    /// Whether this is a built-in template (cannot be deleted by users).
    pub built_in: bool,
    pub created_at: i64,
}

/// Insert a new template. Returns the created row.
pub fn insert_template(
    conn: &Connection,
    id: &str,
    name: &str,
    description: Option<&str>,
    plan: &str,
    built_in: bool,
) -> Result<TemplateRow, DbError> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO templates (id, name, description, plan, built_in, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, description, plan, built_in, now],
    )?;

    get_template(conn, id)?.ok_or_else(|| DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows))
}

/// Retrieve a single template by ID. Returns None if not found.
pub fn get_template(conn: &Connection, id: &str) -> Result<Option<TemplateRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, plan, built_in, created_at
         FROM templates WHERE id = ?1",
    )?;

    let result = stmt
        .query_row(params![id], map_template_row)
        .optional()?;

    Ok(result)
}

/// List all templates, built-in first then user-created, ordered by name within each group.
pub fn list_templates(conn: &Connection) -> Result<Vec<TemplateRow>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, plan, built_in, created_at
         FROM templates ORDER BY built_in DESC, name ASC",
    )?;

    let rows = stmt
        .query_map([], map_template_row)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

/// Delete a template by ID. Built-in templates cannot be deleted.
/// Returns true if a row was deleted.
pub fn delete_template(conn: &Connection, id: &str) -> Result<bool, DbError> {
    let rows_affected = conn.execute(
        "DELETE FROM templates WHERE id = ?1 AND built_in = 0",
        params![id],
    )?;
    Ok(rows_affected > 0)
}

/// Seed the 5 built-in templates. Skips templates that already exist (idempotent).
///
/// Built-in templates provide pre-configured TaskPlan roles for common workflows:
/// 1. Code Review — 3 agents: security reviewer, performance analyst, test checker
/// 2. Research Report — 3 agents: researcher, analyst, writer
/// 3. Bug Investigation — 3 agents: competing hypothesis investigators
/// 4. Feature Build — 3 agents: implementer, tester, reviewer
/// 5. Document Analysis — 2 agents: reader/extractor, summarizer
pub fn seed_builtin_templates(conn: &Connection) -> Result<usize, DbError> {
    let templates = builtin_template_definitions();
    let mut seeded = 0;

    for (id, name, description, plan) in &templates {
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM templates WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !exists {
            insert_template(conn, id, name, Some(description), plan, true)?;
            seeded += 1;
        }
    }

    Ok(seeded)
}

/// Returns the 5 built-in template definitions as (id, name, description, plan_json).
fn builtin_template_definitions() -> Vec<(&'static str, &'static str, &'static str, String)> {
    vec![
        (
            "builtin-code-review",
            "Code Review",
            "Three-agent code review: security, performance, and test coverage analysis",
            serde_json::json!({
                "complexity": "team",
                "agentCount": 3,
                "roles": [
                    { "name": "Security Reviewer", "focus": "Audit for vulnerabilities, injection risks, auth issues, and OWASP top 10", "runtime": "claude-code" },
                    { "name": "Performance Analyst", "focus": "Check for N+1 queries, memory leaks, unnecessary allocations, and algorithmic complexity", "runtime": "claude-code" },
                    { "name": "Test Checker", "focus": "Verify test coverage, edge cases, error paths, and missing assertions", "runtime": "claude-code" }
                ],
                "taskGraph": [
                    { "id": "task-1", "label": "Security audit", "assignee": "Security Reviewer", "dependsOn": [], "status": "pending" },
                    { "id": "task-2", "label": "Performance analysis", "assignee": "Performance Analyst", "dependsOn": [], "status": "pending" },
                    { "id": "task-3", "label": "Test coverage check", "assignee": "Test Checker", "dependsOn": [], "status": "pending" }
                ],
                "runtimeRecommendation": "claude-code",
                "estimatedDuration": "~4 minutes"
            })
            .to_string(),
        ),
        (
            "builtin-research-report",
            "Research Report",
            "Three-agent research pipeline: gather data, analyze findings, write report",
            serde_json::json!({
                "complexity": "team",
                "agentCount": 3,
                "roles": [
                    { "name": "Researcher", "focus": "Gather data, find sources, collect relevant information", "runtime": "claude-code" },
                    { "name": "Analyst", "focus": "Analyze findings, identify patterns, draw conclusions from research data", "runtime": "claude-code" },
                    { "name": "Writer", "focus": "Write a clear, structured report synthesizing the analysis", "runtime": "claude-code" }
                ],
                "taskGraph": [
                    { "id": "task-1", "label": "Research and data gathering", "assignee": "Researcher", "dependsOn": [], "status": "pending" },
                    { "id": "task-2", "label": "Analysis and pattern identification", "assignee": "Analyst", "dependsOn": ["task-1"], "status": "pending" },
                    { "id": "task-3", "label": "Report writing", "assignee": "Writer", "dependsOn": ["task-2"], "status": "pending" }
                ],
                "runtimeRecommendation": "claude-code",
                "estimatedDuration": "~6 minutes"
            })
            .to_string(),
        ),
        (
            "builtin-bug-investigation",
            "Bug Investigation",
            "Three competing investigators explore different hypotheses in parallel",
            serde_json::json!({
                "complexity": "team",
                "agentCount": 3,
                "roles": [
                    { "name": "Investigator Alpha", "focus": "Hypothesis 1: investigate the most likely root cause based on symptoms", "runtime": "claude-code" },
                    { "name": "Investigator Beta", "focus": "Hypothesis 2: investigate environmental or configuration-related causes", "runtime": "claude-code" },
                    { "name": "Investigator Gamma", "focus": "Hypothesis 3: investigate race conditions, timing, or edge case triggers", "runtime": "claude-code" }
                ],
                "taskGraph": [
                    { "id": "task-1", "label": "Primary hypothesis investigation", "assignee": "Investigator Alpha", "dependsOn": [], "status": "pending" },
                    { "id": "task-2", "label": "Environment hypothesis investigation", "assignee": "Investigator Beta", "dependsOn": [], "status": "pending" },
                    { "id": "task-3", "label": "Edge case hypothesis investigation", "assignee": "Investigator Gamma", "dependsOn": [], "status": "pending" }
                ],
                "runtimeRecommendation": "claude-code",
                "estimatedDuration": "~4 minutes"
            })
            .to_string(),
        ),
        (
            "builtin-feature-build",
            "Feature Build",
            "Three-agent feature pipeline: implement, test, and review",
            serde_json::json!({
                "complexity": "team",
                "agentCount": 3,
                "roles": [
                    { "name": "Implementer", "focus": "Build the feature with clean, well-structured code following project conventions", "runtime": "claude-code" },
                    { "name": "Tester", "focus": "Write comprehensive tests: unit, integration, and edge cases", "runtime": "claude-code" },
                    { "name": "Reviewer", "focus": "Review implementation and tests for correctness, style, and potential issues", "runtime": "claude-code" }
                ],
                "taskGraph": [
                    { "id": "task-1", "label": "Feature implementation", "assignee": "Implementer", "dependsOn": [], "status": "pending" },
                    { "id": "task-2", "label": "Test writing", "assignee": "Tester", "dependsOn": ["task-1"], "status": "pending" },
                    { "id": "task-3", "label": "Code review", "assignee": "Reviewer", "dependsOn": ["task-1", "task-2"], "status": "pending" }
                ],
                "runtimeRecommendation": "claude-code",
                "estimatedDuration": "~6 minutes"
            })
            .to_string(),
        ),
        (
            "builtin-document-analysis",
            "Document Analysis",
            "Two-agent document pipeline: extract key information and summarize",
            serde_json::json!({
                "complexity": "team",
                "agentCount": 2,
                "roles": [
                    { "name": "Extractor", "focus": "Read the document, extract key facts, data points, and structured information", "runtime": "claude-code" },
                    { "name": "Summarizer", "focus": "Synthesize extracted information into a concise, actionable summary", "runtime": "claude-code" }
                ],
                "taskGraph": [
                    { "id": "task-1", "label": "Information extraction", "assignee": "Extractor", "dependsOn": [], "status": "pending" },
                    { "id": "task-2", "label": "Summary writing", "assignee": "Summarizer", "dependsOn": ["task-1"], "status": "pending" }
                ],
                "runtimeRecommendation": "claude-code",
                "estimatedDuration": "~3 minutes"
            })
            .to_string(),
        ),
    ]
}

/// Map a rusqlite Row to a TemplateRow.
fn map_template_row(row: &rusqlite::Row<'_>) -> Result<TemplateRow, rusqlite::Error> {
    Ok(TemplateRow {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        plan: row.get(3)?,
        built_in: row.get(4)?,
        created_at: row.get(5)?,
    })
}

/// Use rusqlite's optional() extension for query_row.
trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::run_migrations(&conn).expect("Migrations should succeed");
        conn
    }

    #[test]
    fn insert_and_get_template() {
        let conn = test_conn();

        let template = insert_template(
            &conn,
            "tmpl-1",
            "My Custom Template",
            Some("A custom workflow for my project"),
            r#"{"complexity":"team","agentCount":2,"roles":[],"taskGraph":[],"runtimeRecommendation":"claude-code","estimatedDuration":"~2 minutes"}"#,
            false,
        )
        .expect("Should insert template");

        assert_eq!(template.id, "tmpl-1");
        assert_eq!(template.name, "My Custom Template");
        assert_eq!(template.description.as_deref(), Some("A custom workflow for my project"));
        assert!(template.plan.contains("agentCount"));
        assert!(!template.built_in);
        assert!(template.created_at > 0);

        let fetched = get_template(&conn, "tmpl-1")
            .expect("Should query")
            .expect("Should find template");
        assert_eq!(fetched.name, "My Custom Template");
    }

    #[test]
    fn get_nonexistent_returns_none() {
        let conn = test_conn();
        let result = get_template(&conn, "nope").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn list_templates_returns_all() {
        let conn = test_conn();

        insert_template(&conn, "t1", "Alpha", None, "{}", false).unwrap();
        insert_template(&conn, "t2", "Beta", None, "{}", false).unwrap();

        let templates = list_templates(&conn).expect("Should list");
        assert_eq!(templates.len(), 2);
    }

    #[test]
    fn list_templates_built_in_first() {
        let conn = test_conn();

        insert_template(&conn, "t1", "User Template", None, "{}", false).unwrap();
        insert_template(&conn, "t2", "Built-in Template", None, "{}", true).unwrap();

        let templates = list_templates(&conn).expect("Should list");
        assert_eq!(templates.len(), 2);
        assert!(templates[0].built_in, "Built-in should come first");
        assert!(!templates[1].built_in, "User template should come second");
    }

    #[test]
    fn list_templates_empty() {
        let conn = test_conn();
        let templates = list_templates(&conn).expect("Should list");
        assert!(templates.is_empty());
    }

    #[test]
    fn delete_user_template() {
        let conn = test_conn();
        insert_template(&conn, "t1", "Deletable", None, "{}", false).unwrap();

        let deleted = delete_template(&conn, "t1").expect("Should delete");
        assert!(deleted);

        let result = get_template(&conn, "t1").expect("Should query");
        assert!(result.is_none());
    }

    #[test]
    fn delete_builtin_template_fails() {
        let conn = test_conn();
        insert_template(&conn, "t1", "Protected", None, "{}", true).unwrap();

        let deleted = delete_template(&conn, "t1").expect("Should not error");
        assert!(!deleted, "Built-in templates should not be deletable");

        let result = get_template(&conn, "t1").expect("Should query");
        assert!(result.is_some(), "Built-in template should still exist");
    }

    #[test]
    fn delete_nonexistent_returns_false() {
        let conn = test_conn();
        let deleted = delete_template(&conn, "nope").expect("Should not error");
        assert!(!deleted);
    }

    #[test]
    fn seed_builtin_templates_creates_five() {
        let conn = test_conn();
        let seeded = seed_builtin_templates(&conn).expect("Should seed");
        assert_eq!(seeded, 5);

        let templates = list_templates(&conn).expect("Should list");
        assert_eq!(templates.len(), 5);
        assert!(templates.iter().all(|t| t.built_in));
    }

    #[test]
    fn seed_builtin_templates_is_idempotent() {
        let conn = test_conn();

        let first = seed_builtin_templates(&conn).expect("First seed");
        assert_eq!(first, 5);

        let second = seed_builtin_templates(&conn).expect("Second seed");
        assert_eq!(second, 0, "No new templates should be seeded");

        let templates = list_templates(&conn).expect("Should list");
        assert_eq!(templates.len(), 5, "Still only 5 templates");
    }

    #[test]
    fn builtin_code_review_has_correct_structure() {
        let conn = test_conn();
        seed_builtin_templates(&conn).unwrap();

        let template = get_template(&conn, "builtin-code-review").unwrap().unwrap();
        assert_eq!(template.name, "Code Review");
        assert!(template.built_in);

        let plan: serde_json::Value = serde_json::from_str(&template.plan).expect("Plan should be valid JSON");
        assert_eq!(plan["agentCount"], 3);
        assert_eq!(plan["roles"].as_array().unwrap().len(), 3);
        assert_eq!(plan["roles"][0]["name"], "Security Reviewer");
        assert_eq!(plan["roles"][1]["name"], "Performance Analyst");
        assert_eq!(plan["roles"][2]["name"], "Test Checker");
    }

    #[test]
    fn builtin_research_report_has_dependency_chain() {
        let conn = test_conn();
        seed_builtin_templates(&conn).unwrap();

        let template = get_template(&conn, "builtin-research-report").unwrap().unwrap();
        let plan: serde_json::Value = serde_json::from_str(&template.plan).unwrap();

        let graph = plan["taskGraph"].as_array().unwrap();
        assert_eq!(graph.len(), 3);
        assert!(graph[0]["dependsOn"].as_array().unwrap().is_empty());
        assert_eq!(graph[1]["dependsOn"][0], "task-1");
        assert_eq!(graph[2]["dependsOn"][0], "task-2");
    }

    #[test]
    fn builtin_bug_investigation_has_parallel_tasks() {
        let conn = test_conn();
        seed_builtin_templates(&conn).unwrap();

        let template = get_template(&conn, "builtin-bug-investigation").unwrap().unwrap();
        let plan: serde_json::Value = serde_json::from_str(&template.plan).unwrap();

        let graph = plan["taskGraph"].as_array().unwrap();
        // All three investigators run in parallel (no dependencies)
        for node in graph {
            assert!(
                node["dependsOn"].as_array().unwrap().is_empty(),
                "Bug investigation tasks should be parallel"
            );
        }
    }

    #[test]
    fn builtin_feature_build_has_correct_dependencies() {
        let conn = test_conn();
        seed_builtin_templates(&conn).unwrap();

        let template = get_template(&conn, "builtin-feature-build").unwrap().unwrap();
        let plan: serde_json::Value = serde_json::from_str(&template.plan).unwrap();

        let graph = plan["taskGraph"].as_array().unwrap();
        assert_eq!(graph[0]["assignee"], "Implementer");
        assert!(graph[0]["dependsOn"].as_array().unwrap().is_empty());
        assert_eq!(graph[1]["dependsOn"][0], "task-1"); // Tester after Implementer
        // Reviewer depends on both
        let reviewer_deps = graph[2]["dependsOn"].as_array().unwrap();
        assert_eq!(reviewer_deps.len(), 2);
    }

    #[test]
    fn builtin_document_analysis_has_two_agents() {
        let conn = test_conn();
        seed_builtin_templates(&conn).unwrap();

        let template = get_template(&conn, "builtin-document-analysis").unwrap().unwrap();
        let plan: serde_json::Value = serde_json::from_str(&template.plan).unwrap();
        assert_eq!(plan["agentCount"], 2);
        assert_eq!(plan["roles"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn serializes_to_camel_case_json() {
        let conn = test_conn();
        let template = insert_template(&conn, "t1", "Test", None, "{}", false).unwrap();
        let json = serde_json::to_string(&template).expect("Should serialize");
        assert!(json.contains("builtIn"));
        assert!(json.contains("createdAt"));
        assert!(!json.contains("built_in"));
        assert!(!json.contains("created_at"));
    }
}
