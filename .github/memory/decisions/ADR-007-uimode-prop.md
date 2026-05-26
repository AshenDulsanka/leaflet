---
title: "uiMode Prop Convention for Engagement Panels"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# uiMode Prop Convention for Engagement Panels

## Context
Engagement panels (HostTracker, CredentialVault, FlagTracker, etc.) each have add and edit forms. Some users prefer forms as centered modal overlays; others prefer forms that expand inline within the panel list. This preference is per-user and should persist across sessions.

## Options Considered

### Option A — uiMode prop with localStorage persistence
- **Pros:** Single prop controls both layouts, user preference persists, easy to toggle, consistent API across all panels.
- **Cons:** Each panel must implement two render branches.

### Option B — Separate panel variants (ModalPanel / InlinePanel)
- **Pros:** No conditional rendering inside each component.
- **Cons:** Double the component count, diverging codebases, harder to maintain.

## Decision
All engagement panels accept a `uiMode: 'modal' | 'inline'` prop with default `'modal'`. Preference stored in localStorage under key `leaflet-ui-mode`. The page (`+page.svelte`) reads from localStorage and passes `uiMode` to all panels. Modal = centered overlay dialog. Inline = form expands inside the panel row below the item.

## Consequences
- Every new engagement panel MUST implement both `modal` and `inline` branches.
- The canonical reference implementation is `FlagTrackerPanel.svelte`.
- Never hardcode one mode. Never read localStorage inside a panel — receive it as a prop.
- `+page.svelte` is responsible for reading and passing `uiMode`.

## Related
- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
- [[patterns/engagement-panel-uimode]] — implementation pattern
- [[features/engagement-tools]] — all panels that use this convention
