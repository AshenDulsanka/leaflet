# Commit Message Conventions

All commits in this repository must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

## Type Prefixes

| Type | Description | Example |
|------|-------------|---------|
| `feat` | A new user-facing feature | `feat(workspace): add CTF/general workspace type selection` |
| `fix` | A bug fix | `fix(sidebar): scope pinned notes to active workspace` |
| `docs` | Documentation changes only | `docs(readme): add Docker setup instructions` |
| `style` | Formatting, whitespace, missing semicolons — no logic change | `style(editor): reformat toolbar button spacing` |
| `refactor` | Code change that is neither a fix nor a feature | `refactor(tree): extract file rename logic to separate function` |
| `perf` | Performance improvement | `perf(search): debounce full-text search queries` |
| `test` | Adding or correcting tests | `test(api): add workspace creation endpoint tests` |
| `chore` | Build process, dependency updates, tooling | `chore(deps): update @milkdown/crepe to v7.6` |
| `ci` | CI/CD pipeline configuration | `ci: add svelte-check step to pull request workflow` |
| `revert` | Reverts a previous commit | `revert: feat(sync): revert git push on sync button` |

## Scopes

Use one of the following scopes when the commit is contained to a specific area:

| Scope | Area |
|-------|------|
| `editor` | Milkdown WYSIWYG or CodeMirror source editor |
| `workspace` | Workspace creation, selection, settings |
| `sidebar` | Sidebar, file tree, pinned notes |
| `tree` | File/folder tree API or component |
| `ai` | AI chat, summarize, provider configuration |
| `engagement` | Host tracker, credential vault, flag tracker, attack chain, report generator |
| `sync` | Git-based sync feature |
| `export` | Note export (Markdown, HTML, PDF) |
| `api` | Server-side API routes |
| `db` | Database schema, migrations |
| `docker` | Dockerfile or docker-compose changes |
| `deps` | Dependency updates (use with `chore` type) |

Scope is optional but recommended for non-trivial commits.

## Subject Line Rules

- Maximum **72 characters**
- Use **imperative mood**: "add", "fix", "remove" — not "added", "fixes", "removes"
- **No period** at the end
- **No capitalisation** of the first letter after the colon

Examples:
- `feat(sync): add git push on sync button click` — correct
- `feat(Sync): Added git push on sync button click.` — wrong (capital, past tense, period)

## Breaking Changes

For breaking changes, add `!` after the type/scope, or add a `BREAKING CHANGE:` footer:

```
feat(db)!: rename notes_folder column to workspace_folder

BREAKING CHANGE: existing databases must be migrated manually
```

Both forms are valid. The `!` form is more visible at a glance.

## Body

Use a body when the subject line alone does not fully convey the change. Wrap at 72 characters. Explain *what changed and why*, not *how*.

```
fix(sidebar): scope pinned notes to active workspace

Pinned notes were stored in a single global localStorage key, meaning
notes pinned in one workspace appeared in all workspaces. This changes
storage to a workspace-keyed object so each workspace has its own
pinned list.
```

## Footer

Use footers for:
- Breaking change descriptions: `BREAKING CHANGE: ...`
- Issue references: `Closes #42`, `Fixes #17`, `Refs #55`

## Examples

### Good Commits

```
feat(workspace): add modal to select CTF vs general workspace type
```
```
fix(sync): run wal_checkpoint before git add to flush SQLite WAL data
```
```
docs(contributing): add PR standards and branch naming reference
```
```
chore(deps): bump better-sqlite3 to 11.8.0
```
```
refactor(api): extract path validation into shared safePath utility
```
```
perf(editor): lazy-load milkdown plugins on first editor focus
```

### Bad Commits

```
fixed stuff
```
```
WIP
```
```
Update files
```
```
feat: Added the new thing I was working on and also fixed a bug in the sidebar
```

The last example is bad because it conflates two changes. Each commit should represent one logical change.
