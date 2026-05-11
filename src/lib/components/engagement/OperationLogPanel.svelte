<script lang="ts">
  import { ScrollText, Plus, X, RefreshCw } from '@lucide/svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import OperationLogEntryForm from '$lib/components/engagement/operation-log/OperationLogEntryForm.svelte';
  import OperationLogEntryItem from '$lib/components/engagement/operation-log/OperationLogEntryItem.svelte';
  import {
    localDateTimeValue,
    toLocalDateTimeValue,
  } from '$lib/components/ui/date-time';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { OpLogCategory, OperationLogEntry } from '$lib/types';

  interface HostOption {
    id: string;
    ip: string;
    hostname: string;
  }

  interface OperationLogFormSnapshot {
    category: OpLogCategory;
    description: string;
    hostId: string;
    timestamp: string;
  }

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
    uiMode?: 'modal' | 'inline';
  }

  let { workspaceId, onClose, uiMode = 'modal' }: Props = $props();

  let entries = $state<OperationLogEntry[]>([]);
  let hosts = $state<HostOption[]>([]);
  let loading = $state(false);
  let addingEntry = $state(false);
  let confirmDelete = $state<{ id: string; label: string } | null>(null);
  let confirmDiscardModal = $state<'add' | 'edit' | null>(null);
  let ignoreEscapeUntil = $state(0);

  // Add-entry form
  let newCategory = $state<OpLogCategory>('other');
  let newDescription = $state('');
  let newHostId = $state('');
  let newTimestamp = $state('');
  let addInitialSnapshot = $state<OperationLogFormSnapshot>({
    category: 'other',
    description: '',
    hostId: '',
    timestamp: '',
  });

  // Inline edit state
  let editingId = $state<string | null>(null);
  let editCategory = $state<OpLogCategory>('other');
  let editDescription = $state('');
  let editHostId = $state('');
  let editTimestamp = $state('');
  let editInitialSnapshot = $state<OperationLogFormSnapshot>({
    category: 'other',
    description: '',
    hostId: '',
    timestamp: '',
  });

  // Category filter
  let categoryFilter = $state<'all' | OpLogCategory>('all');
  let oplogQuery = $state('');

  const CATEGORIES: { value: OpLogCategory; label: string; color: string }[] = [
    { value: 'recon', label: 'Recon', color: 'text-blue-400' },
    { value: 'initial-access', label: 'Initial Access', color: 'text-orange-400' },
    { value: 'exploitation', label: 'Exploitation', color: 'text-red-400' },
    { value: 'post-exploitation', label: 'Post-Exploitation', color: 'text-purple-400' },
    { value: 'lateral-movement', label: 'Lateral Movement', color: 'text-yellow-400' },
    { value: 'privilege-escalation', label: 'Priv-Esc', color: 'text-pink-400' },
    { value: 'exfiltration', label: 'Exfiltration', color: 'text-cyan-400' },
    { value: 'cleanup', label: 'Cleanup', color: 'text-green-400' },
    { value: 'other', label: 'Other', color: 'text-muted-foreground' },
  ];

  const categoryColorMap = $derived(
    Object.fromEntries(CATEGORIES.map((category) => [category.value, category.color])) as Record<OpLogCategory, string>
  );

  const hostOptions = $derived.by(() => [
    { value: '', label: 'No host' },
    ...hosts.map((host) => ({
      value: host.id,
      label: host.hostname ? `${host.ip} (${host.hostname})` : host.ip,
    })),
  ]);

  const filteredEntries = $derived.by(() => {
    let result =
      categoryFilter === 'all' ? entries : entries.filter((e) => e.category === categoryFilter);
    if (oplogQuery.trim()) {
      const q = oplogQuery.toLowerCase();
      result = result.filter((e) => e.description.toLowerCase().includes(q));
    }
    return result;
  });

  const addFormDirty = $derived(
    newCategory !== addInitialSnapshot.category ||
      newDescription !== addInitialSnapshot.description ||
      newHostId !== addInitialSnapshot.hostId ||
      newTimestamp !== addInitialSnapshot.timestamp
  );

  const editFormDirty = $derived(
    editCategory !== editInitialSnapshot.category ||
      editDescription !== editInitialSnapshot.description ||
      editHostId !== editInitialSnapshot.hostId ||
      editTimestamp !== editInitialSnapshot.timestamp
  );

  $effect(() => {
    if (workspaceId) {
      loadEntries();
      loadHosts();
    }
  });

  async function loadEntries(): Promise<void> {
    if (!workspaceId) return;
    entries = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/oplog`);
      if (!res.ok) {
        console.error('Failed to load operation log:', { workspaceId, status: res.status });
        return;
      }
      entries = await res.json();
    } catch {
      console.error('Failed to load operation log');
    } finally {
      loading = false;
    }
  }

  async function loadHosts(): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`);
      if (!res.ok) {
        console.error('Failed to load hosts:', { workspaceId, status: res.status });
        return;
      }
      const data = await res.json();
      hosts = (data as Array<{ id: string; ip: string; hostname: string }>).map((h) => ({
        id: h.id,
        ip: h.ip,
        hostname: h.hostname,
      }));
    } catch {
      console.error('Failed to load hosts');
    }
  }

  function openAddForm(): void {
    const now = localDateTimeValue();
    newTimestamp = now;
    addInitialSnapshot = {
      category: newCategory,
      description: newDescription,
      hostId: newHostId,
      timestamp: now,
    };
    addingEntry = true;
  }

  function closeAddForm(): void {
    addingEntry = false;
    confirmDiscardModal = null;
  }

  function closeEditForm(): void {
    editingId = null;
    confirmDiscardModal = null;
  }

  function requestCloseAddForm(): void {
    if (uiMode === 'modal' && addFormDirty) {
      confirmDiscardModal = 'add';
      return;
    }
    closeAddForm();
  }

  function requestCloseEditForm(): void {
    if (uiMode === 'modal' && editFormDirty) {
      confirmDiscardModal = 'edit';
      return;
    }
    closeEditForm();
  }

  async function addEntry(): Promise<void> {
    if (!workspaceId || !newDescription.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/oplog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          description: newDescription.trim(),
          host_id: newHostId || null,
          timestamp: newTimestamp ? new Date(newTimestamp).toISOString() : new Date().toISOString(),
        }),
      });
      if (!res.ok) return;
      const entry: OperationLogEntry = await res.json();
      entries = [entry, ...entries];
      newCategory = 'other';
      newDescription = '';
      newHostId = '';
      newTimestamp = '';
      closeAddForm();
    } catch {
      console.error('Failed to add operation log entry');
    }
  }

  function startEdit(entry: OperationLogEntry): void {
    editingId = entry.id;
    editCategory = entry.category;
    editDescription = entry.description;
    editHostId = entry.host_id ?? '';
    editTimestamp = toLocalDateTimeValue(entry.timestamp);
    editInitialSnapshot = {
      category: entry.category,
      description: entry.description,
      hostId: entry.host_id ?? '',
      timestamp: toLocalDateTimeValue(entry.timestamp),
    };
  }

  async function saveEdit(id: string): Promise<void> {
    if (!workspaceId || !editDescription.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/oplog/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editCategory,
          description: editDescription.trim(),
          host_id: editHostId || null,
          timestamp: editTimestamp ? new Date(editTimestamp).toISOString() : undefined,
        }),
      });
      if (!res.ok) return;
      const updated: OperationLogEntry = await res.json();
      entries = entries.map((e) => (e.id === id ? updated : e));
      closeEditForm();
    } catch {
      console.error('Failed to update operation log entry');
    }
  }

  async function deleteEntry(id: string): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/oplog/${id}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete entry:', { workspaceId, id, status: res.status }); return; }
      entries = entries.filter((e) => e.id !== id);
    } catch (err) {
      console.error('Failed to delete entry:', { workspaceId, id, error: err });
    }
  }

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.key !== 'Escape') return;

    if (Date.now() < ignoreEscapeUntil) {
      return;
    }

    if (confirmDelete) {
      e.preventDefault();
      ignoreEscapeUntil = Date.now() + 120;
      confirmDelete = null;
      return;
    }

    if (confirmDiscardModal) {
      e.preventDefault();
      ignoreEscapeUntil = Date.now() + 120;
      confirmDiscardModal = null;
      return;
    }

    if (editingId) {
      e.preventDefault();
      requestCloseEditForm();
      return;
    }
    if (addingEntry) {
      e.preventDefault();
      requestCloseAddForm();
      return;
    }
    onClose();
  }

  function requestDelete(entry: OperationLogEntry): void {
    confirmDelete = { id: entry.id, label: entry.description };
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="flex h-full w-80 flex-shrink-0 flex-col border-l border-border bg-card"
  transition:fly={{ x: 320, duration: 200, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-9 items-center justify-between border-b border-border px-3">
    <div class="flex items-center gap-2">
      <ScrollText size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Operation Log</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={loadEntries}
        aria-label="Refresh operation log"
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={openAddForm}
        aria-label="Add log entry"
        title="Add entry"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      <button
        onclick={onClose}
        aria-label="Close operation log panel"
        title="Close"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={13} />
      </button>
    </div>
  </div>

  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center p-4">
      <p class="text-center text-xs text-muted-foreground">Select a workspace to view the operation log</p>
    </div>
  {:else}
    <!-- Category filter -->
    <div class="flex flex-wrap gap-1 border-b border-border px-3 py-2">
      <button
        onclick={() => (categoryFilter = 'all')}
        class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}"
      >
        All
      </button>
      {#each CATEGORIES as cat}
        <button
          onclick={() => (categoryFilter = categoryFilter === cat.value ? 'all' : cat.value)}
          class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {categoryFilter === cat.value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent'}"
        >
          {cat.label}
        </button>
      {/each}
    </div>

    {#if entries.length > 0}
    <div class="border-b border-border px-3 py-2">
      <input
        type="text"
        aria-label="Filter log entries"
        placeholder="Filter log entries..."
        bind:value={oplogQuery}
        class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
    {/if}

    <!-- Add-entry form -->
    {#if addingEntry && uiMode === 'inline'}
      <div class="border-b border-border bg-muted/40 p-3">
        <OperationLogEntryForm
          variant="inline"
          description={newDescription}
          category={newCategory}
          hostId={newHostId}
          timestamp={newTimestamp}
          categoryOptions={CATEGORIES}
          hostOptions={hostOptions}
          submitLabel="Add entry"
          onDescriptionChange={(value) => (newDescription = value)}
          onCategoryChange={(value) => (newCategory = value)}
          onHostChange={(value) => (newHostId = value)}
          onTimestampChange={(value) => (newTimestamp = value)}
          onSubmit={addEntry}
          onCancel={requestCloseAddForm}
        />
      </div>
    {/if}

    <!-- Timeline -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={14} class="animate-spin text-muted-foreground" />
        </div>
      {:else if filteredEntries.length === 0}
        <div class="flex flex-1 items-center justify-center py-8">
          <p class="text-center text-xs text-muted-foreground">
            {categoryFilter === 'all' && !oplogQuery.trim() ? 'No log entries yet' : 'No entries match your filter.'}
          </p>
        </div>
      {:else}
        <ul class="divide-y divide-border">
          {#each filteredEntries as entry (entry.id)}
            <li class="group px-3 py-2.5">
              <OperationLogEntryItem
                {entry}
                {uiMode}
                editing={editingId === entry.id}
                editDescription={editDescription}
                editCategory={editCategory}
                editHostId={editHostId}
                editTimestamp={editTimestamp}
                categoryOptions={CATEGORIES}
                hostOptions={hostOptions}
                {formatTime}
                onStartEdit={startEdit}
                onDeleteRequest={requestDelete}
                onEditDescriptionChange={(value) => (editDescription = value)}
                onEditCategoryChange={(value) => (editCategory = value)}
                onEditHostChange={(value) => (editHostId = value)}
                onEditTimestampChange={(value) => (editTimestamp = value)}
                onSave={() => saveEdit(entry.id)}
                onCancelEdit={() => (editingId = null)}
              />
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

{#if addingEntry && uiMode === 'modal'}
  <ToolModal
    ariaLabel="Add Log Entry"
    onClose={requestCloseAddForm}
    maxWidthClass="max-w-2xl"
    dialogClass="overflow-hidden"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <ScrollText size={14} class="text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Add Log Entry</h2>
      <button
        onclick={requestCloseAddForm}
        aria-label="Close add log entry form"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      ><X size={14} /></button>
    </div>
    <OperationLogEntryForm
      variant="modal"
      description={newDescription}
      category={newCategory}
      hostId={newHostId}
      timestamp={newTimestamp}
      categoryOptions={CATEGORIES}
      hostOptions={hostOptions}
      submitLabel="Add Log Entry"
      onDescriptionChange={(value) => (newDescription = value)}
      onCategoryChange={(value) => (newCategory = value)}
      onHostChange={(value) => (newHostId = value)}
      onTimestampChange={(value) => (newTimestamp = value)}
      onSubmit={addEntry}
      onCancel={requestCloseAddForm}
    />
  </ToolModal>
{/if}

{#if editingId !== null && uiMode === 'modal'}
  <ToolModal
    ariaLabel="Edit Log Entry"
    onClose={requestCloseEditForm}
    maxWidthClass="max-w-2xl"
    dialogClass="overflow-hidden"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <ScrollText size={14} class="text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Edit Log Entry</h2>
      <button
        onclick={requestCloseEditForm}
        aria-label="Close edit log entry form"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      ><X size={14} /></button>
    </div>
    <OperationLogEntryForm
      variant="modal"
      description={editDescription}
      category={editCategory}
      hostId={editHostId}
      timestamp={editTimestamp}
      categoryOptions={CATEGORIES}
      hostOptions={hostOptions}
      submitLabel="Save Changes"
      onDescriptionChange={(value) => (editDescription = value)}
      onCategoryChange={(value) => (editCategory = value)}
      onHostChange={(value) => (editHostId = value)}
      onTimestampChange={(value) => (editTimestamp = value)}
      onSubmit={() => {
        if (!editingId) return;
        saveEdit(editingId);
      }}
      onCancel={requestCloseEditForm}
    />
  </ToolModal>
{/if}

{#if confirmDelete !== null}
  {@const pending = confirmDelete}
  <ConfirmDialog
    title="Delete Action"
    message="Delete this action from the operation log? This cannot be undone."
    onConfirm={() => { deleteEntry(pending.id); confirmDelete = null; }}
    onCancel={() => {
      ignoreEscapeUntil = Date.now() + 120;
      confirmDelete = null;
    }}
  />
{/if}

{#if confirmDiscardModal !== null}
  <ConfirmDialog
    title="Discard Changes"
    message="You have unsaved changes. Discard them and close this form?"
    confirmLabel="Discard"
    onConfirm={() => {
      if (confirmDiscardModal === 'add') {
        closeAddForm();
        return;
      }
      closeEditForm();
    }}
    onCancel={() => {
      ignoreEscapeUntil = Date.now() + 120;
      confirmDiscardModal = null;
    }}
  />
{/if}
