<p align="center">
  <img src="assets/logo/png/elves-wordmark-1000x280.png" alt="ELVES" width="500" />
</p>

<h3 align="center"><strong>AI agent orchestration for your codebase.</strong></h3>

<p align="center">
A desktop app for orchestrating AI agent teams with worktree-isolated workspaces.<br/>
Type a task. Get an isolated git worktree with a live embedded terminal. Ship the branch when it's done.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-FFD93D.svg" alt="License: MIT" /></a>
  <a href="https://github.com/mvmcode/elves"><img src="https://img.shields.io/badge/macOS-13%2B-000000.svg" alt="macOS" /></a>
  <a href="https://tauri.app"><img src="https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8DB.svg" alt="Built with Tauri" /></a>
  <a href="https://github.com/mvmcode/elves/actions/workflows/ci.yml"><img src="https://github.com/mvmcode/elves/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

## What is ELVES?

ELVES is a Tauri v2 desktop app (macOS) that orchestrates [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/codex/) in isolated git worktrees with embedded terminals. You type a task, ELVES creates a worktree, spawns the agent in a live PTY, and gives you a terminal view to watch it work. When it's done, you ship the branch or discard the worktree.

Not just for coding. Research, analysis, writing, planning, data processing — if Claude Code or Codex can do it, ELVES can manage it with full workspace isolation.

Everything is local. Projects, memory, sessions — all stored on your machine in SQLite. No cloud. No accounts. No telemetry.

---

## Features

### Worktree-First Workspaces
Every task becomes a git worktree — fully isolated on disk with its own branch. Work happens in an embedded terminal with a live PTY. When done, "Ship It" to push, merge (with strategy picker), extract memories, and clean up — all in one atomic flow. Or "Remove" to discard the worktree and free disk space. Parallel tasks never interfere with each other.

### Embedded Terminal
A real PTY terminal wired to Claude Code or Codex. Watch the agent work in real-time, respond to permission prompts inline, and interact directly when needed. The terminal view opens immediately when a task starts.

### Multi-Runtime Support
Works with Claude Code Agent SDK and Codex CLI. Pick your runtime per-project or per-task via `.elves/config.json`. A unified adapter layer normalizes both event streams — the frontend never knows which engine is underneath.

### Persistent Memory
SQLite-backed memory with FTS5 full-text search. After each session, ELVES extracts decisions, learnings, and context. Relevance scores decay over time and get boosted on access — frequently useful memories stay sharp while stale ones fade. Before each new task, relevant memory is automatically injected into your agent's context.

### Neo-Brutalist UI
Thick black borders. Hard drop shadows (no blur). Saturated colors. Oversized typography. Snappy 100-200ms animations. This isn't another gray SaaS dashboard — it looks like a bold poster that happens to orchestrate AI agents.

### Project-Scoped Configuration
Each project gets a `.elves/config.json` for default runtime, MCP servers, and memory settings. Portable, committable, shareable with teammates.

### Everything Local
All data lives on your machine. SQLite for structured data, `.elves/` per project for config. No cloud sync. No accounts. Export everything anytime.

### Session Replay
Every session records a full event log. Step through past sessions event-by-event, review the work, browse artifacts. Useful for debugging, learning, and sharing.

---

## Screenshots

### Workspace Terminal View
The main view — a live embedded terminal showing the agent's work in real-time. Header displays workspace slug, runtime badge, and diff summary. Footer has Stop, Ship It, and Remove controls.

### Workspace Grid
Overview of all active and idle workspaces as cards with status, diff counts, and branch names. Click to open the terminal view.

### Memory Explorer
Searchable timeline of project memories with FTS5 full-text search. Relevance scores decay over time and boost on access. Pin important memories to keep them permanent.

### Skill Editor
Visual CRUD for custom slash commands with live markdown preview and JSON export. Import skills directly from `~/.claude/commands/`.

### MCP Tool Listing
Visual MCP server manager with tool enumeration — see every tool available from connected servers at a glance.

---

## Prerequisites

- **macOS 13+** (Ventura or later)
- **Node.js 18+**
- **Rust** (for building from source — install via [rustup](https://rustup.rs))
- At least one AI runtime:
  - [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
  - [Codex CLI](https://github.com/openai/codex) — `npm install -g @openai/codex`

---

## Quick Start

### Install via Homebrew (recommended)

```bash
brew install --no-quarantine --cask mvmcode/tap/elves
```

The `--no-quarantine` flag prevents macOS Gatekeeper from blocking the app (ELVES is not notarized — it's an open-source project without an Apple Developer account).

### Or Download Directly

Download the latest `.dmg` from [GitHub Releases](https://github.com/mvmcode/elves/releases).

> **Gatekeeper note:** Since ELVES is not notarized, macOS may say the app is "damaged" or "can't be verified." To fix this, right-click `ELVES.app` → **Open** → click **Open** in the dialog. Or run:
> ```bash
> xattr -cr /Applications/ELVES.app
> ```

---

## Getting Started

### Install from Source

```bash
git clone https://github.com/mvmcode/elves.git
cd elves
npm install
npm run tauri dev
```

On first launch, ELVES scans your PATH for `claude` and `codex` binaries, detects available agents and models, and drops you into the workspace grid — ready to start a task.

### Build for Production

```bash
npm run tauri build
```

This produces a `.app` bundle in `src-tauri/target/release/bundle/macos/`. To create a distributable DMG with proper code signing:

```bash
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/ELVES.app
hdiutil create -volname "ELVES" -srcfolder src-tauri/target/release/bundle/macos/ELVES.app -ov -format UDZO ELVES.dmg
```

---

## Architecture Overview

ELVES uses Tauri v2: a Rust backend handles compute-heavy work (process management, SQLite, file watching) while a WebView frontend renders the UI. They communicate over bidirectional IPC.

The key architectural insight is the **Unified Agent Protocol**. Both Claude Code and Codex emit different event formats. ELVES normalizes everything into a single typed stream (`ElfEvent`) that the frontend subscribes to. The frontend never imports anything runtime-specific — switching from Claude Code to Codex is invisible to the UI layer.

```
┌───────────────────────────────────────────────────────────────┐
│                        React Frontend                          │
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌────────┐         │
│  │ Workspace │ │ Workshop  │ │ Memory   │ │ Skills │         │
│  │ (Worktree │ │ (Theater, │ │ Explorer │ │ Editor │         │
│  │  Cards,   │ │ Plan,Feed)│ │ (FTS5)   │ │        │         │
│  │  Ship It) │ │           │ │          │ │        │         │
│  └─────┬─────┘ └─────┬─────┘ └────┬─────┘ └───┬────┘         │
│        └──────────┬───┘            │           │              │
│   Terminal (PTY)  │ Tauri IPC      │           │              │
│   Git Operations  │                │           │              │
│   Keyboard ───────┤                │           │              │
│   Sound Engine    │                │           │              │
└───────────────────┼────────────────┴───────────┘──────────────┘
┌───────────────────┴───────────────────────────────────────────┐
│                        Rust Backend                            │
│  ┌──────────┐ ┌─────────────────┐ ┌────────────────────────┐ │
│  │ Process  │ │ SQLite (WAL)    │ │ Workspace Manager      │ │
│  │ Manager  │ │ Projects, Elves │ │ Git worktree lifecycle  │ │
│  │          │ │ Sessions, Events│ │ Ship It (push/merge/    │ │
│  │          │ │ Memory + FTS5   │ │   cleanup)              │ │
│  │          │ │ Skills, MCP     │ └────────────────────────┘ │
│  │          │ │ Templates       │ ┌────────────────────────┐ │
│  └────┬─────┘ └─────────────────┘ │ Project Config         │ │
│       │                            │ .elves/config.json     │ │
│  ┌────┴──────────────────────────┐ └────────────────────────┘ │
│  │ Unified Agent Protocol Adapter │ ┌────────────────────────┐│
│  └────┬──────────────────────┬───┘ │ Memory + Interop       ││
│       │                      │      │ Context builder,       ││
│       │                      │      │ extraction, decay      ││
│       │                      │      └────────────────────────┘│
└───────┼──────────────────────┼────────────────────────────────┘
        │                      │
  ┌─────┴───────┐       ┌─────┴────────┐
  │ Claude Code │       │  Codex CLI   │
  │ Agent SDK   │       │  Subprocess  │
  └─────────────┘       └──────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Tauri v2 (Rust) |
| Frontend | React 19, TypeScript 5.8 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| State | Zustand |
| Backend | Rust (2021 edition) |
| Database | SQLite via rusqlite (WAL mode, FTS5) |
| Terminal | xterm.js + portable-pty |
| Process Mgmt | Tokio async runtime |
| Frontend Tests | Vitest + Testing Library |
| Backend Tests | cargo test |

---

## Development

### Setup

```bash
# Clone the repo
git clone https://github.com/mvmcode/elves.git
cd elves

# Install frontend dependencies
npm install

# Start dev server (launches both Vite + Tauri)
npm run tauri dev
```

### Running Tests

```bash
# Frontend tests
npx vitest run

# Rust backend tests
cd src-tauri && cargo test

# Type checking
npx tsc --noEmit
```

### Project Structure

```
elves/
├── src/                         # React frontend
│   ├── components/
│   │   ├── shared/              # DeployButton, Dialog, ResizeHandle
│   │   ├── layout/              # Shell, Sidebar, StatusBar
│   │   ├── workspace/           # ProjectWorkspace, WorkspaceCard, WorkspaceTerminalView,
│   │   │                        # WorkspaceTabBar, SplitTerminalView, TerminalPane
│   │   ├── terminal/            # XTerminal (xterm.js wrapper)
│   │   ├── editors/             # SkillEditor, McpManager
│   │   ├── session/             # SessionControlCard, PermissionPopup
│   │   ├── project/             # SessionHistory
│   │   ├── files/               # FileTreePanel, FileExplorerView
│   │   ├── memory/              # MemoryExplorer, MemoryCard
│   │   └── settings/            # MemorySettings
│   ├── stores/                  # Zustand stores (app, project, session, ui, memory, settings,
│   │                            # skills, mcp, workspace)
│   ├── types/                   # TypeScript types (elf, session, project, memory,
│   │                            # skill, mcp, claude, workspace, search)
│   ├── hooks/                   # useInitialize, useTeamSession, useSessionEvents,
│   │                            # useSkillActions, useMcpActions,
│   │                            # useKeyboardShortcuts, useSessionHistory
│   └── lib/                     # elf-names, Tauri IPC wrappers, pty-agent-detector,
│                                # slug, sounds
│
├── src-tauri/                   # Rust backend
│   └── src/
│       ├── agents/              # Runtime detection, claude/codex adapters, claude discovery,
│       │                        # interop, task analyzer, context builder, memory extractor
│       ├── commands/            # Tauri IPC handlers (agents, projects, sessions, tasks,
│       │                        # memory, skills, mcp, export, pty, git, workspace,
│       │                        # filesystem, search)
│       ├── project/             # Project config management (.elves/config.json)
│       └── db/                  # SQLite schema + migrations, CRUD modules
│                                # (projects, sessions, elves, events, memory, skills, mcp)
│
├── assets/logo/                 # ELVES wordmark and logo assets
├── landing/                     # GitHub Pages landing site
│   ├── index.html               # Neo-brutalist landing page with terminal mockup
│   ├── favicon.svg              # Favicon
│   └── og-image-generator.html  # Canvas-based OG image generator (1200x630)
├── CLAUDE.md                    # Engineering standards
├── VISION.md                    # Full product vision
└── DECISIONS.md                 # Architectural decision log
```

### Key Patterns

- **Neo-brutalist components**: 3px black borders, hard drop shadows (`box-shadow: 6px 6px 0px 0px #000`), no border-radius by default, bold saturated colors
- **Tailwind v4**: Design tokens defined via `@theme` in CSS, not a config file
- **Tauri IPC**: `tauri::command` for request/response, `app.emit()` for streaming events
- **Zustand stores**: Separate stores per domain (app, project, session, ui, memory, settings, skills, mcp, workspace) to prevent unnecessary re-renders
- **Hook-per-domain IPC**: Each data domain has a dedicated hook (`useSkillActions`, `useMcpActions`) that auto-loads data and provides typed CRUD callbacks
- **Persistent memory**: SQLite + FTS5 full-text search. Relevance decays exponentially (`score *= 0.995^days`), boosted on access. Pinned memories exempt from decay.
- **Pre/post-task hooks**: Before each task, project context is built from relevant memories. After completion, heuristic extraction pulls decisions, learnings, and context from the event stream.
- **Worktree-first workspaces**: Every task is a git worktree under `.claude/worktrees/<slug>`. The "Ship It" flow handles push → merge (merge/rebase/squash) → memory extraction → worktree removal → branch deletion as one atomic action.
- **Eager workspace insertion**: Workspaces are added to the store immediately after creation to avoid race conditions between `openWorkspace` and async `listWorkspaces`.
- **Project-scoped config**: `.elves/config.json` per project for default runtime, MCP servers, and memory settings. Portable and committable.
- **Unified agent protocol**: Claude Code and Codex events are normalized into a single typed stream. The interop layer formats context per runtime. Frontend never touches runtime-specific types.
- **Embedded terminal**: PTY via `portable-pty` with xterm.js frontend. Full terminal fidelity including colors, cursor movement, and interactive prompts.
- **Permission popup overlay**: When the PTY agent requests permission, a popup renders over the terminal for inline approve/deny without leaving the view.
- **Global keyboard shortcuts**: Centralized in `useKeyboardShortcuts` hook — Cmd+K (task bar), Cmd+1-9 (projects), Cmd+M (memory)
- **Streaming events**: Claude adapter uses `stream-json` format with background stdout/stderr threads for real-time event delivery
- **Claude discovery**: Filesystem scan of `~/.claude/` surfaces agents, models, permission modes, and slash commands — no subprocess needed

---

## Roadmap

All core phases are complete. The workspace redesign introduces the worktree-first architecture.

- [x] **Phase 1: Foundation** — Tauri v2 scaffold, design system, SQLite backend, runtime detection
- [x] **Phase 2: Single Elf Mode** — ElfCard, ActivityFeed, live streaming, session management
- [x] **Phase 3: Multi-Elf Teams** — Task analyzer, plan preview, team deployment, task graph, thinking panel
- [x] **Phase 4: Memory & Intelligence** — Persistent memory with FTS5, auto-learning, context injection, memory explorer, settings
- [x] **Phase 5: Visual Editors & Polish** — Skills editor with preview/export, MCP manager with tool listing, context editor with save/diff, keyboard shortcuts
- [x] **Phase 6: Codex Full Support** — Codex adapter with JSONL normalization, multi-agent event attribution, interop layer, runtime picker, template library with seeding + JSON export, session history and comparison
- [x] **Phase 7: Distribution** — CI/CD with clippy, auto-updater with signing, session replay export, Homebrew cask, landing page with app mockup, OG image generator, community files
- [x] **Phase 8: Streaming & Terminal** — Real-time stream-json events, Claude discovery, embedded PTY terminal, session resume, resizable panels, solo terminal mode, native dialogs, TaskBar options
- [x] **Phase 9: Workspace Redesign** — Worktree-first workspaces, Ship It completion flow, project-scoped config, branch management, DiffViewer, merge strategy picker

---

## Contributing

Contributions are welcome! Before diving in:

1. Read [`CLAUDE.md`](CLAUDE.md) for engineering standards — it covers code quality, testing, documentation, and the neo-brutalist design system in detail
2. Read [`DECISIONS.md`](DECISIONS.md) for architectural context on past choices
3. Read [`VISION.md`](VISION.md) for the full product vision

### Quick guidelines

- Every new component gets a test. No exceptions.
- Every new Tauri command gets an integration test.
- Types are documentation — no `any`, no implicit returns.
- Commit format: `type(scope): description` (e.g., `feat(workshop): add ElfCard component`)
- One commit per coherent change. No WIP commits.

---

## Community

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

---

## License

[MIT](LICENSE)

---

## Why "ELVES"?

The name stuck from an early prototype where AI agents had animated character avatars. The characters are gone, but the name remains — short, memorable, and easy to type. Think of it as a backronym: **E**xecute **L**ocal **V**ersioned **E**ngineering **S**essions.

> *"You don't do the work. You have ELVES for that."*

---

*Built by the ELVES contributors.*
