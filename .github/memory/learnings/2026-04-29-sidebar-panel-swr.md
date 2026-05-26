---
title: Sidebar and panel SWR refresh guard
date: 2026-04-29
type: learning
status: active
agent: coder
task: Fix sidebar regressions and improve panel load responsiveness
tags:
  - sidebar
  - file-tree
  - sync
  - panel-performance
  - race-conditions
---

When tool panels remount on open, clearing local arrays before fetch creates visible blank flashes and slower perceived load.

Use stale-while-revalidate in panel components:
- Keep per-workspace in-memory cache (module-scoped map)
- Render cached data immediately on open
- Trigger background refresh fetch
- Apply response only if request token and workspace id still match current view

For tree interactions, avoid making full file rows draggable when click-open must remain primary.
Use a dedicated drag handle so normal click behavior stays reliable.

## Related
- [[features/file-tree]]
- [[features/engagement-tools]]
- [[patterns/engagement-panel-uimode]]
