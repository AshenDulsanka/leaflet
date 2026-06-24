---
title: "safePath() for All Filesystem Operations"
date: 2026-04-27
type: pattern
status: active
agent: orchestrator
tags:
  - pattern
  - security
aliases: []
---

# safePath() for All Filesystem Operations

## When to Use

Any server-side code that reads, writes, deletes, or lists files in the notes directory. Applies to all API routes and server modules that touch `data/notes/` or `data/screenshots/`.

## Implementation

```typescript
import { safePath } from "$lib/server/notes";

// In an API route or server function:
const resolved = safePath(userProvidedPath);
// safePath throws if the resolved path escapes NOTES_DIR
// Use resolved for all subsequent fs operations
await fs.readFile(resolved, "utf-8");
```

## Example in Codebase

`src/lib/server/notes.ts` — defines and exports `safePath()`. Resolves the path against `NOTES_DIR` and throws if the result is outside the notes directory.

`src/routes/api/notes/+server.ts` — calls `safePath()` before reading or writing note files.

## Anti-Patterns

```typescript
// WRONG — allows ../../../etc/passwd traversal
const filePath = path.join(notesDir, req.body.path);
await fs.readFile(filePath, "utf-8");

// WRONG — no validation at all
await fs.readFile(req.body.path, "utf-8");
```

## Related

- [[decisions/ADR-003-file-based-notes]] — why file-based storage requires this pattern
- [[sessions/2026-04-27-analyze-codebase]] — session where this was established
