# Security Guidelines

This file defines security rules for the Leaflet project. All contributors and AI agents must follow these.

## Secrets and Configuration

- **NEVER** commit `.env` files to the repository
- **NEVER** hardcode API keys, passwords, secrets, or paths in source code
- All configuration lives in `.env` (gitignored) with a `.env.example` tracking the required keys
- Docker Compose passes env vars from the host - do not bake secrets into Dockerfiles or compose files
- The `data/screenshots/` directory is gitignored - screenshots may contain sensitive engagement data

## File System / Path Traversal Prevention

The app serves and writes `.md` files based on paths provided by the user (via the file tree and API). This is a classic path traversal attack surface.

### Required Validation (notes API)

Every server route in `src/routes/api/notes/` must validate file paths before any filesystem operation. The current implementation resolves the path and then checks that it still stays inside the notes root.

- `userPath` must be validated with `safePath()` before any `fs.readFile`, `fs.writeFile`, `fs.unlink`, or `fs.mkdir` call
- Reject paths containing `..`, null bytes (`\0`), or absolute path segments
- Only `.md` files are readable/writable via the notes API (enforce `.md` extension)
- `data/notes/templates/` directory should be readable but not writable via the API

### Current Route Validation

- `PUT`/`POST` note routes accept only Markdown content and resolve the final path relative to the notes directory
- `GET /api/templates` does not touch the filesystem; it validates workspace references and returns database rows only
- `GET /api/screenshots?workspaceId=...` rejects an empty workspace ID with `400`
- `PATCH /api/screenshots/[filename]` requires a non-empty `workspaceId` and limits caption and linked note input sizes

### Required Validation (screenshots API)

- Screenshot files use timestamp-based safe names and are validated before any file access
- The API accepts PNG, JPEG, GIF, and WebP uploads, and the upload size is capped at 10 MB
- Workspace metadata for screenshots is optional on upload, but when supplied it must be a non-empty string
- `linked_note_path` is stored as data and must not contain `..`

## Database Security

- The SQLite database file (`data/notes.db`) is accessed by server-side code only
- No database file path or contents should be exposed via any HTTP response
- Use parameterized queries with `better-sqlite3` always - never string-concatenate SQL

```typescript
// CORRECT
const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);

// NEVER DO THIS
const row = db.prepare(`SELECT * FROM workspaces WHERE id = ${id}`).get();
```

## Input Validation

- All user-provided names (workspace names, hostnames, file names) should be validated:
  - Max length (255 chars)
  - No null bytes
  - No characters that are invalid in file names on Windows and Linux
- Note content is user-controlled markdown - it is NOT sanitized before storage (user owns the data)
- Note content IS sanitized before rendering as HTML to prevent XSS (Milkdown handles this; if rendering via custom HTML, use DOMPurify)
- User template fields must be validated before insert:
  - `title` required, max 255 chars
  - `description` optional, max 1000 chars
  - `content` required, max 500,000 chars
  - `workspaceId` optional, but if present must resolve to an existing workspace

## Docker Security

- Production Dockerfiles use non-root users where possible
- `docker compose` bind mounts are limited to `data/` - not the entire project directory
- Production compose file does not expose unnecessary ports

## What is Gitignored for Security Reasons

```
.env
.env.local
.env.*.local
data/notes.db-shm
data/notes.db-wal
data/screenshots/
```
