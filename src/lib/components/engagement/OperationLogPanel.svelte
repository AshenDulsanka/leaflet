<script lang="ts">
  import { ScrollText, Plus, X, RefreshCw, Pencil, Trash2, Check } from '@lucide/svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import DateTimePicker from '$lib/components/ui/DateTimePicker.svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { OpLogCategory, OperationLogEntry } from '$lib/types';

  interface HostOption {
    id: string;
    ip: string;
    hostname: string;
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

  // Add-entry form
  let newCategory = $state<OpLogCategory>('other');
  let newDescription = $state('');
  let newHostId = $state('');
  let newTimestamp = $state('');

  // Inline edit state
  let editingId = $state<string | null>(null);
  let editCategory = $state<OpLogCategory>('other');
  let editDescription = $state('');
  let editHostId = $state('');
  let editTimestamp = $state('');

  // Category filter
  let categoryFilter = $state<'all' | OpLogCategory>('all');

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
    Object.fromEntries(CATEGORIES.map((c) => [c.value, c.color]))
  );

  const filteredEntries = $derived(
    categoryFilter === 'all'
      ? entries
      : entries.filter((e) => e.category === categoryFilter)
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

  function localNow(): string {
    // Returns datetime-local compatible string (YYYY-MM-DDTHH:MM) in local time
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openAddForm(): void {
    newTimestamp = localNow();
    addingEntry = true;
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
      addingEntry = false;
    } catch {
      console.error('Failed to add operation log entry');
    }
  }

  function startEdit(entry: OperationLogEntry): void {
    editingId = entry.id;
    editCategory = entry.category;
    editDescription = entry.description;
    editHostId = entry.host_id ?? '';
    const d = new Date(entry.timestamp);
    const pad = (n: number) => String(n).padStart(2, '0');
    editTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
      editingId = null;
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
    if (e.key === 'Escape') {
      if (editingId) { editingId = null; return; }
      if (addingEntry) { addingEntry = false; return; }
      onClose();
    }
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
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={openAddForm}
        title="Add entry"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      <button
        onclick={onClose}
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

    <!-- Add-entry form -->
    {#if addingEntry && uiMode === 'inline'}
      <div class="space-y-2 border-b border-border bg-muted/40 p-3">
        <textarea
          placeholder="Describe what happened..."
          bind:value={newDescription}
          rows={2}
          class="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => { if (e.key === 'Enter' && e.ctrlKey) addEntry(); if (e.key === 'Escape') { addingEntry = false; } }}
        ></textarea>
        <div class="flex gap-2">
          <Select
            size="sm"
            value={newCategory}
            onchange={(v) => newCategory = v as OpLogCategory}
            options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          />
          <Select
            size="sm"
            value={newHostId}
            onchange={(v) => newHostId = v}
            options={[
              { value: '', label: 'No host' },
              ...hosts.map(h => ({ value: h.id, label: h.hostname ? `${h.ip} (${h.hostname})` : h.ip }))
            ]}
          />
        </div>
        <DateTimePicker
          value={newTimestamp}
          onchange={(v) => newTimestamp = v}
        />
        <div class="flex gap-2">
          <button
            onclick={addEntry}
            class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add entry
          </button>
          <button
            onclick={() => (addingEntry = false)}
            class="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
        </div>
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
            {categoryFilter === 'all' ? 'No log entries yet' : 'No entries for this category'}
          </p>
        </div>
      {:else}
        <ul class="divide-y divide-border">
          {#each filteredEntries as entry (entry.id)}
            <li class="group px-3 py-2.5">
              {#if editingId === entry.id}
                <!-- Inline edit form -->
                <div class="space-y-1.5">
                  <textarea
                    bind:value={editDescription}
                    rows={2}
                    class="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    onkeydown={(e) => { if (e.key === 'Enter' && e.ctrlKey) saveEdit(entry.id); if (e.key === 'Escape') editingId = null; }}
                  ></textarea>
                  <div class="flex gap-1.5">
                    <Select
                      size="sm"
                      value={editCategory}
                      onchange={(v) => editCategory = v as OpLogCategory}
                      options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
                    />
                    <Select
                      size="sm"
                      value={editHostId}
                      onchange={(v) => editHostId = v}
                      options={[
                        { value: '', label: 'No host' },
                        ...hosts.map(h => ({ value: h.id, label: h.hostname ? `${h.ip} (${h.hostname})` : h.ip }))
                      ]}
                    />
                  </div>
                  <DateTimePicker
                    value={editTimestamp}
                    onchange={(v) => editTimestamp = v}
                  />
                  <div class="flex gap-1.5">
                    <button
                      onclick={() => saveEdit(entry.id)}
                      class="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      <Check size={10} /> Save
                    </button>
                    <button
                      onclick={() => (editingId = null)}
                      class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              {:else}
                <!-- Display row -->
                <div class="flex items-start gap-2">
                  <!-- Timeline dot -->
                  <div class="mt-0.5 flex-shrink-0">
                    <span
                      class="inline-block h-2 w-2 rounded-full bg-current {categoryColorMap[entry.category] ?? 'text-muted-foreground'}"
                    ></span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-[10px] font-medium uppercase tracking-wide {categoryColorMap[entry.category] ?? 'text-muted-foreground'}">
                        {CATEGORIES.find((c) => c.value === entry.category)?.label ?? entry.category}
                      </span>
                      <div class="flex items-center gap-0.5">
                        <button
                          onclick={() => startEdit(entry)}
                          title="Edit"
                          class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onclick={() => confirmDelete = { id: entry.id, label: entry.description }}
                          title="Delete"
                          class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                    <p class="mt-0.5 text-xs leading-relaxed text-foreground">{entry.description}</p>
                    <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span class="text-[10px] text-muted-foreground">{formatTime(entry.timestamp)}</span>
                      {#if entry.host_ip}
                        <span class="font-mono text-[10px] text-muted-foreground">
                          {entry.host_ip}{entry.host_hostname ? ` · ${entry.host_hostname}` : ''}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

{#if addingEntry && uiMode === 'modal'}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
    role="button"
    tabindex="-1"
    onclick={() => (addingEntry = false)}
    onkeydown={(e) => { if (e.key === 'Escape') addingEntry = false; }}
    aria-label="Close form"
  ></div>
  <!-- Modal -->
  <div
    class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Add Log Entry"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <ScrollText size={14} class="text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Add Log Entry</h2>
      <button onclick={() => (addingEntry = false)} class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <textarea
        placeholder="Describe what happened..."
        bind:value={newDescription}
        rows={2}
        class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        onkeydown={(e) => { if (e.key === 'Enter' && e.ctrlKey) addEntry(); if (e.key === 'Escape') { addingEntry = false; } }}
      ></textarea>
      <div class="flex gap-2">
        <Select
          size="sm"
          value={newCategory}
          onchange={(v) => newCategory = v as OpLogCategory}
          options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
        />
        <Select
          size="sm"
          value={newHostId}
          onchange={(v) => newHostId = v}
          options={[
            { value: '', label: 'No host' },
            ...hosts.map(h => ({ value: h.id, label: h.hostname ? `${h.ip} (${h.hostname})` : h.ip }))
          ]}
        />
      </div>
      <DateTimePicker
        value={newTimestamp}
        onchange={(v) => newTimestamp = v}
      />
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button onclick={addEntry} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Log Entry</button>
      <button onclick={() => (addingEntry = false)} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
    </div>
  </div>
{/if}

{#if confirmDelete !== null}
  {@const pending = confirmDelete}
  <ConfirmDialog
    title="Delete Action"
    message="Delete this action from the operation log? This cannot be undone."
    onConfirm={() => { deleteEntry(pending.id); confirmDelete = null; }}
    onCancel={() => confirmDelete = null}
  />
{/if}
