<script module lang="ts">
  const credentialCache = new Map<string, string>();
</script>

<script lang="ts">
  import { KeyRound, Pencil, Plus, X, RefreshCw, Eye, EyeOff, Trash2, ShieldCheck, ChevronDown, ChevronRight } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import CredentialForm from '$lib/components/engagement/CredentialForm.svelte';
  import type { CredentialFormData } from '$lib/components/engagement/CredentialForm.svelte';
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
  let editingCredId = $state<string | null>(null);
  let editingCred = $state<Credential | null>(null);
  let latestLoadRequest = 0;

  function readCachedCredentials(id: string): Credential[] | null {
    const cached = credentialCache.get(id);
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? (parsed as Credential[]) : null;
    } catch { return null; }
  }

  function writeCachedCredentials(id: string, items: Credential[]): void {
    credentialCache.set(id, JSON.stringify(items));
  }

  $effect(() => {
    if (!workspaceId) { credentials = []; loading = false; return; }
    const currentWorkspaceId = workspaceId;
    const cached = readCachedCredentials(currentWorkspaceId);
    if (cached !== null) credentials = cached;
    void loadCredentials(currentWorkspaceId, cached === null);
  });

  async function loadCredentials(targetWorkspaceId: string, blocking = false): Promise<void> {
    const requestId = latestLoadRequest + 1;
    latestLoadRequest = requestId;
    loading = blocking;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/credentials`);
      if (!res.ok) { console.error('Failed to load credentials:', { workspaceId: targetWorkspaceId, status: res.status }); return; }
      const nextCredentials = await res.json() as Credential[];
      if (requestId !== latestLoadRequest || workspaceId !== targetWorkspaceId) return;
      credentials = nextCredentials;
      writeCachedCredentials(targetWorkspaceId, nextCredentials);
    } catch (err) { console.error('Failed to load credentials:', { workspaceId: targetWorkspaceId, error: err }); }
    finally { if (requestId === latestLoadRequest) loading = false; }
  }

  async function addCredential(data: CredentialFormData): Promise<void> {
    if (!workspaceId) return;
    const targetWorkspaceId = workspaceId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username.trim(),
          secret: data.secret,
          credential_type: data.credentialType,
          domain: data.domain.trim(),
          source: data.source.trim(),
          status: data.status,
          notes: data.notes.trim(),
        }),
      });
      if (!res.ok) { console.error('Failed to add credential:', { workspaceId, status: res.status }); return; }
      const cred: Credential = await res.json();
      credentials = [...credentials, cred];
      writeCachedCredentials(targetWorkspaceId, credentials);
      addingCred = false;
    } catch (err) { console.error('Failed to add credential:', { workspaceId: targetWorkspaceId, error: err }); }
  }

  function startEditing(cred: Credential): void {
    expandedCredId = null;
    editingCredId = cred.id;
    editingCred = cred;
  }

  async function updateCredential(id: string, data: CredentialFormData): Promise<void> {
    if (!workspaceId) return;
    const targetWorkspaceId = workspaceId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/credentials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username.trim(),
          secret: data.secret,
          credential_type: data.credentialType,
          domain: data.domain.trim(),
          source: data.source.trim(),
          status: data.status,
          notes: data.notes.trim(),
        }),
      });
      if (!res.ok) { console.error('Failed to update credential:', { workspaceId: targetWorkspaceId, credId: id, status: res.status }); return; }
      const updated: Credential = await res.json();
      credentials = credentials.map((c) => c.id === id ? updated : c);
      writeCachedCredentials(targetWorkspaceId, credentials);
      if (editingCredId === id) { editingCredId = null; editingCred = null; }
    } catch (err) { console.error('Failed to update credential:', { workspaceId: targetWorkspaceId, credId: id, error: err }); }
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
    } catch (err) { console.error('Failed to delete credential:', { workspaceId: targetWorkspaceId, credentialId: id, error: err }); }
  }

  function toggleReveal(id: string): void {
    const next = new Set(revealedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    revealedIds = next;
  }

  const filteredCredentials = $derived.by(() => {
    const query = credentialQuery.trim().toLowerCase();
    if (!query) return credentials;
    return credentials.filter((cred) =>
      [cred.username ?? '', cred.domain ?? '', cred.source ?? '', cred.notes ?? '', cred.credential_type ?? '', cred.status ?? '']
        .some((value) => value.toLowerCase().includes(query))
    );
  });

  const typeLabels: Record<string, string> = {
    password: 'PW', hash: 'Hash', key: 'Key', ticket: 'TGT', token: 'Token', other: '?'
  };

  const statusBadgeClass: Record<string, string> = {
    unknown: 'bg-muted text-muted-foreground border border-border',
    valid: 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30',
    invalid: 'bg-destructive/15 text-destructive border border-destructive/30',
    expired: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30',
  };

  function handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.key !== 'Escape') return;
    if (confirmDelete !== null) { e.preventDefault(); confirmDelete = null; return; }
    if (addingCred) { e.preventDefault(); addingCred = false; return; }
    if (expandedCredId !== null) { e.preventDefault(); expandedCredId = null; return; }
    if (editingCredId !== null) { e.preventDefault(); editingCredId = null; editingCred = null; return; }
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

  <!-- Search bar (when there are credentials) -->
  {#if credentials.length > 0}
    <div class="border-b border-border px-3 py-2">
      <input
        type="search"
        placeholder="Filter credentials..."
        bind:value={credentialQuery}
        class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  {/if}

  <!-- No workspace -->
  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center p-4">
      <p class="text-center text-xs text-muted-foreground">Select a workspace to use the vault</p>
    </div>
  {:else}
    <!-- Add-credential form -->
    {#if addingCred}
      <CredentialForm
        mode="add"
        {uiMode}
        onSubmit={(data) => addCredential(data)}
        onCancel={() => (addingCred = false)}
      />
    {/if}

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
            {#if editingCredId === cred.id}
              <CredentialForm
                mode="edit"
                {uiMode}
                initialUsername={cred.username}
                initialSecret={cred.secret}
                initialCredentialType={cred.credential_type}
                initialDomain={cred.domain}
                initialSource={cred.source}
                initialStatus={cred.status}
                initialNotes={cred.notes}
                onSubmit={(data) => updateCredential(cred.id, data)}
                onCancel={() => { editingCredId = null; editingCred = null; }}
              />
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#if confirmDelete !== null}
  {@const pending = confirmDelete}
  <ConfirmDialog
    title="Delete Credential"
    message="Delete '{pending.label}'? This cannot be undone."
    onConfirm={() => { deleteCredential(pending.id); confirmDelete = null; }}
    onCancel={() => confirmDelete = null}
  />
{/if}