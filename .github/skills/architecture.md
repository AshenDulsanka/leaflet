# Architecture Overview

## What Is Leaflet

Leaflet is a self-hosted markdown note-taking application built for general use and for CTF and penetration testing engagements. It combines a rich WYSIWYG editor with engagement-specific tools (host tracker, credential vault, flag tracker, attack chain visualizer, report generator) that activate when a workspace is marked as CTF-related.

Notes are `.md` files on disk — Git is the sync mechanism between devices. Structured engagement data (workspaces, hosts, credentials, flags) is stored in a local SQLite database.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│                                                             │
│  ┌──────────┐  ┌────────────────────────────────────────┐  │
│  │ Sidebar  │  │              Editor Panel               │  │
│  │          │  │   (Milkdown WYSIWYG / CodeMirror src)   │  │
│  │ Workspace│  │                                         │  │
│  │ selector │  ├────────────────────────────────────────┤  │
│  │          │  │          Engagement Panels              │  │
│  │ File     │  │  (Hosts / Creds / Flags / Attack Chain) │  │
│  │ Tree     │  └────────────────────────────────────────┘  │
│  │          │                                               │
│  │ Pinned   │  ┌────────────────────────────────────────┐  │
│  │ Notes    │  │          Utility Panels                 │  │
│  └──────────┘  │   (Search / Backlinks / AI / Export)   │  │
│                └────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch (JSON / SSE)
┌──────────────────────────▼──────────────────────────────────┐
│                   SvelteKit Server (Node)                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               API Routes (/api/*)                    │  │
│  │  /api/notes/[...path]   – CRUD for .md files         │  │
│  │  /api/notes/tree        – directory tree             │  │
│  │  /api/notes/search      – full-text search           │  │
│  │  /api/workspaces/[id]   – workspace CRUD             │  │
│  │  /api/workspaces/[id]/hosts, creds, flags, nodes...  │  │
│  │  /api/ai/chat           – streaming AI chat (SSE)    │  │
│  │  /api/ai/summarize      – note summarization         │  │
│  │  /api/ai/status         – provider availability      │  │
│  │  /api/sync/status       – git status                 │  │
│  │  /api/sync/push         – git add+commit+push        │  │
│  │  /api/sync/pull         – git pull                   │  │
│  └────────┬──────────────────────────┬───────────────┘  │  │
│           │                          │                      │
│  ┌────────▼──────────┐   ┌───────────▼────────────────┐   │
│  │   File System     │   │     SQLite (notes.db)       │   │
│  │                   │   │                             │   │
│  │  data/            │   │  workspaces                 │   │
│  │  ├── notes.db     │   │  hosts / ports              │   │
│  │  ├── default/     │   │  credentials                │   │
│  │  │   ├── note.md  │   │  flags                      │   │
│  │  ├── workspace-a/ │   │  attack_chain_nodes/edges   │   │
│  │  │   └── note.md  │   │  command_snippets           │   │
│  │  └── screenshots/ │   │  screenshot_metadata        │   │
│  └───────────────────┘   └─────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │              External AI Providers                 │    │
│  │  Google Gemini (default) / MiniMax (optional)      │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
leaflet/
├── src/
│   ├── app.css              – global styles and Tailwind base
│   ├── app.html             – HTML shell
│   ├── app.d.ts             – SvelteKit ambient type declarations
│   ├── hooks.server.ts      – injects db singleton into event.locals
│   ├── lib/
│   │   ├── types.ts         – shared TypeScript interfaces
│   │   ├── theme.svelte.ts  – dark/light theme state (Svelte 5 rune)
│   │   ├── components/
│   │   │   ├── editor/      – Milkdown, CodeMirror, ImageToolbar, Lightbox
│   │   │   ├── layout/      – Sidebar, FileTree, StatusBar, SyncButton
│   │   │   ├── panels/      – SearchPanel, AiChat, Backlinks, Screenshot, Export, NoteGraph
│   │   │   ├── engagement/  – HostTracker, CredentialVault, FlagTracker, AttackChain, ReportGenerator
│   │   │   └── modals/      – HelpModal, ExportModal, NewNoteModal
│   │   ├── data/
│   │   │   ├── commands.ts      – 50+ command snippet templates
│   │   │   ├── methodology.ts   – pentest methodology checklist
│   │   │   └── sync-messages.ts – funny auto-commit messages
│   │   └── server/
│   │       ├── database.ts  – SQLite singleton, WAL config, migrations
│   │       ├── migrations.ts – schema versioning (v1, v2, v3)
│   │       ├── notes.ts     – file I/O: safePath, readTree, writeNote, etc.
│   │       ├── screenshots.ts – screenshot file management
│   │       └── ai.ts        – Gemini and MiniMax provider abstraction
│   └── routes/
│       ├── +layout.svelte        – root layout, theme init
│       ├── [...path]/
│       │   ├── +page.svelte      – main editor UI (client-side only)
│       │   └── +page.ts          – ssr: false, prerender: false
│       └── api/
│           ├── notes/
│           │   ├── [...path]/+server.ts – note CRUD
│           │   ├── tree/+server.ts      – directory tree
│           │   ├── search/+server.ts    – full-text search
│           │   └── graph/+server.ts     – wikilink graph data
│           ├── workspaces/
│           │   ├── +server.ts           – list and create workspaces
│           │   └── [id]/
│           │       ├── +server.ts       – single workspace CRUD
│           │       ├── hosts/+server.ts
│           │       ├── credentials/+server.ts
│           │       ├── flags/+server.ts
│           │       ├── nodes/+server.ts
│           │       └── edges/+server.ts
│           ├── screenshots/+server.ts
│           ├── ai/
│           │   ├── chat/+server.ts
│           │   ├── summarize/+server.ts
│           │   └── status/+server.ts
│           └── sync/
│               ├── status/+server.ts
│               ├── push/+server.ts
│               └── pull/+server.ts
├── data/                    – gitignored runtime data (created on first run)
│   ├── notes.db             – SQLite database (committed; WAL files are not)
│   ├── default/             – notes folder for Default Workspace
│   ├── templates/           – read-only note templates
│   └── screenshots/         – uploaded screenshots (gitignored)
├── static/                  – static assets
├── Dockerfile               – production multi-stage build
├── Dockerfile.dev           – development image with hot reload
├── docker-compose.yml       – production compose (port 3000)
├── docker-compose.dev.yml   – development compose with watch (port 5173)
├── .env.example             – documented environment variable reference
└── .github/
    ├── skills/              – this directory
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md
```

## Data Flow: User Writes a Note

```
1. User types in editor (Milkdown)
         │
2. 1.5s debounce fires
         │
3. PUT /api/notes/{path}
   Body: { content: "# heading\n..." }
         │
4. +server.ts handler
   ├── safePath() validates path stays within NOTES_DIR
   ├── Checks .md extension
   └── writeNote(path, content)  ← notes.ts
         │
5. fs.writeFile(resolvedPath, content, 'utf-8')
         │
6. File saved to data/{workspace_folder}/{filename}.md
         │
7. Response: 200 OK
         │
8. isDirty = false in editor state
```

## Data Flow: User Opens a Workspace

```
1. User selects workspace from dropdown (Sidebar.svelte)
         │
2. activeWorkspace = selected workspace
   localStorage.setItem('notes-active-workspace-v1', id)
         │
3. GET /api/notes/tree?base={notes_folder}
         │
4. Server: readTree(NOTES_DIR/{notes_folder})
   Returns: FileNode[] (folders first, .md files only)
         │
5. File tree renders with workspace-scoped files
         │
6. Pinned notes reload from localStorage key
   'notes-pinned-v1-{workspaceId}'
```

## SQLite and WAL Mode

The database uses WAL (Write-Ahead Logging) journal mode for better read performance during concurrent web server operation. WAL writes go to a `.db-wal` file first, then checkpoint into the main `.db` file.

**Important for Git sync:** The `.db-wal` file is gitignored. Before committing the database file, the sync feature runs `PRAGMA wal_checkpoint(TRUNCATE)` to flush all pending writes into the main `.db` file. This ensures the committed `.db` file contains all data.

```
Normal write:  PUT /api/notes → writeFile → disk
Normal DB write:  INSERT → notes.db-wal (fast)
                           ↓ (checkpoint)
                         notes.db (persisted)

Git sync push:  wal_checkpoint → git add . → git commit → git push
Git sync pull:  git pull → app reloads from disk
```

## Docker Setup

Two configurations:

| Config | File | Port | Purpose |
|--------|------|------|---------|
| Development | `docker-compose.dev.yml` | 5173 | Hot reload via Vite HMR; files synced into container |
| Production | `docker-compose.yml` | 3000 | Compiled Node.js app; minimal image |

Both configurations bind-mount `./data` into the container at `/app/data`. The database file and notes live in `./data` on the host, so they persist across container restarts and rebuilds.

`node_modules` is **never** bind-mounted — it is installed inside the container at build time to avoid cross-platform binary compatibility issues between Windows hosts and Linux containers.

## Git-Based Sync

The intended workflow for syncing between devices is:

```
Device A (after working):   click Sync → push
Device B (before working):  click Sync → pull
```

There is no real-time collaboration. One device works at a time. Conflicts are not auto-resolved — the user must resolve them manually with standard git tools.

The sync feature requires git to be installed on the host system and the repository to have a remote configured. Authentication (SSH key, credential helper) is the user's responsibility.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Notes as `.md` files on disk | Plain text, portable, Git-diffable, no lock-in |
| SQLite for engagement data | Zero-infrastructure, embedded, fast for single-user |
| WAL journal mode | Better read performance during concurrent API requests |
| Workspace-scoped file trees | Separation of concerns between engagements |
| Client-side-only rendering (`ssr: false`) | Editor (Milkdown) requires browser DOM; SSR would fail |
| Gemini as default AI provider | No API key = AI features are hidden, not broken; Gemini free tier is accessible |
| Git as sync mechanism | No server infrastructure needed; plays nicely with existing workflows |
