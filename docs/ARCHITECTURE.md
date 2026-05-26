# Architecture

## Overview

Leaflet is a SvelteKit 5 application for general notes and pentest/CTF engagements. Notes live on disk as Markdown files, engagement metadata lives in a local SQLite database, and Git is the sync mechanism between devices.

The browser UI is intentionally split into a note editor, utility panels, and engagement panels. Workspace type controls which panels are available:

- `pentest` workspaces are the default creation type and expose the core note-taking experience
- `pentest` workspaces unlock methodology guidance and the engagement toolchain

## Workspace Model

Workspaces are the main isolation boundary. Each workspace has its own note tree and its own engagement data in the database. New workspaces default to `pentest` unless the user explicitly chooses `general`, and the first-run default workspace is created so the app always opens into a valid context.

Workspace scope also affects other shipped features:

- screenshots can be listed by workspace
- user templates can be global or workspace-scoped
- methodology is only shown for pentest workspaces
- engagement panels only open when a workspace is active

## Runtime Storage

| Location            | Purpose                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `data/notes.db`     | SQLite database for workspaces, hosts, credentials, flags, findings, topology, templates, screenshots metadata, and other structured data |
| `data/notes/`       | Markdown notes grouped by workspace folder                                                                                                |
| `data/screenshots/` | Uploaded screenshot files                                                                                                                 |

The database runs in WAL mode. That keeps concurrent reads fast while the app is in use, and the sync flow checkpoints WAL content before git operations so committed data is complete.

## Request Flow

### Notes

1. The editor saves Markdown through `PUT /api/notes/[...path]`.
2. Server-side path validation resolves the note path relative to the notes root before any filesystem access.
3. Only `.md` files are accepted by the notes routes.
4. The file is written to the workspace folder on disk and the editor clears its dirty state.

### Workspaces

1. Workspace CRUD goes through `/api/workspaces` and `/api/workspaces/[id]`.
2. The `type` field controls whether the workspace behaves as `general` or `pentest`.
3. The UI persists the active workspace locally so the last context is restored on reload.

### Templates

1. The command palette loads templates through `/api/templates`.
2. Global templates are always available.
3. Workspace-scoped templates are merged in when a workspace is active.
4. Selecting a template inserts raw Markdown into the editor.

### Screenshots

1. Uploads go through `POST /api/screenshots`.
2. Metadata is stored alongside the file when a workspace ID is supplied.
3. Workspace-scoped reads use `GET /api/screenshots?workspaceId=...`.
4. Empty workspace IDs are rejected so the scoped list cannot silently degrade.

## UI Behavior

The current UI uses a few consistent interaction rules:

- major panels are mutually exclusive, so opening one closes the others
- primary actions stay visible in panel headers or footers instead of being buried behind menus
- destructive actions use a confirmation dialog rather than a direct delete button
- pentest-only panels are hidden instead of disabled when the workspace is not eligible

## Sync and Deployment

Git sync expects a real repository with a configured remote. The app runs either through Docker or directly on Node.js 22, but the data model is the same in both cases because notes and the database live under `data/`.

## Related Docs

- [Features](FEATURES.md)
- [API](API.md)
- [Components](COMPONENTS.md)
- [Engagement Tools](ENGAGEMENT_TOOLS.md)
- [Security](SECURITY.md)
