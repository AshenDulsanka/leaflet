---
title: FileTree folder drop guard must compare target against dragged folder descendants
date: 2026-04-30
type: learning
status: active
agent: coder
task: Restore file tree drag/drop regressions
tags:
  - file-tree
  - drag-drop
  - regression
---

When validating folder-to-folder drops in FileTree, descendant protection must check the drop target path against the dragged folder path (`targetPath.startsWith(`${fromPath}/`)`) rather than checking whether the dragged path starts with the target. Reversing this blocks valid moves from nested items into ancestor folders/root.

Also guard reorder cross-parent drops for folders with exact-parent equality (`targetParent === fromPath`) in addition to descendant checks (`targetParent.startsWith(`${fromPath}/`)`). Without equality check, dragging folder onto file inside same folder can emit `onMoveItem(sourceFolder, sourceFolder)`.

## Related
- [[features/file-tree]]
- [[patterns/workspace-scoped-queries]]
