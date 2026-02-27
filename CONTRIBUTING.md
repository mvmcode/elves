# Contributing to ELVES

Thanks for wanting to help build the workshop! Here's everything you need to get started.

## Prerequisites

- **macOS 13+** (Ventura or later)
- **Rust 1.75+** (install via [rustup](https://rustup.rs))
- **Node.js 18+**
- **Tauri v2 CLI** — `cargo install tauri-cli`

## Setup

```bash
git clone https://github.com/mvmcode/elves.git
cd elves
npm install
cargo tauri dev
```

## Project Structure

```
src/                → React 19 + TypeScript frontend
src-tauri/src/      → Rust backend (SQLite, process management, adapters)
```

Key architecture:
- **Unified Agent Protocol** — Claude Code and Codex events normalized into `ElfEvent`
- **Zustand stores** — 9 domain stores (app, project, session, ui, memory, settings, skills, mcp, templates)
- **Tauri IPC** — `tauri::command` for request/response, `app.emit()` for streaming

## Testing

```bash
# Frontend (418 tests)
npx vitest run

# Backend (40+ tests)
cd src-tauri && cargo test

# Type checking
npx tsc --noEmit
```

## Code Style

### TypeScript
- Strict mode — no `any`, no implicit returns
- Explicit parameter and return types on all functions
- No unused imports or variables

### Rust
- `cargo clippy` — no warnings
- `cargo fmt` — consistent formatting

### Design
- Neo-brutalist: 3px black borders, 6px hard shadows (`box-shadow: 6px 6px 0px 0px #000`), `#FFD93D` yellow
- Fonts: Space Grotesk (headlines), Inter (body), JetBrains Mono (code)
- No gradients, no blur shadows, no rounded-everything

## Commit Format

```
type(scope): description
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples:
- `feat(theater): add ElfCard component with avatar and status display`
- `fix(memory): prevent decay on pinned memories`
- `test(mcp): add integration tests for health check command`

## Pull Request Process

1. **Fork** the repository
2. **Branch** from `main` — `feat/your-feature` or `fix/your-fix`
3. **Implement** your changes
4. **Test** — all tests must pass (`npx vitest run`, `cargo test`, `npx tsc --noEmit`)
5. **PR** against `main` with a clear description

## What to Know Before Contributing

- Read [`CLAUDE.md`](CLAUDE.md) for detailed engineering standards
- Read [`DECISIONS.md`](DECISIONS.md) for architectural context
- Read [`VISION.md`](VISION.md) for the full product vision
- Every new component gets a test. No exceptions.
- Every new Tauri command gets an integration test.
- Update `DECISIONS.md` if you make an architectural choice.
