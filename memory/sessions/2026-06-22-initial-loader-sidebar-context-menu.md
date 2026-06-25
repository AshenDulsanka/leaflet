---
title: Initial Loader and Sidebar Root Context Menu
type: session
tags:
  - session
  - ui
  - file-tree
  - loading
---

# Initial Loader and Sidebar Root Context Menu

## Changes

- Added an initial page loading state while workspaces, the file tree, and the URL-selected note load.
- Added root-level New note and New folder actions when right-clicking empty file-tree space.
- Reused the existing new-note template dialog and folder creation dialog.

## Files

- `src/routes/[...path]/+page.svelte`
- `src/lib/components/layout/Sidebar.svelte`
- `CHANGELOG.md`

## Related

- [[features/file-tree]]
- [[features/editor]]
