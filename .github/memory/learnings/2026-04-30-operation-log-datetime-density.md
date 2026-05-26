---
title: "Operation log datetime controls need dense defaults in modal forms"
date: 2026-04-30
type: learning
status: active
agent: designer
task: "Fix operation-log modal calendar sizing and usability"
tags:
  - learning
  - ui
  - operation-log
  - datetime
---

# Operation log datetime controls need dense defaults in modal forms

## Context
`OperationLogEntryForm` is rendered inside `ToolModal` with `max-w-sm`, so date/time controls can look oversized and visually broken if they keep roomy spacing intended for wide layouts.

## Learning
For date/time picker controls used in narrow modal layouts, prefer denser defaults:
- Smaller icon chips and button footprints.
- Tighter grid gaps and control padding.
- Reduced day cell height in calendar grids.
- Smaller helper copy to avoid vertical overflow pressure.

This keeps the control proportionate without introducing extra mode-specific prop APIs.

## Related
- [[sessions/2026-04-30-regression-fix-doc-finalization]]
- [[features/engagement-tools]]
