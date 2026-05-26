<script lang="ts">
  import { X } from '@lucide/svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  export interface FlagFormData {
    value: string;
    flagType: string;
    captureMethod: string;
    notes: string;
  }

  interface Props {
    mode: 'add' | 'edit';
    uiMode?: 'modal' | 'inline';
    initialValue?: string;
    initialFlagType?: string;
    initialCaptureMethod?: string;
    initialNotes?: string;
    onSubmit: (data: FlagFormData) => void;
    onCancel: () => void;
  }

  let {
    mode,
    uiMode = 'modal',
    initialValue = '',
    initialFlagType = 'user',
    initialCaptureMethod = '',
    initialNotes = '',
    onSubmit,
    onCancel,
  }: Props = $props();

  let value = $state('');
  let flagType = $state('user');
  let captureMethod = $state('');
  let notes = $state('');

  $effect(() => {
    value = initialValue;
    flagType = initialFlagType;
    captureMethod = initialCaptureMethod;
    notes = initialNotes;
  });

  function handleSubmit(): void {
    onSubmit({ value, flagType, captureMethod, notes });
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  }
</script>

{#snippet formBody()}
  <input
    type="text"
    placeholder="Flag value e.g. HTB&#123;...&#125;"
    bind:value={value}
    onkeydown={handleKeydown}
    class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
  />
  <div class="flex gap-2">
    <Select
      size="sm"
      value={flagType}
      onchange={(v) => flagType = v}
      options={[
        { value: 'user', label: 'User flag' },
        { value: 'root', label: 'Root flag' },
        { value: 'other', label: 'Other' }
      ]}
    />
    <input
      type="text"
      placeholder="Via (e.g. LPE, DC Sync)"
      bind:value={captureMethod}
      class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
    />
  </div>
{/snippet}

{#if uiMode === 'modal'}
  <ToolModal ariaLabel="{mode === 'add' ? 'Add' : 'Edit'} flag" onClose={onCancel} maxWidthClass="max-w-sm">
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <span class="flex-1 text-sm font-semibold">{mode === 'add' ? 'Add Flag' : 'Edit Flag'}</span>
      <button onclick={onCancel} aria-label="Close {mode === 'add' ? 'add' : 'edit'} flag modal" class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      {@render formBody()}
    </div>
    <div class="flex gap-2 border-t border-border bg-muted/30 px-5 py-3">
      <button onclick={handleSubmit} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">{mode === 'add' ? 'Add Flag' : 'Save Changes'}</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
    </div>
  </ToolModal>
{:else}
  <div class="border-b border-border bg-muted/40 p-3 space-y-2">
    {@render formBody()}
    <div class="flex gap-2">
      <button onclick={handleSubmit} class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">{mode === 'add' ? 'Add' : 'Save'}</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent">Cancel</button>
    </div>
  </div>
{/if}
