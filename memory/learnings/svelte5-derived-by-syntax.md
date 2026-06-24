---
title: "$derived.by() Required for Multi-Statement Derived Blocks"
date: 2026-04-27
type: learning
status: active
agent: orchestrator
task: "Svelte 5 rune syntax — derived computation patterns"
tags:
  - learning
  - svelte5
aliases: []
---

# $derived.by() Required for Multi-Statement Derived Blocks

## What Happened

Code was written using `$derived(() => { let x = ...; return y; })` — passing a function with multiple statements to `$derived`. This caused a Svelte 5 compile/runtime error or silently produced incorrect reactive behaviour.

## Root Cause

Svelte 5's `$derived()` takes a **single expression**, not a function body. The syntax `$derived(expr)` evaluates the expression reactively. Passing an arrow function `() => { ... }` with a body makes `$derived` track the function reference itself (which never changes), not the return value of the body.

`$derived.by()`, on the other hand, explicitly takes a function and calls it, tracking all reactive reads inside the function body.

## Fix / Workaround

Replace `$derived(fn)` with `$derived.by(fn)` whenever the computation has more than one statement:

```typescript
// BEFORE (wrong)
let result = $derived(() => {
  const filtered = items.filter((i) => i.active);
  return filtered.length;
});

// AFTER (correct)
let result = $derived.by(() => {
  const filtered = items.filter((i) => i.active);
  return filtered.length;
});
```

For genuinely single-expression derivations, `$derived(expr)` is fine:

```typescript
let doubled = $derived(count * 2); // OK
```

## Prevention

Rule of thumb: if the derived body needs a `let`, `const`, `if`, `for`, or `return` in a block — use `$derived.by`. If it's a single arithmetic/boolean/ternary expression — `$derived` is fine.

## Related

- [[patterns/derived-by-for-blocks]] — the pattern note for ongoing prevention
- [[decisions/ADR-001-sveltekit-framework]] — Svelte 5 runes decision
- [[sessions/2026-04-27-analyze-codebase]] — session where this was documented
