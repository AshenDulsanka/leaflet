<script lang="ts">
  import { X } from '@lucide/svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  type CredentialType = 'password' | 'hash' | 'key' | 'ticket' | 'token' | 'other';
  type CredentialStatus = 'unknown' | 'valid' | 'invalid' | 'expired';

  export interface CredentialFormData {
    username: string;
    secret: string;
    credentialType: CredentialType;
    domain: string;
    source: string;
    status: CredentialStatus;
    notes: string;
  }

  interface Props {
    mode: 'add' | 'edit';
    uiMode?: 'modal' | 'inline';
    initialUsername?: string;
    initialSecret?: string;
    initialCredentialType?: CredentialType;
    initialDomain?: string;
    initialSource?: string;
    initialStatus?: CredentialStatus;
    initialNotes?: string;
    onSubmit: (data: CredentialFormData) => void;
    onCancel: () => void;
  }

  let {
    mode,
    uiMode = 'modal',
    initialUsername = '',
    initialSecret = '',
    initialCredentialType = 'password',
    initialDomain = '',
    initialSource = '',
    initialStatus = 'unknown',
    initialNotes = '',
    onSubmit,
    onCancel,
  }: Props = $props();

  let username = $state('');
  let secret = $state('');
  let credentialType = $state<CredentialType>('password');
  let domain = $state('');
  let source = $state('');
  let status = $state<CredentialStatus>('unknown');
  let notes = $state('');

  $effect(() => {
    username = initialUsername;
    secret = initialSecret;
    credentialType = initialCredentialType;
    domain = initialDomain;
    source = initialSource;
    status = initialStatus;
    notes = initialNotes;
  });

  function handleSubmit(): void {
    if (!username.trim() && !secret.trim()) return;
    onSubmit({ username, secret, credentialType, domain, source, status, notes });
  }

  function handleSecretKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }

  const TYPE_OPTIONS = [
    { value: 'password', label: 'Password' },
    { value: 'hash',     label: 'Hash'     },
    { value: 'key',      label: 'SSH Key'  },
    { value: 'ticket',   label: 'Kerberos Ticket' },
    { value: 'token',    label: 'Token'    },
    { value: 'other',    label: 'Other'    },
  ];

  const STATUS_OPTIONS = [
    { value: 'unknown', label: 'Unknown' },
    { value: 'valid',   label: 'Valid'   },
    { value: 'invalid', label: 'Invalid' },
    { value: 'expired', label: 'Expired' },
  ];
</script>

{#snippet formBody()}
  <div class="space-y-2">
    <div class="flex gap-2">
      <label class="flex-1 space-y-0.5">
        <span class="block text-[10px] text-muted-foreground">Username</span>
        <input
          type="text"
          placeholder="username"
          bind:value={username}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>
      <label class="w-24 space-y-0.5">
        <span class="block text-[10px] text-muted-foreground">Domain</span>
        <input
          type="text"
          placeholder="CORP"
          bind:value={domain}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>
    </div>
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">Secret</span>
      <input
        type="text"
        placeholder="password / hash / key"
        bind:value={secret}
        class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        onkeydown={handleSecretKeydown}
      />
    </label>
    <div class="flex gap-2">
      <div class="flex-1 space-y-0.5">
        <p class="text-[10px] text-muted-foreground">Type</p>
        <Select
          size="sm"
          value={credentialType}
          onchange={(v) => (credentialType = v as CredentialType)}
          options={TYPE_OPTIONS}
        />
      </div>
      <div class="flex-1 space-y-0.5">
        <p class="text-[10px] text-muted-foreground">Status</p>
        <Select
          size="sm"
          value={status}
          onchange={(v) => (status = v as CredentialStatus)}
          options={STATUS_OPTIONS}
        />
      </div>
    </div>
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">URL / Source</span>
      <input
        type="text"
        placeholder="e.g. SMB share, /etc/passwd"
        bind:value={source}
        class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">Notes</span>
      <input
        type="text"
        placeholder="Optional notes"
        bind:value={notes}
        class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  </div>
{/snippet}

{#if uiMode === 'modal'}
  <ToolModal ariaLabel="{mode === 'add' ? 'Add' : 'Edit'} credential" onClose={onCancel} maxWidthClass="max-w-sm">
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <span class="flex-1 text-sm font-semibold">{mode === 'add' ? 'Add Credential' : 'Edit Credential'}</span>
      <button
        onclick={onCancel}
        aria-label="Close {mode === 'add' ? 'add' : 'edit'} credential modal"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      >
        <X size={14} />
      </button>
    </div>
    <div class="space-y-3 px-5 py-4">
      {@render formBody()}
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3">
      <button
        onclick={handleSubmit}
        class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {mode === 'add' ? 'Add Credential' : 'Save Changes'}
      </button>
      <button
        onclick={onCancel}
        class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  </ToolModal>
{:else}
  <div class="border-b border-border bg-muted/40 p-3">
    {@render formBody()}
    <div class="mt-2 flex gap-2">
      <button
        onclick={handleSubmit}
        class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        {mode === 'add' ? 'Add' : 'Save'}
      </button>
      <button
        onclick={onCancel}
        class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  </div>
{/if}
