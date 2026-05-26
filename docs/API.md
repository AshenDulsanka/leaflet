# API

## Overview

Leaflet exposes JSON routes for notes, workspaces, screenshots, user templates, AI, and git sync. The server validates file paths, workspace scope, and request bodies before touching the filesystem or database.

## Shared Conventions

- Successful JSON responses return application/json unless the route explicitly streams or returns a file
- Validation failures return 400 with a short human-readable message
- Missing resources return 404
- Destructive operations generally return 204 with no body
- Workspace-scoped routes require a real workspace ID, not an empty string

## Route Map

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/workspaces` | List workspaces and create a workspace |
| GET, PATCH, DELETE | `/api/workspaces/[id]` | Read, update, or delete a workspace |
| GET, POST, PUT, DELETE | `/api/notes/[...path]` | Note CRUD |
| GET | `/api/notes/tree` | File tree for the active workspace |
| GET | `/api/notes/search` | Search notes |
| GET | `/api/templates` | List global templates or merge in workspace-scoped templates |
| POST | `/api/templates` | Create a user template |
| DELETE | `/api/templates/[id]` | Delete a user template |
| GET, POST | `/api/screenshots` | List screenshots or upload a new screenshot |
| GET, PATCH, DELETE | `/api/screenshots/[filename]` | Read, update, or delete a screenshot |
| GET, POST | `/api/ai/chat` and `/api/ai/summarize` | AI assistant endpoints |
| GET | `/api/ai/status` | Provider availability |
| POST | `/api/sync` | Git sync (`action: status | pull | push`) |

## Templates API

### GET `/api/templates`

Returns user templates ordered newest first.

| Query | Behavior |
|---|---|
| no `workspaceId` | Returns global templates only (`workspace_id IS NULL`) |
| `workspaceId=<id>` | Returns global templates plus templates scoped to that workspace |

Example:

```bash
curl "http://localhost:3000/api/templates?workspaceId=7f3d0d6f-0b28-4d8a-9cf7-6fbf0af2d2f9"
```

Response shape:

```json
[
  {
    "id": "...",
    "workspace_id": null,
    "title": "...",
    "description": "...",
    "content": "...",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

### POST `/api/templates`

Creates a new template.

Request body:

```json
{
  "title": "Local enum checklist",
  "description": "Optional summary",
  "content": "# Checklist\n- ...",
  "workspaceId": null
}
```

Validation rules:

- `title` is required, must be a non-empty string, and is capped at 255 characters
- `content` is required, must be a non-empty string, and is capped at 500,000 characters
- `description` is optional, but if present it must be a string and is capped at 1,000 characters
- `workspaceId` is optional, but if present it must be a string or `null`
- when `workspaceId` is set, it must reference an existing workspace

Successful response:

- status `201`
- body is the created `UserTemplate` row

Common failure cases:

- `400` for invalid JSON, invalid field types, missing required fields, or an unknown `workspaceId`
- `500` if the database insert fails

### DELETE `/api/templates/[id]`

Deletes a template by id.

- returns `204` when the row exists and is deleted
- returns `404` when the template id is unknown

## Screenshot API

### GET `/api/screenshots`

Returns screenshot metadata objects with filename, URL, size, caption, and linked note path.

Behavior:

- without `workspaceId`, the route scans the full screenshots directory for backward compatibility
- with `workspaceId`, the route returns only screenshots that belong to that workspace
- an empty `workspaceId` is rejected with `400`

Example:

```bash
curl "http://localhost:3000/api/screenshots?workspaceId=7f3d0d6f-0b28-4d8a-9cf7-6fbf0af2d2f9"
```

### POST `/api/screenshots`

Uploads an image via multipart form data.

Required form field:

- `image` - a `File` object

Optional form field:

- `workspace_id` - if supplied and non-empty, the server adds workspace metadata for the uploaded file

Validation rules:

- only PNG, JPEG, GIF, and WebP images are accepted
- images are capped at 10 MB
- missing or invalid `image` values return `400`

Successful response:

- status `200`
- body contains the public file URL

### GET `/api/screenshots/[filename]`

Returns the screenshot file itself.

- filename must match the timestamp-based safe-name pattern
- invalid filenames return `400`
- missing files return `404`

### PATCH `/api/screenshots/[filename]`

Updates screenshot metadata.

Request body:

```json
{
  "workspaceId": "7f3d0d6f-0b28-4d8a-9cf7-6fbf0af2d2f9",
  "caption": "Initial foothold proof",
  "linked_note_path": "pentest/recon.md"
}
```

Validation rules:

- `workspaceId` is required and must be a non-empty string
- `caption`, if provided, must be a string no longer than 500 characters
- `linked_note_path`, if provided, must be a string and must not contain `..`
- at least one updatable field must be present

### DELETE `/api/screenshots/[filename]`

Deletes the file and its metadata row.

- returns `204` on success
- returns `404` if the file does not exist

## Sync API

### POST `/api/sync`

Single sync endpoint for status checks and git actions.

Request body:

```json
{
  "action": "status"
}
```

Allowed actions:

- `status` - returns repository sync status
- `pull` - pulls latest remote changes
- `push` - stages `data/`, commits with an auto message, and pushes

`status` response fields:

- `initialized` (`boolean`) - git repo detected
- `branch` (`string`) - current branch name
- `hasRemote` (`boolean`) - `origin` exists
- `dirty` (`boolean`) - local unstaged/staged changes exist
- `changes` (`string | null`) - raw porcelain status summary
- `ahead` (`number`) - local commits ahead of upstream
- `behind` (`number`) - commits behind upstream
- `recommendation` (`'push' | 'pull' | 'both' | 'none'`) - server suggestion used by toolbar UI

Common responses:

- `200` for successful status/pull/push
- `400` for invalid JSON, invalid `action`, missing repo, or missing remote
- `401` for auth/authorization failures
- `409` when push is rejected because remote is ahead
- `500` for unexpected git/runtime failures

## Notes, Workspaces, AI, and Sync

The remaining route families are intentionally summarized here because their behavior is broader and documented in the product pages:

- notes routes validate paths before filesystem access and only operate on Markdown files
- workspace routes provide list, create, read, update, and delete behavior for the active workspace model
- AI routes expose assistant, summary, and status endpoints
- sync route wraps git status, pull, and push actions through `POST /api/sync`
