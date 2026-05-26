# Workspaces

## Purpose
Workspaces provide isolated contexts for notes and engagement data. Each workspace has a name, a type (`pentest` or `general`), an optional `preset` field (only `'cpts'` is meaningful), and a unique slug used as the notes subdirectory. The pentest type unlocks all 10 engagement panels. The `preset = 'cpts'` value additionally gates the Methodology panel (CPTS exam checklist). Users can create, switch, and delete workspaces via the workspace modal.

## Key Files
- `src/lib/components/modals/WorkspaceCreateModal.svelte` — create/edit workspace modal; sets type and preset toggle
- `src/routes/api/workspaces/+server.ts` — GET all workspaces, POST create workspace
- `src/routes/api/workspaces/[id]/+server.ts` — PATCH update, DELETE workspace

## Status
stable

## Notes
- Workspace `type` must be `'pentest'` or `'general'` — these are the only valid live values. The DB schema may contain stale enum values (`exam/practice/ctf/other`) from earlier development; ignore them.
- Gate CPTS-specific features on `activeWorkspace.preset === 'cpts'`, NOT on `workspace.type`.
- Deleting a workspace deletes all engagement data (FK CASCADE) and the notes directory.
- Workspace slug is derived from the name; must be filesystem-safe.
