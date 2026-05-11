<script module lang="ts">
  const credentialCache = new Map<string, string>();
</script>

<script lang="ts">
  import { KeyRound, Pencil, Plus, X, RefreshCw, Eye, EyeOff, Trash2, ShieldCheck, ChevronDown, ChevronRight } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Credential {
    id: string;
    username: string;
    secret: string;
    credential_type: 'password' | 'hash' | 'key' | 'ticket' | 'token' | 'other';
    domain: string;
    source: string;
    status: 'unknown' | 'valid' | 'invalid' | 'expired';
    notes: string;
    valid_host_ids: string[];
  }

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
    uiMode?: 'modal' | 'inline';
  }

  let { workspaceId, onClose, uiMode = 'modal' }: Props = $props();

  let credentials = $state<Credential[]>([]);
  let loading = $state(false);
  let addingCred = $state(false);
  let revealedIds = $state<Set<string>>(new Set());
  let confirmDelete = $state<{ id: string; label: string } | null>(null);
  let expandedCredId = $state<string | null>(null);
  let credentialQuery = $state('');

  // Add-cred form
  let newUsername = $state('');
  let newSecret = $state('');
  let newCredType = $state<'password' | 'hash' | 'key' | 'ticket' | 'token' | 'other'>('password');
  let newDomain = $state('');
  let newSource = $state('');
  let newStatus = $state<'unknown' | 'valid' | 'invalid' | 'expired'>('unknown');
  let newNotes = $state('');

  // Edit-credential state
  let editingCredId = $state<string | null>(null);
  let editUsername = $state('');
  let editSecret = $state('');
  let editCredType = $state<Credential['credential_type']>('password');
  let editDomain = $state('');
  let editSource = $state('');
  let editStatus = $state<Credential['status']>('unknown');
  let editNotes = $state('');
  let latestLoadRequest = 0;

  function readCachedCredentials(id: string): Credential[] | null {
    const cached = credentialCache.get(id);
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? (parsed as Credential[]) : null;
    } catch {
      return null;
    }
  }

  function writeCachedCredentials(id: string, items: Credential[]): void {
    credentialCache.set(id, JSON.stringify(items));
  }

  $effect(() => {
    if (!workspaceId) {
      credentials = [];
      loading = false;
      return;
    }

    const currentWorkspaceId = workspaceId;
    const cached = readCachedCredentials(currentWorkspaceId);
    if (cached !== null) {
      credentials = cached;
    }

    void loadCredentials(currentWorkspaceId, cached === null);
  });

  async function loadCredentials(targetWorkspaceId: string, blocking = false): Promise<void> {
    const requestId = latestLoadRequest + 1;
    latestLoadRequest = requestId;
    loading = blocking;

    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/credentials`);
      if (!res.ok) {
        console.error('Failed to load credentials:', { workspaceId: targetWorkspaceId, status: res.status });
        return;
      }

      const nextCredentials = await res.json() as Credential[];
      if (requestId !== latestLoadRequest || workspaceId !== targetWorkspaceId) {
        return;
      }

      credentials = nextCredentials;
      writeCachedCredentials(targetWorkspaceId, nextCredentials);
    } catch (err) {
      console.error('Failed to load credentials:', { workspaceId: targetWorkspaceId, error: err });
    } finally {
      if (requestId === latestLoadRequest) {
        loading = false;
      }
    }
  }

  async function addCredential(): Promise<void> {
    if (!workspaceId) return;
    const targetWorkspaceId = workspaceId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          secret: newSecret,
          credential_type: newCredType,
          domain: newDomain.trim(),
          source: newSource.trim(),
          status: newStatus,
          notes: newNotes.trim()
        })
      });
      if (!res.ok) {
        console.error('Failed to add credential:', { workspaceId, status: res.status });
        return;
      }
      const cred: Credential = await res.json();
      credentials = [...credentials, cred];
      writeCachedCredentials(targetWorkspaceId, credentials);
      newUsername = '';
      newSecret = '';
      newCredType = 'password';
      newDomain = '';
      newSource = '';
      newStatus = 'unknown';
      newNotes = '';
      addingCred = false;
    } catch (err) {
      console.error('Failed to add credential:', { workspaceId: targetWorkspaceId, error: err });
    }
  }

  function startEditing(cred: Credential): void {
    expandedCredId = null;
    editingCredId = cred.id;
    editUsername = cred.username;
    editSecret = cred.secret;
    editCredType = cred.credential_type;
    editDomain = cred.domain;
    editSource = cred.source;
    editStatus = cred.status;
    editNotes = cred.notes;
  }

  async function updateCredential(): Promise<void> {
    if (!workspaceId || !editingCredId) return;
    const targetWorkspaceId = workspaceId;
    const targetCredId = editingCredId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/credentials/${targetCredId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername.trim(),
          secret: editSecret,
          credential_type: editCredType,
          domain: editDomain.trim(),
          source: editSource.trim(),
          status: editStatus,
          notes: editNotes.trim()
        })
      });
      if (!res.ok) {
        console.error('Failed to update credential:', { workspaceId: targetWorkspaceId, credId: targetCredId, status: res.status });
        return;
      }
      const updated: Credential = await res.json();
      credentials = credentials.map((c) => c.id === targetCredId ? updated : c);
      writeCachedCredentials(targetWorkspaceId, credentials);
      if (editingCredId === targetCredId) {
        editingCredId = null;
      }
    } catch (err) {
      console.error('Failed to update credential:', { workspaceId: targetWorkspaceId, credId: targetCredId, error: err });
    }
  }

  async function deleteCredential(id: string): Promise<void> {
    if (!workspaceId) return;
    const targetWorkspaceId = workspaceId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/credentials/${id}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete credential:', { workspaceId: targetWorkspaceId, credentialId: id, status: res.status }); return; }
      credentials = credentials.filter((c) => c.id !== id);
      writeCachedCredentials(targetWorkspaceId, credentials);
      if (expandedCredId === id) expandedCredId = null;
    } catch (err) {
      console.error('Failed to delete credential:', { workspaceId: targetWorkspaceId, credentialId: id, error: err });
    }
  }


  function toggleReveal(id: string) {
    const next = new Set(revealedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    revealedIds = next;
  }

  const filteredCredentials = $derived.by(() => {
    const query = credentialQuery.trim().toLowerCase();
    if (!query) return credentials;

    return credentials.filter((cred) =>
      [
        cred.username ?? '',
        cred.domain ?? '',
        cred.source ?? '',
        cred.notes ?? '',
        cred.credential_type ?? '',
        cred.status ?? ''
      ].some((value) => value.toLowerCase().includes(query))
    );
  });

  const typeLabels: Record<string, string> = {
    password: 'PW',
    hash: 'Hash',
    key: 'Key',
    ticket: 'TGT',
    token: 'Token',
    other: '?'
  };

  const statusBadgeClass: Record<string, string> = {
    unknown: 'bg-muted text-muted-foreground border border-border',
    valid: 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30',
    invalid: 'bg-destructive/15 text-destructive border border-destructive/30',
    expired: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30'
  };

  function handleKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.key !== 'Escape') return;

    if (confirmDelete !== null) {
      e.preventDefault();
      confirmDelete = null;
      return;
    }

    if (addingCred) {
      e.preventDefault();
      addingCred = false;
      return;
    }

    if (expandedCredId !== null) {
      e.preventDefault();
      expandedCredId = null;
      return;
    }

    if (editingCredId !== null) {
      e.preventDefault();
      editingCredId = null;
      return;
    }

    onClose();
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
      <KeyRound size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Credential Vault</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={() => {
          if (!workspaceId) return;
          void loadCredentials(workspaceId, true);
        }}
        title="Refresh"
        aria-label="Refresh credentials"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => (addingCred = !addingCred)}
        title="Add credential"
        aria-label="Add credential"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      <button
        onclick={onClose}
        title="Close"
        aria-label="Close credential vault"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={13} />
      </button>
    </div>
  </div>

  <!-- No workspace -->
  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center p-4">
      <p class="text-center text-xs text-muted-foreground">Select a workspace to use the vault</p>
    </div>
  {:else}
    <!-- Add-credential form -->
    {#if addingCred && uiMode === 'inline'}
      <div class="border-b border-border bg-muted/40 p-3 space-y-2">
        <div class="flex gap-2">
          <label class="flex-1 space-y-0.5">
            <span class="block text-[10px] text-muted-foreground">Username</span>
            <input
              type="text"
              placeholder="username"
              bind:value={newUsername}
              class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label class="w-24 space-y-0.5">
            <span class="block text-[10px] text-muted-foreground">Domain</span>
            <input
              type="text"
              placeholder="CORP"
              bind:value={newDomain}
              class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>
        <label class="block space-y-0.5">
          <span class="text-[10px] text-muted-foreground">Secret</span>
          <input
            type="text"
            placeholder="password / hash / key"
            bind:value={newSecret}
            class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            onkeydown={(e) => {
              if (e.key === 'Enter') addCredential();
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                addingCred = false;
              }
            }}
          />
        </label>
        <div class="flex gap-2">
          <div class="flex-1 space-y-0.5">
            <p class="text-[10px] text-muted-foreground">Type</p>
            <Select
              size="sm"
              value={newCredType}
              onchange={(v) => newCredType = v as Credential['credential_type']}
              options={[
                { value: 'password', label: 'Password' },
                { value: 'hash', label: 'Hash' },
                { value: 'key', label: 'SSH Key' },
                { value: 'ticket', label: 'Kerberos Ticket' },
                { value: 'token', label: 'Token' },
                { value: 'other', label: 'Other' }
              ]}
            />
          </div>
          <div class="flex-1 space-y-0.5">
            <p class="text-[10px] text-muted-foreground">Status</p>
            <Select
              size="sm"
              value={newStatus}
              onchange={(v) => newStatus = v as Credential['status']}
              options={[
                { value: 'unknown', label: 'Unknown' },
                { value: 'valid', label: 'Valid' },
                { value: 'invalid', label: 'Invalid' },
                { value: 'expired', label: 'Expired' }
              ]}
            />
          </div>
        </div>
        <label class="block space-y-0.5">
          <span class="text-[10px] text-muted-foreground">URL / Source</span>
          <input
            type="text"
            placeholder="e.g. SMB share, /etc/passwd"
            bind:value={newSource}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label class="block space-y-0.5">
          <span class="text-[10px] text-muted-foreground">Notes</span>
          <input
            type="text"
            placeholder="Optional notes"
            bind:value={newNotes}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <div class="flex gap-2">
          <button
            onclick={addCredential}
            class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add
          </button>
          <button
            onclick={() => (addingCred = false)}
            class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <div class="border-b border-border px-3 py-2">
      <input
        type="text"
        placeholder="Search credentials..."
        bind:value={credentialQuery}
        aria-label="Search credentials"
        class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>

    <!-- Credential list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading && credentials.length === 0}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={16} class="animate-spin text-muted-foreground" />
        </div>
      {:else if credentials.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <ShieldCheck size={24} class="text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">No credentials yet. Click + to add one.</p>
        </div>
      {:else if filteredCredentials.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <ShieldCheck size={24} class="text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">No credentials match your search.</p>
        </div>
      {:else}
        {#each filteredCredentials as cred (cred.id)}
          <div class="group border-b border-border hover:bg-accent/30 last:border-b-0">
            <div class="px-3 py-2">
              <!-- Header row -->
              <div class="flex items-center gap-2">
                <span class="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                  {typeLabels[cred.credential_type] ?? cred.credential_type}
                </span>
                <span class="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase {statusBadgeClass[cred.status] ?? statusBadgeClass.unknown}">
                  {cred.status}
                </span>
                <span class="min-w-0 flex-1 text-xs">
                  {#if cred.domain}
                    <span class="font-medium text-muted-foreground">{cred.domain}\</span>
                  {/if}
                  <span class="font-medium">{cred.username || '(no username)'}</span>
                </span>
                <div class="flex items-center gap-0.5">
                  {#if cred.username}
                    <CopyButton
                      text={cred.domain ? `${cred.domain}\\${cred.username}` : cred.username}
                      size={10}
                    />
                  {/if}
                  <button
                    onclick={() => startEditing(cred)}
                    class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Edit credential"
                    aria-label="Edit credential"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onclick={() => confirmDelete = { id: cred.id, label: cred.username || 'Credential' }}
                    class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                    title="Delete"
                    aria-label="Delete credential"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
              <!-- Secret row -->
              <div class="mt-1 flex items-center gap-1">
                <code class="flex-1 truncate rounded bg-muted px-1 py-0.5 text-[10px] font-mono">
                  {revealedIds.has(cred.id) ? cred.secret : '••••••••••••'}
                </code>
                <button
                  onclick={() => toggleReveal(cred.id)}
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={revealedIds.has(cred.id) ? 'Hide secret' : 'Show secret'}
                  aria-pressed={revealedIds.has(cred.id)}
                >
                  {#if revealedIds.has(cred.id)}
                    <EyeOff size={10} />
                  {:else}
                    <Eye size={10} />
                  {/if}
                </button>
              </div>
              {#if cred.source}
                <p class="mt-0.5 text-[10px] text-muted-foreground">via {cred.source}</p>
              {/if}
              {#if cred.notes}
                <button
                  onclick={() => (expandedCredId = expandedCredId === cred.id ? null : cred.id)}
                  class="mt-0.5 flex h-5 items-center gap-0.5 rounded px-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-expanded={expandedCredId === cred.id}
                  aria-controls="cred-notes-{cred.id}"
                  title={expandedCredId === cred.id ? 'Hide notes' : 'Show notes'}
                >
                  {#if expandedCredId === cred.id}
                    <ChevronDown size={10} />
                  {:else}
                    <ChevronRight size={10} />
                  {/if}
                  <span>notes</span>
                </button>
                {#if expandedCredId === cred.id}
                  <div id="cred-notes-{cred.id}" class="mt-1 rounded bg-muted/40 px-2 py-1.5">
                    <p class="whitespace-pre-wrap break-words text-[10px] text-muted-foreground italic">{cred.notes}</p>
                  </div>
                {/if}
              {/if}
            </div>
            {#if editingCredId === cred.id && uiMode === 'inline'}
              <div class="border-t border-border bg-muted/40 px-3 pb-3 pt-2 space-y-2">
                <div class="flex gap-2">
                  <label class="flex-1 space-y-0.5">
                    <span class="block text-[10px] text-muted-foreground">Username</span>
                    <input
                      type="text"
                      bind:value={editUsername}
                      class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label class="w-20 space-y-0.5">
                    <span class="block text-[10px] text-muted-foreground">Domain</span>
                    <input
                      type="text"
                      bind:value={editDomain}
                      class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                </div>
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Secret</span>
                  <input
                    type="text"
                    bind:value={editSecret}
                    class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    onkeydown={(e) => {
                      if (e.key === 'Enter') updateCredential();
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        editingCredId = null;
                      }
                    }}
                  />
                </label>
                <div class="flex gap-2">
                  <div class="flex-1 space-y-0.5">
                    <p class="text-[10px] text-muted-foreground">Type</p>
                    <Select
                      size="sm"
                      value={editCredType}
                      onchange={(v) => editCredType = v as Credential['credential_type']}
                      options={[
                        { value: 'password', label: 'Password' },
                        { value: 'hash', label: 'Hash' },
                        { value: 'key', label: 'SSH Key' },
                        { value: 'ticket', label: 'Kerberos Ticket' },
                        { value: 'token', label: 'Token' },
                        { value: 'other', label: 'Other' }
                      ]}
                    />
                  </div>
                  <div class="flex-1 space-y-0.5">
                    <p class="text-[10px] text-muted-foreground">Status</p>
                    <Select
                      size="sm"
                      value={editStatus}
                      onchange={(v) => editStatus = v as Credential['status']}
                      options={[
                        { value: 'unknown', label: 'Unknown' },
                        { value: 'valid', label: 'Valid' },
                        { value: 'invalid', label: 'Invalid' },
                        { value: 'expired', label: 'Expired' }
                      ]}
                    />
                  </div>
                </div>
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">URL / Source</span>
                  <input
                    type="text"
                    bind:value={editSource}
                    class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Notes</span>
                  <input
                    type="text"
                    bind:value={editNotes}
                    class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <div class="flex gap-2">
                  <button
                    onclick={updateCredential}
                    class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >Save</button>
                  <button
                    onclick={() => (editingCredId = null)}
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

{#if addingCred && uiMode === 'modal'}
  <ToolModal
    ariaLabel="Add credential"
    onClose={() => (addingCred = false)}
    maxWidthClass="max-w-sm"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <KeyRound size={14} class="text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Add Credential</h2>
      <button onclick={() => (addingCred = false)} aria-label="Close add credential modal" class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <div class="flex gap-2">
        <label class="flex-1 space-y-1">
          <span class="block text-xs text-muted-foreground">Username</span>
          <input
            type="text"
            placeholder="username"
            bind:value={newUsername}
            class="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label class="w-24 space-y-1">
          <span class="block text-xs text-muted-foreground">Domain</span>
          <input
            type="text"
            placeholder="CORP"
            bind:value={newDomain}
            class="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Secret</span>
        <input
          type="text"
          placeholder="password / hash / key"
          bind:value={newSecret}
          class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => {
            if (e.key === 'Enter') addCredential();
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              addingCred = false;
            }
          }}
        />
      </label>
      <div class="flex gap-2">
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Type</p>
          <Select
            size="sm"
            value={newCredType}
            onchange={(v) => newCredType = v as Credential['credential_type']}
            options={[
              { value: 'password', label: 'Password' },
              { value: 'hash', label: 'Hash' },
              { value: 'key', label: 'SSH Key' },
              { value: 'ticket', label: 'Kerberos Ticket' },
              { value: 'token', label: 'Token' },
              { value: 'other', label: 'Other' }
            ]}
          />
        </div>
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Status</p>
          <Select
            size="sm"
            value={newStatus}
            onchange={(v) => newStatus = v as Credential['status']}
            options={[
              { value: 'unknown', label: 'Unknown' },
              { value: 'valid', label: 'Valid' },
              { value: 'invalid', label: 'Invalid' },
              { value: 'expired', label: 'Expired' }
            ]}
          />
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">URL / Source</span>
        <input
          type="text"
          placeholder="e.g. SMB share, /etc/passwd"
          bind:value={newSource}
          class="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Notes</span>
        <input
          type="text"
          placeholder="Optional notes"
          bind:value={newNotes}
          class="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3">
      <button onclick={addCredential} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Credential</button>
      <button onclick={() => (addingCred = false)} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
    </div>
  </ToolModal>
{/if}

{#if confirmDelete !== null}
  {@const pending = confirmDelete}
  <ConfirmDialog
    title="Delete Credential"
    message="Delete '{pending.label}'? This cannot be undone."
    onConfirm={() => { deleteCredential(pending.id); confirmDelete = null; }}
    onCancel={() => confirmDelete = null}
  />
{/if}

{#if editingCredId !== null && uiMode === 'modal'}
  <ToolModal
    ariaLabel="Edit credential"
    onClose={() => (editingCredId = null)}
    maxWidthClass="max-w-sm"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <KeyRound size={14} class="text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Edit Credential</h2>
      <button onclick={() => (editingCredId = null)} aria-label="Close edit credential modal" class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <div class="flex gap-2">
        <label class="flex-1 space-y-1">
          <span class="block text-xs text-muted-foreground">Username</span>
          <input
            type="text"
            bind:value={editUsername}
            class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label class="w-24 space-y-1">
          <span class="block text-xs text-muted-foreground">Domain</span>
          <input
            type="text"
            bind:value={editDomain}
            class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Secret</span>
        <input
          type="text"
          bind:value={editSecret}
          class="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <div class="flex gap-2">
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Type</p>
          <Select
            size="sm"
            value={editCredType}
            onchange={(v) => editCredType = v as Credential['credential_type']}
            options={[
              { value: 'password', label: 'Password' },
              { value: 'hash', label: 'Hash' },
              { value: 'key', label: 'SSH Key' },
              { value: 'ticket', label: 'Kerberos Ticket' },
              { value: 'token', label: 'Token' },
              { value: 'other', label: 'Other' }
            ]}
          />
        </div>
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Status</p>
          <Select
            size="sm"
            value={editStatus}
            onchange={(v) => editStatus = v as Credential['status']}
            options={[
              { value: 'unknown', label: 'Unknown' },
              { value: 'valid', label: 'Valid' },
              { value: 'invalid', label: 'Invalid' },
              { value: 'expired', label: 'Expired' }
            ]}
          />
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">URL / Source</span>
        <input
          type="text"
          bind:value={editSource}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Notes</span>
        <input
          type="text"
          bind:value={editNotes}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
    </div>
    <div class="flex gap-2 border-t border-border bg-muted/30 px-5 py-3">
      <button
        onclick={updateCredential}
        class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >Save Changes</button>
      <button
        onclick={() => (editingCredId = null)}
        class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >Cancel</button>
    </div>
  </ToolModal>
{/if}
