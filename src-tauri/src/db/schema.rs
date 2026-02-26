// Database schema and migrations — creates all tables from the ELVES product plan Section 6.2.

use rusqlite::Connection;

use super::DbError;

/// Current schema version. Increment this when adding new migrations.
const CURRENT_VERSION: i32 = 1;

/// Run all pending migrations up to CURRENT_VERSION.
/// Uses a schema_version table to track which migrations have been applied.
pub fn run_migrations(conn: &Connection) -> Result<(), DbError> {
    // Create the version tracking table if it doesn't exist
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );",
    )?;

    let current: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current < 1 {
        migrate_v1(conn)?;
    }

    Ok(())
}

/// Migration v1: Create all core tables from the product plan schema.
fn migrate_v1(conn: &Connection) -> Result<(), DbError> {
    conn.execute_batch(
        "
        -- Projects: top-level workspace containers
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            default_runtime TEXT NOT NULL DEFAULT 'claude-code',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            settings TEXT NOT NULL DEFAULT '{}'
        );

        -- Sessions: individual task executions within a project
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id),
            task TEXT NOT NULL,
            runtime TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            plan TEXT,
            agent_count INTEGER NOT NULL DEFAULT 1,
            started_at INTEGER NOT NULL,
            ended_at INTEGER,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            cost_estimate REAL NOT NULL DEFAULT 0.0,
            summary TEXT
        );

        -- Elves: individual agent instances within a session
        CREATE TABLE IF NOT EXISTS elves (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            name TEXT NOT NULL,
            role TEXT,
            avatar TEXT NOT NULL,
            color TEXT NOT NULL,
            quirk TEXT,
            runtime TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'spawning',
            spawned_at INTEGER NOT NULL,
            finished_at INTEGER,
            parent_elf_id TEXT REFERENCES elves(id),
            tools_used TEXT NOT NULL DEFAULT '[]'
        );

        -- Memory: persistent cross-session context entries
        CREATE TABLE IF NOT EXISTS memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT REFERENCES projects(id),
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            source TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            accessed_at INTEGER NOT NULL,
            relevance_score REAL NOT NULL DEFAULT 1.0
        );

        -- Skills: reusable prompt templates
        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            project_id TEXT REFERENCES projects(id),
            name TEXT NOT NULL,
            description TEXT,
            content TEXT NOT NULL,
            trigger_pattern TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- MCP servers: configured Model Context Protocol servers
        CREATE TABLE IF NOT EXISTS mcp_servers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            args TEXT NOT NULL DEFAULT '[]',
            env TEXT NOT NULL DEFAULT '{}',
            scope TEXT NOT NULL DEFAULT 'global',
            enabled INTEGER NOT NULL DEFAULT 1,
            last_health_check INTEGER
        );

        -- Events: full event log for session replay
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            elf_id TEXT,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            funny_status TEXT,
            timestamp INTEGER NOT NULL
        );

        -- Full-text search index for memory content
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
            content,
            category,
            tags,
            content='memory',
            content_rowid='id'
        );

        -- Triggers to keep FTS index in sync with memory table
        CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory BEGIN
            INSERT INTO memory_fts(rowid, content, category, tags)
            VALUES (new.id, new.content, new.category, new.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory BEGIN
            INSERT INTO memory_fts(memory_fts, rowid, content, category, tags)
            VALUES ('delete', old.id, old.content, old.category, old.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory BEGIN
            INSERT INTO memory_fts(memory_fts, rowid, content, category, tags)
            VALUES ('delete', old.id, old.content, old.category, old.tags);
            INSERT INTO memory_fts(rowid, content, category, tags)
            VALUES (new.id, new.content, new.category, new.tags);
        END;

        -- Indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
        CREATE INDEX IF NOT EXISTS idx_elves_session ON elves(session_id);
        CREATE INDEX IF NOT EXISTS idx_memory_project ON memory(project_id);
        CREATE INDEX IF NOT EXISTS idx_memory_category ON memory(category);
        CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
        CREATE INDEX IF NOT EXISTS idx_events_elf ON events(elf_id);

        -- Record this migration
        INSERT INTO schema_version (version) VALUES (1);
        ",
    )
    .map_err(|e| DbError::Migration {
        version: CURRENT_VERSION,
        message: e.to_string(),
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        conn
    }

    #[test]
    fn migrations_run_successfully() {
        let conn = test_conn();
        run_migrations(&conn).expect("Migrations should succeed");

        // Verify version was recorded
        let version: i32 = conn
            .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
                row.get(0)
            })
            .expect("Should query version");
        assert_eq!(version, 1);
    }

    #[test]
    fn migrations_are_idempotent() {
        let conn = test_conn();
        run_migrations(&conn).expect("First migration run should succeed");
        run_migrations(&conn).expect("Second migration run should succeed");
    }

    #[test]
    fn all_tables_created() {
        let conn = test_conn();
        run_migrations(&conn).expect("Migrations should succeed");

        let expected_tables = [
            "projects",
            "sessions",
            "elves",
            "memory",
            "skills",
            "mcp_servers",
            "events",
            "schema_version",
        ];

        for table_name in expected_tables {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?1",
                    [table_name],
                    |row| row.get(0),
                )
                .unwrap_or(false);
            assert!(exists, "Table '{table_name}' should exist");
        }
    }

    #[test]
    fn fts_virtual_table_created() {
        let conn = test_conn();
        run_migrations(&conn).expect("Migrations should succeed");

        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='memory_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);
        assert!(exists, "FTS virtual table 'memory_fts' should exist");
    }
}
