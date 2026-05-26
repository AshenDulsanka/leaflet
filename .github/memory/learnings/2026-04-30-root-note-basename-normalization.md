---
title: Root Note Creation Must Use Normalized Base Name
date: 2026-04-30
type: learning
status: active
agent: coder
task: regression-fix-doc-finalization
tags:
  - notes
  - editor
  - regression
  - normalization
---

When creating a note from Toolbar at workspace root, use normalized `baseName` for both folder and root paths. Using raw `fileName` in root branch bypasses `.md` normalization and can create extensionless notes.

## Related
- [[features/editor]]
- [[features/file-tree]]
