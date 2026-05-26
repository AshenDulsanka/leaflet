---
title: "$derived.by() for Block-Body Derived Computations"
date: 2026-04-27
type: pattern
status: active
agent: orchestrator
tags:
  - pattern
  - svelte5
aliases: []
---

# $derived.by() for Block-Body Derived Computations

## When to Use
Any `$derived` that needs more than a single expression — conditionals, loops, intermediate variables, or any multi-statement logic. If the derived body requires a `let`, `const`, `if`, or `for`, use `$derived.by`.

## Implementation

```typescript
// CORRECT — single expression (fine for $derived)
let doubled = $derived(count * 2);

// CORRECT — block body with intermediate variables
let filteredItems = $derived.by(() => {
  const lower = searchQuery.toLowerCase();
  return items.filter(item => item.name.toLowerCase().includes(lower));
});

// CORRECT — conditional logic
let statusLabel = $derived.by(() => {
  if (score >= 9.0) return 'Critical';
  if (score >= 7.0) return 'High';
  if (score >= 4.0) return 'Medium';
  return 'Low';
});
```

## Example in Codebase
`src/lib/data/cvss.ts` — uses `$derived.by` for multi-step CVSS score calculations.

`src/routes/[...path]/+page.svelte` — uses `$derived.by` for filtered note lists and panel state computations.

## Anti-Patterns
```typescript
// WRONG — $derived does not accept a function body with statements
let x = $derived(() => {
  const temp = someValue * 2;  // ← this is invalid Svelte 5 syntax
  return temp + 1;
});

// WRONG — using $: reactive statement (Svelte 4 syntax, not allowed)
$: filteredItems = items.filter(i => i.active);
```

## Related
- [[learnings/svelte5-derived-by-syntax]] — the learning note from the original discovery
- [[decisions/ADR-001-sveltekit-framework]] — Svelte 5 runes decision
- [[sessions/2026-04-27-analyze-codebase]] — session where this was established
