# 🍌 MINIONS — Deploy Your AI Army

> *"You don't do the work. You have minions for that."*

**Website:** minions.dev
**Tagline options:**
- "Deploy the minions."
- "Why do it yourself when you have minions?"
- "Your personal army of AI chaos agents."
- "One task. Many minions. Zero effort."

---

## 1. Product Vision

MINIONS is a Tauri-based macOS desktop app that turns Claude Code and OpenAI Codex into a visually chaotic, delightfully fun, general-purpose multi-agent system. You type a task. MINIONS deploys a team of animated, personality-driven AI agents who bicker, collaborate, and get the job done — all rendered in a gorgeous real-time UI with character avatars, live thinking bubbles, funny status messages, and inter-agent chat.

**Not just for coding.** Research, analysis, writing, planning, data processing — if Claude Code or Codex can do it, your minions can do it in parallel while you watch and eat a banana 🍌.

**Everything is local.** Projects, memory, skills, plans — all stored on your machine. No cloud. No accounts. Your minions, your data.

**Interoperable.** Start a project with Claude Code, switch to Codex mid-stream. MINIONS doesn't care. The project layer is engine-agnostic.

---

## 2. The Personality — What Makes It Fun

### 2.1 Every Minion Has Character

When agents spawn, they get randomly assigned:
- **A name** from a pool of funny minion names: Gru Jr., Kevin, Stuart, Bob, Otto, Dave, Jerry, Phil, Norbert, Jorge, Carl, Tim, Mark, Lance, Steve
- **An avatar** — expressive yellow blob characters with different accessories (hard hat, lab coat, glasses, headphones, detective hat, chef hat, etc.)
- **A personality quirk** that shows up in their status messages

### 2.2 Status Messages That Make You Screenshot

Instead of boring "Running..." or "Processing...", minions have personality:

| Actual State | What Minion Shows |
|---|---|
| Thinking | "🧠 *Kevin is staring at the ceiling thinking really hard...*" |
| Reading files | "📖 *Stuart is speed-reading your code with one eye closed...*" |
| Writing code | "⌨️ *Bob is typing furiously with both hands AND feet...*" |
| Waiting for another agent | "😤 *Otto is tapping his foot waiting for Kevin to finish...*" |
| Running tests | "🧪 *Dave mixed some chemicals and is hoping nothing explodes...*" |
| Tests passing | "🎉 *Dave is doing a victory dance! All tests pass!*" |
| Tests failing | "😱 *Dave broke something. He's hiding under the desk.*" |
| Searching the web | "🔍 *Jerry fell down a Wikipedia rabbit hole again...*" |
| Writing a report | "✍️ *Phil is pretending to be a serious journalist...*" |
| Error state | "🔥 *Kevin set something on fire. Classic Kevin.*" |
| Completing task | "🍌 *Stuart finished and is demanding a banana as payment.*" |
| Idle | "😴 *Bob fell asleep at his desk. Someone poke him.*" |
| Communicating with teammate | "📢 *Otto is yelling across the room at Stuart...*" |
| Spawning sub-agent | "👶 *Kevin hired an intern. This can only go well.*" |
| Agent disagreement | "🥊 *Dave and Jerry are arguing about the right approach...*" |

### 2.3 Sound Design (Optional, Toggle)
- Soft "bloop" when a minion spawns
- Typing sounds when agents are writing
- Celebration jingle when task completes
- Cartoon crash sound on errors
- Minion-style gibberish mumble ambient (very subtle, opt-in)

### 2.4 The Deploy Button
The main action button doesn't say "Run" or "Execute." It says:

**🍌 DEPLOY THE MINIONS**

### 2.5 Loading States
- "Waking up the minions..." (app startup)
- "Recruiting minions for this job..." (planning phase)
- "The minions are arguing about who does what..." (task decomposition)
- "Herding the minions into position..." (agent spawning)
- "The minions have been deployed. Pray for them." (execution start)

### 2.6 Empty States
- No projects yet: "Your minions are bored. Give them something to do. 🍌"
- No tasks in project: "The minions are just sitting around eating bananas."
- No memory entries: "Your minions have amnesia. Start a task to build memories."

---

## 3. Core Principles

1. **Zero ceremony** — Type a task. Hit deploy. MINIONS figures out how many agents, what roles, which runtime. No boilerplate.
2. **Runtime agnostic** — Works with Claude Code AND Codex. Pick per-project or per-task. Mix freely.
3. **Visually chaotic (in a good way)** — Animated avatars, live thought bubbles, task dependency graphs, inter-agent chat — all updating in real-time.
4. **Expose everything** — Plans, skills, CLAUDE.md, MCP servers, permissions — all via visual editors. No vim-ing config files.
5. **General purpose** — "Refactor my auth module" and "Research 5 competitors and write a report" are both valid minion tasks.
6. **Persistent memory** — Minions remember across sessions. Project context, past decisions, user preferences — locally stored, always available.
7. **Interoperable projects** — Projects aren't locked to a runtime. Switch Claude Code ↔ Codex anytime.

---

## 4. Pre-requisites & First Launch

**Required on user's machine:**
- macOS 13+ (Ventura or later)
- Claude Code CLI (`claude` in PATH) and/or Codex CLI (`codex` in PATH)
- Node.js 18+ (required by both CLIs)

**First launch flow:**
1. MINIONS scans PATH for `claude` and `codex` binaries
2. Shows a fun onboarding screen: *"Let's see who showed up for work today..."*
3. Detects runtimes with checkmarks: ✅ Claude Code v2.1.x · ✅ Codex v1.x  (or ❌ Not Found with install link)
4. User picks default runtime preference
5. Optional: scan for existing MCP servers in `~/.claude.json`
6. Done — drops into empty project state with the banana prompt

---

## 5. Architecture

### 5.1 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| App Shell | **Tauri v2** (Rust) | ~10MB, native macOS feel, Rust for process mgmt + SQLite |
| Frontend | **React 19 + TypeScript** | Component ecosystem, fast iteration |
| Styling | **Tailwind CSS v4 + Framer Motion** | Animations are key for minion personality |
| State | **Zustand** | Lightweight, subscribe to slices |
| Local DB | **SQLite** via `rusqlite` (Rust) | All structured data, FTS for memory search |
| Claude Code | **Agent SDK (TypeScript)** | `query()` with streaming, subagent definitions, tool callbacks |
| Codex | **CLI subprocess** + JSONL stdout parsing | Same UX, different plumbing |
| IPC | **Tauri Commands + Events** | Rust→JS event streaming for real-time UI |
| File Watch | **notify** (Rust crate) | Detect file changes made by agents |
| Avatars | **Lottie animations** or **Rive** | Smooth, lightweight character animations |

### 5.2 System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     MINIONS Desktop App                       │
│                                                               │
│  ┌─────────────────── React Frontend ──────────────────────┐ │
│  │                                                          │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐ │ │
│  │  │ 🍌 Task  │  │ 🎭 Minion    │  │ 📊 Live Activity  │ │ │
│  │  │ Command  │  │ Theater      │  │ Feed & Task Graph │ │ │
│  │  │ Bar      │  │ (avatars,    │  │                   │ │ │
│  │  │          │  │  animations, │  │                   │ │ │
│  │  │ Cmd+K    │  │  status)     │  │                   │ │ │
│  │  └──────────┘  └──────────────┘  └───────────────────┘ │ │
│  │                                                          │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐ │ │
│  │  │ 📁       │  │ 📝 Visual    │  │ 🧠 Memory         │ │ │
│  │  │ Project  │  │ Editors      │  │ Explorer          │ │ │
│  │  │ Sidebar  │  │ (Skills,     │  │ (search, browse,  │ │ │
│  │  │          │  │  Plans, MCP, │  │  edit, timeline)  │ │ │
│  │  │          │  │  CLAUDE.md)  │  │                   │ │ │
│  │  └──────────┘  └──────────────┘  └───────────────────┘ │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │ Tauri IPC                            │
│  ┌──────────────────────┴───────────────────────────────────┐ │
│  │                 Rust Backend Core                         │ │
│  │                                                           │ │
│  │  ┌──────────────┐  ┌───────────┐  ┌──────────────────┐  │ │
│  │  │ Process      │  │ SQLite    │  │ File Watcher     │  │ │
│  │  │ Manager      │  │ Store     │  │                  │  │ │
│  │  │ (spawn,      │  │ (memory,  │  │ (detect agent    │  │ │
│  │  │  monitor,    │  │  projects,│  │  file changes)   │  │ │
│  │  │  kill)       │  │  events)  │  │                  │  │ │
│  │  └──────┬───────┘  └───────────┘  └──────────────────┘  │ │
│  │         │                                                 │ │
│  │  ┌──────┴──────────────────────────────────────────────┐ │ │
│  │  │        Unified Agent Protocol Adapter                │ │ │
│  │  │  (normalizes Claude Code + Codex events into one     │ │ │
│  │  │   stream for the frontend to render)                 │ │ │
│  │  └──────────┬─────────────────────┬────────────────────┘ │ │
│  └─────────────┼─────────────────────┼──────────────────────┘ │
│                │                     │                         │
│  ┌─────────────┴──────┐  ┌──────────┴───────────┐            │
│  │  Claude Code        │  │  Codex CLI            │            │
│  │  Agent SDK          │  │  Subprocess           │            │
│  │  query() streaming  │  │  JSONL stdout parse   │            │
│  └─────────────────────┘  └──────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
         │                              │
  ┌──────┴──────┐               ┌───────┴──────┐
  │ ~/.minions/ │               │ MCP Servers   │
  │ (projects,  │               │ (inherited    │
  │  memory,    │               │  from Claude  │
  │  skills)    │               │  Code/Codex)  │
  └─────────────┘               └──────────────┘
```

### 5.3 Unified Agent Protocol

The key innovation. Both runtimes emit different formats. MINIONS normalizes everything:

```typescript
type MinionEvent = {
  id: string;
  timestamp: number;
  minionId: string;           // internal agent ID
  minionName: string;         // "Kevin", "Stuart", etc.
  runtime: 'claude-code' | 'codex';
  type:
    | 'thinking'              // extended thinking / plan mode
    | 'tool_call'             // calling a tool (bash, edit, MCP, etc.)
    | 'tool_result'           // tool returned something
    | 'output'                // text output / response
    | 'spawn'                 // spawned a sub-minion
    | 'chat'                  // inter-minion communication
    | 'task_update'           // task status change
    | 'error'                 // something broke
    | 'permission_request'    // needs human approval
    | 'file_change';          // modified a file
  payload: Record<string, any>;
  funnyStatus?: string;       // the personality-driven status message
};
```

Frontend subscribes to the event stream and renders it. Never needs to know which runtime is underneath.

### 5.4 Smart Task Decomposition (The "Auto-Team" Logic)

When user types a task, BEFORE deploying:

```
User Input
    │
    ▼
┌───────────────────────────────────┐
│  Task Analyzer (fast LLM call)│
│                               │
│  Input: task text + project   │
│         context + memory      │
│                               │
│  Output:                      │
│  - complexity: solo | team    │
│  - agent_count: 1-6           │
│  - roles: [{name, focus}]     │
│  - runtime_rec: cc | codex    │
│  - estimated_time: string     │
│  - task_graph: dependencies   │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Plan Preview Card            │
│  (user can edit or just go)   │
│                               │
│  "3 minions recommended"      │
│  🟡 Kevin — Research          │
│  🟡 Stuart — Analysis         │
│  🟡 Bob — Report Writing      │
│                               │
│  [Edit Plan]  [🍌 DEPLOY]     │
└───────────────────────────────┘
```

For **simple tasks** (single file edit, quick question, small fix), MINIONS skips the planning and just deploys one agent immediately. The user never has to say "create a team" — it's automatic based on task complexity.

---

## 6. Data Model — Everything Local

### 6.1 Directory Structure

```
~/.minions/
├── minions.db                     # SQLite — all structured data
├── projects/
│   ├── {project-id}/
│   │   ├── project.json           # Manifest: name, path, runtime prefs, settings
│   │   ├── memory/
│   │   │   ├── context.md         # Accumulated project context (auto-maintained)
│   │   │   ├── decisions.md       # Key decisions across sessions
│   │   │   └── learnings.md       # Patterns, gotchas, preferences agents discovered
│   │   ├── skills/
│   │   │   └── *.md               # Project-specific skills
│   │   ├── plans/
│   │   │   └── *.json             # Saved task decomposition plans
│   │   ├── sessions/
│   │   │   └── {session-id}/
│   │   │       ├── events.jsonl   # Full event log (MinionEvent format)
│   │   │       ├── summary.md     # Auto-generated session summary
│   │   │       └── artifacts/     # Files produced
│   │   └── .claude/               # Claude Code compatibility
│   │       ├── CLAUDE.md          # Auto-managed (MINIONS injects project memory)
│   │       └── settings.json      # Claude Code settings for this project
├── global/
│   ├── memory/
│   │   ├── preferences.md         # How user likes things done
│   │   └── learnings.md           # Cross-project knowledge
│   ├── skills/                    # Available to all projects
│   ├── personas/                  # Custom minion personas
│   │   └── *.json                 # {name, avatar, prompt_prefix, quirk}
│   └── mcp-servers.json           # Global MCP configurations
└── config.json                    # Theme, defaults, sound settings
```

### 6.2 SQLite Schema

```sql
-- Core tables
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  default_runtime TEXT DEFAULT 'claude-code',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  settings TEXT DEFAULT '{}'             -- JSON: project-level overrides
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task TEXT NOT NULL,
  runtime TEXT NOT NULL,
  status TEXT DEFAULT 'active',          -- active | completed | failed | cancelled
  plan TEXT,                             -- JSON: decomposed plan + roles
  agent_count INTEGER DEFAULT 1,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  tokens_used INTEGER DEFAULT 0,
  cost_estimate REAL DEFAULT 0.0,
  summary TEXT
);

CREATE TABLE minions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  name TEXT NOT NULL,                    -- "Kevin", "Stuart", etc.
  role TEXT,                             -- "researcher", "implementer", "reviewer"
  avatar TEXT NOT NULL,                  -- avatar asset ID
  color TEXT NOT NULL,                   -- hex for UI
  quirk TEXT,                            -- personality text
  runtime TEXT NOT NULL,
  status TEXT DEFAULT 'spawning',        -- spawning | working | waiting | chatting | done | error | sleeping
  spawned_at INTEGER NOT NULL,
  finished_at INTEGER,
  parent_minion_id TEXT REFERENCES minions(id),
  tools_used TEXT DEFAULT '[]'           -- JSON array of tool names used
);

CREATE TABLE memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT REFERENCES projects(id),  -- NULL = global
  category TEXT NOT NULL,                    -- context | decision | learning | preference | fact
  content TEXT NOT NULL,
  source TEXT,                               -- session_id or 'user' or 'system'
  tags TEXT DEFAULT '[]',                    -- JSON array for filtering
  created_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,              -- updated on every read
  relevance_score REAL DEFAULT 1.0           -- decays, boosted on use
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),   -- NULL = global
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  trigger_pattern TEXT,                      -- auto-activate regex
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  args TEXT DEFAULT '[]',
  env TEXT DEFAULT '{}',
  scope TEXT DEFAULT 'global',
  enabled INTEGER DEFAULT 1,
  last_health_check INTEGER
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  minion_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  funny_status TEXT,
  timestamp INTEGER NOT NULL
);

-- Full-text search
CREATE VIRTUAL TABLE memory_fts USING fts5(content, category, tags);
```

### 6.3 Interoperability: How Runtime Switching Works

```
┌─────────────────────────────────────────┐
│          MINIONS Project Layer           │
│  (memory, plans, skills, task history)   │
│  ════════════════════════════════════    │
│  This is the SOURCE OF TRUTH.            │
│  Always engine-agnostic.                 │
└────────┬────────────────────┬────────────┘
         │                    │
    ┌────┴────┐          ┌────┴────┐
    │ Claude  │          │ Codex   │
    │ Code    │          │ CLI     │
    │ Adapter │          │ Adapter │
    └────┬────┘          └────┬────┘
         │                    │
         ▼                    ▼
  Writes CLAUDE.md       Writes workspace
  with injected          config with same
  project memory,        project memory,
  spawns via SDK         spawns via CLI
```

**When deploying minions:**
1. Read project memory (context + decisions + learnings + relevant past sessions)
2. Read relevant skills
3. Build a context payload (runtime-agnostic markdown)
4. Hand to the selected runtime adapter:
   - **Claude Code adapter**: Writes `CLAUDE.md`, calls `query()` with streaming
   - **Codex adapter**: Writes workspace instructions, spawns `codex` subprocess
5. Events flow back through Unified Protocol → frontend renders them identically

**When switching runtimes mid-project:**
- Memory stays untouched (it's in MINIONS' SQLite + markdown)
- Previous session artifacts stay in `sessions/{id}/`
- New sessions just use the new runtime adapter
- Zero migration needed

---

## 7. UI Design — Screen by Screen

### 7.1 Layout Overview

```
┌─────┬───────────────────────────────────────────────┐
│     │  🍌 Task Bar (Cmd+K)                    ⚙️ 🔔 │
│  P  │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│  R  │                                               │
│  O  │  ┌─────────────────────────────────────────┐  │
│  J  │  │                                         │  │
│  E  │  │        MINION THEATER                   │  │
│  C  │  │    (main content area — changes         │  │
│  T  │  │     based on current view)              │  │
│     │  │                                         │  │
│  S  │  │                                         │  │
│  I  │  │                                         │  │
│  D  │  └─────────────────────────────────────────┘  │
│  E  │                                               │
│  B  │  ┌─────────────────────────────────────────┐  │
│  A  │  │  ACTIVITY FEED (collapsible)            │  │
│  R  │  │  Live stream of minion events + chat    │  │
│     │  └─────────────────────────────────────────┘  │
└─────┴───────────────────────────────────────────────┘
```

### 7.2 Project Sidebar (Left)

- List of projects with last activity time
- Each project shows: name, minion count badge, runtime icon (Claude/Codex)
- "New Project" button (folder picker + name)
- Bottom section: Global Skills, Global Memory, Settings
- Cute: idle projects show tiny sleeping minion icons

### 7.3 Minion Theater (Center — Active Session View)

This is the star of the show. When minions are deployed:

```
┌──────────────────────────────────────────────────────────┐
│  TASK: "Research top 5 Notion competitors & write report"│
│  Status: 3 minions deployed · 2m 34s elapsed · ~$0.42   │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  🟡 KEVIN  │  │  🟡 STUART │  │  🟡 BOB    │        │
│  │  Lead &    │  │  Researcher│  │  Report    │        │
│  │  Coord.    │  │            │  │  Writer    │        │
│  │            │  │            │  │            │        │
│  │  [avatar]  │  │  [avatar]  │  │  [avatar]  │        │
│  │  animated  │  │  animated  │  │  animated  │        │
│  │            │  │            │  │            │        │
│  │ "Assigning │  │ "Speed-    │  │ "Waiting   │        │
│  │  tasks to  │  │  reading   │  │  for data  │        │
│  │  the crew" │  │  Coda's    │  │  from      │        │
│  │            │  │  website"  │  │  Stuart... │        │
│  │ ████░░ 40% │  │ ██████ 60%│  │ ░░░░░░ 0%  │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│                                                          │
│  ┌──────── TASK GRAPH ─────────┐                        │
│  │ [Research] ──┐              │                        │
│  │ [Analysis] ──┼──▶ [Report]  │                        │
│  │ [Pricing]  ──┘              │                        │
│  └─────────────────────────────┘                        │
│                                                          │
│  ┌──────── THINKING PANEL (expandable) ────────┐        │
│  │ Kevin: "I need Stuart to research Coda,     │        │
│  │ Notion, Craft, Slite, and Obsidian. Bob can │        │
│  │ start the report template while we wait..."  │        │
│  └──────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

**Each Minion Card shows:**
- Animated avatar (idle, working, thinking, celebrating, error poses)
- Name + role badge
- Funny status text (auto-rotating)
- Progress bar (estimated)
- Expand arrow → shows full live output stream for that minion
- Click → focuses on this minion, shows their detailed terminal-like output

**Task Graph:**
- Visual DAG of task dependencies
- Nodes colored by status: gray (pending), yellow (active), green (done), red (error)
- Animated edges showing data flow between minions
- Click a node → highlights the responsible minion

**Thinking Panel:**
- Shows extended thinking / reasoning from the lead agent
- Collapsible, defaults open for team tasks
- Shows the "why" behind task decomposition

### 7.4 Activity Feed (Bottom)

Real-time scrolling feed of everything happening:

```
[12:03:42] 🟡 Kevin spawned and assigned as Lead
[12:03:43] 🟡 Stuart spawned — role: Researcher
[12:03:43] 🟡 Bob spawned — role: Report Writer
[12:03:45] 📋 Kevin created task list (3 tasks)
[12:03:47] 🔍 Stuart: searching web for "Notion alternatives 2026"
[12:03:52] 📢 Stuart → Kevin: "Found 7 competitors, narrowing to top 5"
[12:04:01] ✍️ Bob: creating report template in /output/report.md
[12:04:15] 🔍 Stuart: fetching pricing pages for Coda, Craft, Slite
[12:04:30] 📢 Stuart → Bob: "Here's the competitor data, ready for you"
[12:04:31] ⌨️ Bob: writing comparison section
[12:05:10] ✅ Stuart completed research task
[12:05:11] 😴 Stuart fell asleep at his desk
[12:06:45] ✅ Bob completed report
[12:06:46] 📋 Kevin reviewing final output...
[12:07:01] 🎉 ALL DONE! Kevin: "The minions have spoken."
```

- Color-coded by minion
- Clickable events (tool calls expand to show details)
- Filter buttons: All | Chat | Tools | Errors
- Inter-minion messages shown as speech bubbles

### 7.5 Visual Editors

#### Skills Editor
- Left panel: list of skills (global + project)
- Right panel: Monaco editor with markdown preview
- Drag-and-drop reordering
- "Test this skill" button → runs a mini-task with the skill active
- Import/export skills as `.md` files

#### Plan Editor
- When MINIONS proposes a plan before deploying:
  - Visual card-based editor
  - Drag to reorder tasks
  - Click to edit agent role, focus area, runtime
  - Add/remove agents
  - Set dependencies between tasks (draw arrows)
  - "Save as template" for reuse

#### CLAUDE.md / Context Editor
- Visual editor for project instructions
- Sections: Project Context, Coding Standards, Architecture Notes, Custom Instructions
- Toggle sections on/off
- Preview what gets injected into agent context
- Diff view: what MINIONS auto-adds vs what user wrote

#### MCP Server Manager
- Cards for each configured MCP server
- Toggle on/off
- Health check indicator (green/yellow/red)
- "Add Server" wizard
- Import from existing `~/.claude.json` or `.mcp.json`
- Shows which tools each server provides

### 7.6 Memory Explorer

```
┌──────────────────────────────────────────────────────────┐
│  🧠 Memory Explorer                    [🔍 Search...]   │
│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                          │
│  Filter: [All] [Context] [Decisions] [Learnings] [Prefs] │
│  Scope:  [This Project] [Global]                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📌 DECISION · Feb 24                              │   │
│  │ "Use PostgreSQL over MongoDB for the user store   │   │
│  │  because we need ACID transactions for billing"   │   │
│  │ Source: Session "Setup database" · Relevance: 0.9 │   │
│  │ [Edit] [Pin] [Delete]                             │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 🧠 LEARNING · Feb 23                              │   │
│  │ "The project uses pnpm, not npm. All install      │   │
│  │  commands should use pnpm."                       │   │
│  │ Source: Session "Fix deps" · Relevance: 0.95      │   │
│  │ [Edit] [Pin] [Delete]                             │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ 📝 CONTEXT · Feb 22                               │   │
│  │ "Main API is Express.js on port 3001. Frontend    │   │
│  │  is Next.js on port 3000. Auth uses Clerk."       │   │
│  │ Source: auto-detected · Relevance: 0.85           │   │
│  │ [Edit] [Pin] [Delete]                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Timeline view: ─●────●──●───●────●──●─── (sessions)   │
│                                                          │
│  [+ Add Memory Manually]  [🍌 Let Minions Learn]        │
└──────────────────────────────────────────────────────────┘
```

**Memory is built automatically:**
- After each session, MINIONS summarizes and extracts:
  - New context discovered about the project
  - Decisions made (and why)
  - Lessons learned (what worked, what didn't)
  - User preferences observed
- Relevance scores decay over time (old memories fade)
- Accessed memories get boosted (frequently useful = high relevance)
- Users can manually add, edit, pin (never decays), or delete memories
- Full-text search across all memory

**Memory injection into agents:**
- Before each task, MINIONS queries relevant memory
- Builds a context section injected into the agent's prompt
- Includes: top N most relevant memories by score + recency + category

### 7.7 Settings Panel

```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                             │
│                                                          │
│  RUNTIMES                                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Claude Code  ✅ Detected v2.1.32               │    │
│  │ Default model: [Opus 4.6 ▾]                     │    │
│  │ Permission mode: [Default ▾]                    │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ Codex CLI    ✅ Detected v1.4.2                │    │
│  │ Default model: [GPT-5.2-Codex ▾]               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  MINION PERSONALITY                                      │
│  [✓] Funny status messages                               │
│  [✓] Sound effects              Volume: [███░░] 60%     │
│  [✓] Avatar animations                                   │
│  [ ] Minion gibberish ambient                            │
│                                                          │
│  MEMORY                                                  │
│  Auto-learn from sessions:  [✓ On]                       │
│  Memory decay rate:         [Normal ▾]                   │
│  Max memories per project:  [500]                        │
│  Max context injection:     [20 memories]                │
│                                                          │
│  TEAM DEFAULTS                                           │
│  Max minions per task:      [6]                          │
│  Auto-deploy for simple:    [✓ Skip plan preview]        │
│  Default runtime:           [Claude Code ▾]              │
│                                                          │
│  ADVANCED                                                │
│  [Export all data]  [Import]  [Reset]                    │
└──────────────────────────────────────────────────────────┘
```

---

## 8. How a Task Flows End-to-End

Here's the complete lifecycle when a user types a task:

```
Step 1: USER INPUT
   User types: "Add authentication to my Express app using Clerk"
   Hits Enter or clicks 🍌 DEPLOY THE MINIONS

Step 2: CONTEXT GATHERING (50ms)
   MINIONS reads:
   - Project memory (context, decisions, learnings)
   - Project skills
   - Recent session summaries
   - File tree snapshot of project directory

Step 3: TASK ANALYSIS (1-3 seconds)
   Quick LLM call (Haiku/mini) classifies:
   → Complexity: TEAM (multi-step, touches routes + middleware + config)
   → Agents needed: 3
   → Roles: Implementer, Tester, Reviewer
   → Runtime: Claude Code (user's default)
   → Estimated time: ~4 minutes

Step 4: PLAN PREVIEW
   Shows plan card with 3 minion roles
   User can edit or just hit Deploy
   If "auto-deploy for simple tasks" is on AND task is simple → skip to Step 5

Step 5: MINION DEPLOYMENT
   - Assigns names + avatars: Kevin (Lead), Stuart (Implementer), Bob (Tester)
   - Creates session in SQLite
   - Builds context payload (project memory + skills + CLAUDE.md)
   - For Claude Code: writes CLAUDE.md, calls Agent SDK query() with:
     - Team prompt describing roles
     - CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
     - Streaming enabled
   - Minions appear in Theater with spawn animations

Step 6: LIVE EXECUTION
   - Events stream in via Unified Protocol
   - Each event updates:
     - Minion card (status, progress, funny message)
     - Activity feed (scrolling log)
     - Task graph (node status changes)
     - Thinking panel (lead's reasoning)
   - File changes detected via watcher → shown in feed
   - Inter-minion messages shown as chat bubbles
   - Permission requests bubble up as modal dialogs

Step 7: COMPLETION
   - All tasks marked done
   - Celebration animation (minions doing a group dance)
   - Summary auto-generated
   - Memory extraction:
     - New context learned about the project
     - Decisions made (e.g., "chose Clerk over Auth0 because...")
     - Learnings (e.g., "Express middleware order matters for Clerk")
   - Session saved with full event log

Step 8: POST-SESSION
   - User can browse artifacts (files created/modified)
   - Diff view of all changes
   - Can "replay" the session (step through events)
   - Memory entries are reviewable/editable
   - Minions go to sleep 😴
```

---

## 9. Implementation Plan for Claude Code

### Phase 1: Foundation (Week 1-2)
**Goal: Tauri app that can spawn one Claude Code agent and stream output**

```
1.1 Scaffold Tauri v2 + React project
    - cargo create-tauri-app with React template
    - Configure for macOS (Universal binary)
    - Setup Tailwind v4 + Framer Motion
    - Setup Zustand store

1.2 Rust backend: Runtime detection
    - Scan PATH for `claude` and `codex` binaries
    - Get versions via `claude --version` / `codex --version`
    - Store in app state
    - Expose via Tauri command: detect_runtimes()

1.3 Rust backend: SQLite setup
    - Embed rusqlite with bundled feature
    - Create all tables from schema (Section 6.2)
    - Expose CRUD Tauri commands for projects, sessions, memory

1.4 Rust backend: Process manager
    - Spawn Claude Code via Agent SDK (TS subprocess)
    - Parse JSONL streaming output
    - Normalize to MinionEvent
    - Emit events to frontend via Tauri event system

1.5 Frontend: Basic shell
    - Left sidebar (project list)
    - Center area (empty state with banana)
    - Task bar (Cmd+K input)
    - Settings panel stub
```

### Phase 2: Single Minion Mode (Week 2-3)
**Goal: Type a task, one minion works on it, see everything live**

```
2.1 Minion card component
    - Avatar (static initially, animated later)
    - Name, role, status
    - Funny status message rotation
    - Progress indicator
    - Expand to show raw output

2.2 Activity feed component
    - Scrolling event list
    - Color-coded by minion
    - Clickable tool calls (expand details)
    - Auto-scroll with "pause on hover"

2.3 File watcher integration
    - Watch project directory via notify crate
    - Show file changes in activity feed
    - Basic diff view for modified files

2.4 Session management
    - Create session on task start
    - Save events to SQLite
    - Session list in sidebar (per project)
    - Session replay (step through events)

2.5 Permission handling
    - When agent requests permission → modal dialog
    - "Always allow" option per tool
    - Map to Claude Code's allowedTools
```

### Phase 3: Multi-Minion Teams (Week 3-4)
**Goal: Auto-deploy agent teams, full Minion Theater**

```
3.1 Task analyzer
    - Fast LLM call for task classification
    - Output: complexity, agent count, roles, dependencies
    - Use Claude Haiku via API (or Claude Code itself in plan mode)

3.2 Plan preview UI
    - Card-based plan editor
    - Add/remove agents
    - Edit roles and focus areas
    - Draw dependency arrows
    - Save plan as template

3.3 Multi-agent deployment
    - Claude Code: use AGENT_TEAMS env var + team prompts
    - Spawn lead agent with team instructions
    - Track teammate spawning events
    - Map each teammate to a Minion card

3.4 Minion Theater (full version)
    - Grid of minion cards (responsive, 1-6 agents)
    - Task dependency graph (D3.js or React Flow)
    - Inter-minion chat bubbles
    - Thinking panel for lead agent
    - Global progress bar

3.5 Codex adapter (basic)
    - Spawn codex CLI subprocess
    - Parse output to MinionEvent format
    - Single agent only first
    - Verify interop (same project, different runtime)
```

### Phase 4: Memory & Intelligence (Week 4-5)
**Goal: Persistent memory, auto-learning, context injection**

```
4.1 Memory system
    - Post-session extraction (LLM call to summarize + categorize)
    - Auto-categorize: context, decision, learning, preference
    - Relevance scoring + decay
    - FTS search via SQLite FTS5
    - Pin/edit/delete UI

4.2 Memory Explorer UI
    - Browse by category, project, timeline
    - Search with instant results
    - Edit inline
    - Pin important memories
    - Visual timeline of sessions + memories

4.3 Context injection
    - Before each task: query relevant memories
    - Build context payload: top N by relevance + recency
    - Inject into CLAUDE.md / agent prompt
    - Show "context provided" in UI (what memories were used)

4.4 Auto-learning settings
    - Toggle per project
    - Memory limits (max per project)
    - Decay rate configuration
    - Manual memory addition
```

### Phase 5: Visual Editors & Polish (Week 5-6)
**Goal: Skills editor, MCP manager, CLAUDE.md editor, animations**

```
5.1 Skills editor
    - Monaco editor integration
    - Markdown preview
    - Skill list (global + project)
    - Create / edit / delete / import / export
    - "Test skill" quick action

5.2 MCP server manager
    - Card grid of servers
    - Add / configure / toggle / health check
    - Import from ~/.claude.json
    - Show available tools per server

5.3 CLAUDE.md visual editor
    - Section-based editing
    - Toggle sections on/off
    - Preview injected context
    - Auto-sync with MINIONS memory

5.4 Avatar animations
    - Lottie or Rive animated minion characters
    - States: idle, thinking, working, celebrating, error, sleeping
    - Each avatar has unique accessories
    - Smooth transitions between states

5.5 Sound design
    - Spawn sound, typing sound, completion jingle
    - Error crash sound
    - Toggle in settings
    - Volume control

5.6 Polish & empty states
    - All funny copy (loading, empty, error states)
    - Keyboard shortcuts (Cmd+K task bar, Cmd+1-9 projects, etc.)
    - Dark/light theme with yellow minion accent
    - App icon: a yellow blob with sunglasses
```

### Phase 6: Codex Full Support & Interop (Week 6-7)
**Goal: Full Codex integration, runtime switching, templates**

```
6.1 Codex multi-agent
    - Parse Codex team/parallel output
    - Map to MinionEvent stream
    - Same Theater UI

6.2 Runtime switching
    - Per-task runtime picker in plan preview
    - Mid-project switch (new session, same memory)
    - Runtime comparison view (same task, both engines)

6.3 Task templates
    - Save plans as reusable templates
    - Template library (built-in + custom)
    - "Research report", "Code review", "Bug investigation", etc.
    - Share templates as JSON files

6.4 Session comparison
    - Side-by-side two sessions
    - Diff artifacts between sessions
    - Useful for comparing runtimes or approaches
```

### Phase 7: Distribution & Sharing (Week 7-8)
**Goal: Ship it, make it shareable**

```
7.1 macOS distribution
    - Signed + notarized .dmg
    - Auto-updater (Tauri built-in)
    - Homebrew cask formula

7.2 Shareable session replays
    - Export session as animated GIF / video
    - Shareable HTML replay (static, no app needed)
    - "Share to X" with auto-generated screenshot

7.3 Landing page (minions.dev)
    - Hero: animated minions doing a task
    - Demo video
    - Download button
    - GitHub star button
    - "Made with 🍌" footer

7.4 Open source prep
    - Clean up repo
    - Write README with GIFs
    - Contributing guide
    - License (MIT)
```

---

## 10. File & Folder Structure for the Codebase

```
minions/
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   ├── lib.rs                # Module exports
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs         # SQLite table creation
│   │   │   ├── projects.rs       # Project CRUD
│   │   │   ├── sessions.rs       # Session CRUD
│   │   │   ├── memory.rs         # Memory CRUD + FTS
│   │   │   ├── skills.rs         # Skills CRUD
│   │   │   └── events.rs         # Event log append + query
│   │   ├── agents/
│   │   │   ├── mod.rs
│   │   │   ├── runtime.rs        # Runtime detection (claude/codex in PATH)
│   │   │   ├── claude_adapter.rs # Claude Code Agent SDK bridge
│   │   │   ├── codex_adapter.rs  # Codex CLI subprocess bridge
│   │   │   ├── protocol.rs       # MinionEvent unified type
│   │   │   └── process.rs        # Process spawn/monitor/kill
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── projects.rs       # Tauri commands for project ops
│   │   │   ├── sessions.rs       # Tauri commands for sessions
│   │   │   ├── agents.rs         # Tauri commands for agent control
│   │   │   ├── memory.rs         # Tauri commands for memory
│   │   │   └── settings.rs       # Tauri commands for config
│   │   ├── watcher.rs            # File system watcher
│   │   └── config.rs             # App config management
│   └── icons/                    # App icons
│
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root layout
│   ├── stores/
│   │   ├── app.ts                # Global app state (Zustand)
│   │   ├── project.ts            # Active project state
│   │   ├── session.ts            # Active session + events
│   │   └── ui.ts                 # UI state (panels, modals)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TaskBar.tsx       # Cmd+K command input
│   │   │   ├── TopBar.tsx
│   │   │   └── Shell.tsx
│   │   ├── theater/
│   │   │   ├── MinionTheater.tsx # Main agent display grid
│   │   │   ├── MinionCard.tsx    # Individual minion card
│   │   │   ├── MinionAvatar.tsx  # Animated avatar component
│   │   │   ├── TaskGraph.tsx     # Dependency graph
│   │   │   ├── ThinkingPanel.tsx # Lead agent thinking view
│   │   │   └── ChatBubble.tsx    # Inter-minion messages
│   │   ├── feed/
│   │   │   ├── ActivityFeed.tsx  # Scrolling event log
│   │   │   ├── EventRow.tsx      # Single event display
│   │   │   └── FeedFilters.tsx   # Filter buttons
│   │   ├── editors/
│   │   │   ├── SkillEditor.tsx
│   │   │   ├── PlanEditor.tsx
│   │   │   ├── ContextEditor.tsx # CLAUDE.md editor
│   │   │   └── McpManager.tsx    # MCP server cards
│   │   ├── memory/
│   │   │   ├── MemoryExplorer.tsx
│   │   │   ├── MemoryCard.tsx
│   │   │   ├── MemoryTimeline.tsx
│   │   │   └── MemorySearch.tsx
│   │   ├── project/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── NewProject.tsx
│   │   │   └── SessionList.tsx
│   │   ├── settings/
│   │   │   ├── Settings.tsx
│   │   │   ├── RuntimeConfig.tsx
│   │   │   ├── PersonalityConfig.tsx
│   │   │   └── MemoryConfig.tsx
│   │   └── shared/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── EmptyState.tsx    # With funny messages
│   │       ├── DeployButton.tsx  # The 🍌 DEPLOY THE MINIONS button
│   │       └── FunnyStatus.tsx   # Status message generator
│   ├── lib/
│   │   ├── tauri.ts              # Tauri IPC wrappers
│   │   ├── events.ts             # Event stream subscription
│   │   ├── minion-names.ts       # Name + quirk + status message pools
│   │   ├── avatars.ts            # Avatar asset mapping
│   │   └── sounds.ts             # Sound effect player
│   ├── hooks/
│   │   ├── useMinions.ts         # Active minion state
│   │   ├── useEvents.ts          # Event stream subscription
│   │   ├── useMemory.ts          # Memory queries
│   │   └── useProject.ts         # Active project
│   ├── types/
│   │   ├── minion.ts             # MinionEvent, Minion, etc.
│   │   ├── project.ts
│   │   ├── memory.ts
│   │   └── session.ts
│   └── assets/
│       ├── avatars/              # Minion avatar images/animations
│       ├── sounds/               # Sound effect files
│       └── icons/                # UI icons
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── README.md                     # With lots of GIFs 🍌
```

---

## 11. Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Tauri v2 (not Electron) | 10MB vs 200MB+, native feel, Rust perf for process mgmt |
| DB | SQLite (not files-only) | FTS search, relational queries, single-file portability |
| Agent SDK | TypeScript SDK (not CLI wrapping) | Structured streaming, tool callbacks, subagent control |
| State | Zustand (not Redux) | Minimal boilerplate, subscribe to slices, good with streaming |
| Animations | Framer Motion + Lottie/Rive | Smooth, GPU-accelerated, minion personality needs animation |
| Memory format | SQLite + markdown files | SQLite for queries/search, markdown for human-readability + agent injection |
| Inter-runtime | Unified Protocol Adapter | Never expose runtime details to frontend, clean abstraction |
| Auto-team | Fast classifier LLM call | Sub-second decision on solo vs team, no user friction |
| Avatars | Pre-built set (12-15) with randomization | Fast to ship, consistent look, expandable later |

---

## 12. Name & Branding Notes

- **Domain:** minions.dev (check availability)
- **GitHub:** github.com/minions-dev/minions (or similar)
- **App icon:** Yellow blob character with sunglasses, holding a wrench
- **Color palette:** Yellow (#FFD93D) primary, dark navy (#1A1A2E) background, white text
- **Font:** Inter (UI) + JetBrains Mono (code/terminal)
- **Legal note:** "Minions" is trademarked by Universal/Illumination for the movie franchise. For the actual product, consider variations: **MinionHQ**, **MyMinions**, **Minion.dev**, **DeployMinions**, or **Bananions** (portmanteau of banana + minions). The playful chaos brand works with any of these.

---

## 13. Success Metrics for v1.0

- [ ] macOS .dmg ships and installs cleanly
- [ ] Detects Claude Code + Codex on first launch
- [ ] Single-minion task works end-to-end with live streaming
- [ ] Multi-minion team (3+ agents) works with task graph
- [ ] Memory persists across sessions and improves context
- [ ] Skills and CLAUDE.md are visually editable
- [ ] At least 5 funny status messages per minion state
- [ ] Session replay works
- [ ] README has at least 3 GIFs showing minions in action
- [ ] Someone screenshots the app and posts it on X without being asked

---

*Built with 🍌 by the MINIONS contributors.*
