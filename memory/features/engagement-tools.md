# Engagement Tools

## Purpose

Suite of 10 pentest-specific panels available only in `pentest` workspaces. They cover the full lifecycle of a penetration test engagement: host tracking, credential management, flag tracking, attack path visualization, operation logging, vulnerability findings, network topology, CVSS scoring, command reuse, and methodology checklists.

## Key Files

- `src/lib/components/engagement/HostTrackerPanel.svelte` — hosts, open ports, screenshots
- `src/lib/components/engagement/CredentialVaultPanel.svelte` — credential store (username/password/hash/key)
- `src/lib/components/engagement/FlagTrackerPanel.svelte` — CTF/exam flag capture and submission tracking (canonical uiMode reference)
- `src/lib/components/engagement/AttackChainPanel.svelte` — graph-based attack path builder (@xyflow/svelte)
- `src/lib/components/engagement/OperationLogPanel.svelte` — chronological engagement notes
- `src/lib/components/engagement/FindingsTrackerPanel.svelte` — vulnerability findings with severity, CVSS, MITRE mapping
- `src/lib/components/engagement/NetworkTopologyPanel.svelte` — host-to-host relationship canvas
- `src/lib/components/engagement/CvssCalculatorPanel.svelte` — CVSS 3.1 calculator
- `src/lib/components/panels/CommandSnippetsPanel.svelte` — reusable command templates (see [[features/command-snippets]])
- Methodology panel (inline in `+page.svelte`) — CPTS checklist, gated on `preset === 'cpts'`

## Status

in-progress

## Notes

- ALL panels MUST accept `uiMode: 'modal' | 'inline'` prop. See [[patterns/engagement-panel-uimode]].
- `FlagTrackerPanel.svelte` is the canonical reference for correct uiMode and ConfirmDialog implementation.
- Methodology panel is gated on `activeWorkspace.preset === 'cpts'` — NOT on `workspace.type`.
- ConfirmDialog required for every destructive action. See [[patterns/confirm-dialog-destructive]].
- All DB queries must scope by `workspace_id`. See [[patterns/workspace-scoped-queries]].
- Some panels are incomplete; all are in-progress toward v1 release.
- File size goal: each panel should be ≤ 500 lines. Currently many exceed 1000 lines.
- Attack Chain and Network Topology flow tools now use centered windowed dialogs (Note Graph style), with legends positioned away from left-side flow controls.
- Attack Chain add-step modal uses fade transitions and hardened Escape behavior to avoid parent dialog close conflicts.
- Attack Chain nodes use attack-type-specific visual styling for quicker at-a-glance differentiation.
- Network Topology edge deletion and Attack Chain node deletion are both guarded by ConfirmDialog before destructive action.
