---
title: "Attack Chain Node Type Differentiation"
date: 2026-04-29
type: pattern
status: active
agent: designer
task: "Improve AttackChainNode scanability by node type"
tags:
  - pattern
  - svelte5
  - ux
  - engagement-tools
---

# Attack Chain Node Type Differentiation

## Pattern
Use a typed visual map keyed by `node.type` that drives:
- type chip text (short code)
- human-readable type label
- accent token via CSS variable (`--node-accent`)
- distinct structural style per type (border style, radius profile, stripe treatment)

This improves scanability beyond color-only encoding and keeps logic maintainable in one map object.

## Accessibility Notes
- Keep node surface dark and text light for stable contrast.
- Use accent on border/chip rather than full-surface saturation.
- Preserve text labels so color is not the only differentiator.

## Related
- [[features/engagement-tools]]
- [[patterns/engagement-panel-uimode]]
