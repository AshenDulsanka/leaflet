---
title: Project Memory
type: moc
tags:
  - moc
---

# Project Memory

> This vault is maintained by AI agents. Open it in Obsidian to explore the knowledge graph.
> Graph view: color-coded by type — blue=decisions, green=patterns, yellow=learnings, purple=sessions, red=reviews.

## Sessions
- [[sessions/2025-07-15-analyze-codebase]] — Initial vault population from analyze-codebase skill
- [[sessions/2026-04-29-flow-panels-doc-sync]] — Document flow-panel UX updates and refresh memory links
- [[sessions/2026-04-30-regression-fix-doc-finalization]] — Finalize regression-fix changelog + memory coverage

## Decisions
- [[decisions/ADR-001-sveltekit-framework]] — SvelteKit 5 as Application Framework
- [[decisions/ADR-002-sqlite-database]] — SQLite via better-sqlite3 for Structured Data
- [[decisions/ADR-003-file-based-notes]] — Markdown Files on Disk for Note Storage
- [[decisions/ADR-004-git-sync]] — Git as the Sync Mechanism
- [[decisions/ADR-005-workspace-isolation]] — Workspace-Scoped Data Isolation (IDOR Prevention)
- [[decisions/ADR-006-ai-optional]] — AI Features Are Optional and Provider-Agnostic
- [[decisions/ADR-007-uimode-prop]] — uiMode Prop Convention for Engagement Panels
- [[decisions/ADR-008-component-size-limit]] — 500-Line Component File Limit
- [[decisions/ADR-009-flow-canvas-dialog-behavior]] — Windowed Dialog + ConfirmDialog Standard for Flow Canvases

## Active Patterns
- [[patterns/safe-path-validation]] — safePath() for All Filesystem Operations
- [[patterns/workspace-scoped-queries]] — Workspace-Scoped DB Queries (IDOR Prevention)
- [[patterns/confirm-dialog-destructive]] — ConfirmDialog for All Destructive Actions
- [[patterns/derived-by-for-blocks]] — $derived.by() for Block-Body Derived Computations
- [[patterns/engagement-panel-uimode]] — uiMode-Aware Engagement Panel Pattern
- [[patterns/api-route-validation]] — API Route Input Validation Pattern

## Learnings
- [[learnings/milkdown-posatdom]] — Use posAtDOM Instead of posAtCoords in Milkdown
- [[learnings/svelte5-derived-by-syntax]] — $derived.by() Required for Multi-Statement Derived Blocks
- [[learnings/svelte-const-placement]] — {@const} Must Be Direct Child of Block Tags
- [[learnings/sveltekit-import-extensions]] — No .js Extension in SvelteKit TypeScript Imports

## Reviews
- [[reviews/2026-04-29-flow-panels-doc-review]] — Docs-only review of flow-panel UX changelog and memory consistency

## Features
- [[features/editor]] — Milkdown WYSIWYG + CodeMirror dual editor
- [[features/workspaces]] — Workspace creation, switching, and scoped data isolation
- [[features/file-tree]] — File tree with zone-based drag-and-drop reorder
- [[features/sync]] — Git-based multi-device sync
- [[features/engagement-tools]] — Suite of 10 pentest-specific panels
- [[features/command-snippets]] — Reusable command templates with variable substitution
- [[features/screenshots]] — Screenshot upload, rename, and engagement linking
- [[features/ai-assistant]] — Optional AI chat and summarize (Gemini)
- [[features/note-graph]] — Visual backlink graph for note relationships
