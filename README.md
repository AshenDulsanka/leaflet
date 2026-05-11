# Leaflet

A self-hosted markdown note-taking app for general use and for CTF and penetration testing engagements.

## About

Leaflet was created to capture notes from the HackTheBox CPTS (Certified Penetration Testing Specialist) course. The app was inspired by **Obsidian** and **Cherry Tree** (an open-source hierarchical note-taking tool), but I decided to build my own to:

1. Add features tailored to **pentest/CTF workflows** — Host tracker, credential vault, flag tracker, and attack chain visualizer
2. Keep notes as **plain `.md` files** — maximizing portability and Git-friendly sync
3. Support **both general and pentest modes** via workspace selection, since the app proved useful for everyday note-taking too

Leaflet combines a rich WYSIWYG editor with engagement-specific tools that activate when a workspace is marked as CTF-related. Notes are plain `.md` files on disk — Git is the sync mechanism between devices. No cloud. No lock-in.

### Learning Projects

This project also serves as a reference for **agent orchestration** and open-source project structure — featuring an 8-agent AI engineering pipeline (orchestrator, planner, coder, designer, code-reviewer, security-auditor, test-writer, docs-updater) with structured output formats, context-passing protocols, and skills-based code generation.

## Features

**Core**
- WYSIWYG editor (Milkdown) with source mode toggle (CodeMirror)
- LaTeX math rendering (inline `$...$` and block `$$...$$`)
- Syntax-highlighted code blocks
- Auto-save (1.5 second debounce)
- Full-text search across all notes
- Wiki-style `[[links]]` between notes
- Backlinks panel
- Note graph visualization (force-directed)
- Image upload, alignment, and lightbox
- Export to Markdown, HTML, and PDF

**Workspaces**
- Isolated workspaces — each with its own note tree
- Pentest workspaces are the default creation type
- General workspaces remain available for everyday notes
- Pentest workspaces unlock the engagement tools; the optional **CPTS preset** additionally enables the methodology checklist
- Workspace order can be rearranged by drag and drop; right-click a workspace for rename/delete

**Templates and Workflow**
- Command Palette templates insert raw Markdown snippets into the current note
- Global templates are always available; workspace templates appear when that workspace is active
- Methodology checklist is available only in pentest workspaces with the CPTS preset enabled
- Destructive panel actions use confirmation dialogs

**CTF and Pentest Tools** (pentest workspaces only)
- Host tracker with port management (initial port entry and screenshot association on add)
- Credential vault
- Flag tracker
- Attack chain visualizer
- Command snippets with variable substitution
- Operation log, findings tracker, network topology, and CVSS calculator
- Add forms open as centered modal dialogs by default (toggle to inline mode in Settings)

**AI Integration** (optional)
- AI chat assistant with current note as context
- Note summarization
- Google Gemini (default) or MiniMax provider

**Sync**
- One-click git push and pull
- Persistent sync badge with recommendation-driven pull/push actions and stale/error states
- Status refresh on load, window focus, and after pull/push actions

## Screenshots

<!-- TODO: add screenshots after UI is stable -->

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit 5 (adapter-node) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Editor (WYSIWYG) | Milkdown (@milkdown/crepe) |
| Editor (Source) | CodeMirror 6 (svelte-codemirror-editor) |
| Math | @milkdown/plugin-math + KaTeX |
| Database | SQLite via better-sqlite3 |
| ORM | drizzle-orm (better-sqlite3 dialect, synchronous) |
| Icons | @lucide/svelte |
| Package Manager | pnpm |
| Runtime | Node.js 22 LTS |

## Quick Start (Docker - Recommended)

Requires: Docker Desktop, Git.

```bash
git clone https://github.com/AshenDulsanka/leaflet.git
cd leaflet
cp .env.example .env
# Edit .env to set AI API keys (optional)
docker compose -f docker-compose.dev.yml up --watch
```

App runs at http://localhost:5173.

## Quick Start (Local)

Requires: Node.js 22+, pnpm 9+.

```bash
git clone https://github.com/AshenDulsanka/leaflet.git
cd leaflet
cp .env.example .env
pnpm install
pnpm dev
```

Optional database tooling:

```bash
pnpm db:generate   # regenerate Drizzle migration files from schema
pnpm db:studio     # open Drizzle Studio (visual DB browser)
```

## Production

```bash
docker compose build
docker compose up -d
```

App runs at http://localhost:3000.

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NOTES_DATA_DIR` | No | `./data` | Directory for database and notes |
| `NOTES_DIR` | No | `./data/notes` | Directory for `.md` note files |
| `SCREENSHOTS_DIR` | No | `./data/screenshots` | Directory for uploaded screenshots |
| `PORT` | No | `3000` (prod) / `5173` (dev) | Server port |
| `AI_PROVIDER` | No | `gemini` | AI provider: `gemini` or `minimax` |
| `GEMINI_API_KEY` | No | - | Google Gemini API key (enables AI features) |
| `MINIMAX_API_KEY` | No | - | MiniMax API key (alternative provider) |

AI features are silently disabled when no API key is configured.

## Syncing Between Devices

Notes are `.md` files in `data/notes/`. The database (`data/notes.db`) stores workspace and engagement metadata. Both are tracked by Git.

Use the Sync button in the app toolbar, or manually:

Toolbar sync behavior:

- Calls `POST /api/sync` with `action: status | pull | push`
- Keeps a persistent badge (In Sync, Pull N, Push N, Diverged, Ready to Push, Stale Status)
- Enables pull/push buttons from server recommendation and ahead/behind counts
- Reuses the notification pill system for start/success/info/error feedback

```bash
# On device A (after working)
git add data/
git commit -m "chore: sync notes after session"
git push

# On device B (before working)
git pull
```

## Documentation

| File | Contents |
|------|----------|
| `AGENTS.md` | 8-agent orchestration pipeline and AI coding agent guidelines |
| `docs/ARCHITECTURE.md` | Workspace model, runtime data flow, storage layout, sync design |
| `docs/API.md` | API route contracts, validation rules, templates, screenshots |
| `docs/COMPONENTS.md` | Component inventory and visible UI surfaces |
| `docs/ENGAGEMENT_TOOLS.md` | Host tracker, credential vault, flag tracker, findings, topology |
| `docs/FEATURES.md` | End-user feature guide and UX conventions |
| `docs/SECURITY.md` | Path traversal, validation, and secret-handling rules |
| `.github/skills/architecture/SKILL.md` | Data flow, folder structure, design decisions |
| `.github/skills/coding-standards/SKILL.md` | Code conventions for contributors and AI agents |
| `.github/skills/commit-conventions/SKILL.md` | Commit message format and examples |
| `.github/skills/branch-conventions/SKILL.md` | Branch naming rules |
| `.github/skills/pr-standards/SKILL.md` | Pull request requirements |
| `.github/agents/` | 8 specialized agents (orchestrator, planner, coder, designer, code-reviewer, security-auditor, test-writer, docs-updater) |
| `CONTRIBUTING.md` | How to contribute |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).


## License

[MIT](LICENSE)
