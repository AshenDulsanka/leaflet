# Screenshots

## Purpose

Screenshot management for engagement documentation. Users can upload screenshots (paste from clipboard or file picker), rename them, and link them to engagement records (hosts, findings, etc.). Screenshots are stored in `data/screenshots/` and synced via Git alongside notes.

## Key Files

- `src/lib/components/panels/ScreenshotPanel.svelte` — screenshot gallery and upload UI
- `src/lib/server/screenshots.ts` — server-side screenshot storage logic; handles file save/delete/rename
- `src/routes/api/screenshots/+server.ts` — GET list, POST upload
- `src/routes/api/screenshots/[filename]/+server.ts` — GET single, DELETE, PATCH rename

## Status

stable

## Notes

- Screenshots are versioned with notes in the same Git repo — `data/screenshots/` is committed.
- Filenames are sanitized on upload; `safePath()` must be used before any `fs` operation.
- Clipboard paste support: the panel listens for `paste` events and extracts image data.
- Linking screenshots to engagement records (hosts, findings) is stored in DB, not in the file.
