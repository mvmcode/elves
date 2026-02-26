# DECISIONS.md — MINIONS Architectural Decision Log

## 2026-02-26 — Project Scaffolding Choices
**Context:** Initializing the MINIONS desktop app from scratch
**Options:** create-tauri-app v2, manual setup, Tauri v1
**Decision:** Used create-tauri-app v2 with React+TypeScript template, then customized
**Rationale:** Tauri v2 gives us the latest IPC model, multi-window support, and mobile targets (future). The React+TS template provides a working Vite build pipeline out of the box. We customized the scaffold to rename from "minions-scaffold" to "minions", add all required deps, and apply strict TypeScript config.

## 2026-02-26 — Tailwind CSS v4 (not v3)
**Context:** Styling framework for the frontend
**Options:** Tailwind v3 with config file, Tailwind v4 with CSS-first config, vanilla CSS, CSS modules
**Decision:** Tailwind v4 with @tailwindcss/vite plugin and @theme CSS tokens
**Rationale:** v4 is CSS-first config (no tailwind.config.js needed — tokens live in the CSS file via @theme). This is cleaner for our neo-brutalist design tokens. The Vite plugin eliminates PostCSS config. Trade-off: v4 is newer with fewer community examples, but the API is stable and we benefit from the simpler config model.

## 2026-02-26 — Vitest (not Jest)
**Context:** Frontend test runner
**Options:** Jest, Vitest, Node test runner
**Decision:** Vitest with jsdom environment and @testing-library/react
**Rationale:** Native Vite integration — same transform pipeline, no double config. Faster than Jest for Vite projects. Compatible with jest-dom matchers via @testing-library/jest-dom/vitest.

## 2026-02-26 — rusqlite v0.31 with bundled SQLite
**Context:** SQLite library for Rust backend
**Options:** rusqlite (bundled), rusqlite (system), sqlx, diesel
**Decision:** rusqlite v0.31 with `bundled` and `modern_sqlite` features
**Rationale:** Bundled means no system dependency — the app ships its own SQLite. This guarantees FTS5 and WAL support regardless of the user's macOS version. rusqlite is the most mature Rust SQLite binding. We chose v0.31 (not latest 0.38) because Tauri v2's dependency tree pins to compatible versions. Trade-off: slightly older SQLite version, but all features we need (FTS5, WAL, JSON1) are available.

## 2026-02-26 — Strict TypeScript Configuration
**Context:** TypeScript compiler strictness level
**Options:** Default strict, strict + extras, loose
**Decision:** strict: true + noImplicitReturns + noUncheckedIndexedAccess + noUnusedLocals + noUnusedParameters
**Rationale:** Per CLAUDE.md standards: no `any`, no implicit returns. noUncheckedIndexedAccess catches array/object index access bugs at compile time. This matches the "types are documentation" principle.

## 2026-02-26 — macOS Universal Binary Target
**Context:** macOS build targets
**Options:** aarch64-apple-darwin only, x86_64 only, universal binary
**Decision:** Both targets installed (aarch64-apple-darwin + x86_64-apple-darwin), minimum macOS 13.0
**Rationale:** Universal binary ensures the app works on both Apple Silicon and Intel Macs. macOS 13.0 (Ventura) minimum matches the product plan requirement.

## 2026-02-26 — Zustand Store Architecture
**Context:** Frontend state management for runtime info, projects, sessions, and UI
**Options:** Zustand with single store, Zustand with multiple sliced stores, Redux, React context
**Decision:** Zustand with separate stores per domain (app, project, ui) using `create()` for each
**Rationale:** Per product plan: "Lightweight, subscribe to slices". Separate stores prevent unnecessary re-renders — TopBar subscribes to runtimes only, Sidebar subscribes to projects only. Stores are simple enough that no middleware is needed yet.

## 2026-02-26 — Database Shared State via Mutex
**Context:** How to share the SQLite connection between Tauri commands
**Options:** Mutex<Connection>, RwLock<Connection>, connection pool, open per-request
**Decision:** Mutex<Connection> in Tauri managed state
**Rationale:** rusqlite::Connection is not Send/Sync by default, requiring a Mutex. A single connection with WAL mode and busy_timeout is sufficient for a desktop app's concurrency needs. Connection pooling adds complexity without benefit here since we have one process. If read contention becomes an issue, we can switch to a RwLock with a second read-only connection.

## 2026-02-26 — Migration System Design
**Context:** How to manage database schema evolution
**Options:** Embedded SQL in code, migration files on disk, ORM migration, diesel migrations
**Decision:** schema_version table with versioned Rust functions (migrate_v1, migrate_v2, etc.)
**Rationale:** Simple, no external files to manage, fully testable in-memory. Each migration is a Rust function that runs SQL. Version table tracks what has been applied. Idempotent — migrations check current version before applying.
