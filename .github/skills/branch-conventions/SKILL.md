---
name: branch-conventions
description: Use when creating a branch or reviewing branch names. Covers type prefixes (feat, fix, docs, chore, refactor, ci), naming rules (all lowercase, hyphens only, 2-5 words), branch lifecycle from cut to delete, and correct/wrong examples.
---

# Branch Naming Conventions

All branches in this repository must follow these conventions.

## Format

```
<type>/<issue-number>-<short-description>
```

Include the issue number when a GitHub issue exists for the work.

## Type Prefixes

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New user-facing feature | `feat/7-floating-pill-notifications` |
| `fix` | Bug fix | `fix/pinned-notes-workspace-scope` |
| `docs` | Documentation updates only | `docs/contributing-guide` |
| `chore` | Maintenance, dependency updates, tooling | `chore/bump-milkdown-v7` |
| `refactor` | Code restructure with no behaviour change | `refactor/extract-file-tree-logic` |
| `ci` | CI/CD pipeline changes | `ci/add-svelte-check-workflow` |

## Rules

- All lowercase — no uppercase letters in branch names.
- Hyphens only — no underscores, spaces, or other separators.
- No slashes except the single type prefix separator (`feat/`, not `feat/sub/name`).
- Short description: 2-5 words max, hyphenated.
- Always cut from `development`.

## Examples

### Correct

```
feat/7-floating-pill-notifications
fix/5-sqlite-reload-after-pull
fix/default-workspace-on-fresh-clone
docs/architecture-overview
chore/update-sveltekit-2-17
refactor/workspace-api-error-handling
```

### Wrong

```
feature/add_workspace_type     # underscore, wrong type prefix spelling
Fix/sidebar-pinned-notes       # uppercase
my-fix                         # missing type prefix
feat/add-the-new-ctf-workspace-type-selection-dialog  # too long
```

## Lifecycle

1. Cut branch from `development`: `git checkout development && git checkout -b feat/42-short-description`
2. Work in small, focused commits following `commit-conventions/SKILL.md`.
3. Open a pull request targeting `development` when ready.
4. Delete branch after merge.
