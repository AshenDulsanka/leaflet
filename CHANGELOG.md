# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- SQLite DB connection is now reloaded after `git pull` so the app reads updated data without a server restart ([#5](https://github.com/AshenDulsanka/leaflet/issues/5))

### Added

- Auto-manage `.gitkeep` for empty workspace folders — placeholder is written on directory creation and removed when the first note is saved ([#6](https://github.com/AshenDulsanka/leaflet/issues/6))
- Floating pill notification system replaces inline sync status — success/warning/error pills appear bottom-right with 4 s auto-dismiss and a draining progress bar ([#7](https://github.com/AshenDulsanka/leaflet/issues/7))
- Sidebar and workspace tree reload automatically after a successful `git pull` with no manual page refresh required ([#8](https://github.com/AshenDulsanka/leaflet/issues/8))
- GitHub Actions CI pipeline: `pnpm check` → `pnpm lint` → `pnpm build` → `pnpm test` on every PR to `main` and push to `development` ([#9](https://github.com/AshenDulsanka/leaflet/issues/9))
- Vitest unit test suite covering path-safety helpers, notes directory resolution, DB singleton lifecycle, WAL checkpoint, and connection reload

## [0.1.0] - 2026-04-08

### Added
- WYSIWYG editor (Milkdown) with source mode toggle (CodeMirror)
- LaTeX math rendering (inline and block)
- Syntax-highlighted code blocks
- Auto-save with 1.5 second debounce
- Full-text search across all notes
- Wiki-style `[[links]]` with backlinks panel
- Note graph visualization (force-directed canvas)
- Image upload, alignment, and lightbox
- Export to Markdown, HTML, and PDF
- Workspace isolation with `pentest` and `general` workspace types; `pentest` unlocks the engagement toolbar
- CTF workspace tools: host tracker, credential vault, flag tracker, attack chain visualizer, command snippets, report generator
- AI chat and summarize (Google Gemini default, MiniMax optional)
- Git-based sync button (push/pull) with inline status messages
- Default Workspace created on first run
- Pinned notes scoped per workspace
- Docker setup for development and production

### Fixed
- Sync API now detects the Git repo root instead of checking the data directory directly
- Git cross-filesystem boundary discovery enabled so the repo root is found correctly inside Docker
- SSL certificates, Git identity env vars, and GitHub token auth added to Docker sync environment
- Double workspace-prefix prevented when creating notes in subfolders
- `general` set as the correct default workspace type in the workspaces API
- `better-sqlite3` native binding now builds correctly with pnpm 10+
- `@const` removed from `#if` block to resolve `svelte-check` chunk-split error
- `.git` directory mounted in Docker and `git add` scoped to the `data/` directory only
- Light theme warm off-white background (`#f0eee6`) applied correctly
- Warm palette extended to `secondary`, `muted`, `accent`, `border`, and `input` tokens in light theme
- Theme toggle animation duration increased to 600 ms
- Code quality pass: ESLint and `svelte-check` corrections applied
