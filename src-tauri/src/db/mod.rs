// Database subsystem — SQLite storage with WAL mode, FTS5, and migration management.

pub mod schema;
pub mod projects;
pub mod sessions;
pub mod events;
pub mod elves;

use rusqlite::Connection;
use std::path::Path;
use thiserror::Error;

/// Database errors with context-rich messages for debugging.
#[derive(Debug, Error)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Failed to create database directory at {path}: {source}")]
    CreateDir {
        path: String,
        source: std::io::Error,
    },

    #[error("Migration failed at version {version}: {message}")]
    Migration { version: i32, message: String },
}

/// Open (or create) the ELVES SQLite database at the given path.
/// Enables WAL mode for concurrent reads, sets busy timeout, and runs migrations.
pub fn open_database(db_path: &Path) -> Result<Connection, DbError> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| DbError::CreateDir {
            path: parent.to_string_lossy().to_string(),
            source: e,
        })?;
    }

    let conn = Connection::open(db_path)?;

    // Enable WAL mode for concurrent reads during agent execution
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    // 5 second busy timeout — prevents "database is locked" during concurrent access
    conn.execute_batch("PRAGMA busy_timeout=5000;")?;
    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    // Run migrations
    schema::run_migrations(&conn)?;

    Ok(conn)
}

/// Get the default database path: ~/.elves/elves.db
pub fn default_db_path() -> std::path::PathBuf {
    let home = dirs::home_dir().expect("Could not determine home directory");
    home.join(".elves").join("elves.db")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn test_db() -> (Connection, PathBuf) {
        let dir = tempdir().expect("Failed to create temp dir");
        let db_path = dir.path().join("test.db");
        let conn = open_database(&db_path).expect("Failed to open test database");
        // Keep the temp dir alive by preventing cleanup (test dirs are ephemeral)
        #[allow(deprecated)]
        let path = dir.into_path();
        (conn, path)
    }

    #[test]
    fn opens_database_and_creates_tables() {
        let (conn, _dir) = test_db();

        // Verify WAL mode is enabled
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("Failed to query journal_mode");
        assert_eq!(journal_mode, "wal");

        // Verify tables exist by querying sqlite_master
        let table_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                [],
                |row| row.get(0),
            )
            .expect("Failed to count tables");

        // We expect at least 7 tables: projects, sessions, elves, memory, skills, mcp_servers, events
        // Plus the schema_version table and the FTS virtual table
        assert!(
            table_count >= 7,
            "Expected at least 7 tables, found {table_count}"
        );
    }

    #[test]
    fn opens_database_idempotently() {
        let dir = tempdir().expect("Failed to create temp dir");
        let db_path = dir.path().join("test.db");

        // Open twice — migrations should be idempotent
        let _conn1 = open_database(&db_path).expect("First open failed");
        drop(_conn1);
        let _conn2 = open_database(&db_path).expect("Second open failed");
    }
}
