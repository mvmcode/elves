// Runtime interoperability — prepares project context for injection into any runtime.
//
// Both Claude Code and Codex use the same memory source (ELVES' SQLite database).
// This module formats memory into each runtime's native context mechanism:
// - Claude Code: CLAUDE.md section format
// - Codex: workspace instructions format

use rusqlite::Connection;

use crate::agents::context_builder;
use crate::db::DbError;

/// Supported runtime identifiers for context formatting.
const RUNTIME_CLAUDE_CODE: &str = "claude-code";
const RUNTIME_CODEX: &str = "codex";

/// Prepare project memory context formatted for a specific runtime.
///
/// Queries project memories via the shared context_builder and wraps the result
/// in the runtime's native context format:
/// - `claude-code`: wraps in a CLAUDE.md `# ELVES Project Memory` section
/// - `codex`: wraps as workspace instructions with a `[ELVES Memory]` header
///
/// Both runtimes receive the same underlying memory content — no runtime-specific
/// storage. Switching runtimes requires zero migration.
///
/// Returns an empty string if no memories exist for the project.
pub fn prepare_context_for_runtime(
    conn: &Connection,
    project_id: &str,
    runtime: &str,
) -> Result<String, DbError> {
    let memory_context = context_builder::build_context(conn, project_id)?;

    if memory_context.is_empty() {
        return Ok(String::new());
    }

    match runtime {
        RUNTIME_CLAUDE_CODE => Ok(format_for_claude_code(&memory_context)),
        RUNTIME_CODEX => Ok(format_for_codex(&memory_context)),
        _ => {
            // Unknown runtime — return raw memory context as a safe fallback
            Ok(memory_context)
        }
    }
}

/// Format memory context as a CLAUDE.md section.
///
/// Claude Code reads CLAUDE.md files and injects their contents into the system prompt.
/// We wrap the memory block in a clearly labeled section so it integrates naturally.
fn format_for_claude_code(memory_context: &str) -> String {
    let mut output = String::with_capacity(memory_context.len() + 128);
    output.push_str("# ELVES Project Memory\n\n");
    output.push_str("> Automatically injected by ELVES from persistent project memory.\n");
    output.push_str("> Do not edit this section manually — it is regenerated on each session.\n\n");
    output.push_str(memory_context);
    output.push('\n');
    output
}

/// Format memory context as Codex workspace instructions.
///
/// Codex reads workspace configuration for project-specific instructions.
/// We wrap the memory block in a bracket-labeled section for clear boundaries.
fn format_for_codex(memory_context: &str) -> String {
    let mut output = String::with_capacity(memory_context.len() + 128);
    output.push_str("[ELVES Memory — auto-injected project context]\n\n");
    output.push_str(memory_context);
    output.push_str("\n\n[End ELVES Memory]\n");
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{memory, schema};
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::run_migrations(&conn).expect("Migrations should succeed");
        conn
    }

    fn seed_project(conn: &Connection, id: &str) {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT OR IGNORE INTO projects (id, name, path, default_runtime, created_at, updated_at)
             VALUES (?1, 'Test Project', '/tmp/test', 'claude-code', ?2, ?3)",
            rusqlite::params![id, now, now],
        )
        .expect("Should seed project");
    }

    // --- Empty project tests ---

    #[test]
    fn empty_project_returns_empty_for_claude_code() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let context = prepare_context_for_runtime(&conn, "proj-1", "claude-code")
            .expect("Should prepare context");
        assert!(context.is_empty());
    }

    #[test]
    fn empty_project_returns_empty_for_codex() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        let context = prepare_context_for_runtime(&conn, "proj-1", "codex")
            .expect("Should prepare context");
        assert!(context.is_empty());
    }

    // --- Claude Code format tests ---

    #[test]
    fn claude_code_format_includes_header_and_memory() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "context",
            "The API uses GraphQL",
            None,
            "[]",
        )
        .unwrap();

        let context = prepare_context_for_runtime(&conn, "proj-1", "claude-code")
            .expect("Should prepare context");

        assert!(context.contains("# ELVES Project Memory"));
        assert!(context.contains("Automatically injected by ELVES"));
        assert!(context.contains("The API uses GraphQL"));
    }

    #[test]
    fn claude_code_format_includes_no_edit_warning() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(&conn, Some("proj-1"), "context", "Fact", None, "[]").unwrap();

        let context = prepare_context_for_runtime(&conn, "proj-1", "claude-code")
            .expect("Should prepare context");

        assert!(context.contains("Do not edit this section manually"));
    }

    // --- Codex format tests ---

    #[test]
    fn codex_format_includes_brackets_and_memory() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "decision",
            "We chose Rust for the backend",
            None,
            "[]",
        )
        .unwrap();

        let context = prepare_context_for_runtime(&conn, "proj-1", "codex")
            .expect("Should prepare context");

        assert!(context.contains("[ELVES Memory"));
        assert!(context.contains("We chose Rust for the backend"));
        assert!(context.contains("[End ELVES Memory]"));
    }

    // --- Same memory, both runtimes ---

    #[test]
    fn same_memory_available_in_both_runtimes() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "context",
            "Shared knowledge fact",
            None,
            "[]",
        )
        .unwrap();

        let claude_context = prepare_context_for_runtime(&conn, "proj-1", "claude-code")
            .expect("Should prepare for claude-code");
        let codex_context = prepare_context_for_runtime(&conn, "proj-1", "codex")
            .expect("Should prepare for codex");

        // Both contain the same underlying memory content
        assert!(claude_context.contains("Shared knowledge fact"));
        assert!(codex_context.contains("Shared knowledge fact"));

        // But with different formatting
        assert!(claude_context.contains("# ELVES Project Memory"));
        assert!(!claude_context.contains("[ELVES Memory"));
        assert!(codex_context.contains("[ELVES Memory"));
        assert!(!codex_context.contains("# ELVES Project Memory"));
    }

    #[test]
    fn both_runtimes_include_all_memory_categories() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(&conn, Some("proj-1"), "context", "API fact", None, "[]").unwrap();
        memory::insert_memory(&conn, Some("proj-1"), "decision", "Chose React", None, "[]")
            .unwrap();
        memory::insert_memory(&conn, Some("proj-1"), "learning", "Cache helps", None, "[]")
            .unwrap();
        memory::insert_memory(&conn, Some("proj-1"), "preference", "Dark mode", None, "[]")
            .unwrap();

        let claude_context = prepare_context_for_runtime(&conn, "proj-1", "claude-code")
            .expect("Should prepare");
        let codex_context =
            prepare_context_for_runtime(&conn, "proj-1", "codex").expect("Should prepare");

        for content in &["API fact", "Chose React", "Cache helps", "Dark mode"] {
            assert!(
                claude_context.contains(content),
                "Claude context missing: {content}"
            );
            assert!(
                codex_context.contains(content),
                "Codex context missing: {content}"
            );
        }
    }

    // --- Unknown runtime fallback ---

    #[test]
    fn unknown_runtime_returns_raw_memory() {
        let conn = test_conn();
        seed_project(&conn, "proj-1");

        memory::insert_memory(
            &conn,
            Some("proj-1"),
            "context",
            "Raw content test",
            None,
            "[]",
        )
        .unwrap();

        let context = prepare_context_for_runtime(&conn, "proj-1", "unknown-runtime")
            .expect("Should prepare context");

        assert!(context.contains("Raw content test"));
        // No runtime-specific wrapping
        assert!(!context.contains("# ELVES Project Memory"));
        assert!(!context.contains("[ELVES Memory"));
    }

    // --- Format function unit tests ---

    #[test]
    fn format_for_claude_code_structure() {
        let output = format_for_claude_code("# Project Memory\n- fact one\n- fact two");
        assert!(output.starts_with("# ELVES Project Memory\n"));
        assert!(output.contains("fact one"));
        assert!(output.contains("fact two"));
    }

    #[test]
    fn format_for_codex_structure() {
        let output = format_for_codex("# Project Memory\n- fact one");
        assert!(output.starts_with("[ELVES Memory"));
        assert!(output.ends_with("[End ELVES Memory]\n"));
        assert!(output.contains("fact one"));
    }
}
