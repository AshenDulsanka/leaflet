---
title: "Windowed Dialog + ConfirmDialog Standard for Flow Canvases"
date: 2026-04-29
type: decision
status: active
agent: docs-updater
task: "Document UX baseline for Attack Chain and Network Topology flow canvases"
tags:
  - decision
  - ux
  - engagement
aliases: []
---

# Windowed Dialog + ConfirmDialog Standard for Flow Canvases

## Context

Flow-canvas engagement tools (Attack Chain and Network Topology) needed consistent, less intrusive presentation and safer destructive actions.

## Options Considered

### Option A — Full-screen overlays + mixed confirmation behavior

- **Pros:** Maximum canvas space.
- **Cons:** Heavier context switch, overlap with controls, inconsistent delete safety.

### Option B — Centered windowed dialogs + mandatory ConfirmDialog for destructive actions

- **Pros:** Better visual continuity with Note Graph, reduced control overlap, consistent safety for deletes.
- **Cons:** Slightly reduced canvas area on small screens.

## Decision

Use centered windowed popup-style dialogs for flow-canvas tools, position legends away from left-side controls, and require ConfirmDialog before destructive graph actions (Attack Chain node delete and Network Topology edge delete).

## Consequences

- UX consistency across canvas-heavy tools improves.
- Destructive actions become predictable and safer.
- Future flow tools should follow the same dialog and confirmation baseline.

## Related

- [[sessions/2026-04-29-flow-panels-doc-sync]] — session where this was decided
- [[patterns/windowed-flow-panels]]
- [[patterns/confirm-dialog-destructive]]
- [[patterns/attack-chain-node-type-differentiation]]
