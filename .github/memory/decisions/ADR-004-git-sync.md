---
title: "Git as the Sync Mechanism"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# Git as the Sync Mechanism

## Context
Multi-device sync is needed for pentesters who work across multiple machines. A server-side sync service would add infrastructure complexity. The target audience is technical and comfortable with Git.

## Options Considered

### Option A — Git push/pull
- **Pros:** No extra server required, conflict model is well-understood, notes are already files, SSH keys already common in pentester workflow.
- **Cons:** Merge conflicts require manual resolution, SQLite WAL files must be excluded.

### Option B — Custom sync server (WebSocket / polling)
- **Pros:** Real-time sync, automatic conflict resolution.
- **Cons:** Adds server infrastructure, increases deployment complexity, defeats self-hosted simplicity.

## Decision
Git push/pull via API endpoints. `/api/sync/status` checks remote status, `/api/sync/push` stages and pushes, `/api/sync/pull` fetches and merges. Notes and screenshots are committed and pushed.

## Consequences
- SQLite WAL temp files (`*.db-shm`, `*.db-wal`) must be in `.gitignore`.
- `data/notes.db` itself is committed so workspace metadata and engagement data sync across devices.
- Merge conflicts in `.md` files require manual Git resolution.
- Remote must be configured before sync works — documented in `DEPLOYMENT.md`.

## Related
- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
- [[decisions/ADR-003-file-based-notes]] — file-based storage that enables Git sync
- [[features/sync]] — implementation details
