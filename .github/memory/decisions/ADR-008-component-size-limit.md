---
title: "500-Line Component File Limit"
date: 2026-04-27
type: decision
status: active
agent: orchestrator
task: "Analyze codebase — initial vault population"
tags:
  - decision
aliases: []
---

# 500-Line Component File Limit

## Context
Most engagement panel files currently exceed 1000 lines, making them hard to review, test, and maintain. The project is targeting open-source release quality. Large files also make AI-assisted development less reliable — agents lose context at the edges of large files.

## Options Considered

### Option A — 500-line soft limit, proactive splitting
- **Pros:** Gradual refactor, can be applied session-by-session, doesn't require a dedicated refactor sprint.
- **Cons:** Some files will temporarily remain oversized.

### Option B — 300-line hard limit, immediate refactor
- **Pros:** Smaller files.
- **Cons:** Large upfront refactor risk, may break functionality.

## Decision
Files should not exceed approximately 500 lines. When an agent touches a file that is over 500 lines, it should proactively split it into focused sub-components before or alongside the primary change. Atomic design preferred: extract reusable UI atoms, molecules, and organisms into separate files.

## Consequences
- No individual `.svelte`, `.ts`, or `.server.ts` file should be created over 500 lines.
- When editing any file over 500 lines, splitting is expected as part of the task.
- Sub-components live in the same feature directory or `src/lib/components/ui/` for pure UI atoms.
- This is a gradual refactor goal — no deadline, but every session should make progress.

## Related
- [[sessions/2026-04-27-analyze-codebase]] — session where this was decided
