---
title: "uiMode-Aware Engagement Panel Pattern"
date: 2026-04-27
type: pattern
status: active
agent: orchestrator
tags:
  - pattern
  - svelte5
  - ux
aliases: []
---

# uiMode-Aware Engagement Panel Pattern

## When to Use
Building any new engagement panel that includes add or edit forms. All engagement panels (HostTracker, CredentialVault, FlagTracker, FindingsTracker, CommandSnippets, OperationLog, etc.) must implement this pattern.

## Implementation

```svelte
<script lang="ts">
  interface Props {
    workspaceId: number;
    uiMode?: 'modal' | 'inline';
  }

  let { workspaceId, uiMode = 'modal' }: Props = $props();

  let showAddForm = $state(false);
  let editingId = $state<number | null>(null);
</script>

<!-- Inline form branch -->
{#if uiMode === 'inline'}
  <button onclick={() => showAddForm = !showAddForm}>Add Item</button>
  {#if showAddForm}
    <div class="inline-form">
      <!-- form fields here -->
    </div>
  {/if}
{:else}
  <!-- Modal branch -->
  <button onclick={() => showAddForm = true}>Add Item</button>
  {#if showAddForm}
    <div class="modal-overlay">
      <div class="modal-dialog">
        <!-- form fields here -->
        <button onclick={() => showAddForm = false}>Cancel</button>
      </div>
    </div>
  {/if}
{/if}
```

## Example in Codebase
`src/lib/components/engagement/FlagTrackerPanel.svelte` — canonical reference for uiMode-aware panel with both modal and inline branches.

`src/routes/[...path]/+page.svelte` — reads `uiMode` from localStorage and passes it as prop to all engagement panels.

## Anti-Patterns
```svelte
<!-- WRONG — hardcodes modal mode, ignores user preference -->
<div class="modal-overlay">...</div>

<!-- WRONG — reads localStorage inside the panel instead of receiving it as prop -->
<script>
  const uiMode = localStorage.getItem('leaflet-ui-mode') ?? 'modal';
</script>
```

## Related
- [[decisions/ADR-007-uimode-prop]] — the architectural decision behind this pattern
- [[features/engagement-tools]] — all panels using this convention
- [[sessions/2026-04-27-analyze-codebase]] — session where this was established
