---
title: "No .js Extension in SvelteKit TypeScript Imports"
date: 2026-04-27
type: learning
status: active
agent: orchestrator
task: "SvelteKit module resolution — import path conventions"
tags:
  - learning
  - sveltekit
  - typescript
aliases: []
---

# No .js Extension in SvelteKit TypeScript Imports

## What Happened
An import was written as `import { fn } from '$lib/data/commands.js'` (with `.js` extension) when the actual file is `commands.ts`. This caused a module resolution error at runtime or during `pnpm check`.

## Root Cause
SvelteKit uses Vite for module resolution, which resolves TypeScript files directly. Adding a `.js` extension hint in the import path is incorrect in this context — Vite does not rewrite `.js` → `.ts` the way some Node.js ESM tooling does.

The `.js` extension convention comes from Node.js ESM specification where `.js` is used to import compiled `.ts` output. SvelteKit/Vite resolves `.ts` source directly, so that convention does not apply here.

## Fix / Workaround
Remove the file extension entirely from internal SvelteKit imports:

```typescript
// WRONG
import { parseCommands } from '$lib/data/commands.js';
import { getDb } from '$lib/server/database.ts';

// CORRECT
import { parseCommands } from '$lib/data/commands';
import { getDb } from '$lib/server/database';
```

External package imports from `node_modules` are unaffected — only internal `$lib/` or relative imports.

## Prevention
Never add `.js` or `.ts` extensions to internal imports in SvelteKit. Use bare paths with `$lib/` alias or relative paths without extension. Run `pnpm check` to catch resolution errors before committing.

## Related
- [[decisions/ADR-001-sveltekit-framework]] — SvelteKit framework decision
- [[sessions/2026-04-27-analyze-codebase]] — session where this was documented
