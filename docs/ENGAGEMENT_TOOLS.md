# Engagement Tools

## Overview

The engagement toolset is available in pentest workspaces. It is designed around fast data entry, always-visible action icons, shared `Select` dropdowns, `DateTimePicker` inputs, and `ConfirmDialog` for destructive operations.

## Host Tracker

Location: `src/lib/components/engagement/HostTrackerPanel.svelte`

What it does:

- tracks hosts, ports, scope, status, and screenshots
- supports Nmap import for bulk host and port creation
- exposes always-visible add/update/delete action icons in the panel UI
- uses `ConfirmDialog` for destructive actions

Useful behavior:

- host entries can store a screenshot filename link for quick navigation
- ports are managed per host and kept in the workspace scope
- scope and status are part of the current UX, not hidden metadata

## Credential Vault

Location: `src/lib/components/engagement/CredentialVaultPanel.svelte`

What it does:

- stores usernames and secrets found during an engagement
- records credential type, source host, and notes
- exposes copy actions for secrets and usernames
- uses `ConfirmDialog` for deletes and destructive resets

## Flag Tracker

Location: `src/lib/components/engagement/FlagTrackerPanel.svelte`

What it does:

- records user/root/other flags per workspace
- tracks submission state and the host used to capture the flag
- links flags back to screenshots and notes when available
- uses `ConfirmDialog` for destructive actions

## Attack Chain

Location: `src/lib/components/engagement/AttackChainPanel.svelte`

What it does:

- builds an attack-path graph from engagement nodes and edges
- supports MITRE ATT&CK tagging on nodes
- keeps the canvas and detail drawer in sync with the active workspace

## Operation Log

Location: `src/lib/components/engagement/OperationLogPanel.svelte`

What it does:

- stores chronological engagement notes
- supports category filtering and host linking
- uses `DateTimePicker` for timestamp entry/editing
- uses `ConfirmDialog` for deletes
- keeps create and edit actions visible in the panel instead of hiding them behind menus

## Findings Tracker

Location: `src/lib/components/engagement/FindingsTrackerPanel.svelte`

What it does:

- tracks vulnerability findings in pentest workspaces
- stores severity, CVSS data, status, host links, note links, and MITRE techniques
- supports finding templates for prefill
- supports scanner import workflows for vulnerability exports

## Network Topology

Location: `src/lib/components/engagement/NetworkTopologyPanel.svelte`

What it does:

- renders host-to-host relationships on a canvas
- lets the user create and delete edges
- persists node positions back to the host record
- is workspace-scoped and pentest-only

## CVSS Calculator

Location: `src/lib/components/engagement/CvssCalculatorPanel.svelte`

What it does:

- calculates CVSS 3.1 base scores from the standard metrics
- shows the live score and severity category
- can insert the generated vector into a note

## Command Snippets

Location: command-snippet UI in the engagement toolbar and command palette

What it does:

- stores reusable commands with `{VARIABLE}` placeholders
- merges global snippets with workspace-scoped snippets
- shows missing variables immediately so templates can be filled in-place
- supports variable cleanup and clear-all flows with `ConfirmDialog` confirmation

## UX Conventions

Across the engagement tools, the app follows the same interaction rules:

- primary action icons stay visible in the panel chrome (not hover-only)
- destructive actions use `ConfirmDialog`
- engagement and panel dropdowns use the shared `Select` component
- date/time fields use `DateTimePicker` (native `datetime-local` behavior under the hood)
- panelless general workspaces do not show the pentest toolbar
- the methodology checklist is separate from engagement data, remains pentest-only, and uses the CPTS preset
