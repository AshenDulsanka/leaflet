<script lang="ts">
  import { Flag, Plus, X, RefreshCw, CheckCircle2, Circle, Trash2 } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
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
  }

  let { workspaceId, totalFlags = 0, passingFlags = 0, onClose }: Props = $props();

  let flags = $state<FlagEntry[]>([]);
  let loading = $state(false);
  let addingFlag = $state(false);

  // Add-flag form
  let newValue = $state('');
  let newFlagType = $state('user');
  let newCaptureMethod = $state('');
  let newNotes = $state('');

  $effect(() => {
    if (workspaceId) loadFlags();
  });

  async function loadFlags() {
    if (!workspaceId) return;
    flags = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/flags`);
      flags = await res.json();
    } catch {
      console.error('Failed to load flags');
    } finally {
      loading = false;
    }
  }

  async function addFlag() {
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
      if (!res.ok) return;
      const flag: FlagEntry = await res.json();
      flags = [...flags, flag];
      newValue = '';
      newFlagType = 'user';
      newCaptureMethod = '';
      newNotes = '';
      addingFlag = false;
    } catch {
      console.error('Failed to add flag');
    }
  }

  async function toggleSubmitted(flag: FlagEntry) {
    if (!workspaceId) return;
    const submitted = flag.submitted ? 0 : 1;
    await fetch(`/api/workspaces/${workspaceId}/flags/${flag.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submitted })
    });
    flags = flags.map((f) => f.id === flag.id ? { ...f, submitted } : f);
  }

  async function deleteFlag(id: string) {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/flags/${id}`, { method: 'DELETE' });
    flags = flags.filter((f) => f.id !== id);
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
    {#if addingFlag}
      <div class="border-b border-border bg-muted/40 p-3 space-y-2">
        <input
          type="text"
          placeholder="Flag value e.g. HTB&#123;...&#125;"
          bind:value={newValue}
          class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => { if (e.key === 'Enter') addFlag(); if (e.key === 'Escape') addingFlag = false; }}
        />
        <div class="flex gap-2">
          <select
            bind:value={newFlagType}
            class="flex-1 rounded border border-border bg-background px-1 py-1 text-xs focus:outline-none"
          >
            <option value="user">User flag</option>
            <option value="root">Root flag</option>
            <option value="other">Other</option>
          </select>
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
          <div class="group flex items-start gap-2 border-b border-border px-3 py-2 hover:bg-accent/30 last:border-b-0">
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
              <code class="block truncate text-[10px] font-mono text-foreground">{flag.value || '(empty)'}</code>
              {#if flag.capture_method}
                <p class="text-[10px] text-muted-foreground">via {flag.capture_method}</p>
              {/if}
            </div>

            <button
              onclick={() => deleteFlag(flag.id)}
              class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10"
              title="Delete flag"
            >
              <Trash2 size={10} />
            </button>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
