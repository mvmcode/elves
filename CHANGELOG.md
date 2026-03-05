# Changelog

All notable changes to ELVES are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.3] - 2026-03-05 — Terminal View Race Fix & Worktree Cleanup

### Fixed
- **Terminal view race condition** — workspace tab now opens immediately when a task starts. Previously, `openWorkspace(slug)` was called before the workspace existed in the store array (the background `listWorkspaces` call hadn't resolved yet), so `ProjectWorkspace` couldn't find the workspace and rendered the grid instead of the terminal. Fixed by eagerly inserting a provisional `WorkspaceInfo` into the store via new `addWorkspace` method before setting the active tab.

### Added
- **`addWorkspace` store method** — idempotent method on `useWorkspaceStore` that inserts a workspace into the array immediately if the slug doesn't already exist. Eliminates the race between `openWorkspace` and the async `listWorkspaces` refresh.
- **"Remove Workspace" button** — when a PTY session ends (exit code received), the terminal footer shows a "Remove" button next to "Ship It". Clicking it deletes the worktree from disk via `removeWorkspace(projectPath, slug, true)` and closes the tab. Prevents orphaned worktrees from accumulating on disk.

### Changed
- **Solo and team deploy paths** — both `analyzeAndDeploy` (solo) and `deployWithPlan` (team) in `useTeamSession` now call `addWorkspace` with a provisional workspace entry before `openWorkspace`, ensuring the terminal view renders on the first frame.
- **Landing page** — replaced elf theater mockup with terminal-first workspace demo. Updated hero tagline, feature cards, and "How It Works" steps to reflect the worktree-based workflow. Removed floating elf emoji decorations and personality-themed copy.
- **README** — rewrote to focus on workspace isolation and embedded terminals. Removed Personality System section, elf status message table, workshop copy examples, elf theater screenshot, and character-themed descriptions. Updated project structure to match current codebase (removed theater/, workshop/). Added backronym for the name.

### Removed
- **Elf character references in docs** — ELVES is now just the app name, not a personality system. All references to elf avatars, funny status messages, character names, workshop metaphors, and "summon the elves" copy removed from public-facing docs.

## [1.0.2] - 2026-03-03 — Worktree-First Workspace Model

### Added
- **Workspace view** — new primary view for managing git worktree-based workspaces
- **WorkspaceCard** — status card with diff summary, elf info, and action buttons (Focus, Diff, Resume, Ship It, Remove)
- **NewWorkspaceDialog** — create workspaces with slug validation, base branch picker, and runtime selector
- **ShipItDialog** — merge strategy picker (merge/rebase/squash), memory extraction toggle, step preview
- **DiffViewer** — file-level diff display with A/M/D badges and +/- line counts
- **BranchList** — branch viewer with switch, create worktree, and delete actions
- **RecentlyShipped** — completed workspace history with elf names and memory counts
- **Workspace Rust backend** — 11 new Tauri commands: `create_workspace`, `list_workspaces`, `get_workspace_diff`, `push_workspace`, `create_pr_from_workspace`, `merge_workspace`, `remove_workspace`, `complete_workspace`, `init_elves_dir`, `read_project_config`, `write_project_config`
- **Git commands** — `create_branch`, `delete_branch`, `get_branch_diff` added to git module
- **Project config** — `.elves/config.json` per-project configuration (runtime, MCP servers, memory settings)
- **Workspace store** — Zustand store for workspace state, diffs, recently shipped history
- **Workspace types** — `WorkspaceInfo`, `WorkspaceDiff`, `DiffFile`, `ProjectConfig`, `MergeStrategy`, `ShippedWorkspace`
- **13 new IPC wrappers** in `tauri.ts` for workspace and git operations

### Changed
- **Shell** routes workspace view via `AppView`
- **Sidebar** shows workspace icon as first navigation item
- **AppView** type extended with `"workspace"`

## [1.0.1] - 2026-03-02 — Stability & UX Polish

### Fixed
- **Deduplicate projects by path** — prevents duplicate project entries when opening the same directory multiple times
- **Plan approval GUI** — approve/reject buttons for agent plan mode completions
- **Detect plan mode completions** — correctly identifies when an agent is waiting for plan approval
- **Prevent agent question truncation** — agent follow-up questions are no longer silently cut off

## [1.0.0] - 2026-03-03 — Phase 5+6 Completion & Visual Overhaul

### Added
- **SkillEditor preview & export** — live markdown preview and JSON export for custom skills
- **MCP tool listing** — enumerate and display available tools from configured MCP servers
- **ContextEditor save/diff** — save CLAUDE.md edits with inline diff preview before committing
- **Enhanced avatar animations** — glow effects per-status (working=yellow, thinking=purple, done=green)
- **Dark mode themes** — neo-brutalist-dark and modern-dark theme options with full design token support
- **Codex multi-agent event attribution** — events from Codex team sessions correctly attributed to individual elves
- **Template seeding + JSON export** — built-in templates auto-seed on first launch, exportable as JSON
- **Session comparison view** — side-by-side diff of two sessions with event timeline alignment
- **Auto-interactive mode** — detect when sessions benefit from interactive terminal vs print mode
- **Project context hook** — `useProjectContext` aggregates git state, file tree, and memory for context injection
- **Event summary utility** — `event-summary.ts` generates human-readable session summaries
- **Simple diff engine** — `simple-diff.ts` for lightweight text comparison without external dependencies
- **Git state types** — `git-state.ts` typed representations of branch, status, and diff data

### Changed
- **Rich interaction flow** — SessionControlCard redesigned with inline response blocks and follow-up handling
- **File tree sidebar** — SidePanel shows project file tree with git status indicators
- **Git awareness** — BranchSwitcher and StatusBar show real-time git state
- **Comparison store** — Zustand store for managing session comparison state

### Removed
- `AgentPromptPopup` — replaced by inline interaction in SessionControlCard
- `FollowUpCard` — merged into SessionControlCard's response flow
- `InlineResponseBlock` — consolidated into SessionControlCard
- `prompt-classifier` — classification logic moved into session event handling

## [0.9.0] - 2026-03-01 — Agent Prompt Popup & PTY Elf Pairing

### Added
- **Agent Prompt Popup** — centered popup replaces embedded `FollowUpCard` when Claude asks a follow-up question; classifies questions as yes/no or free-text and renders the appropriate UI
- **Prompt classifier** — pure `classifyPromptType()` function detects yes/no patterns ("shall I", "should I", "proceed?") vs open-ended questions ("what", "which", "how")
- **Quirky yes/no button pairs** — randomized labels like "Ship it! / Skip it!", "Make it so! / Hard pass!", "Let's gooo! / Not today!"
- **"Go Super Mode" link** — opens the PTY terminal panel directly from the prompt popup
- **PTY agent detector** — `PtyAgentDetector` class scans raw terminal output for Claude Code Agent tool invocations, strips ANSI escape codes, buffers across chunks
- **Elf-agent pairing in interactive mode** — agents spawned in PTY/interactive terminal mode now create corresponding elves with personality, avatar, and spawn animation
- **Elf-agent pairing in print mode** — `useSessionEvents` detects `Agent` tool calls in `--print` stream-json events and spawns elves for each sub-agent
- **Elf leadership model** — first elf (elves[0]) is always the leader; spawned sub-agents set `parentElfId` pointing to the leader

### Changed
- `FollowUpCard` removed from `SessionControlCard` — follow-up prompts now handled by the global `AgentPromptPopup` mounted in `Shell`
- `SessionTerminal` accepts `onAgentDetected` callback for PTY-based agent detection
- `BottomTerminalPanel` creates elves via `handleAgentDetected` when agents are detected in PTY output

### Tests
- 17 unit tests for `prompt-classifier` (both types, multi-question, empty string, edge cases)
- 19 component tests for `AgentPromptPopup` (both modes, submit/dismiss, elf display, keyboard shortcuts)
- 28 unit tests for `pty-agent-detector` (ANSI stripping, all spawn patterns, cross-chunk buffering, role extraction, false positive avoidance)
- Updated `SessionControlCard` tests to remove stale FollowUpCard assertions

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
