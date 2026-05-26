---
title: "Workspace-Scoped DB Queries (IDOR Prevention)"
date: 2026-04-27
type: pattern
status: active
agent: orchestrator
tags:
  - pattern
  - security
aliases: []
---

# Workspace-Scoped DB Queries (IDOR Prevention)

## When to Use

Every INSERT, UPDATE, DELETE — and any SELECT that returns sensitive data — on workspace-scoped tables. Tables include: hosts, credentials, flags, findings, snippets, attack_chain_nodes, operation_log, topology_nodes, topology_edges, etc.

## Implementation

```typescript
import { getDb } from "$lib/server/database";

const db = getDb();

// SELECT — scope by workspace
const host = db
  .prepare("SELECT * FROM hosts WHERE id = ? AND workspace_id = ?")
  .get(hostId, workspaceId);

// UPDATE — scope by workspace
db.prepare("UPDATE hosts SET name = ? WHERE id = ? AND workspace_id = ?").run(
  name,
  hostId,
  workspaceId,
);

// DELETE — scope by workspace
db.prepare("DELETE FROM hosts WHERE id = ? AND workspace_id = ?").run(
  hostId,
  workspaceId,
);

// INSERT — always include workspace_id
db.prepare("INSERT INTO hosts (workspace_id, name, ip) VALUES (?, ?, ?)").run(
  workspaceId,
  name,
  ip,
);
```

## Example in Codebase

`src/routes/api/workspaces/[id]/snippets/[snippetId]/+server.ts` — PATCH and DELETE both use `WHERE id = ? AND workspace_id = ?`.

`src/lib/server/database.ts` — `getDb()` singleton with FK enforcement enabled.

## Anti-Patterns

```typescript
// WRONG — single-ID WHERE allows cross-workspace access (IDOR)
db.prepare("DELETE FROM hosts WHERE id = ?").run(hostId);

// WRONG — workspace_id from user body instead of server-validated session
const { workspaceId } = await request.json(); // attacker controls this!
```

## Related

- [[decisions/ADR-005-workspace-isolation]] — the architectural decision behind this pattern
- [[sessions/2026-04-27-analyze-codebase]] — session where this was established
