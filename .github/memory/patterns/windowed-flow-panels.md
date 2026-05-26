---
title: "Windowed Flow Panels for Engagement Tools"
date: 2026-04-29
type: pattern
status: active
agent: coder
task: "Convert Attack Chain and Network Topology to windowed dialogs"
tags:
  - pattern
  - svelte5
  - engagement
  - ux
---

# Windowed Flow Panels for Engagement Tools

## Pattern

For large canvas tools (SvelteFlow/D3), prefer Note Graph-style centered dialogs over full-screen overlays:

- Backdrop: `fixed inset-0 ... bg-black/50 backdrop-blur-sm`
- Dialog shell: `h-[80vh] w-[85vw] max-w-[1400px] ... rounded-lg border ... shadow-2xl`
- Accessibility: `role="dialog"`, `aria-modal="true"`, Escape to close, click-outside to close
- Keep legends away from SvelteFlow left controls (place legend bottom-right)

## Implementation Notes

- For SvelteFlow arrays, use `$state.raw` for `nodes`/`edges` and keep immutable updates (`map`, `filter`, spread reassignment)
- Use `ConfirmDialog` for destructive actions in canvas-adjacent footer/tool rows
- Avoid `overflow-hidden`/scroll wrappers around custom `Select` fields in modals when dropdown options are clipped

## Related

- [[patterns/confirm-dialog-destructive]]
- [[patterns/engagement-panel-uimode]]
- [[features/engagement-tools]]
