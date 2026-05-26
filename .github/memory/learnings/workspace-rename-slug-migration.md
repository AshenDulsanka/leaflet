---
title: Workspace Rename Slug Migration Contract
date: 2026-04-29
type: learning
status: active
agent: coder
task: Rename workspace updates slug + URL safely
tags:
  - learning
  - workspace
  - filesystem
  - api
---

# Workspace Rename Slug Migration Contract

When `PATCH /api/workspaces/[id]` receives a changed `name`, it now also migrates `notes_folder` to a safe slug and treats rename as a filesystem+database migration, not a simple label update.

## Contract

- Generate `notes_folder` from name (`kebab-case`), validate strict slug safety, reject collisions.
- Rename workspace folder on disk (`safePath`-validated) before DB mutation.
- Apply DB transaction that updates workspace row and rewrites path-keyed metadata:
  - `note_sort_order.note_path`
  - `screenshot_metadata.linked_note_path` (workspace-scoped)
  - `findings.note_path` (workspace-scoped)
- If DB transaction fails after disk rename, attempt folder rollback.

## Related

- [[patterns/safe-path-validation]]
- [[patterns/workspace-scoped-queries]]
