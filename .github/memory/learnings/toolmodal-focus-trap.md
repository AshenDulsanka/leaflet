---
title: "ToolModal Focus Trap and Focus Restore"
date: 2026-04-29
type: learning
status: active
agent: designer
task: "Improve keyboard accessibility in shared ToolModal"
tags:
  - learning
  - accessibility
  - modal
---

# ToolModal Focus Trap and Focus Restore

## What Changed
`src/lib/components/modals/ToolModal.svelte` now:
- stores the previously focused element on mount,
- moves focus into the modal when it opens,
- traps Tab/Shift+Tab within modal focusable elements,
- restores previous focus when the modal closes.

## Why It Matters
Without focus containment, keyboard users can tab into background UI while modal is open. Restoring focus prevents disorientation after modal close.

## Related
- [[patterns/confirm-dialog-destructive]]
- [[patterns/windowed-flow-panels]]
