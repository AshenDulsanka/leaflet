# Features

## Workspace Model

Leaflet supports two workspace types:

- `pentest` for engagement work and the default workspace creation type
- `general` for everyday note-taking

New workspaces default to `pentest`. The app also creates a default workspace on first run so the editor always starts in a usable state.

Workspace type determines what the UI exposes:

- `general` workspaces show the core note-taking tools only
- `pentest` workspaces add the methodology panel and the engagement toolchain

## Core Note-Taking

- WYSIWYG editor with source mode toggle
- auto-save while typing
- wiki-style links and backlinks
- note graph visualization
- image upload, alignment, and lightbox preview
- export to Markdown, HTML, and PDF

## User Templates

User templates are inserted from the Command Palette.

- the Templates tab lists global templates for every workspace
- when a workspace is active, its workspace-scoped templates are merged into the same list
- selecting a template inserts raw Markdown into the editor instead of wrapping it in a shell/code block
- templates can be created and deleted through the API-backed UI

## Methodology Panel

The methodology checklist is a pentest-only helper.

- the panel opens from the toolbar or `Ctrl+.`
- it uses the HTB CPTS preset
- progress is stored locally per preset so checkboxes persist across reloads
- the checklist is hidden entirely outside pentest workspaces

## Engagement Tools

Pentest workspaces expose a grouped toolbar for the engagement panels:

- Host Tracker for discovered hosts, ports, scope, and screenshot references
- Credential Vault for usernames, secrets, and usage tracking
- Flag Tracker for captured flags and submission state
- Attack Chain for linked attack-path notes and MITRE tagging
- Operation Log for timeline-style engagement notes
- Findings Tracker for vulnerability records, severity, CVSS, and remediation status
- Network Topology for host-to-host relationships
- CVSS Calculator for scoring and note insertion
- Command Snippets for reusable commands with variables

## Screenshots

Screenshots are managed separately from notes.

- uploads are stored on disk and can be listed globally or by workspace
- screenshot entries are labeled by filename and support inline preview + insert actions
- screenshot deletion uses `ConfirmDialog` confirmation
- workspace-scoped screenshot browsing is the normal path for engagement work
- the screenshot insert flow uses filename-based markdown labels

## UX Conventions

The current UI uses a few consistent patterns across the app:

- important action icons and buttons stay visible in panel headers/footers (no hover-only dependency)
- destructive actions use `ConfirmDialog`, including Command Snippets clear-all
- major panels are mutually exclusive so the interface does not stack competing tools on top of each other
- engagement and panel dropdowns consistently use the shared `Select` component
- date/time entry uses `DateTimePicker` for consistent UI while keeping native `datetime-local` behavior under the hood
- pentest-only tools are hidden in general workspaces rather than shown in a disabled state

## Sync

- notes and the database are git-backed for local device sync
- the sync button performs the push/pull workflow from the toolbar
- WAL checkpointing keeps the committed database current before sync pushes
