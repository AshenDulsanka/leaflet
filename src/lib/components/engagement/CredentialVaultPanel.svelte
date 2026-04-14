<script lang="ts">
  import { KeyRound, Plus, X, RefreshCw, Eye, EyeOff, Trash2, ShieldCheck } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
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
  }

  let { workspaceId, onClose }: Props = $props();

  let credentials = $state<Credential[]>([]);
  let loading = $state(false);
  let addingCred = $state(false);
  let revealedIds = $state<Set<string>>(new Set());
  let confirmDelete = $state<{ id: string; label: string } | null>(null);

  // Add-cred form
  let newUsername = $state('');
  let newSecret = $state('');
  let newCredType = $state<'password' | 'hash' | 'key' | 'ticket' | 'token' | 'other'>('password');
  let newDomain = $state('');
  let newSource = $state('');
  let newStatus = $state<'unknown' | 'valid' | 'invalid' | 'expired'>('unknown');

  $effect(() => {
    if (workspaceId) loadCredentials();
  });

  async function loadCredentials(): Promise<void> {
    if (!workspaceId) return;
    credentials = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/credentials`);
      if (!res.ok) {
        console.error('Failed to load credentials:', { workspaceId, status: res.status });
        return;
      }
      credentials = await res.json();
    } catch (err) {
      console.error('Failed to load credentials:', { workspaceId, error: err });
    } finally {
      loading = false;
    }
  }

  async function addCredential(): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          secret: newSecret,
          credential_type: newCredType,
          domain: newDomain.trim(),
          source: newSource.trim(),
          status: newStatus
        })
      });
      if (!res.ok) {
        console.error('Failed to add credential:', { workspaceId, status: res.status });
        return;
      }
      const cred: Credential = await res.json();
      credentials = [...credentials, cred];
      newUsername = '';
      newSecret = '';
      newCredType = 'password';
      newDomain = '';
      newSource = '';
      newStatus = 'unknown';
      addingCred = false;
    } catch (err) {
      console.error('Failed to add credential:', { workspaceId, error: err });
    }
  }

  async function deleteCredential(id: string): Promise<void> {
    if (!workspaceId) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/credentials/${id}`, { method: 'DELETE' });
    if (!res.ok) { console.error('Failed to delete credential:', { workspaceId, credentialId: id, status: res.status }); return; }
    credentials = credentials.filter((c) => c.id !== id);
  }

  async function updateStatus(cred: Credential, status: Credential['status']): Promise<void> {
    if (!workspaceId) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/credentials/${cred.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) { console.error('Failed to update credential status:', { workspaceId, credentialId: cred.id, status: res.status }); return; }
    credentials = credentials.map((c) => c.id === cred.id ? { ...c, status } : c);
  }

  function toggleReveal(id: string) {
    const next = new Set(revealedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    revealedIds = next;
  }

  const typeLabels: Record<string, string> = {
    password: 'PW',
    hash: 'Hash',
    key: 'Key',
    ticket: 'TGT',
    token: 'Token',
    other: '?'
  };

  const statusColors: Record<string, string> = {
    unknown: 'text-muted-foreground border-muted-foreground/30',
    valid: 'text-green-600 border-green-600/30',
    invalid: 'text-destructive border-destructive/30',
    expired: 'text-yellow-600 border-yellow-600/30'
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
      <KeyRound size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Credential Vault</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={loadCredentials}
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => (addingCred = !addingCred)}
        title="Add credential"
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
      <p class="text-center text-xs text-muted-foreground">Select a workspace to use the vault</p>
    </div>
  {:else}
    <!-- Add-credential form -->
    {#if addingCred}
      <div class="border-b border-border bg-muted/40 p-3 space-y-2">
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Username"
            bind:value={newUsername}
            class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Domain"
            bind:value={newDomain}
            class="w-24 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          type="text"
          placeholder="Secret (password / hash / key)"
          bind:value={newSecret}
          class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => { if (e.key === 'Enter') addCredential(); if (e.key === 'Escape') addingCred = false; }}
        />
        <div class="flex gap-2">
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
        <input
          type="text"
          placeholder="Source (e.g. SMB share, /etc/passwd)"
          bind:value={newSource}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
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

    <!-- Credential list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={16} class="animate-spin text-muted-foreground" />
        </div>
      {:else if credentials.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <ShieldCheck size={24} class="text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">No credentials yet. Click + to add one.</p>
        </div>
      {:else}
        {#each credentials as cred (cred.id)}
          <div class="group border-b border-border px-3 py-2 hover:bg-accent/30 last:border-b-0">
            <!-- Header row -->
            <div class="flex items-center gap-2">
              <span class="rounded border px-1 py-0.5 text-[9px] font-medium uppercase {statusColors[cred.status] ?? statusColors.unknown}">
                {typeLabels[cred.credential_type] ?? cred.credential_type}
              </span>
              <span class="flex-1 truncate text-xs font-medium">
                {cred.domain ? `${cred.domain}\\` : ''}{cred.username || '(no username)'}
              </span>
              <div class="flex items-center gap-0.5">
                {#if cred.username}
                  <CopyButton
                    text={cred.domain ? `${cred.domain}\\${cred.username}` : cred.username}
                    size={10}
                  />
                {/if}
                <Select
                  size="xs"
                  value={cred.status}
                  onchange={(v) => updateStatus(cred, v as Credential['status'])}
                  options={[
                    { value: 'unknown', label: '?' },
                    { value: 'valid', label: 'Valid' },
                    { value: 'invalid', label: 'Invalid' },
                    { value: 'expired', label: 'Expired' }
                  ]}
                />
                <button
                  onclick={() => confirmDelete = { id: cred.id, label: cred.username || 'Credential' }}
                  class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                  title="Delete"
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
              >
                {#if revealedIds.has(cred.id)}
                  <EyeOff size={10} />
                {:else}
                  <Eye size={10} />
                {/if}
              </button>
            </div>
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
