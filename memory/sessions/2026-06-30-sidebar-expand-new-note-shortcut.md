---
title: Sidebar Expand All, New Note Heading, and Shortcut Change
type: session
tags:
  - session
  - ui
  - file-tree
  - editor
---

# Sidebar Expand All, New Note Heading, and Shortcut Change

## Changes

- Added a sidebar Expand/Collapse all folders icon button that opens or closes nested folders recursively.
- New notes now start with an H1 heading based on the note filename before optional template content.
- Changed sidebar collapse/expand shortcut from `Ctrl+B` to `Ctrl+Shift+L` and updated help text/tooltips.
- Updated `CHANGELOG.md` under `[Unreleased]`.

## Verification

- `pnpm check` passed with 0 errors and 2 existing warnings.
- Targeted ESLint passed for changed Svelte files.

## Files

- `src/lib/components/layout/Sidebar.svelte`
- `src/lib/components/layout/FileTree.svelte`
- `src/routes/[...path]/+page.svelte`
- `src/lib/components/modals/HelpModal.svelte`
- `CHANGELOG.md`

## Related

- [[features/file-tree]]
- [[features/editor]]
