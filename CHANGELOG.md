# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CommandSnippetsPanel: snippet edit — Pencil icon per row opens a pre-populated edit modal; changes saved via `PATCH /api/workspaces/[id]/snippets/[snippetId]`
- CommandSnippetsPanel: snippet delete now requires `ConfirmDialog` confirmation before removing
- CommandSnippetsPanel: Variables tab — add-variable form is hidden by default behind a `+` button; per-variable delete styled as destructive red with confirmation; bulk "Clear All" button removed
- ScreenshotPanel: rename screenshot via Pencil icon in hover controls — triggers an inline rename input
- HostTrackerPanel: field labels on all add-host form inputs; edit modal now shows all host fields (IP, hostname, OS, status, scope, notes, screenshot, ports read-only)
- CredentialVaultPanel: Notes field added to credential records; field labels added to all forms
- `extractSnippetVarNames` regex extended from `[A-Z0-9_]+` to `[A-Z0-9_-]+` — hyphenated variable names like `{TEST-NAME}` are now extracted and substituted correctly
- Screenshot panel auto-refreshes when an image is pasted or dropped into the editor — no manual refresh needed
- FileTree right-click "New Note" now opens the same template-picker dialog as the Toolbar button (6 templates: Blank, Module Notes, Section Notes, Machine Writeup, Pentest Engagement, Finding Report, Cheatsheet)
- AI chat footer now displays the active model name dynamically (fetched from `/api/ai/config`) instead of a hardcoded string
- Nmap importer in HostTracker respects `uiMode` — shows as a centered modal overlay in modal mode, inline panel in inline mode
- Edit functionality for HostTracker, CredentialVault, and FlagTracker — each row now has a Pencil edit button that opens an edit form (modal overlay) pre-populated with the existing values
- New `GET /api/ai/config` endpoint returning the active AI provider and model name
- File tree drag-and-drop reordering — drag notes within a folder to reorder them; order persists to SQLite (`note_sort_order` table, migration v13)

### Fixed
- FileTree drag-reorder dead zones — top-level folder-to-folder reorder, sibling folder-to-folder reorder within the same parent, and file drop between two sibling folders now all register correctly; drop zones are split by position: top 30% = insert before, bottom 30% = insert after, center 40% = move into folder
- Editor image toolbar: replaced `posAtCoords` with `posAtDOM` for accurate image-node targeting; type guards added to delete and align handlers to prevent operating on non-image nodes
- HostTrackerPanel: removed stale inline status dropdown from host row, scope dropdown, screenshot edit input, and add-port form from the expanded view; edit form now opens as a centered modal overlay (or inline when `uiMode==='inline'`)
- CredentialVaultPanel: removed inline status dropdown from credential row; edit form now respects `uiMode` — overlay modal by default, inline when `uiMode==='inline'`; Escape key during inline edit now cancels the edit instead of closing the panel
- Remove `overflow-hidden` from FlagTracker, HostTracker, and CredentialVault add-form modal containers — Select dropdowns were being clipped and options were invisible
- Add `transition:fly` and `transition:fade` to FlagTracker, HostTracker, and CredentialVault modal overlay forms for consistent open/close animations
- Add `{uiMode}` prop to `<HostTrackerPanel>` in main page — inline mode was not being passed, so the setting had no effect
- Replace native `<select>` screenshot dropdown in HostTracker (inline and modal forms) with custom `Select` component for visual consistency
- Fix `NewNoteDialog` button order — Create now appears left of Cancel
- Fix AiChat `renderMarkdown()` to HTML-escape all user/AI content before injecting into `{@html}`, preventing XSS via crafted AI responses
- Add `try/catch` error handling to `toggleSubmitted`, `deleteFlag` (FlagTracker), `deleteHost`, `updateHostStatus`, `updateHostScope`, `saveScreenshotFilename`, `deletePort` (HostTracker), `deleteCredential`, `updateStatus` (CredentialVault)

### Added
- `WorkspaceCreateModal` CPTS preset toggle — when creating a pentest workspace a checkbox enables the `cpts` preset; the selected preset is stored as `preset = 'cpts'` in the DB and returned on workspace load
- Methodology toolbar button (`ListChecks`) is now gated to `activeWorkspace.preset === 'cpts'`; pentest workspaces without the CPTS preset no longer show the methodology checklist button
- Workspace drag-to-reorder in Sidebar — drag a workspace tab to reorder; new position is persisted immediately via `PATCH /api/workspaces/reorder`
- Workspace right-click context menu in Sidebar — right-clicking a workspace name shows Rename and Delete options as a floating context menu
- File tree root drop zone — files dragged above the `FileTree` component can be dropped to move them to the workspace root folder
- Right panel drag-resize — dragging the left edge of the right panel resizes it between 240–600 px; width resets on panel close
- Host Tracker add-host form: initial port entry field and screenshot association (dropdown of existing workspace screenshots with upload fallback)
- Engagement panel modal mode: all 6 engagement panels (`HostTracker`, `CredVault`, `FlagTracker`, `OperationLog`, `FindingsTracker`, `AttackChain`) accept a `uiMode: 'modal' | 'inline'` prop (default `'modal'`); in modal mode, add forms open as centered overlay dialogs instead of inline expanding sections
- Interaction mode setting in Settings modal — new "Interaction" section toggles between `modal` (default) and `inline` form mode for all engagement panels; preference persisted in `localStorage`

### Fixed
- Screenshot panel "Click to Insert" overlay is now hover-only (was always visible)
- Screenshot panel delete `ConfirmDialog` moved outside the `overflow-hidden` aside element so it renders without clipping
- Dialog button order: confirm/action button is now on the LEFT, cancel on the RIGHT (platform convention)
- Right panel width no longer flashes when toggling between panels — controlled-width wrapper maintains stable layout
- Credential Vault: domain and username are now fully visible; source field is shown under the credential row
- Flag Tracker: delete button is now in the same flex row as the copy button

### Security
- FileTree drop handler validates the dragged source path against known in-memory tree paths before processing; in-memory `draggedPath` state is preferred over the `dataTransfer` string fallback to prevent spoofed drag payloads from operating on arbitrary paths
- Snippet `PATCH` and `DELETE` endpoints: added `workspace_id` ownership check; maximum field length validation on all string inputs; `category` field validated against an allowlist on both `POST /api/workspaces/[id]/snippets` and `PATCH /api/workspaces/[id]/snippets/[snippetId]`
- Workspace folder creation now routes through `safePath()` instead of direct `path.join` (path traversal prevention)
- Workspace type field validated against `['cpts']` allowlist in `POST /api/workspaces`; numeric fields validated as integers in `PATCH` handler
- `PATCH /api/workspaces/reorder` hardened: array length capped at 200, IDs deduplicated before processing, workspace-not-found error no longer echoes the supplied ID
- `GET /api/mitre` error response returns a generic message instead of the upstream HTTP status code

### Added
- DB migration v12: `preset TEXT` and `sort_order INTEGER NOT NULL DEFAULT 0` columns on `workspaces` table; default seeded workspace now sets `preset = 'cpts'`; `preset` and `sort_order` fields added to the `Workspace` interface in `src/lib/types.ts`
- `PATCH /api/workspaces/reorder` — accepts `{ order: string[] }` (workspace IDs in desired display order) and updates each workspace's `sort_order` in a single transaction; validates all IDs exist before committing
- `GET /api/mitre` — proxies the MITRE Enterprise ATT&CK STIX bundle from GitHub raw, extracts `attack-pattern` objects into a typed `MitreTechnique` array (external_id, name, tactic, description, url), caches in-memory for 24 hours, returns 503 on upstream failure
- `workspaceId` prop on `Editor` component; when set, screenshot uploads via paste/drag-drop include `workspace_id` in the FormData so screenshots are workspace-scoped in the DB

### Changed
- `GET /api/workspaces` now orders results by `sort_order ASC, created_at ASC` (previously `created_at DESC`)
- `POST /api/workspaces` accepts optional `preset` field; validated against `['cpts']` allowlist (400 on invalid value)
- `PATCH /api/workspaces/[id]` allows `sort_order` as an updatable field

### Added
- Test coverage for templates API validation/list/delete flows, screenshot upload and filename metadata routes, workspace-scoped screenshot behaviors, and command search helper matching
- Nessus and Burp Suite XML import for vulnerability findings — upload scanner exports via the Import button in the Findings Tracker panel; auto-deduplicates by title, maps scanner severity to FindingSeverity, and links findings to tracked hosts by IP (Issue #32)
- Network Topology Diagram panel for pentest workspaces — interactive canvas with host nodes (colour-coded by status: up/down/rooted/unknown), drag-to-connect edges, position persistence, and Ctrl+Shift+T shortcut (Issue #31, migration v10)
- DB migration v10: `topo_x`/`topo_y` REAL columns on `hosts` table; `topology_edges` table with `id`, `workspace_id` (FK cascade), `source_host_id`/`target_host_id` (FK cascade), `label`, `created_at`, UNIQUE on `(workspace_id, source_host_id, target_host_id)`; indexes on `workspace_id`, `source_host_id`, `target_host_id`; `TopologyEdge` and `TopologyHost` interfaces added to `src/lib/types.ts`
- `GET /api/workspaces/[id]/topology` — returns all hosts (with port counts and stored canvas positions) and edges for a workspace
- `POST /api/workspaces/[id]/topology/edges` and `DELETE /api/workspaces/[id]/topology/edges/[edgeId]` — create and remove topology connections
- `topo_x` and `topo_y` added to the allowed PATCH fields for `/api/workspaces/[id]/hosts/[hostId]` for position persistence
- Finding templates library: 13 built-in vulnerability templates across 5 categories (Injection, Auth, Crypto, Exposure, Misc) with pre-fill support for title, description, severity, and MITRE technique (Issue #30)
- MITRE ATT&CK technique tagging for vulnerability findings with search-as-you-type picker (Issue #29)
- Vulnerability findings tracker panel: full CRUD findings management for pentest workspaces with severity levels (Critical/High/Medium/Low/Info/None), inline CVSS 3.1 metric pickers with live score display and auto-fill severity from score, status tracking (Open/Confirmed/Remediated/False Positive), optional host link and note reference; dual filter chips for severity and status; accessible via toolbar `Bug` icon and `Ctrl+Shift+F` ([#28](https://github.com/AshenDulsanka/leaflet/issues/28))
- DB migration v8: `findings` table with `id`, `workspace_id` (FK cascade), `title`, `description`, `severity` (CHECK enum), `cvss_score`, `cvss_vector`, `status` (CHECK enum), `host_id` (FK set null), `note_path`, `created_at`, `updated_at`; indexes on `workspace_id`, `status`, and `host_id`; `FindingSeverity`, `FindingStatus`, and `Finding` types added to `src/lib/types.ts`; `GET`/`POST` at `/api/workspaces/[id]/findings` and `PATCH`/`DELETE` at `/api/workspaces/[id]/findings/[findingId]` ([#28](https://github.com/AshenDulsanka/leaflet/issues/28))
- Nmap output parser supporting grepable (-oG) and XML (-oX) formats with bulk host and port upsert into the Host Tracker (DB transaction, update existing hosts/ports); `NmapPort`, `NmapHost`, and `NmapParseResult` interfaces added to `src/lib/types.ts`; pure parser at `src/lib/server/nmap.ts` with `detectFormat`, `parseNmapGrepable`, `parseNmapXml`, and `parseNmap` covered by 19 unit tests; `POST /api/workspaces/[id]/hosts/bulk` endpoint with 2 MB size guard, workspace validation, single-transaction prepare-once upsert ([#27](https://github.com/AshenDulsanka/leaflet/issues/27))
- Import Nmap button (`FileInput` icon) in Host Tracker panel header with live format detection badge (grepable=green, xml=blue, unknown=muted), multi-line textarea, inline error list, and import summary message ([#27](https://github.com/AshenDulsanka/leaflet/issues/27))
- Client-side CVSS 3.1 base-score calculator panel with metric pickers (Attack Vector, Attack Complexity, Privileges Required, User Interaction, Scope, Confidentiality, Integrity, Availability), live numeric score, severity badge (None/Low/Medium/High/Critical), vector string copy button, and insert-into-note action; pure `cvss.ts` utility implements the CVSS 3.1 base formula including scope-adjusted PR weights and ceiling rounding ([#26](https://github.com/AshenDulsanka/leaflet/issues/26))
- CVSS Calculator accessible from toolbar (pentest workspaces, `ShieldAlert` icon, `Ctrl+Shift+V`) and Command Palette quick action ([#26](https://github.com/AshenDulsanka/leaflet/issues/26))
- Pentest operation log timeline panel: migration v7 adds `operation_log` table with `id`, `workspace_id` (FK cascade), `category` (CHECK enum), `description`, `host_id` (FK set null), `timestamp`, `created_at`, `updated_at`, and indexes on `workspace_id`, `timestamp`, and `host_id`; `OpLogCategory` union type and `OperationLogEntry` interface added to `src/lib/types.ts`; `GET`/`POST` at `/api/workspaces/[id]/oplog` and `PATCH`/`DELETE` at `/api/workspaces/[id]/oplog/[entryId]` with category and description validation; `OperationLogPanel` engagement component with timeline listing, category filter chips, add form, inline edit/delete, and linked-host display; `ScrollText` toolbar button added to the pentest button group ([#25](https://github.com/AshenDulsanka/leaflet/issues/25))
- Built-in AI prompt templates: 12 pentest-oriented prompt presets (recon, exploitation, privesc, post-exploitation, ad-attacks, reporting, general) with `[PLACEHOLDER]` tokens; empty chat state shows categorised template cards that insert the prompt into the composer without auto-sending; active-conversation compact picker accessible via a "Prompts" toggle button above the composer; `AiPromptTemplate` interface and `AiPromptCategory` union added to `src/lib/types.ts`; data module at `src/lib/data/ai-prompts.ts` with `searchAiPrompts` helper covered by unit tests ([#24](https://github.com/AshenDulsanka/leaflet/issues/24))
- Snippet variable UX: auto-extract `{VAR_NAME}` placeholders from all snippet commands and merge with persisted workspace variables so unset vars appear immediately; debounced autosave (500 ms) on value input; per-variable delete button; bulk "Clear all" button with confirmation; bulk `DELETE /api/workspaces/[id]/variables` endpoint; single-variable `DELETE /api/workspaces/[id]/variables/[varId]` endpoint (workspace-scoped); `extractSnippetVarNames` pure helper in `src/lib/data/commands.ts` with unit tests ([#23](https://github.com/AshenDulsanka/leaflet/issues/23))
- MITRE ATT&CK technique tagging on attack-chain nodes: migration v6 adds `timestamp`, `mitre_technique_id`, and `mitre_technique_name` columns to `attack_chain_nodes`; MITRE data module (`src/lib/data/mitre-attack.ts`) exposes 130+ techniques with `getMitreTechnique` (exact lookup) and `searchMitreTechniques` (prefix/substring, max 8 results); node PATCH endpoint validates ID format (`T\d{4}(\.\d{3})?`); custom `AttackChainNode` component renders coloured node with linked badge and date; detail drawer in `AttackChainPanel` provides date picker, live MITRE ID search with autocomplete suggestions, and Save (PATCH) action ([#22](https://github.com/AshenDulsanka/leaflet/issues/22))
- Screenshot manager now uses filename labels with inline preview and insert actions; deleting a screenshot requires `ConfirmDialog` confirmation ([#21](https://github.com/AshenDulsanka/leaflet/issues/21))
- Workspace-scoped screenshot metadata stored in DB (migration v5): `linked_note_path` column added to `screenshot_metadata`, unique index on `(workspace_id, filename)` ([#21](https://github.com/AshenDulsanka/leaflet/issues/21))
- `ScreenshotMeta` interface added to `src/lib/types.ts` with `caption` and `linked_note_path` fields
- `PATCH /api/screenshots/[filename]` endpoint for updating caption and linked note path
- `GET /api/screenshots` extended with optional `?workspaceId=` query parameter to merge DB metadata into response
- `POST /api/screenshots` extended: saves metadata row when `workspace_id` is provided in formData
- Insert screenshot into editor now uses filename labels in markdown (`![filename](url)`)
- Host scope status field (`in-scope` / `out-of-scope` / `unknown`) with filter toggle bar and color-coded badges on Host Tracker panel; scope selectable per host in expanded view ([#20](https://github.com/AshenDulsanka/leaflet/issues/20))
- Screenshot filename link on host entries in Host Tracker — enter a screenshot filename to get a direct link to `/api/screenshots/{filename}` in the expanded host details ([#20](https://github.com/AshenDulsanka/leaflet/issues/20))
- Note templates via Command Palette — five pentest-oriented templates (Recon, Vulnerability Finding, Exploit Log, Post-Exploitation Checklist, Active Directory) accessible from a new **Templates** tab in the Command Palette; inserting a template writes raw markdown directly into the editor (no bash code-block wrapper); template search filters by title and description; `NoteTemplate` type added to `src/lib/types.ts`; data module at `src/lib/data/templates.ts` with `searchTemplates` helper covered by unit tests ([#19](https://github.com/AshenDulsanka/leaflet/issues/19))
- Copy-to-clipboard buttons on all engagement panel values (HostTracker IP/hostname/ports, CredentialVault username/secret, FlagTracker flag values) via shared `CopyButton` component with 1.5 s green-check confirmation state ([#18](https://github.com/AshenDulsanka/leaflet/issues/18))

### Changed
- Screenshot listing is workspace-scoped when `workspaceId` is supplied, and empty workspace IDs are rejected
- Screenshot manager cards now use filename labels with preview/insert/delete actions; caption and linked-note controls are no longer exposed in that UI
- Destructive actions now use `ConfirmDialog` instead of native `confirm()` dialogs
- Sidebar workspace controls now support workspace rename and delete actions
- The first-run seeded default workspace is now `pentest`
- User templates in Command Palette include both global templates and workspace-scoped templates
- Methodology remains pentest-gated and continues to ship with the CPTS preset
- Methodology, AI chat, and engagement panels now follow mutual-exclusion behavior
- Engagement and panel dropdowns now consistently use the shared `Select` component
- Date/time fields now use `DateTimePicker`, a wrapper around native `datetime-local`
- Engagement tool action icons are always visible instead of hover-only

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

- Resolved lint/compile regressions in Note Graph, toolbar trusted SVG rendering, Host Tracker click handlers, Screenshot panel, Command Snippets variable cleanup, Findings Tracker imports, and route test import paths

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
