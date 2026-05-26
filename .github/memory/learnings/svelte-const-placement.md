---
title: "{@const} Must Be Direct Child of Block Tags"
date: 2026-04-27
type: learning
status: active
agent: orchestrator
task: "Svelte 5 template syntax — const declarations"
tags:
  - learning
  - svelte5
aliases: []
---

# {@const} Must Be Direct Child of Block Tags

## What Happened
A `{@const}` declaration was placed at the top level of a Svelte component (outside any block tag) to compute a derived value in the template. This caused a Svelte parse error — the component failed to compile.

## Root Cause
In Svelte, `{@const}` is only valid as a **direct child** of block tags: `{#each}`, `{#if}`, `{#snippet}`, `{#await}`, and `{:else}`. It cannot appear at the component root level, inside HTML elements (without a wrapping block), or as a sibling of regular markup at the top level.

## Fix / Workaround
Two options:

**Option 1 — Move `{@const}` inside the block it belongs to:**
```svelte
{#each items as item}
  {@const label = item.active ? 'Active' : 'Inactive'}
  <span>{label}</span>
{/each}
```

**Option 2 — Use `$derived` in `<script>` instead:**
```svelte
<script lang="ts">
  let label = $derived(activeItem?.active ? 'Active' : 'Inactive');
</script>
<span>{label}</span>
```

## Prevention
Never place `{@const}` outside a block tag. For computed values needed at the component top level, use `$derived` or `$derived.by` in `<script>`. Use `{@const}` only for loop-local or block-local temporaries.

## Related
- [[learnings/svelte5-derived-by-syntax]] — related Svelte 5 syntax learning
- [[decisions/ADR-001-sveltekit-framework]] — Svelte 5 runes decision
- [[sessions/2026-04-27-analyze-codebase]] — session where this was documented
