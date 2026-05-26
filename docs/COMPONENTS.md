# Components

## Overview

This page inventories the main Svelte components that make up the visible Leaflet UI. The list focuses on user-facing and stateful components rather than small style helpers.

## Layout Components

| Component | Location | Props | Purpose | Appears In |
|---|---|---|---|---|
| `Sidebar.svelte` | `src/lib/components/layout/Sidebar.svelte` | Workspace, tree, pinned-note, and CRUD callbacks | Renders workspace switching, file tree navigation, and workspace actions | App layout |
| `Toolbar.svelte` | `src/lib/components/layout/Toolbar.svelte` | Bindable panel state plus action callbacks and workspace flags | Top action bar with the always-visible primary controls | App layout |
| `StatusBar.svelte` | `src/lib/components/layout/StatusBar.svelte` | Status and sync state props | Shows save/sync state and editor context | App footer |
| `SyncButton.svelte` | `src/lib/components/layout/SyncButton.svelte` | Sync action props | Shows persistent sync badge, refreshes status, and triggers recommendation-aware pull/push actions | Toolbar |
| `AnimatedThemeToggler.svelte` | `src/lib/components/layout/AnimatedThemeToggler.svelte` | Theme toggle props | Switches between light and dark themes | Toolbar |
| `FileTree.svelte` | `src/lib/components/layout/FileTree.svelte` | Tree data and selection callbacks | Renders the workspace note tree | Sidebar |

## Editor Components

| Component | Location | Props | Purpose | Appears In |
|---|---|---|---|---|
| `Editor.svelte` | `src/lib/components/editor/Editor.svelte` | Note content, save, mode, and insert callbacks | Main Milkdown/CodeMirror editor surface | Main page |
| `FindPanel.svelte` | `src/lib/components/editor/FindPanel.svelte` | Search state and callbacks | In-editor find UI | Editor |
| `ImageToolbar.svelte` | `src/lib/components/editor/ImageToolbar.svelte` | Image selection and alignment props | Edits inserted image formatting | Editor |
| `ImageLightbox.svelte` | `src/lib/components/editor/ImageLightbox.svelte` | Selected image URL and close callback | Full-screen image preview | Editor |

## Panel Components

| Component | Location | Props | Purpose | Appears In |
|---|---|---|---|---|
| `MethodologyPanel.svelte` | `src/lib/components/panels/MethodologyPanel.svelte` | `onClose` | Pentest checklist using the CPTS preset | Pentest workspaces |
| `ScreenshotPanel.svelte` | `src/lib/components/panels/ScreenshotPanel.svelte` | `workspaceId`, `onClose` | Screenshot list with filename labels, inline preview/insert, delete confirmation, and upload | Toolbar screenshot button |
| `SearchPanel.svelte` | `src/lib/components/panels/SearchPanel.svelte` | Search state | Full-text note search | Toolbar search button |
| `BacklinksPanel.svelte` | `src/lib/components/panels/BacklinksPanel.svelte` | Active note context and close callback | Shows inbound note links | Toolbar backlinks button |
| `ExportPanel.svelte` | `src/lib/components/panels/ExportPanel.svelte` | Active note context and export callbacks | Exports the current note | Toolbar export button |
| `NoteGraphPanel.svelte` | `src/lib/components/panels/NoteGraphPanel.svelte` | Graph data and close callback | Displays the workspace note graph | Toolbar graph button |

## Engagement Components

| Component | Location | Props | Purpose | Appears In |
|---|---|---|---|---|
| `HostTrackerPanel.svelte` | `src/lib/components/engagement/HostTrackerPanel.svelte` | `workspaceId`, `onClose` | Host and port inventory, Nmap import, screenshot links | Pentest toolbar |
| `CredentialVaultPanel.svelte` | `src/lib/components/engagement/CredentialVaultPanel.svelte` | `workspaceId`, `onClose` | Credential storage and reuse tracking | Pentest toolbar |
| `FlagTrackerPanel.svelte` | `src/lib/components/engagement/FlagTrackerPanel.svelte` | `workspaceId`, `onClose` | Flag capture and submission tracking | Pentest toolbar |
| `AttackChainPanel.svelte` | `src/lib/components/engagement/AttackChainPanel.svelte` | `workspaceId`, `onClose` | Attack-path canvas and MITRE tagging | Pentest toolbar |
| `OperationLogPanel.svelte` | `src/lib/components/engagement/OperationLogPanel.svelte` | `workspaceId`, `onClose` | Timeline notes for an engagement with discard-confirmation guards for unsaved add/edit modal changes | Pentest toolbar |
| `FindingsTrackerPanel.svelte` | `src/lib/components/engagement/FindingsTrackerPanel.svelte` | `workspaceId`, `onClose` | Vulnerability/finding records and CVSS | Pentest toolbar |
| `NetworkTopologyPanel.svelte` | `src/lib/components/engagement/NetworkTopologyPanel.svelte` | `workspaceId`, `onClose` | Host relationship graph and edge editing | Pentest toolbar |
| `CvssCalculatorPanel.svelte` | `src/lib/components/engagement/CvssCalculatorPanel.svelte` | `workspaceId`, `onClose` | CVSS 3.1 scoring helper | Pentest toolbar |

## Modal and Shared UI Components

| Component | Location | Props | Purpose | Appears In |
|---|---|---|---|---|
| `CommandPalette.svelte` | `src/lib/components/modals/CommandPalette.svelte` | Search state, insertion callbacks, workspace context | Houses templates and command search | Toolbar palette button |
| `NewNoteDialog.svelte` | `src/lib/components/modals/NewNoteDialog.svelte` | Path and template callbacks | Creates notes and folders | Toolbar new-note flow |
| `Dialog.svelte` | `src/lib/components/modals/Dialog.svelte` | Variant, title, message, confirm/cancel actions | Generic modal shell | Shared |
| `ConfirmDialog.svelte` | `src/lib/components/modals/ConfirmDialog.svelte` | `title`, `message`, `confirmLabel?`, `destructive?`, `onConfirm`, `onCancel` | Standard destructive-action confirmation surface, including Command Snippets clear-all | Shared |
| `Select.svelte` | `src/lib/components/ui/Select.svelte` | Options, value, change callback | Shared dropdown control used consistently across engagement and panel forms | Shared |
| `DateTimePicker.svelte` | `src/lib/components/ui/DateTimePicker.svelte` | Value and change callback | Shared calendar + time control (CalendarGrid + TimeField) that emits local `YYYY-MM-DDTHH:MM` values | Shared |

## Notes

- `MethodologyPanel.svelte` and the engagement panels are intentionally workspace-aware so they only render for eligible workspaces
- `ConfirmDialog.svelte` is the standard delete/replace confirmation surface used across the app
- `Select.svelte` and `DateTimePicker.svelte` are shared input controls for engagement/panel forms
- `DateTimePicker.svelte` is currently used by operation log create/edit forms
- This inventory should stay aligned with the visible surfaces in `src/routes/[...path]/+page.svelte`
