# Agent Guidelines

This file defines how AI coding agents (GitHub Copilot, Claude Code, etc.) should approach this repository.

## Read First

Before writing any code, read these files in order:

1. `.github/skills/coding-standards/SKILL.md` — TypeScript, Svelte 5, and general code conventions
2. `.github/skills/commit-conventions/SKILL.md` — commit message format and scope list
3. `.github/skills/architecture/SKILL.md` — folder structure, data flow, design decisions
4. `.github/skills/branch-conventions/SKILL.md` — branch naming rules and lifecycle
5. `.github/skills/pr-standards/SKILL.md` — pull request format and review requirements
6. `docs/SECURITY.md` — path traversal prevention, secret management, input validation

## What Is Leaflet

Leaflet is a self-hosted markdown note-taking app. Notes are `.md` files on disk. Structured metadata (workspaces, hosts, credentials, flags) is stored in a local SQLite database (`data/notes.db`). Git is the sync mechanism between devices.

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
| Icons | @lucide/svelte (zero emojis) |
| Package Manager | pnpm |
| Runtime | Node.js 22 LTS |

## Project Terminology

| Term | Meaning |
|------|---------|
| Workspace | An isolated context for notes. Can be `general` or `ctf`. |
| CTF Workspace | Unlocks engagement tools: host tracker, credential vault, flag tracker, attack chain. |
| General Workspace | Standard note-taking without engagement panels. |
| Notes Folder | Each workspace maps to a subfolder in `data/notes/`. |
| Default Workspace | Auto-created on first run so the user always starts in a valid context. |

## Folder Structure

```
leaflet/
  src/
    lib/
      components/
        editor/       - Milkdown, CodeMirror, ImageToolbar, Lightbox, FindPanel
        layout/       - Sidebar, FileTree, StatusBar, Toolbar, SyncButton
        panels/       - SearchPanel, AiChat, Backlinks, Screenshots, Export, NoteGraph
        engagement/   - HostTracker, CredentialVault, FlagTracker, AttackChain
        modals/       - HelpModal, ExportModal, CommandPalette, SettingsModal
      data/           - commands.ts, methodology.ts, sync-messages.ts
      server/         - database.ts, migrations.ts, notes.ts, screenshots.ts, ai.ts
    routes/
      [...path]/      - main editor page
      api/            - notes, workspaces, screenshots, ai, sync endpoints
  data/
    notes.db          - SQLite database (committed via Git)
    notes/            - markdown files organized by workspace folder
    screenshots/      - uploaded screenshots (synced via git)
```

## What Agents Must Do

- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`). No Svelte 4 syntax.
- Use Lucide icons from `@lucide/svelte`. No emojis anywhere — not in code, data, seed files, comments, or UI strings. When an icon identifier is needed in data or database records, use the Lucide icon name as a string (e.g., `'notebook-pen'`, `'circle-alert'`).
- Use `better-sqlite3` synchronously. No async DB calls.
- Validate all file paths with `safePath()` before any `fs` operation (see `docs/SECURITY.md`).
- Follow `.github/skills/coding-standards/SKILL.md` for naming, imports, error handling.
- Follow `.github/skills/commit-conventions/SKILL.md` for all commit messages.
- Follow `.github/skills/branch-conventions/SKILL.md` for branch naming.
- Follow `.github/skills/pr-standards/SKILL.md` when opening pull requests.

## What Agents Must Not Do

- Do not install React, Vue, Angular, or Radix UI packages.
- Do not use `any` types without a comment explaining why.
- Do not hardcode file paths. Use environment variables with documented fallbacks.
- Do not commit `.env` files or WAL temp files.

## Agent Task Workflow

1. Check if a GitHub issue exists for the task. If not, note that one should be created.
2. Read the skill files listed in **Read First** before making changes.
3. Search for existing similar code before writing new code.
4. Write the implementation following all **What Agents Must Do** rules.
5. Run `pnpm check` and `pnpm lint` mentally to verify no TypeScript or lint errors.
6. Update `CHANGELOG.md` under `[Unreleased]` with a concise entry for every change made.
- Do not leave dead code, unused imports, or commented-out blocks.

## Orchestration Pipeline

For complex features, bug fixes, or multi-file changes, use the 8-agent orchestration pipeline in `.github/agents/`. Invoke `@Orchestrator` as your entry point — it will break the work into phases, delegate to specialist agents, and report results.

| Agent | Role |
|-------|------|
| **Orchestrator** | Brain — classifies request, plans phases, delegates, gates on quality |
| **Planner** | Researches codebase and produces ordered implementation steps |
| **Coder** | Implements TypeScript, SvelteKit routes, server-side logic |
| **Designer** | Writes Svelte 5 components and Tailwind UI |
| **Code Reviewer** | Audits code quality against coding-standards/SKILL.md |
| **Security Auditor** | Audits for path traversal, SQL injection, XSS, and secret leaks |
| **Test Writer** | Writes Vitest unit tests for `src/lib/server/` |
| **Docs Updater** | Updates CHANGELOG.md, AGENTS.md, README.md |

**Standard pipeline:** Planner → Coder + Designer (parallel) → Code Reviewer + Security Auditor (parallel) → Test Writer + Docs Updater (parallel)

## Running the App

```bash
# Local development
pnpm install
pnpm dev

# Docker development
docker compose -f docker-compose.dev.yaml up --watch

# Type check
pnpm check

# Lint
pnpm lint
```
