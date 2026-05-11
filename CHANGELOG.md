# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Drizzle ORM infrastructure: `drizzle-orm` + `drizzle-kit` installed, `drizzle.config.ts` configured, `src/lib/server/db/schema.ts` mirrors all 15 tables, `src/lib/server/db/index.ts` exposes `getDrizzle()` singleton
- `event.locals.drizzle` wired in `src/hooks.server.ts` and typed in `src/app.d.ts` — type-safe Drizzle client available in all routes
- `pnpm db:generate` and `pnpm db:studio` scripts added to `package.json`
- Screenshot rename modal: fade/fly transitions added for consistent open/close animation
- Shared `ToolModal` component for engagement tools to standardize overlay/dialog animation and container styling
- Operation Log and Findings Tracker now include dedicated edit modals in `uiMode='modal'` (inline edit remains for `uiMode='inline'`)
- Regression component tests added for Attack Chain, Network Topology, and AttackChainNode UX flows (Escape precedence, destructive confirms, node-type visual fallback)

### Removed

- ImageLightbox zoom button removed — zoom was non-functional; lightbox now shows Download + Close only
- Dead `svelte-ignore` comments in `ImageLightbox` cleaned up after zoom removal

### Fixed

- File tree visual hierarchy: folder children now render with consistent 16px per-level indentation (up from 14px), with a unified padding formula applied directly on buttons/rows so children sit clearly inside their parent.
- Folder drag-and-drop reorder reliability: same-sibling folder drags now always reorder (top 50% = before, bottom 50% = after) — no more dead center zone that randomly did nothing.
- Folder self-move guard: dragging a folder onto a file inside itself no longer triggers an invalid self-move call.

### Removed

- Dedicated root drop boxes (top/bottom indicators) removed: any file or folder can now be moved to workspace root by dragging to the very top or bottom edge of the root list — no UI boxes needed.
- Dead `getFolderDropReorderPosition` helper and `FOLDER_REORDER_EDGE_RATIO` constant removed from `FileTree.svelte`.

### Fixed

- Operation Log modal widened to improve readability and reduce cramped add/edit form layout at typical desktop widths.
- File-tree reorder/move restore hardened after stale full-tree validation blocked valid drag-drop operations.
- Invalid URL handling now returns 404 through catch-all route validation instead of surfacing ambiguous route failures.
- Small-screen desktop warning now opens as a centered modal for clearer constrained-width guidance.
- Drag/reorder regression hardening: restored stable cross-level note moves and tightened drop-zone handling to reduce missed drops and accidental no-op drags.
- Workspace selector rollback polish: workspace row action controls now sit adjacent to labels with reliable hit-areas, and reorder interactions no longer interfere with those controls.
- Calendar/date-time modal usability rebalanced: picker interaction and modal behavior tuned to reduce friction during operation-log add/edit flows.
- Error handling hardening: dedicated route-level `+error` surfaces and safer user-facing error messages now prevent leaking internal failure details.
- Added a small-screen desktop warning so constrained desktop widths show a clearer guidance state instead of degraded panel UX.

- Regressions restored: file/folder tree drag-drop now supports cross-level moves (including root top/bottom zones and file-row center-to-parent drop), workspace dropdown regained card-style container with always-visible edit/delete controls, file-row drag dots removed, and destructive delete icons now use stronger red styling in Sidebar workspace rows, Screenshot manager, Operation Log, Findings Tracker, plus improved dark-mode destructive token contrast.
- Tool-panel loading loop regression: Host Tracker, Credential Vault, and Flag Tracker loaders now depend on workspace changes only, keep cached-first rendering, and avoid reactive self-trigger recursion during background refresh.
- Workspace rename now performs safe name+slug migration: updates `notes_folder`, renames workspace notes directory, rewrites workspace-scoped path metadata (`note_sort_order`, screenshot links, finding note paths), and rolls back folder move on DB failure.
- Workspace rename in the editor route now preserves the open note context across slug migration when the active note belongs to the renamed workspace, only falling back to workspace root when there is no migratable active note.
- Right panel container no longer intercepts interactions when closed (`pointer-events-none` in collapsed state).

- Test hardening pass: AttackChainNode assertions now target observable node chip/label + accent mappings (including initial-access, privesc, lateral-movement, data-exfil + unknown fallback), screenshot filename route test now narrows unknown thrown errors before status assertions, and flow-panel addEdge mocks now avoid unconstrained generics
- Sidebar regression fixes: sync controls are compact icon-only in the sidebar header (GitBranch icon removed), file open clicks are no longer swallowed by drag/reorder interactions (drag handle introduced), sidebar resize now enforces min/max bounds in both drag logic and CSS, and Host/Credential/Flag panels now use cached-first background refresh with stale-response guards so cached opens do not show blocking spinners
- Sync notifications now reuse the floating pill system with clearer start/success/info/error feedback for status, pull, and push flows
- Operation Log modal add/edit close paths now guard against unsaved data loss via discard confirmation

- Attack Chain and Network Topology now open in centered windowed dialogs (Note Graph style) instead of full-screen overlays; both legends were repositioned to avoid overlap with left-side flow controls
- Attack Chain now uses `$state.raw` flow arrays for nodes/edges to avoid SvelteFlow proxy-performance warnings, and node deletion from the footer list now requires `ConfirmDialog` confirmation
- Network Topology edge deletion now requires `ConfirmDialog` confirmation before removal
- Attack Chain nodes now use attack-type-specific visual treatments for faster graph scanability
- Attack Chain add-step modal now uses fade transitions for smoother open/close and no longer clips the node type dropdown options
- WYSIWYG wikilink rendering now loads reliably via Milkdown's ProseMirror re-export surface (`@milkdown/kit/prose/*`), removing the fragile direct import path and dynamic-import fallback risk
- WYSIWYG wikilinks now stay rendered as links during caret movement (before/inside/after `[[...]]`) instead of temporarily showing raw tokens
- Backspace at/inside a wikilink in WYSIWYG now removes the full `[[...]]` token atomically instead of deleting one character at a time
- Screenshot rename 400 error — filename init now strips extension before sending; server strips extension defensively before regex validation
- Escape key in rename forms no longer closes the panel when rename modal is open (`stopPropagation` + early guard added)
- HostTrackerPanel: host notes field now displayed in the expanded host detail view
- HostTrackerPanel: Nmap import modal now auto-closes after 2.5 seconds on successful import; skipped when parse errors are present (requiring manual dismiss)
- Operation Log and Findings Tracker create/edit modal overlays now use smooth fade/fly transitions for consistent open/close behavior
- Command Snippets modal input typography normalized to match other tool modals (create/edit snippet and variable dialogs)
- Tool modal consistency pass: Host Tracker Nmap import now uses shared `ToolModal`; Escape handling was hardened across ToolModal/Dialog and key engagement panels with `defaultPrevented` guards plus explicit modal/confirm precedence to reduce parent-panel closes during nested dialogs
- Workspace rename now uses a modal dialog instead of inline dropdown editing
- Workspace rename updates local workspace state optimistically
- File tree workspace-root drop target restored so notes can be moved back to root
- Workspace switch autosave race fixed by cancelling stale save targets during workspace changes to prevent cross-workspace writes
- Sync buttons now retry failed or missing status fetches from the existing pull/push controls, without restoring a separate refresh button

### Changed

- File tree drag UX rollback: intrusive root-drop textbox removed from sidebar, subtle top/bottom root drop zones restored in tree, note rows remain draggable from the row body, and file-row drag grip/dots UI was removed.
- Sync button now matches waypoint pull/push-first UX: manual refresh control removed, status initializes on mount, and status refresh runs after pull/push completion.

- Sync API remains a single `POST /api/sync` endpoint with `action: status | pull | push`; status checks are now local-only (no remote fetch/ahead-behind recommendation pass)
- Sync button now follows simplified local dirty/not-dirty behavior with local-only status checks, and the sidebar header no longer shows the GitBranch icon
- Shared `DateTimePicker` now uses a custom calendar + time picker UI while preserving local `YYYY-MM-DDTHH:MM` value contracts for operation log create/edit forms

- `PATCH /api/screenshots/[filename]` now accepts `newFilename` — renames file on disk, updates DB filename column, returns updated `{ filename, url, caption }`
- ScreenshotPanel: rename action now renames the physical file via PATCH; modal stays open on failure for retry
- ScreenshotPanel: `uiMode: 'modal' | 'inline'` prop added; rename form renders as centered overlay dialog in modal mode
- `ScreenshotPanel` in main page now receives `uiMode` prop
- **Credential Vault:** notes field is now collapsible — hidden by default, revealed via a chevron toggle per credential row; supports multi-line notes with `whitespace-pre-wrap` rendering

### Fixed (continued)

- ImageLightbox: zoomed image now centers in viewport via inner flex centering div; no longer snaps to top-left corner
- ImageLightbox: download button appends anchor to DOM before triggering click (cross-browser fix)

### Security

- Tree API path-boundary validation hardened to reject out-of-workspace traversal attempts before filesystem or tree operations run.
- `renameScreenshotFile()` validates `oldFilename` for path traversal, checks workspace ownership, and performs atomic DB-first rename with filesystem rollback on failure
- `deleteScreenshotMetadata()` now scoped to workspace when `workspaceId` is provided
- Screenshot `DELETE` handler now distinguishes `404` (file not found / `ENOENT`) from `500` (other I/O errors)

### Added (continued)

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

### Fixed (continued 1)

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

### Added (continued 1)

- `WorkspaceCreateModal` CPTS preset toggle — when creating a pentest workspace a checkbox enables the `cpts` preset; the selected preset is stored as `preset = 'cpts'` in the DB and returned on workspace load
- Methodology toolbar button (`ListChecks`) is now gated to `activeWorkspace.preset === 'cpts'`; pentest workspaces without the CPTS preset no longer show the methodology checklist button
- Workspace drag-to-reorder in Sidebar — drag a workspace tab to reorder; new position is persisted immediately via `PATCH /api/workspaces/reorder`
- Workspace right-click context menu in Sidebar — right-clicking a workspace name shows Rename and Delete options as a floating context menu
- File tree root drop zone — files dragged above the `FileTree` component can be dropped to move them to the workspace root folder
- Right panel drag-resize — dragging the left edge of the right panel resizes it between 240–600 px; width resets on panel close
- Host Tracker add-host form: initial port entry field and screenshot association (dropdown of existing workspace screenshots with upload fallback)
- Engagement panel modal mode: all 6 engagement panels (`HostTracker`, `CredVault`, `FlagTracker`, `OperationLog`, `FindingsTracker`, `AttackChain`) accept a `uiMode: 'modal' | 'inline'` prop (default `'modal'`); in modal mode, add forms open as centered overlay dialogs instead of inline expanding sections
- Interaction mode setting in Settings modal — new "Interaction" section toggles between `modal` (default) and `inline` form mode for all engagement panels; preference persisted in `localStorage`

### Fixed (continued 2)

- Screenshot panel "Click to Insert" overlay is now hover-only (was always visible)
- Screenshot panel delete `ConfirmDialog` moved outside the `overflow-hidden` aside element so it renders without clipping
- Dialog button order: confirm/action button is now on the LEFT, cancel on the RIGHT (platform convention)
- Right panel width no longer flashes when toggling between panels — controlled-width wrapper maintains stable layout
- Credential Vault: domain and username are now fully visible; source field is shown under the credential row
- Flag Tracker: delete button is now in the same flex row as the copy button
- Note Graph: hover highlight now works for connected nodes — hovering a node highlights all direct neighbors and fades unconnected nodes/edges (matches Obsidian interactive graph behavior)
- Screenshots panel: view, rename, and delete action buttons moved to persistent row below thumbnail; no longer clipped or unclickable at narrow panel widths
- Host Tracker — create modal: added Notes field; Status and Scope dropdowns moved to same row for consistency with edit modal
- Host Tracker — edit modal: screenshot field replaced with dropdown populated from uploaded screenshots (with image preview); Add port form added so new ports can be created without closing the modal
- Host Tracker — expanded view: port rows no longer show delete button (port deletion is edit-modal-only); screenshot filename replaced with clickable image preview that opens lightbox
- Credential Vault: credential notes now displayed in list view below source; status (valid/invalid/expired/unknown) shown as color-coded badge for instant recognition
- Command Snippets — Variables tab: header description truncated so Add button is always visible at narrow widths; variable values no longer inline-editable — Pencil/edit and Trash/delete buttons open proper modals instead
- Command Snippets — Snippets tab: inline add form replaced with proper create modal including Title, Command, Category, Description, and Global fields; description field shown in snippet list view
- Editor: image delete in hover toolbar now correctly removes the image node (fixes accidental text-line deletion caused by incorrect ProseMirror position lookup)

### Security (continued 1)

- FileTree drop handler validates the dragged source path against known in-memory tree paths before processing; in-memory `draggedPath` state is preferred over the `dataTransfer` string fallback to prevent spoofed drag payloads from operating on arbitrary paths
- Snippet `PATCH` and `DELETE` endpoints: added `workspace_id` ownership check; maximum field length validation on all string inputs; `category` field validated against an allowlist on both `POST /api/workspaces/[id]/snippets` and `PATCH /api/workspaces/[id]/snippets/[snippetId]`
- Workspace folder creation now routes through `safePath()` instead of direct `path.join` (path traversal prevention)
- Workspace type field validated against `['cpts']` allowlist in `POST /api/workspaces`; numeric fields validated as integers in `PATCH` handler
- `PATCH /api/workspaces/reorder` hardened: array length capped at 200, IDs deduplicated before processing, workspace-not-found error no longer echoes the supplied ID
- `GET /api/mitre` error response returns a generic message instead of the upstream HTTP status code

### Added (continued 2)

- DB migration v12: `preset TEXT` and `sort_order INTEGER NOT NULL DEFAULT 0` columns on `workspaces` table; default seeded workspace now sets `preset = 'cpts'`; `preset` and `sort_order` fields added to the `Workspace` interface in `src/lib/types.ts`
- `PATCH /api/workspaces/reorder` — accepts `{ order: string[] }` (workspace IDs in desired display order) and updates each workspace's `sort_order` in a single transaction; validates all IDs exist before committing
- `GET /api/mitre` — proxies the MITRE Enterprise ATT&CK STIX bundle from GitHub raw, extracts `attack-pattern` objects into a typed `MitreTechnique` array (external_id, name, tactic, description, url), caches in-memory for 24 hours, returns 503 on upstream failure
- `workspaceId` prop on `Editor` component; when set, screenshot uploads via paste/drag-drop include `workspace_id` in the FormData so screenshots are workspace-scoped in the DB

### Changed (continued 1)

- `GET /api/workspaces` now orders results by `sort_order ASC, created_at ASC` (previously `created_at DESC`)
- `POST /api/workspaces` accepts optional `preset` field; validated against `['cpts']` allowlist (400 on invalid value)
- `PATCH /api/workspaces/[id]` allows `sort_order` as an updatable field

### Added (continued 3)

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

### Changed (continued 2)

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

### Removed (continued)

- Markdown report generator panel (`ReportGeneratorPanel.svelte`), its API route (`/api/workspaces/[id]/report`), and all references (toolbar button, `reportOpen` state, mutual-exclusion effect). A standalone report service will be built separately and integrated via API in the future. ([#17](https://github.com/AshenDulsanka/leaflet/issues/17))

### Security (continued 2)

- Fix path traversal bypass in `safePath()`: replaced `startsWith` check with `relative()` comparison to prevent sibling-directory escape (e.g. `/data/notes-evil` bypassing `/data/notes` prefix check)

### Added (continued 4)

- Logo and wordmark SVGs (`logo.svg`, `typo.svg`) displayed as combined brand mark in the app toolbar; SVGs use `currentColor` and `hsl(var(--background))` for theme-adaptive rendering in both light and dark mode
- Favicon (`static/favicon.svg`) created from the logo mark with brand-blue fill (`#3b82f6`) — visible on all browser tab backgrounds
- Dynamic page title: browser tab shows the current note name (without `.md` extension), falling back to "Leaflet"
- Note Graph: workspace-scoped view — graph now shows only notes in the active workspace (not all workspaces combined)
- Note Graph: two view mode buttons — Network icon (all workspace notes) and Crosshair icon (local graph — current note and its direct connections only)
- Note Graph: converted from full-screen overlay to centered popup modal (`85vw × 80vh`) with click-outside-to-close
- Note Graph: theme-aware canvas colors — background, links, labels, and highlight colors resolved from live Tailwind CSS and update automatically on dark/light toggle

### Changed (continued 4)

- Agent description fields shortened to single-sentence summaries across all 8 `.github/agents/*.agent.md` files
- Note Graph API (`/api/notes/graph`) now accepts optional `workspace` query parameter for workspace scoping, validated through `safePath()` with outer error boundary

### Fixed (continued 3)

- Resolved lint/compile regressions in Note Graph, toolbar trusted SVG rendering, Host Tracker click handlers, Screenshot panel, Command Snippets variable cleanup, Findings Tracker imports, and route test import paths

- Wiki-link `[[...]]` autocomplete, visual highlighting, and slash-command insertion all repaired: `flattenTree` was silently discarding all note paths (`.md` extension check on already-stripped names), CSS Highlight ranges were invalid due to `domAtPos` element–text-node ambiguity (replaced with DOM `TreeWalker`), and the slash command left `/w[[` instead of `[[` due to unreliable `setTimeout` (replaced with double `requestAnimationFrame` + remnant cleanup)
- SQLite DB connection is now reloaded after `git pull` so the app reads updated data without a server restart ([#5](https://github.com/AshenDulsanka/leaflet/issues/5))
- Wikilink `[[note]]` rendering in WYSIWYG editor — CSS Highlight API approach was unreliable (Range objects became stale when ProseMirror replaced DOM nodes); replaced with ProseMirror `Decoration.inline()` plugin injected via `state.reconfigure()` so highlights stay in sync with the editor's render cycle
- Wikilink autocomplete dropdown keyboard navigation — arrow keys reset to first item on every keyup due to `checkAndUpdateWikilinkDropdown` always resetting `selectedIndex` to `0`; now preserves index when the typed query is unchanged
- Note Graph canvas was blank — `containerEl` was `undefined` at point of force-graph initialization because it lives inside a Svelte `{:else}` block and `loading = false` was set before Svelte flushed the DOM; fixed with `await tick()`
- Note Graph search filter did not highlight nodes — `graph.nodeColor()` was dead code because `nodeCanvasObjectMode(() => 'replace')` bypasses the color callback; node color logic moved into `nodeCanvasObject` so search and hover states render correctly
- XSS in Note Graph tooltip — `nodeLabel` template injected `n.name` and `n.folder` directly into HTML without escaping; added `escapeHtml()` helper applied to all interpolated values
- Note Graph memory leak on close — `onDestroy` called `_destructor()` which does not exist in force-graph; replaced with `pauseAnimation()` to stop the animation RAF loop

### Added (continued 5)

- Auto-manage `.gitkeep` for empty workspace folders — placeholder is written on directory creation and removed when the first note is saved ([#6](https://github.com/AshenDulsanka/leaflet/issues/6))
- Floating pill notification system replaces inline sync status — success/warning/error pills appear bottom-right with 4 s auto-dismiss and a draining progress bar ([#7](https://github.com/AshenDulsanka/leaflet/issues/7))
- Sidebar and workspace tree reload automatically after a successful `git pull` with no manual page refresh required ([#8](https://github.com/AshenDulsanka/leaflet/issues/8))
- GitHub Actions CI pipeline: `pnpm check` → `pnpm lint` → `pnpm build` → `pnpm test` on every PR to `main` and push to `development` ([#9](https://github.com/AshenDulsanka/leaflet/issues/9))
- Vitest unit test suite covering path-safety helpers, notes directory resolution, DB singleton lifecycle, WAL checkpoint, and connection reload

### Changed (continued 3)

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
