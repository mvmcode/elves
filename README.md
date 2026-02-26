# MINIONS

**Deploy the minions.**

A visual, personality-driven desktop app for orchestrating AI agent teams. Type a task. Watch your minions bicker, collaborate, and get the job done — all in a gorgeous real-time UI with character avatars, live thinking bubbles, and hilarious status messages.

[![License: MIT](https://img.shields.io/badge/License-MIT-FFD93D.svg)](LICENSE)
[![macOS](https://img.shields.io/badge/macOS-13%2B-000000.svg)](https://github.com/mvmcode/minions)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8DB.svg)](https://tauri.app)

---

## What is MINIONS?

MINIONS is a Tauri v2 desktop app (macOS) that turns [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/codex/) into a visually chaotic, delightfully fun, general-purpose multi-agent system. You type a task, MINIONS figures out how many agents to deploy, assigns them names and personalities, and streams everything back in real-time.

Not just for coding. Research, analysis, writing, planning, data processing — if Claude Code or Codex can do it, your minions can do it in parallel while you watch and eat a banana.

Everything is local. Projects, memory, sessions — all stored on your machine in SQLite. No cloud. No accounts. No telemetry. Your minions, your data.

### Minions Have Personality

Instead of boring "Running..." or "Processing...", your minions have opinions:

| Actual State | What Your Minion Shows |
|---|---|
| Thinking | "Kevin is staring at the ceiling thinking really hard..." |
| Writing code | "Bob is typing furiously with both hands AND feet..." |
| Running tests | "Dave mixed some chemicals and is hoping nothing explodes..." |
| Tests passing | "Dave is doing a victory dance! All tests pass!" |
| Tests failing | "Dave broke something. He's hiding under the desk." |
| Error state | "Kevin set something on fire. Classic Kevin." |
| Completing task | "Stuart finished and is demanding a banana as payment." |
| Idle | "Bob fell asleep at his desk. Someone poke him." |

---

## Features

### Personality System
Every agent gets a randomly assigned name (Kevin, Stuart, Bob, Otto, Dave...), an expressive avatar with unique accessories, and a personality quirk that shows up in their status messages. The deploy button doesn't say "Run." It says **DEPLOY THE MINIONS**.

### Multi-Runtime Support
Works with Claude Code Agent SDK and Codex CLI. Pick your runtime per-project or per-task. Mix freely. A unified adapter layer normalizes both event streams — the frontend never knows which engine is underneath.

### Persistent Memory
SQLite-backed memory with FTS5 full-text search. After each session, MINIONS extracts decisions, learnings, and context. Relevance scores decay over time and get boosted on access — frequently useful memories stay sharp while stale ones fade. Before each new task, relevant memory is automatically injected into your agent's context.

### Neo-Brutalist UI
Thick black borders. Hard drop shadows (no blur). Saturated colors. Oversized typography. Snappy 100-200ms animations. This isn't another gray SaaS dashboard — it looks like a bold poster that happens to orchestrate AI agents.

### Everything Local
All data lives in `~/.minions/` on your machine. SQLite for structured data, markdown for human-readable memory. No cloud sync. No accounts. Export everything anytime.

### Session Replay
Every session records a full event log. Step through past sessions event-by-event, see what each minion did, review the thinking, browse artifacts. Useful for debugging, learning, and sharing.

---

## Screenshots

> **Coming Soon** — the minions are still getting dressed.

```
┌─────┬──────────────────────────────────────────────────┐
│     │  TASK: "Research competitors & write report"      │
│  P  │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  R  │                                                   │
│  O  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  J  │  │  KEVIN     │  │  STUART    │  │  BOB       │ │
│  E  │  │  Lead      │  │  Research  │  │  Writer    │ │
│  C  │  │  [avatar]  │  │  [avatar]  │  │  [avatar]  │ │
│  T  │  │ "Assigning │  │ "Speed-    │  │ "Waiting   │ │
│  S  │  │  tasks..." │  │  reading   │  │  for data  │ │
│     │  │ ████░░ 40% │  │ ██████ 60% │  │ ░░░░░░ 0%  │ │
│     │  └────────────┘  └────────────┘  └────────────┘ │
│     │                                                   │
│     │  ┌─────── ACTIVITY FEED ───────────────────────┐ │
│     │  │ [12:03] Kevin spawned as Lead               │ │
│     │  │ [12:03] Stuart → "Found 7 competitors"      │ │
│     │  │ [12:04] Bob creating report template...      │ │
│     │  └─────────────────────────────────────────────┘ │
└─────┴──────────────────────────────────────────────────┘
```

---

## Prerequisites

- **macOS 13+** (Ventura or later)
- **Node.js 18+**
- **Rust** (for building from source — install via [rustup](https://rustup.rs))
- At least one AI runtime:
  - [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
  - [Codex CLI](https://github.com/openai/codex) — `npm install -g @openai/codex`

---

## Getting Started

### Install from Source

```bash
git clone https://github.com/mvmcode/minions.git
cd minions
npm install
npm run tauri dev
```

On first launch, MINIONS scans your PATH for `claude` and `codex` binaries and shows you what's available. Then you're dropped into an empty project state with a banana-yellow prompt, ready to deploy.

### Build for Production

```bash
npm run tauri build
```

This produces a signed `.dmg` in `src-tauri/target/release/bundle/`.

---

## Architecture Overview

MINIONS uses Tauri v2: a Rust backend handles compute-heavy work (process management, SQLite, file watching) while a WebView frontend renders the UI. They communicate over bidirectional IPC.

The key architectural insight is the **Unified Agent Protocol**. Both Claude Code and Codex emit different event formats. MINIONS normalizes everything into a single typed stream (`MinionEvent`) that the frontend subscribes to. The frontend never imports anything runtime-specific — switching from Claude Code to Codex is invisible to the UI layer.

```
┌─────────────────────────────────────────────┐
│              React Frontend                  │
│   (Theater, Activity Feed, Memory Explorer)  │
└──────────────────┬──────────────────────────┘
                   │ Tauri IPC
┌──────────────────┴──────────────────────────┐
│              Rust Backend                    │
│  ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Process  │ │ SQLite │ │ File Watcher │  │
│  │ Manager  │ │ Store  │ │              │  │
│  └────┬─────┘ └────────┘ └──────────────┘  │
│       │                                      │
│  ┌────┴──────────────────────────────────┐  │
│  │    Unified Agent Protocol Adapter      │  │
│  └────┬──────────────────────┬───────────┘  │
└───────┼──────────────────────┼──────────────┘
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
| Process Mgmt | Tokio async runtime |
| Frontend Tests | Vitest + Testing Library |
| Backend Tests | cargo test |

---

## Development

### Setup

```bash
# Clone the repo
git clone https://github.com/mvmcode/minions.git
cd minions

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
minions/
├── src/                         # React frontend
│   ├── components/
│   │   ├── shared/              # Button, Card, Input, Panel, Badge, etc.
│   │   ├── layout/              # Shell, Sidebar, TaskBar, TopBar
│   │   ├── theater/             # MinionTheater, MinionCard, TaskGraph
│   │   ├── feed/                # ActivityFeed, EventRow
│   │   ├── memory/              # MemoryExplorer, MemoryCard
│   │   └── editors/             # SkillEditor, PlanEditor, McpManager
│   ├── stores/                  # Zustand stores (app, project, ui)
│   ├── types/                   # TypeScript type definitions
│   ├── hooks/                   # React hooks
│   └── lib/                     # Utilities, Tauri IPC wrappers
│
├── src-tauri/                   # Rust backend
│   └── src/
│       ├── agents/              # Runtime detection, adapters
│       ├── commands/            # Tauri IPC command handlers
│       └── db/                  # SQLite schema, migrations, CRUD
│
├── CLAUDE.md                    # Engineering standards
├── VISION.md                    # Full product vision
└── DECISIONS.md                 # Architectural decision log
```

### Key Patterns

- **Neo-brutalist components**: 3px black borders, hard drop shadows (`box-shadow: 6px 6px 0px 0px #000`), no border-radius by default, bold saturated colors
- **Tailwind v4**: Design tokens defined via `@theme` in CSS, not a config file
- **Tauri IPC**: `tauri::command` for request/response, `app.emit()` for streaming events
- **Zustand stores**: Separate stores per domain to prevent unnecessary re-renders

---

## Roadmap

- [x] **Phase 1: Foundation** — Tauri v2 scaffold, design system, SQLite backend, runtime detection
- [ ] **Phase 2: Single Minion Mode** — MinionCard, ActivityFeed, live streaming, session management
- [ ] **Phase 3: Multi-Minion Teams** — Auto-team decomposition, plan editor, Minion Theater
- [ ] **Phase 4: Memory & Intelligence** — Persistent memory, auto-learning, context injection
- [ ] **Phase 5: Visual Editors & Polish** — Skills editor, MCP manager, avatar animations, sound design
- [ ] **Phase 6: Codex Full Support** — Multi-agent Codex, runtime switching, task templates
- [ ] **Phase 7: Distribution** — Signed .dmg, auto-updater, Homebrew cask, landing page

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
- Commit format: `type(scope): description` (e.g., `feat(theater): add MinionCard component`)
- One commit per coherent change. No WIP commits.

---

## License

[MIT](LICENSE)

---

## Why "Minions"?

Developer tools don't have to be boring. Terminal UIs are powerful but invisible. IDEs are productive but sterile. We think there's room for tools that are genuinely fun to use — tools that make you smile while they do the hard work.

MINIONS gives your AI agents names, faces, and opinions. When Kevin sets something on fire, you laugh. When Dave's tests pass, you celebrate. When Stuart demands a banana as payment, you screenshot it and share it. That's the point.

The best tools are the ones people *want* to use. And nobody wants to stare at a gray loading spinner when they could be watching a team of animated yellow blobs argue about the best approach to your refactor.

> *"You don't do the work. You have minions for that."*

---

*Built with lots of bananas by the MINIONS contributors.*
