---
title: "Modal Escape Precedence Across Panel Handlers"
date: 2026-04-29
type: learning
status: active
agent: designer
task: "Harden Escape precedence after ToolModal migration"
tags:
  - learning
  - accessibility
  - keyboard
  - modal
---

# Modal Escape Precedence Across Panel Handlers

## Pattern

When panel and modal/dialog both listen for Escape:

- modal/dialog Escape handlers should call both `preventDefault()` and `stopPropagation()`.
- panel-level Escape handlers should early-return on `event.defaultPrevented`.
- panel-level handlers should close nested UI first (confirm dialog, modal form, lightbox), then close panel as final fallback.

## Why

This avoids fragile listener-order behavior where Escape inside nested dialogs can close the parent panel unexpectedly.

## Related

- [[patterns/engagement-panel-uimode]]
- [[patterns/confirm-dialog-destructive]]
