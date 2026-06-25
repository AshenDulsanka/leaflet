---
title: "Markdown Files on Disk for Note Storage"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# Markdown Files on Disk for Note Storage

## Context

Notes are the core content of the app. Options included storing note content as BLOBs in SQLite or as flat files on disk. The target audience (pentesters) expects portability, external editor access, and version control compatibility.

## Options Considered

### Option A — Markdown files on disk

- **Pros:** Git-compatible, portable, external editor access, human-readable, no BLOB overhead.
- **Cons:** File path validation required to prevent traversal attacks.

### Option B — SQLite BLOBs

- **Pros:** Single file, ACID transactions across content and metadata.
- **Cons:** No external editor access, not Git-diffable as text, worse for sync workflows.

## Decision

`.md` files stored in `data/notes/<workspace-slug>/`. DB stores only workspace metadata and engagement data — never note content. `NOTES_DIR` env var controls the base path with a fallback to `data/notes`.

## Consequences

- `safePath()` MUST be called before every `fs` operation on note files. Never use `path.join(notesDir, userInput)` directly.
- `NOTES_DIR` env var required in production; defaults to `data/notes` in development.
- Each workspace maps to a subdirectory named after the workspace slug.
- Moving/renaming notes means `fs.rename()` + updating DB metadata.
- Git sync includes both `data/notes/` and `data/screenshots/`.

## Related

- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
- [[patterns/safe-path-validation]] — mandatory pattern for all fs operations
- [[decisions/ADR-004-git-sync]] — sync mechanism that depends on file-based storage
