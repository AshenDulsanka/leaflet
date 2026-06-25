# Sync

## Purpose

Git-based multi-device sync. Users can push local changes (notes, screenshots, DB) to a configured Git remote and pull changes from it. Status endpoint checks whether the remote is ahead, behind, or up-to-date. SyncButton in the toolbar triggers push/pull.

## Key Files

- `src/routes/api/sync/status/+server.ts` — GET: checks git remote status (ahead/behind/up-to-date)
- `src/routes/api/sync/push/+server.ts` — POST: stages all changes and pushes to remote
- `src/routes/api/sync/pull/+server.ts` — POST: fetches and merges from remote
- `src/lib/components/layout/SyncButton.svelte` — toolbar button; shows status indicator and triggers push/pull

## Status

stable

## Notes

- WAL temp files (`*.db-shm`, `*.db-wal`) must be in `.gitignore` — they must never be committed.
- `data/notes.db` itself is committed so engagement metadata syncs across devices.
- Merge conflicts in `.md` files require manual Git resolution by the user.
- A Git remote must be configured before sync works; see `docs/DEPLOYMENT.md`.
- Sync runs shell commands via Node `child_process`; commands are validated and not user-controlled.
