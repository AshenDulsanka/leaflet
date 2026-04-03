# Branch Naming Conventions

All branches in this repository must follow these conventions.

## Format

```
<type>/<short-description>
```

## Type Prefixes

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New user-facing feature | `feat/workspace-type-selection` |
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
- Always cut from `main`.

## Examples

### Correct

```
feat/git-sync-button
fix/default-workspace-on-fresh-clone
fix/sqlite-wal-checkpoint-before-push
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

1. Cut branch from `main`: `git checkout main && git checkout -b feat/short-description`
2. Work in small, focused commits following `commit-conventions.md`.
3. Open a pull request to `main` when ready.
4. Delete branch after merge.
