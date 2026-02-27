# Changelog

All notable changes to ELVES are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.8.0] - 2026-02-27 — Phase 8: Streaming, Terminal & Discovery

### Added
- **Streaming event output** — Claude adapter switched from `--output-format json` to `--output-format stream-json` for real-time line-by-line event streaming with `--verbose` flag
- **Claude discovery** — `claude_discovery.rs` scans `~/.claude/` for agents, settings, and slash commands; surfaces agent/model/permission mode options in the UI
- **Embedded PTY terminal** — `portable-pty` crate spawns pseudo-terminals; `XTerminal` + `SessionTerminal` components render xterm.js in-app with neo-brutalist theme
- **Session resume** — `claude_session_id` captured from streaming events, stored in DB (migration v3), enables "Resume" button in session history that opens an embedded terminal
- **Native save dialog** — `save_session_replay` uses `tauri-plugin-dialog` instead of browser Blob+anchor (which silently fails in Tauri WebView)
- **Solo terminal mode** — single-elf sessions render a full-height terminal-style card with always-visible output stream instead of the team grid
- **Resizable panels** — `useResizable` hook + `ResizeHandle` component for drag-resizing sidebar and activity feed
- **Collapsible activity feed** — `Cmd+B` shortcut and toggle button to show/hide the right panel
- **TaskBar options row** — agent picker, model picker, permission mode picker, and team toggle sourced from Claude discovery
- **EventBlock component** — rich per-event renderer with type-specific styling (thinking=purple, tool_call=blue, tool_result=green, error=red)
- **TerminalOutput component** — scrollable event container with auto-scroll, resume button, and overflow truncation
- **New project dialog** — modal with native folder picker via `@tauri-apps/plugin-dialog`
- **Reusable Dialog component** — Framer Motion slide-up modal with neo-brutalist styling
- **Import skills from Claude** — scans `~/.claude/commands/` and project `.claude/commands/` for slash command files
- **Open external terminal** — TopBar button opens Terminal.app at project path, optionally resuming a Claude session
- **Session event viewer** — inline expandable event list in SessionHistory rows
- **Completion summary card** — animated card showing elapsed time with "View in History" navigation
- **Stale session cleanup** — marks orphaned "active" sessions as "failed" on app startup
- **stderr drain thread** — prevents OS pipe buffer deadlock by reading stderr in background

### Changed
- `ClaudeSpawnOptions` struct with 8 optional fields (agent, model, permission_mode, budget, system prompt, effort, resume, continue)
- `start_task` and `start_team_task` accept serialized spawn options from frontend
- `endSession` uses explicit status strings ("completed", "cancelled", "ended") instead of summary-based inference
- `SessionHistory` redesigned from card-list to compact table rows with status dots, duration, cost
- `ShareButton` uses native save dialog instead of browser download
- `ElfCard` supports `variant="terminal"` for full-height output display
- `ElfTheater` detects solo mode (1 elf) and renders terminal variant automatically
- `ActivityFeed` shows richer event descriptions (thinking text, tool paths, result previews)
- Timer freezes on session completion instead of continuing to count

### Dependencies
- **Rust:** `tauri-plugin-dialog` 2.6.0, `portable-pty` 0.8
- **npm:** `@tauri-apps/plugin-dialog` ^2.6.0, `@xterm/xterm` ^5.5.0, `@xterm/addon-fit` ^0.10.0, `@xterm/addon-web-links` ^0.11.0

### Tests
- 7 new test files: Dialog, ResizeHandle, NewProjectDialog, EventBlock, TerminalOutput, XTerminal, useResizable
- Updated tests: SessionHistory (resume button), ElfCard (terminal variant), ElfTheater (solo mode + timer freeze), session store (status semantics)
- 15 unit tests in `claude_discovery.rs` using `tempfile`
- 2 new tests in `db/sessions.rs` for `update_session_usage`

## [0.7.0] - 2026-02-26 — Phase 7: Distribution & Community

### Added
- GitHub Actions CI pipeline (ci.yml) — lint, type-check, test on every push/PR
- GitHub Actions Release pipeline (release.yml) — tauri-action builds signed DMG on version tags
- Homebrew cask formula (packaging/homebrew/elves.rb)
- Tauri auto-updater plugin configured
- Session replay HTML export command with 3 backend tests
- ShareButton component for session replay export
- Landing page at landing/index.html (neo-brutalist, self-contained)
- Community files: CONTRIBUTING.md, SECURITY.md, CHANGELOG.md
- GitHub issue templates (bug report, feature request)
- Pull request template with checklist
- Release process documentation (RELEASE.md)

## [0.6.0] - 2026-02-26 — Phase 6: Codex Full Support

### Added
- Codex CLI adapter with JSONL event parsing
- Event normalization (Codex → unified ElfEvent)
- Interop layer for per-runtime context formatting
- RuntimePicker component in TopBar
- Template library with 5 built-in templates
- Session history with event-by-event replay

## [0.5.0] - 2026-02-26 — Phase 5: Visual Editors & Polish

### Added
- Skills editor (CRUD, markdown preview)
- MCP server manager (add, toggle, health check)
- Context editor (CLAUDE.md visual editing)
- 15 inline SVG elf avatars with status animations
- Web Audio API sound effects (6 effects)
- Global keyboard shortcuts (Cmd+K, Cmd+M, Cmd+/, Escape)
- ShortcutOverlay help modal

## [0.4.0] - 2026-02-26 — Phase 4: Memory & Intelligence

### Added
- SQLite memory table with FTS5 full-text search
- Exponential relevance decay (0.995^days)
- Access boost and pinning
- Memory Explorer UI with search and timeline
- Heuristic memory extraction from sessions
- Context injection before tasks
- Memory settings (decay rate, auto-learn, limits)

## [0.3.0] - 2026-02-26 — Phase 3: Multi-Elf Teams

### Added
- Heuristic task analyzer (solo vs team classification)
- Plan preview card with editable roles
- Multi-agent team deployment
- TaskGraph SVG visualization (dependency DAG)
- ThinkingPanel for lead agent reasoning
- ProcessManager extended to Vec<Child> for teams

## [0.2.0] - 2026-02-26 — Phase 2: Single Elf Mode

### Added
- ElfCard component with avatar, status, progress
- ActivityFeed with color-coded scrolling events
- Personality engine: 15 elf names, 150+ funny status messages
- Session lifecycle (create, execute, complete)
- useSession and useTeamSession hooks

## [0.1.0] - 2026-02-26 — Phase 1: Foundation

### Added
- Tauri v2 scaffold with React 19 + TypeScript
- Rust backend: SQLite (WAL mode, FTS5), runtime detection, process manager
- Neo-brutalist design system (Tailwind v4 @theme tokens)
- Zustand stores (app, project, session, ui)
- Shell layout (Sidebar, TopBar, TaskBar)
- Claude Code adapter (--print --output-format json)
