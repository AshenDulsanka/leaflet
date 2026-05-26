---
title: "ConfirmDialog for All Destructive Actions"
date: 2026-04-27
type: pattern
status: active
agent: orchestrator
tags:
  - pattern
  - ux
aliases: []
---

# ConfirmDialog for All Destructive Actions

## When to Use
Any delete, clear, reset, or other irreversible operation triggered from the UI. Applies to engagement panel delete buttons, note deletion, workspace removal, and any bulk clear operations.

## Implementation

```svelte
<script lang="ts">
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';

  let confirmOpen = $state(false);
  let confirmMessage = $state('');
  let pendingDeleteId = $state<number | null>(null);

  function requestDelete(id: number) {
    pendingDeleteId = id;
    confirmMessage = 'Delete this item? This cannot be undone.';
    confirmOpen = true;
  }

  async function handleConfirmedDelete() {
    if (pendingDeleteId === null) return;
    // perform delete...
    confirmOpen = false;
    pendingDeleteId = null;
  }
</script>

<ConfirmDialog
  bind:open={confirmOpen}
  message={confirmMessage}
  onConfirm={handleConfirmedDelete}
/>
```

## Example in Codebase
`src/lib/components/engagement/FlagTrackerPanel.svelte` — canonical reference for ConfirmDialog usage in engagement panels.

## Anti-Patterns
```svelte
<!-- WRONG — direct delete without confirmation -->
<button onclick={() => deleteItem(id)}>Delete</button>

<!-- WRONG — browser confirm() — non-standard, can't be styled -->
<button onclick={() => { if (confirm('Sure?')) deleteItem(id); }}>Delete</button>
```

## Related
- [[sessions/2026-04-27-analyze-codebase]] — session where this was established
- [[features/engagement-tools]] — all panels that use this pattern
