# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Screenshot captions: inline editable caption field on each screenshot tile in the Screenshots panel; click to edit, saved on blur or Enter via PATCH endpoint ([#21](https://github.com/AshenDulsanka/leaflet/issues/21))
- Screenshot note linking: link any screenshot to a note via a searchable picker in the Screenshots panel; linked note name displayed with an unlink button ([#21](https://github.com/AshenDulsanka/leaflet/issues/21))
- Workspace-scoped screenshot metadata stored in DB (migration v5): `linked_note_path` column added to `screenshot_metadata`, unique index on `(workspace_id, filename)` ([#21](https://github.com/AshenDulsanka/leaflet/issues/21))
- `ScreenshotMeta` interface added to `src/lib/types.ts` with `caption` and `linked_note_path` fields
- `PATCH /api/screenshots/[filename]` endpoint for updating caption and linked note path
- `GET /api/screenshots` extended with optional `?workspaceId=` query parameter to merge DB metadata into response
- `POST /api/screenshots` extended: saves metadata row when `workspace_id` is provided in formData
- Insert screenshot into editor now uses caption as markdown alt text (`![caption](url)`)
- Host scope status field (`in-scope` / `out-of-scope` / `unknown`) with filter toggle bar and color-coded badges on Host Tracker panel; scope selectable per host in expanded view ([#20](https://github.com/AshenDulsanka/leaflet/issues/20))
- Screenshot filename link on host entries in Host Tracker — enter a screenshot filename to get a direct link to `/api/screenshots/{filename}` in the expanded host details ([#20](https://github.com/AshenDulsanka/leaflet/issues/20))
- Note templates via Command Palette — five pentest-oriented templates (Recon, Vulnerability Finding, Exploit Log, Post-Exploitation Checklist, Active Directory) accessible from a new **Templates** tab in the Command Palette; inserting a template writes raw markdown directly into the editor (no bash code-block wrapper); template search filters by title and description; `NoteTemplate` type added to `src/lib/types.ts`; data module at `src/lib/data/templates.ts` with `searchTemplates` helper covered by unit tests ([#19](https://github.com/AshenDulsanka/leaflet/issues/19))
- Copy-to-clipboard buttons on all engagement panel values (HostTracker IP/hostname/ports, CredentialVault username/secret, FlagTracker flag values) via shared `CopyButton` component with 1.5 s green-check confirmation state ([#18](https://github.com/AshenDulsanka/leaflet/issues/18))

### Removed
- Markdown report generator panel (`ReportGeneratorPanel.svelte`), its API route (`/api/workspaces/[id]/report`), and all references (toolbar button, `reportOpen` state, mutual-exclusion effect). A standalone report service will be built separately and integrated via API in the future. ([#17](https://github.com/AshenDulsanka/leaflet/issues/17))

### Security
- Fix path traversal bypass in `safePath()`: replaced `startsWith` check with `relative()` comparison to prevent sibling-directory escape (e.g. `/data/notes-evil` bypassing `/data/notes` prefix check)

### Added
- Logo and wordmark SVGs (`logo.svg`, `typo.svg`) displayed as combined brand mark in the app toolbar; SVGs use `currentColor` and `hsl(var(--background))` for theme-adaptive rendering in both light and dark mode
- Favicon (`static/favicon.svg`) created from the logo mark with brand-blue fill (`#3b82f6`) — visible on all browser tab backgrounds
- Dynamic page title: browser tab shows the current note name (without `.md` extension), falling back to "Leaflet"
- Note Graph: workspace-scoped view — graph now shows only notes in the active workspace (not all workspaces combined)
- Note Graph: two view mode buttons — Network icon (all workspace notes) and Crosshair icon (local graph — current note and its direct connections only)
- Note Graph: converted from full-screen overlay to centered popup modal (`85vw × 80vh`) with click-outside-to-close
- Note Graph: theme-aware canvas colors — background, links, labels, and highlight colors resolved from live Tailwind CSS and update automatically on dark/light toggle

### Changed
- Agent description fields shortened to single-sentence summaries across all 8 `.github/agents/*.agent.md` files
- Note Graph API (`/api/notes/graph`) now accepts optional `workspace` query parameter for workspace scoping, validated through `safePath()` with outer error boundary

### Fixed

- Wiki-link `[[...]]` autocomplete, visual highlighting, and slash-command insertion all repaired: `flattenTree` was silently discarding all note paths (`.md` extension check on already-stripped names), CSS Highlight ranges were invalid due to `domAtPos` element–text-node ambiguity (replaced with DOM `TreeWalker`), and the slash command left `/w[[` instead of `[[` due to unreliable `setTimeout` (replaced with double `requestAnimationFrame` + remnant cleanup)
- SQLite DB connection is now reloaded after `git pull` so the app reads updated data without a server restart ([#5](https://github.com/AshenDulsanka/leaflet/issues/5))
- Wikilink `[[note]]` rendering in WYSIWYG editor — CSS Highlight API approach was unreliable (Range objects became stale when ProseMirror replaced DOM nodes); replaced with ProseMirror `Decoration.inline()` plugin injected via `state.reconfigure()` so highlights stay in sync with the editor's render cycle
- Wikilink autocomplete dropdown keyboard navigation — arrow keys reset to first item on every keyup due to `checkAndUpdateWikilinkDropdown` always resetting `selectedIndex` to `0`; now preserves index when the typed query is unchanged
- Note Graph canvas was blank — `containerEl` was `undefined` at point of force-graph initialization because it lives inside a Svelte `{:else}` block and `loading = false` was set before Svelte flushed the DOM; fixed with `await tick()`
- Note Graph search filter did not highlight nodes — `graph.nodeColor()` was dead code because `nodeCanvasObjectMode(() => 'replace')` bypasses the color callback; node color logic moved into `nodeCanvasObject` so search and hover states render correctly
- XSS in Note Graph tooltip — `nodeLabel` template injected `n.name` and `n.folder` directly into HTML without escaping; added `escapeHtml()` helper applied to all interpolated values
- Note Graph memory leak on close — `onDestroy` called `_destructor()` which does not exist in force-graph; replaced with `pauseAnimation()` to stop the animation RAF loop

### Added

- Auto-manage `.gitkeep` for empty workspace folders — placeholder is written on directory creation and removed when the first note is saved ([#6](https://github.com/AshenDulsanka/leaflet/issues/6))
- Floating pill notification system replaces inline sync status — success/warning/error pills appear bottom-right with 4 s auto-dismiss and a draining progress bar ([#7](https://github.com/AshenDulsanka/leaflet/issues/7))
- Sidebar and workspace tree reload automatically after a successful `git pull` with no manual page refresh required ([#8](https://github.com/AshenDulsanka/leaflet/issues/8))
- GitHub Actions CI pipeline: `pnpm check` → `pnpm lint` → `pnpm build` → `pnpm test` on every PR to `main` and push to `development` ([#9](https://github.com/AshenDulsanka/leaflet/issues/9))
- Vitest unit test suite covering path-safety helpers, notes directory resolution, DB singleton lifecycle, WAL checkpoint, and connection reload

### Changed

- Wikilink autocomplete dropdown: added search input at top for filtering notes in large workspaces; results list now shows up to 50 items (was 8); "No notes found" empty state shown when search has no matches
- Wikilink autocomplete dropdown: improved accessibility — `role="combobox"` on search input with `aria-controls`, `aria-activedescendant`, `aria-autocomplete`; Tab key accepts highlighted suggestion (same as Enter)
- Note Graph hover highlighting: hovering a node highlights it and its direct neighbors in indigo, dims unconnected nodes and links (Obsidian-style focus view); labels always visible regardless of zoom level
- Note Graph: `graph` variable changed from `$state` to plain reference to avoid unnecessary deep Proxy over force-graph internals; `graphReady = $state(false)` used as the reactive gate instead

## [0.1.0] - 2026-04-08

### Added
- WYSIWYG editor (Milkdown) with source mode toggle (CodeMirror)
- LaTeX math rendering (inline and block)
- Syntax-highlighted code blocks
- Auto-save with 1.5 second debounce
- Full-text search across all notes
- Wiki-style `[[links]]` with backlinks panel
- Note graph visualization (force-directed canvas)
- Image upload, alignment, and lightbox
- Export to Markdown, HTML, and PDF
- Workspace isolation with `pentest` and `general` workspace types; `pentest` unlocks the engagement toolbar
- CTF workspace tools: host tracker, credential vault, flag tracker, attack chain visualizer, command snippets, report generator
- AI chat and summarize (Google Gemini default, MiniMax optional)
- Git-based sync button (push/pull) with inline status messages
- Default Workspace created on first run
- Pinned notes scoped per workspace
- Docker setup for development and production

### Fixed
- Sync API now detects the Git repo root instead of checking the data directory directly
- Git cross-filesystem boundary discovery enabled so the repo root is found correctly inside Docker
- SSL certificates, Git identity env vars, and GitHub token auth added to Docker sync environment
- Double workspace-prefix prevented when creating notes in subfolders
- `general` set as the correct default workspace type in the workspaces API
- `better-sqlite3` native binding now builds correctly with pnpm 10+
- `@const` removed from `#if` block to resolve `svelte-check` chunk-split error
- `.git` directory mounted in Docker and `git add` scoped to the `data/` directory only
- Light theme warm off-white background (`#f0eee6`) applied correctly
- Warm palette extended to `secondary`, `muted`, `accent`, `border`, and `input` tokens in light theme
- Theme toggle animation duration increased to 600 ms
- Code quality pass: ESLint and `svelte-check` corrections applied
