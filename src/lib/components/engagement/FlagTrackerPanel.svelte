<script lang="ts">
  import { Flag, Plus, X, RefreshCw, CheckCircle2, Circle, Trash2, Pencil } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface FlagEntry {
    id: string;
    value: string;
    flag_type: string;
    capture_method: string;
    captured_at: string;
    submitted: number;
    notes: string;
    host_ip: string | null;
    host_hostname: string | null;
  }

  interface Props {
    workspaceId: string | null;
    totalFlags?: number;
    passingFlags?: number;
    onClose: () => void;
    uiMode?: 'modal' | 'inline';
  }

  let { workspaceId, totalFlags = 0, passingFlags = 0, onClose, uiMode = 'modal' }: Props = $props();

  let flags = $state<FlagEntry[]>([]);
  let loading = $state(false);
  let addingFlag = $state(false);
  let confirmDelete = $state<{ id: string; label: string } | null>(null);

  // Add-flag form
  let newValue = $state('');
  let newFlagType = $state('user');
  let newCaptureMethod = $state('');
  let newNotes = $state('');

  // Edit-flag state
  let editingFlagId = $state<string | null>(null);
  let editValue = $state('');
  let editFlagType = $state('user');
  let editCaptureMethod = $state('');
  let editNotes = $state('');

  $effect(() => {
    if (workspaceId) loadFlags();
  });

  async function loadFlags(): Promise<void> {
    if (!workspaceId) return;
    flags = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/flags`);
      if (!res.ok) {
        console.error('Failed to load flags:', { workspaceId, status: res.status });
        return;
      }
      flags = await res.json();
    } catch (err) {
      console.error('Failed to load flags:', { workspaceId, error: err });
    } finally {
      loading = false;
    }
  }

  async function addFlag(): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: newValue.trim(),
          flag_type: newFlagType,
          capture_method: newCaptureMethod.trim(),
          notes: newNotes.trim()
        })
      });
      if (!res.ok) {
        console.error('Failed to add flag:', { workspaceId, status: res.status });
        return;
      }
      const flag: FlagEntry = await res.json();
      flags = [...flags, flag];
      newValue = '';
      newFlagType = 'user';
      newCaptureMethod = '';
      newNotes = '';
      addingFlag = false;
    } catch (err) {
      console.error('Failed to add flag:', { workspaceId, error: err });
    }
  }

  async function updateFlag(): Promise<void> {
    if (!workspaceId || !editingFlagId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/flags/${editingFlagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: editValue.trim(),
          flag_type: editFlagType,
          capture_method: editCaptureMethod.trim(),
          notes: editNotes.trim()
        })
      });
      if (!res.ok) {
        console.error('Failed to update flag:', { workspaceId, flagId: editingFlagId, status: res.status });
        return;
      }
      const updated: FlagEntry = await res.json();
      flags = flags.map((f) => (f.id === editingFlagId ? updated : f));
      editingFlagId = null;
    } catch (err) {
      console.error('Failed to update flag:', { workspaceId, error: err });
    }
  }

  function startEditing(flag: FlagEntry): void {
    editingFlagId = flag.id;
    editValue = flag.value;
    editFlagType = flag.flag_type;
    editCaptureMethod = flag.capture_method;
    editNotes = flag.notes;
  }

  async function toggleSubmitted(flag: FlagEntry): Promise<void> {
    if (!workspaceId) return;
    const submitted = flag.submitted ? 0 : 1;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/flags/${flag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted })
      });
      if (!res.ok) { console.error('Failed to toggle flag submitted:', { workspaceId, flagId: flag.id, status: res.status }); return; }
      flags = flags.map((f) => f.id === flag.id ? { ...f, submitted } : f);
    } catch (err) {
      console.error('Failed to toggle flag submitted:', { workspaceId, flagId: flag.id, error: err });
    }
  }

  async function deleteFlag(id: string): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/flags/${id}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete flag:', { workspaceId, flagId: id, status: res.status }); return; }
      flags = flags.filter((f) => f.id !== id);
    } catch (err) {
      console.error('Failed to delete flag:', { workspaceId, flagId: id, error: err });
    }
  }

  const submittedCount = $derived(flags.filter((f) => f.submitted).length);
  const userFlags = $derived(flags.filter((f) => f.flag_type === 'user'));
  const rootFlags = $derived(flags.filter((f) => f.flag_type === 'root'));

  const progressPct = $derived(totalFlags > 0 ? Math.round((submittedCount / totalFlags) * 100) : 0);
  const isPassing = $derived(passingFlags > 0 && submittedCount >= passingFlags);

  const typeColors: Record<string, string> = {
    user: 'text-blue-400',
    root: 'text-green-400',
    other: 'text-muted-foreground'
  };

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
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
      <Flag size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Flag Tracker</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={loadFlags}
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => (addingFlag = !addingFlag)}
        title="Add flag"
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

  <!-- No workspace -->
  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center p-4">
      <p class="text-center text-xs text-muted-foreground">Select a workspace to track flags</p>
    </div>
  {:else}
    <!-- Progress bar -->
    {#if totalFlags > 0}
      <div class="border-b border-border px-3 py-2">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-medium">
            {submittedCount} / {totalFlags} flags
          </span>
          <span class="text-xs {isPassing ? 'text-green-500 font-medium' : 'text-muted-foreground'}">
            {isPassing ? 'PASSING' : `Need ${passingFlags - submittedCount} more`}
          </span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full transition-all duration-300 {isPassing ? 'bg-green-500' : 'bg-primary'}"
            style="width: {progressPct}%"
          ></div>
        </div>
        <div class="mt-1 flex gap-3">
          <span class="text-[10px] text-blue-400">User: {userFlags.length}</span>
          <span class="text-[10px] text-green-400">Root: {rootFlags.length}</span>
        </div>
      </div>
    {/if}

    <!-- Add-flag form -->
    {#if addingFlag && uiMode === 'inline'}
      <div class="border-b border-border bg-muted/40 p-3 space-y-2">
        <input
          type="text"
          placeholder="Flag value e.g. HTB&#123;...&#125;"
          bind:value={newValue}
          class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => { if (e.key === 'Enter') addFlag(); if (e.key === 'Escape') addingFlag = false; }}
        />
        <div class="flex gap-2">
          <Select
            size="sm"
            value={newFlagType}
            onchange={(v) => newFlagType = v}
            options={[
              { value: 'user', label: 'User flag' },
              { value: 'root', label: 'Root flag' },
              { value: 'other', label: 'Other' }
            ]}
          />
          <input
            type="text"
            placeholder="Via (e.g. LPE, DC Sync)"
            bind:value={newCaptureMethod}
            class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div class="flex gap-2">
          <button
            onclick={addFlag}
            class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add
          </button>
          <button
            onclick={() => (addingFlag = false)}
            class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <!-- Flag list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={16} class="animate-spin text-muted-foreground" />
        </div>
      {:else if flags.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Flag size={24} class="text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">No flags yet. Click + to add one.</p>
        </div>
      {:else}
        {#each flags as flag (flag.id)}
          <div class="group border-b border-border hover:bg-accent/30 last:border-b-0">
            <div class="flex items-start gap-2 px-3 py-2">
              <button
                onclick={() => toggleSubmitted(flag)}
                class="mt-0.5 flex-shrink-0 {flag.submitted ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'}"
                title={flag.submitted ? 'Mark unsubmitted' : 'Mark submitted'}
              >
                {#if flag.submitted}
                  <CheckCircle2 size={14} />
                {:else}
                  <Circle size={14} />
                {/if}
              </button>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] font-medium uppercase {typeColors[flag.flag_type] ?? typeColors.other}">
                    {flag.flag_type}
                  </span>
                  {#if flag.host_ip}
                    <span class="text-[10px] text-muted-foreground">{flag.host_hostname || flag.host_ip}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-1">
                  <code class="flex-1 truncate text-[10px] font-mono text-foreground">{flag.value || '(empty)'}</code>
                  {#if flag.value}
                    <CopyButton text={flag.value} size={10} />
                  {/if}
                  <button
                    onclick={() => startEditing(flag)}
                    class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Edit flag"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onclick={() => confirmDelete = { id: flag.id, label: flag.value || flag.flag_type }}
                    class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                    title="Delete flag"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {#if flag.capture_method}
                  <p class="text-[10px] text-muted-foreground">via {flag.capture_method}</p>
                {/if}
              </div>
            </div>
            {#if editingFlagId === flag.id && uiMode === 'inline'}
              <div class="border-t border-border bg-muted/40 px-3 pb-2 pt-2 space-y-1.5">
                <input
                  type="text"
                  placeholder="Flag value"
                  bind:value={editValue}
                  class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  onkeydown={(e) => { if (e.key === 'Enter') updateFlag(); if (e.key === 'Escape') editingFlagId = null; }}
                />
                <div class="flex gap-2">
                  <Select
                    size="sm"
                    value={editFlagType}
                    onchange={(v) => editFlagType = v}
                    options={[
                      { value: 'user', label: 'User flag' },
                      { value: 'root', label: 'Root flag' },
                      { value: 'other', label: 'Other' }
                    ]}
                  />
                  <input
                    type="text"
                    placeholder="Via (e.g. LPE)"
                    bind:value={editCaptureMethod}
                    class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    onclick={updateFlag}
                    class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >Save</button>
                  <button
                    onclick={() => (editingFlagId = null)}
                    class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                  >Cancel</button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#if addingFlag && uiMode === 'modal'}
  <!-- Backdrop -->
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
    role="button"
    tabindex="-1"
    onclick={() => (addingFlag = false)}
    onkeydown={(e) => { if (e.key === 'Escape') addingFlag = false; }}
    aria-label="Close form"
  ></div>
  <!-- Modal -->
  <div
    transition:fly={{ y: 8, duration: 200, easing: cubicOut }}
    class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Add Flag"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <Flag size={14} class="text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Add Flag</h2>
      <button onclick={() => (addingFlag = false)} class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <input
        type="text"
        placeholder="Flag value e.g. HTB&#123;...&#125;"
        bind:value={newValue}
        class="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        onkeydown={(e) => { if (e.key === 'Enter') addFlag(); if (e.key === 'Escape') addingFlag = false; }}
      />
      <div class="flex gap-2">
        <Select
          size="sm"
          value={newFlagType}
          onchange={(v) => newFlagType = v}
          options={[
            { value: 'user', label: 'User flag' },
            { value: 'root', label: 'Root flag' },
            { value: 'other', label: 'Other' }
          ]}
        />
        <input
          type="text"
          placeholder="Via (e.g. LPE, DC Sync)"
          bind:value={newCaptureMethod}
          class="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button onclick={addFlag} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Flag</button>
      <button onclick={() => (addingFlag = false)} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
    </div>
  </div>
{/if}

{#if editingFlagId !== null && uiMode === 'modal'}
  <!-- Backdrop -->
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
    role="button"
    tabindex="-1"
    onclick={() => (editingFlagId = null)}
    onkeydown={(e) => { if (e.key === 'Escape') editingFlagId = null; }}
    aria-label="Close edit form"
  ></div>
  <!-- Modal -->
  <div
    transition:fly={{ y: 8, duration: 200, easing: cubicOut }}
    class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Edit Flag"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <Flag size={14} class="text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Edit Flag</h2>
      <button onclick={() => (editingFlagId = null)} class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <input
        type="text"
        placeholder="Flag value e.g. HTB&#123;...&#125;"
        bind:value={editValue}
        class="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        onkeydown={(e) => { if (e.key === 'Enter') updateFlag(); if (e.key === 'Escape') editingFlagId = null; }}
      />
      <div class="flex gap-2">
        <Select
          size="sm"
          value={editFlagType}
          onchange={(v) => editFlagType = v}
          options={[
            { value: 'user', label: 'User flag' },
            { value: 'root', label: 'Root flag' },
            { value: 'other', label: 'Other' }
          ]}
        />
        <input
          type="text"
          placeholder="Via (e.g. LPE, DC Sync)"
          bind:value={editCaptureMethod}
          class="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button onclick={updateFlag} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save Changes</button>
      <button onclick={() => (editingFlagId = null)} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
    </div>
  </div>
{/if}

{#if confirmDelete !== null}
  {@const pending = confirmDelete}
  <ConfirmDialog
    title="Delete Flag"
    message="Delete '{pending.label}'? This cannot be undone."
    onConfirm={() => { deleteFlag(pending.id); confirmDelete = null; }}
    onCancel={() => confirmDelete = null}
  />
{/if}
