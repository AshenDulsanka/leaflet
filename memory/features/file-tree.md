# File Tree

## Purpose

Hierarchical file tree displayed in the sidebar, showing notes and folders for the active workspace. Supports folder creation, note creation, renaming, drag-and-drop reordering (zone-based: top 30% = move before, center 40% = move into folder, bottom 30% = move after), and context menu operations. Sort order is persisted in the database.

## Key Files

- `src/lib/components/layout/FileTree.svelte` — main file tree component; handles rendering, drag-and-drop logic, and context menu
- `src/lib/components/layout/Sidebar.svelte` — sidebar container; hosts FileTree and workspace switcher

## Status

stable

## Notes

- Drop zones are calculated as fractions of the target node's height: top 30% = insert before, middle 40% = insert into folder, bottom 30% = insert after.
- Drop source is validated against a `knownPaths` Set to prevent external drag injection (security guard).
- Sort order is written to DB on every drop; persisted across sessions.
- `readTree()` in `src/lib/server/notes.ts` strips `.md` extension from `node.name` via `basename(entry.name, '.md')`. Use `node.type === 'file'` to identify file nodes — never `node.name.endsWith('.md')`.
