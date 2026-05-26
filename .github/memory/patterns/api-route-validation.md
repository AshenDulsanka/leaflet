---
title: "API Route Input Validation Pattern"
date: 2026-04-27
type: pattern
status: active
agent: orchestrator
tags:
  - pattern
  - security
aliases: []
---

# API Route Input Validation Pattern

## When to Use

Every POST, PATCH, and PUT route that accepts a request body. Applied to all routes under `src/routes/api/`.

## Implementation

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getDb } from "$lib/server/database";

const VALID_CATEGORIES = [
  "recon",
  "exploitation",
  "post-exploitation",
  "reporting",
] as const;
const MAX_NAME_LENGTH = 255;
const MAX_CONTENT_LENGTH = 10_000;

export const POST: RequestHandler = async ({ request, params }) => {
  const workspaceId = parseInt(params.id);
  if (isNaN(workspaceId)) {
    return json({ error: "Invalid workspace ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 1. Check required fields
  const { name, category, content } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) {
    return json({ error: "name is required" }, { status: 400 });
  }

  // 2. Validate max lengths
  if (name.length > MAX_NAME_LENGTH) {
    return json({ error: "name too long" }, { status: 400 });
  }

  // 3. Validate allowlists (enums/categories)
  if (
    !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
  ) {
    return json({ error: "Invalid category" }, { status: 400 });
  }

  // 4. Parameterized DB query (never string interpolation)
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO snippets (workspace_id, name, category, content) VALUES (?, ?, ?, ?)",
    )
    .run(workspaceId, name.trim(), category, content ?? "");

  return json({ id: result.lastInsertRowid }, { status: 201 });
};
```

## Example in Codebase

`src/routes/api/workspaces/[id]/snippets/+server.ts` — enforces category allowlist on POST and PATCH.

`src/routes/api/workspaces/+server.ts` — validates workspace type as `pentest | general`.

## Anti-Patterns

```typescript
// WRONG — raw user string passed to DB without validation
const { category } = await request.json();
db.prepare("INSERT INTO items (category) VALUES (?)").run(category);

// WRONG — string interpolation in SQL (SQL injection)
db.prepare(`INSERT INTO items (name) VALUES ('${name}')`).run();
```

## Related

- [[decisions/ADR-005-workspace-isolation]] — workspace_id scoping
- [[decisions/ADR-002-sqlite-database]] — parameterized queries via better-sqlite3
- [[sessions/2026-04-27-analyze-codebase]] — session where this was established
