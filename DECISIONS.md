# DECISIONS.md — ELVES Architectural Decision Log

## 2026-02-26 — Project Scaffolding Choices
**Context:** Initializing the ELVES desktop app from scratch
**Options:** create-tauri-app v2, manual setup, Tauri v1
**Decision:** Used create-tauri-app v2 with React+TypeScript template, then customized
**Rationale:** Tauri v2 gives us the latest IPC model, multi-window support, and mobile targets (future). The React+TS template provides a working Vite build pipeline out of the box. We customized the scaffold to rename from the template to "elves", add all required deps, and apply strict TypeScript config.

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

## 2026-02-26 — Claude Code CLI Invocation via --print Flag
**Context:** How to spawn and communicate with Claude Code from the Rust backend
**Options:** Claude Code Agent SDK (TypeScript), Claude Code CLI with --print flag, HTTP API
**Decision:** Spawn `claude --print --output-format json` as a child process
**Rationale:** The --print flag runs Claude Code in non-interactive mode with output to stdout. Combined with --output-format json, we get structured JSON output we can parse. This avoids needing a Node.js bridge process or the full Agent SDK for Phase 2. The Rust process manager spawns, tracks, and kills child processes. Future phases can upgrade to the SDK for streaming events.

## 2026-02-26 — Process Manager with HashMap<String, Child>
**Context:** How to track and manage active agent processes
**Options:** ProcessManager struct, OS-level process groups, tokio task handles
**Decision:** ProcessManager with Mutex<HashMap<String, Child>> keyed by session ID
**Rationale:** Simple ownership model — one process per session. The Mutex ensures thread-safe access from Tauri command handlers. kill() reaps zombies with wait(). kill_all() is called on shutdown. If we need multiple processes per session (multi-agent), we extend to HashMap<String, Vec<Child>>.

## 2026-02-26 — Frontend Personality Assignment (not Backend)
**Context:** Where to assign elf names, avatars, and personality quirks
**Options:** Backend generates personality in Rust, frontend generates via TypeScript
**Decision:** Frontend generates personality via generateElf() and sends to store; backend stores a placeholder
**Rationale:** The personality engine uses randomization and session-scoped deduplication that's simpler to manage in the reactive frontend layer. The backend creates an elf DB row with placeholder name/avatar, and the frontend overrides with the personality-enriched version. This keeps the Rust backend focused on data persistence and process management.

## 2026-02-26 — Rebrand from MINIONS to ELVES
**Context:** "Minions" poses a potential copyright issue (Illumination/Universal). Need a full rebrand.
**Options:** Elves, Sprites, Gnomes, Imps, Pixies
**Decision:** Rebrand to ELVES — all code, types, UI strings, database tables, file names, logos, docs
**Rationale:** "Elves" fits the same playful personality archetype while being generic enough to avoid trademark issues. The workshop/crafting metaphor (elves making things) maps perfectly to AI agents building code. Key mappings: minion→elf, MinionEvent→ElfEvent, banana→cookie, deploy→summon, ~/.minions/→~/.elves/, minion-yellow→elf-gold. Complete rename across ~693 occurrences in 48 files.

---

## Phase 3: Multi-Elf Teams — Decisions

## 2026-02-26 — Shared Types First, Then Parallel Work
**Context:** Phase 3 requires both Rust backend (task analyzer, team deployment) and React frontend (plan preview, task graph, thinking panel) work
**Options:** Sequential (all backend then frontend), parallel with shared types first, fully parallel with type stubs
**Decision:** Lead builds shared types (TaskPlan, RoleDef, TaskNode in both Rust and TS) first, then Forge (backend) and Pixel (frontend) work in parallel
**Rationale:** The type boundary between Rust and TypeScript is the critical contract. By establishing it first, both engineers work against the same interface. This prevents serialization mismatches — the Rust serde(rename_all = "camelCase") output must match TypeScript interfaces exactly.

## 2026-02-26 — Heuristic Task Analyzer (not LLM-based yet)
**Context:** Task analyzer needs to classify complexity as solo/team and propose agent roles
**Options:** Claude Haiku API call (as spec suggests), local heuristic, hybrid
**Decision:** Start with a local heuristic (keyword matching, sentence count) with a clear interface for swapping in an LLM call later
**Rationale:** An API call introduces latency (~1-3s), API key management, and a hard dependency on network connectivity. The heuristic gives instant results and handles 80% of cases. The TaskPlan interface is the same regardless of implementation, so swapping in Claude Haiku later is a one-function change. Ship fast, upgrade later.

## 2026-02-26 — Custom SVG Task Graph (not React Flow/D3)
**Context:** Task graph visualization for 3-6 nodes
**Options:** React Flow, D3.js, vis.js, custom SVG
**Decision:** Custom SVG/div renderer with simple topological sort layout
**Rationale:** React Flow and D3 are heavy dependencies (100KB+ gzipped) for rendering 3-6 nodes. A custom SVG renderer with hardcoded layout rules (left-to-right, stack parallel nodes vertically) is ~100 lines of code, zero dependencies, and perfectly adequate for our max 6-node graphs. If we need more complex graphs later, we can swap in React Flow.

## 2026-02-26 — ProcessManager Extended to Vec<Child> for Teams
**Context:** Phase 2 ProcessManager maps session_id → single Child. Phase 3 needs multiple processes per session.
**Options:** Change HashMap<String, Child> to HashMap<String, Vec<Child>>, create TeamProcessManager, keep separate maps
**Decision:** Extend existing ProcessManager with `HashMap<String, Vec<Child>>` and add `register_team()`, `kill_team()` methods alongside existing single-process methods
**Rationale:** Single responsibility — one struct manages all processes. The Vec<Child> is backward compatible: solo sessions just have a Vec with one entry. No need for a separate manager struct.

## 2026-02-26 — TaskBar Uses useTeamSession Instead of useSession
**Context:** TaskBar needs to go through analyze → plan preview → deploy flow instead of direct deploy
**Options:** Modify existing useSession hook, create new useTeamSession hook, inline logic in TaskBar
**Decision:** Created useTeamSession hook that replaces useSession for task submission. The old useSession hook is preserved for backward compatibility.
**Rationale:** useTeamSession encapsulates the full Phase 3 lifecycle (analyze → plan preview → team deploy OR solo deploy). Keeping useSession allows any legacy code paths to still work. TaskBar now calls `analyzeAndDeploy()` which routes through the analyzer before deciding solo vs team.

## 2026-02-26 — Shell.tsx as Orchestration Hub for Phase 3 UI
**Context:** PlanPreview, TaskGraph, ThinkingPanel, and celebration banner all need to appear in the main content area
**Options:** Shell orchestrates all panels, create a SessionView wrapper component, use React context for panel visibility
**Decision:** Shell.tsx directly orchestrates all Phase 3 panels based on store state (isPlanPreview, activeSession, thinkingStream)
**Rationale:** Shell already manages the top-level layout. Adding another wrapper creates unnecessary indirection. The store state is the single source of truth for which panels to show: isPlanPreview → PlanPreview card, activeSession with team plan → TaskGraph + ThinkingPanel, session completed → celebration banner. This keeps rendering logic colocated with layout.
