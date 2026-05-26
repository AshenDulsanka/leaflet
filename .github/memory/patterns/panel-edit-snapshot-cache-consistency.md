---
title: Panel Edit Snapshot + Cache Consistency
date: 2026-04-29
type: pattern
status: active
agent: coder
task: Fix high findings in Host/Credential/Flag panels
tags:
	- svelte
	- state-management
	- cache
	- race-condition
---

# Pattern

In async edit/update handlers, snapshot both workspace id and edited entity id before first await.

1. Build fetch URL with snapshot ids.
2. Apply returned state update using snapshot entity id.
3. Clear edit UI only if current edit id still matches snapshot id.
4. After every successful create/update/delete mutation, write updated in-memory list into panel cache immediately.

This avoids edit-target drift races and stale cached-first reopen behavior when workspace or selected edit target changes during pending requests.

## Related

- [[patterns/engagement-panel-uimode]]
- [[patterns/workspace-scoped-queries]]
