---
title: "SQLite via better-sqlite3 for Structured Data"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# SQLite via better-sqlite3 for Structured Data

## Context
Needed persistent storage for workspace metadata (types, slugs, presets) and all engagement data (hosts, credentials, flags, findings, snippets, etc.). The app is self-hosted with no external DB server. Simplicity and zero-dependency deployment are priorities.

## Options Considered

### Option A — SQLite via better-sqlite3
- **Pros:** Zero server, single file DB, synchronous API (no async complexity), WAL mode for concurrent reads, FK enforcement available, ships in Docker image.
- **Cons:** Not suitable for multi-process write scaling (not needed here).

### Option B — PostgreSQL / MySQL
- **Pros:** Full-featured, concurrent writes.
- **Cons:** Requires external server, defeats self-hosted simplicity goal.

## Decision
better-sqlite3 with WAL mode and foreign key enforcement. Single `getDb()` singleton exported from `src/lib/server/database.ts`. Schema migrations managed in `src/lib/server/migrations.ts`.

## Consequences
- All DB calls are synchronous — no `await db.query()`, no async patterns.
- WAL mode enabled: `PRAGMA journal_mode = WAL`.
- FK enforcement: `PRAGMA foreign_keys = ON`.
- Schema migrations run at startup via `runMigrations()`.
- DB file at `data/notes.db` — gitignored WAL temp files (`*.db-shm`, `*.db-wal`).
- Note: DB schema contains stale enum values (`exam/practice/ctf/other`) for workspace type that do not match the live app (`pentest | general`). Ignore stale values.

## Related
- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
- [[patterns/workspace-scoped-queries]] — query pattern enforced by this decision
