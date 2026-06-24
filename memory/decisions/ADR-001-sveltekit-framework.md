---
title: "SvelteKit 5 as Application Framework"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# SvelteKit 5 as Application Framework

## Context

Needed a full-stack TypeScript framework with SSR, file-based routing, and server endpoints for a self-hosted markdown note-taking app. Svelte 5 runes provide fine-grained reactivity without a virtual DOM, reducing bundle size and runtime overhead. The developer is a solo maintainer targeting open-source release.

## Options Considered

### Option A — SvelteKit 5 with Svelte 5 runes

- **Pros:** Fine-grained reactivity, no virtual DOM, TypeScript strict mode, file-based routing, server endpoints built-in, small runtime.
- **Cons:** Svelte 5 runes are a recent API change — less community examples than React.

### Option B — Next.js / React

- **Pros:** Large ecosystem, many examples.
- **Cons:** Heavier runtime, virtual DOM overhead, more boilerplate for simple SSR pages.

## Decision

SvelteKit 5 with Svelte 5 runes. All components use rune syntax exclusively. No Svelte 4 syntax permitted anywhere in the codebase.

## Consequences

- All components must use `$state`, `$derived`, `$derived.by`, `$effect`, `$props` runes.
- No `$:` reactive declarations.
- No `on:event` directives — use `onclick={handler}` syntax.
- No `export let prop` — use `let { prop } = $props()`.
- Agents must verify Svelte 5 syntax before writing any component code.
- No React, Vue, Angular, or Radix UI packages allowed.

## Related

- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
