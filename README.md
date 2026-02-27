<p align="center">
  <img src="assets/logo/png/elves-wordmark-1000x280.png" alt="ELVES" width="500" />
</p>

<h3 align="center"><strong>Summon the elves.</strong></h3>

<p align="center">
A visual, personality-driven desktop app for orchestrating AI agent teams.<br/>
Type a task. Watch your elves bicker, collaborate, and craft the solution — all in a gorgeous real-time workshop UI with character avatars, live thinking bubbles, and hilarious status messages.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-FFD93D.svg" alt="License: MIT" /></a>
  <a href="https://github.com/mvmcode/elves"><img src="https://img.shields.io/badge/macOS-13%2B-000000.svg" alt="macOS" /></a>
  <a href="https://tauri.app"><img src="https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8DB.svg" alt="Built with Tauri" /></a>
  <a href="https://github.com/mvmcode/elves/actions/workflows/ci.yml"><img src="https://github.com/mvmcode/elves/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

## What is ELVES?

ELVES is a Tauri v2 desktop app (macOS) that turns [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/codex/) into a visually chaotic, delightfully fun, general-purpose multi-agent system. You type a task, ELVES figures out how many agents to summon, assigns them names and personalities, and streams everything back in real-time through a workshop interface.

Not just for coding. Research, analysis, writing, planning, data processing — if Claude Code or Codex can do it, your elves can do it in parallel while you watch and eat a cookie.

Everything is local. Projects, memory, sessions — all stored on your machine in SQLite. No cloud. No accounts. No telemetry. Your elves, your data.

### Elves Have Personality

Instead of boring "Running..." or "Processing...", your elves have opinions:

| Actual State | What Your Elf Shows |
|---|---|
| Thinking | "Tinker is staring at the ceiling thinking really hard..." |
| Reading files | "Jingle is speed-reading your code with pointy ears perked..." |
| Writing code | "Sprocket is typing furiously with nimble elf fingers..." |
| Waiting | "Nimble is tapping their foot waiting for Tinker to finish..." |
| Running tests | "Flicker mixed some chemicals and is hoping nothing explodes..." |
| Tests passing | "Flicker is doing a victory dance! All tests pass!" |
| Tests failing | "Flicker broke something. He's hiding under the workbench." |
| Searching the web | "Bramble fell down a Wikipedia rabbit hole again..." |
| Writing a report | "Thistle is pretending to be a serious journalist..." |
| Error state | "Tinker set something on fire. Classic Tinker." |
| Completing task | "Jingle finished and is demanding a cookie as payment." |
| Chatting | "Nimble is yelling across the workshop at Jingle..." |
| Spawning helper | "Tinker recruited an apprentice. This can only go well." |
| Disagreement | "Flicker and Bramble are arguing about the right approach..." |
| Idle | "Sprocket fell asleep at the workbench. Someone poke them." |

---

## Features

### Personality System
Every agent gets a randomly assigned name (Spark, Tinker, Jingle, Sprocket, Nimble, Flicker, Bramble, Thistle...), an expressive avatar with unique accessories, and a personality quirk that shows up in their status messages. The action button doesn't say "Run." It says **SUMMON THE ELVES**.

### Multi-Runtime Support
Works with Claude Code Agent SDK and Codex CLI. Pick your runtime per-project or per-task. Mix freely. A unified adapter layer normalizes both event streams — the frontend never knows which engine is underneath.

### Persistent Memory
SQLite-backed memory with FTS5 full-text search. After each session, ELVES extracts decisions, learnings, and context. Relevance scores decay over time and get boosted on access — frequently useful memories stay sharp while stale ones fade. Before each new task, relevant memory is automatically injected into your agent's context.

### Neo-Brutalist UI
Thick black borders. Hard drop shadows (no blur). Saturated colors. Oversized typography. Snappy 100-200ms animations. This isn't another gray SaaS dashboard — it looks like a bold poster that happens to orchestrate AI agents.

### Everything Local
All data lives in `~/.elves/` on your machine. SQLite for structured data, markdown for human-readable memory. No cloud sync. No accounts. Export everything anytime.

### Session Replay
Every session records a full event log. Step through past sessions event-by-event, see what each elf did, review the thinking, browse artifacts. Useful for debugging, learning, and sharing.

### Workshop Copy That Makes You Smile

**Loading states:**
- *"Waking up the elves..."* (app startup)
- *"Recruiting elves for this job..."* (planning phase)
- *"The elves are arguing about who does what..."* (task decomposition)
- *"Herding the elves into position..."* (agent spawning)
- *"The elves have been summoned. Pray for them."* (execution start)

**Empty states:**
- No projects yet: *"Your elves are bored. Give them something to do."*
- No tasks in project: *"The elves are just sitting around munching cookies."*
- No memory entries: *"Your elves have amnesia. Start a task to build memories."*

---

## Screenshots

> Screenshots and GIFs coming soon. In the meantime, here's what you'll see:
> - **Elf Theater** — animated elf cards with live status messages
> - **Multi-Elf Teams** — task graph visualization with dependency arrows
> - **Memory Explorer** — searchable timeline of project memories
> - **Session Replay** — step through past sessions event-by-event

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

### Install via Homebrew

```bash
brew install --cask elves
```

### Or Download

Download the latest `.dmg` from [GitHub Releases](https://github.com/mvmcode/elves/releases).

---

## Getting Started

### Install from Source

```bash
git clone https://github.com/mvmcode/elves.git
cd elves
npm install
npm run tauri dev
```

On first launch, ELVES scans your PATH for `claude` and `codex` binaries and shows you what's available — *"Let's see who showed up for work today..."* — then drops you into an empty workshop with a cookie-yellow prompt, ready to summon.

### Build for Production

```bash
npm run tauri build
```

This produces a signed `.dmg` in `src-tauri/target/release/bundle/`.

---

## Architecture Overview

ELVES uses Tauri v2: a Rust backend handles compute-heavy work (process management, SQLite, file watching) while a WebView frontend renders the UI. They communicate over bidirectional IPC.

The key architectural insight is the **Unified Agent Protocol**. Both Claude Code and Codex emit different event formats. ELVES normalizes everything into a single typed stream (`ElfEvent`) that the frontend subscribes to. The frontend never imports anything runtime-specific — switching from Claude Code to Codex is invisible to the UI layer.

```
┌──────────────────────────────────────────────────────────────┐
│                        React Frontend                         │
│  ┌───────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│  │ Workshop  │ │ Memory   │ │ Skills │ │  MCP   │ │ Hist │ │
│  │ (Theater, │ │ Explorer │ │ Editor │ │Manager │ │ ory  │ │
│  │ Plan,Feed)│ │ (FTS5)   │ │        │ │        │ │      │ │
│  └─────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──┬───┘ │
│        └─────────┬───┘           │          │         │     │
│   Keyboard       │ Tauri IPC    │          │         │     │
│   Shortcuts ─────┤              │          │         │     │
│   Sound Engine   │              │          │         │     │
│   Runtime Picker │              │          │         │     │
└──────────────────┼──────────────┴──────────┴─────────┘     │
┌──────────────────┴─────────────────────────────────────────┘
│                        Rust Backend                           │
│  ┌──────────┐ ┌─────────────────┐ ┌───────────────────────┐ │
│  │ Process  │ │ SQLite (WAL)    │ │ Memory Engine         │ │
│  │ Manager  │ │ Projects, Elves │ │ Context Builder       │ │
│  │          │ │ Sessions, Events│ │ Heuristic Extraction  │ │
│  │          │ │ Memory + FTS5   │ │ Relevance Decay       │ │
│  │          │ │ Skills, MCP     │ └───────────────────────┘ │
│  │          │ │ Templates       │                            │
│  └────┬─────┘ └─────────────────┘ ┌───────────────────────┐ │
│       │                            │ Interop Layer         │ │
│  ┌────┴──────────────────────────┐ │ Context formatting    │ │
│  │ Unified Agent Protocol Adapter │ │ per runtime           │ │
│  └────┬──────────────────────┬───┘ └───────────────────────┘ │
│       │                      │      ┌──────────────────┐     │
│       │                      │      │ Task Analyzer     │     │
│       │                      │      │ (solo vs. team)   │     │
└───────┼──────────────────────┼──────┴──────────────────┘─────┘
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
│   │   ├── shared/              # Button, Card, Input, Panel, Badge, EmptyState, DeployButton,
│   │   │                        # RuntimePicker, ShortcutOverlay
│   │   ├── layout/              # Shell, Sidebar, TaskBar, TopBar
│   │   ├── theater/             # ElfTheater, ElfCard, ElfAvatar, PlanPreview, TaskGraph, ThinkingPanel
│   │   ├── editors/             # SkillEditor, McpManager, ContextEditor, TemplateLibrary
│   │   ├── project/             # SessionHistory
│   │   ├── feed/                # ActivityFeed
│   │   ├── memory/              # MemoryExplorer, MemoryCard
│   │   └── settings/            # MemorySettings
│   ├── stores/                  # Zustand stores (app, project, session, ui, memory, settings,
│   │                            # skills, mcp, templates)
│   ├── types/                   # TypeScript types (elf, session, project, memory, runtime,
│   │                            # skill, mcp, template)
│   ├── hooks/                   # useInitialize, useSession, useTeamSession, useMemoryActions,
│   │                            # useSkillActions, useMcpActions, useTemplateActions,
│   │                            # useKeyboardShortcuts, useSessionHistory, useSounds
│   └── lib/                     # elf-names, sounds, funny-copy, Tauri IPC wrappers
│
├── src-tauri/                   # Rust backend
│   └── src/
│       ├── agents/              # Runtime detection, claude/codex adapters, interop,
│       │                        # task analyzer, context builder, memory extractor
│       ├── commands/            # Tauri IPC handlers (agents, projects, sessions, tasks,
│       │                        # memory, skills, mcp, templates)
│       └── db/                  # SQLite schema + migrations, CRUD modules
│                                # (projects, sessions, elves, events, memory, skills, mcp, templates)
│
├── assets/logo/                 # ELVES wordmark and logo assets
├── CLAUDE.md                    # Engineering standards
├── VISION.md                    # Full product vision
└── DECISIONS.md                 # Architectural decision log
```

### Key Patterns

- **Neo-brutalist components**: 3px black borders, hard drop shadows (`box-shadow: 6px 6px 0px 0px #000`), no border-radius by default, bold saturated colors
- **Tailwind v4**: Design tokens defined via `@theme` in CSS, not a config file
- **Tauri IPC**: `tauri::command` for request/response, `app.emit()` for streaming events
- **Zustand stores**: Separate stores per domain (app, project, session, ui, memory, settings, skills, mcp, templates) to prevent unnecessary re-renders
- **Hook-per-domain IPC**: Each data domain has a dedicated hook (`useMemoryActions`, `useSkillActions`, `useMcpActions`, `useTemplateActions`) that auto-loads data and provides typed CRUD callbacks
- **Persistent memory**: SQLite + FTS5 full-text search. Relevance decays exponentially (`score *= 0.995^days`), boosted on access. Pinned memories exempt from decay.
- **Pre/post-task hooks**: Before each task, project context is built from relevant memories. After completion, heuristic extraction pulls decisions, learnings, and context from the event stream.
- **View routing**: `AppView` union type in Zustand (session/memory/skills/mcp/history/settings) — no React Router needed for a single-window desktop app
- **Unified agent protocol**: Claude Code and Codex events are normalized into a single typed stream. The interop layer formats context per runtime. Frontend never touches runtime-specific types.
- **Inline SVG avatars**: 15 unique elf avatars with per-status CSS animations. Zero network requests.
- **Web Audio API sounds**: Oscillator-based sound effects with no audio file dependencies. 6 effects (spawn, typing, complete, error, chat, deploy).
- **Global keyboard shortcuts**: Centralized in `useKeyboardShortcuts` hook — Cmd+K (task bar), Cmd+1-9 (projects), Cmd+M (memory), Cmd+/ (help overlay)

---

## Roadmap

- [x] **Phase 1: Foundation** — Tauri v2 scaffold, design system, SQLite backend, runtime detection
- [x] **Phase 2: Single Elf Mode** — ElfCard, ActivityFeed, live streaming, session management
- [x] **Phase 3: Multi-Elf Teams** — Task analyzer, plan preview, team deployment, task graph, thinking panel
- [x] **Phase 4: Memory & Intelligence** — Persistent memory with FTS5, auto-learning, context injection, memory explorer, settings
- [x] **Phase 5: Visual Editors & Polish** — Skills editor, MCP manager, context editor, 15 SVG elf avatars, Web Audio sounds, funny copy engine, keyboard shortcuts, shortcut overlay
- [x] **Phase 6: Codex Full Support** — Codex adapter with JSONL normalization, interop layer, runtime picker, template library (5 built-in), session history
- [x] **Phase 7: Distribution** — CI/CD, auto-updater, session replay export, Homebrew cask, landing page

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

## Why "Elves"?

Developer tools don't have to be boring. Terminal UIs are powerful but invisible. IDEs are productive but sterile. We think there's room for tools that are genuinely fun to use — tools that make you smile while they do the hard work.

ELVES gives your AI agents names, faces, and opinions. When Tinker sets something on fire, you laugh. When Flicker's tests pass, you celebrate. When Jingle demands a cookie as payment, you screenshot it and share it. That's the point.

The best tools are the ones people *want* to use. And nobody wants to stare at a gray loading spinner when they could be watching a team of animated elves argue about the best approach to your refactor in their cozy workshop.

> *"You don't do the work. You have elves for that."*

---

*Built with lots of cookies by the ELVES contributors.*
