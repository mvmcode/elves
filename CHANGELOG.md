# Changelog

All notable changes to ELVES are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
