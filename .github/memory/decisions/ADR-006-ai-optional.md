---
title: "AI Features Are Optional and Provider-Agnostic"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# AI Features Are Optional and Provider-Agnostic

## Context

AI chat and summarize features improve productivity but are not core to note-taking. Some users will not have API keys, or will deploy in air-gapped environments. Requiring AI for core workflows would break those deployments.

## Options Considered

### Option A — AI optional, gated by env var

- **Pros:** Works in any environment, clear availability signal, no broken UI when key missing.
- **Cons:** UI logic needed to hide/show AI features.

### Option B — AI always required

- **Pros:** Simpler code — no availability checks.
- **Cons:** Breaks self-hosted deployments without API keys.

## Decision

AI endpoints check `GEMINI_API_KEY` env var at runtime. `/api/ai/status` reports availability as JSON. UI reads `/api/ai/status` on load and hides AI features (AI chat, summarize panel) when unavailable. Current provider is Google Gemini — but the pattern is provider-agnostic by design.

## Consequences

- No AI feature may be required for core note-taking or engagement workflows.
- New AI features must check availability via `/api/ai/status` before rendering.
- `GEMINI_API_KEY` is the only AI env var. Never hardcode API keys.
- If a different provider is added, create a new env var and update `/api/ai/status`.

## Related

- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
- [[features/ai-assistant]] — implementation details
