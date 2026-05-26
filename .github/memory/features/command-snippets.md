# Command Snippets

## Purpose

Library of reusable command templates for pentest workflows. Templates support variable substitution using `{VAR-NAME}` syntax (uppercase letters, digits, underscore, hyphen allowed). Users can create snippets with a category, copy them to clipboard with variables pre-filled via a prompt dialog, and manage them per workspace.

## Key Files

- `src/lib/components/panels/CommandSnippetsPanel.svelte` — UI panel; list, add, edit, delete, copy with variable substitution
- `src/routes/api/workspaces/[id]/snippets/+server.ts` — GET list, POST create
- `src/routes/api/workspaces/[id]/snippets/[snippetId]/+server.ts` — PATCH update, DELETE
- `src/lib/data/commands.ts` — built-in default command templates (seed data)

## Status

stable

## Notes

- Category allowlist is enforced on both POST and PATCH routes — raw user strings must not reach the DB unchecked.
- Variable regex: `[A-Z0-9_-]+` — only uppercase, digits, underscore, hyphen inside `{}`.
- Variable substitution prompts user for each `{VAR}` found in the command before copying.
- Import `commands.ts` without `.js` extension: `import { ... } from '$lib/data/commands'`.
