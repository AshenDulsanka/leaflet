---
title: "Workspace-Scoped Data Isolation"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# Workspace-Scoped Data Isolation

## Context
Users run multiple engagements simultaneously (e.g., separate pentest engagements for different clients). Data from one engagement must never bleed into another. Without strict scoping, an attacker (or a bug) could read or modify records from a different workspace via predictable integer IDs — a classic IDOR vulnerability.

## Options Considered

### Option A — Workspace_id FK on all engagement tables + double-key WHERE
- **Pros:** Enforced at DB query level, simple to audit, FK constraint gives referential integrity.
- **Cons:** Every query needs two WHERE conditions (minor verbosity).

### Option B — Separate DB per workspace
- **Pros:** Complete isolation at file level.
- **Cons:** Multiple DB files, complex migrations, no cross-workspace queries possible.

## Decision
Every engagement table has a `workspace_id` INTEGER FK referencing the workspaces table. Every API query that reads, updates, or deletes a record MUST scope its WHERE clause by both `id` AND `workspace_id`. File trees are per-workspace subdirectories under `data/notes/<workspace-slug>/`.

## Consequences
- Pattern: `WHERE id = ? AND workspace_id = ?` — never `WHERE id = ?` alone.
- INSERT statements must always include `workspace_id`.
- New routes must be audited before merge for IDOR — see [[patterns/workspace-scoped-queries]].
- API routes receive `workspace_id` from the validated session/request, never from user-supplied body.

## Related
- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
- [[patterns/workspace-scoped-queries]] — the concrete query pattern
