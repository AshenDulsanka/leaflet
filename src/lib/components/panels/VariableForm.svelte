<script lang="ts">
  import { X } from '@lucide/svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';

  export interface VariableFormData {
    name: string;
    value: string;
  }

  interface Props {
    mode: 'add' | 'edit';
    uiMode?: 'modal' | 'inline';
    initialName?: string;
    initialValue?: string;
    onSubmit: (data: VariableFormData) => void;
    onCancel: () => void;
  }

  let {
    mode,
    uiMode = 'modal',
    initialName = '',
    initialValue = '',
    onSubmit,
    onCancel,
  }: Props = $props();

  let name = $state('');
  let value = $state('');
  let nameError = $state('');

  $effect(() => {
    name = initialName;
    value = initialValue;
    nameError = '';
  });

  function handleSubmit(): void {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) { nameError = 'Name is required.'; return; }
    if (!/^[A-Z][A-Z0-9_-]*$/.test(trimmed)) { nameError = 'Must start with a letter; only A-Z, 0-9, _ or - allowed.'; return; }
    nameError = '';
    onSubmit({ name: trimmed, value: value.trim() });
  }
</script>

{#if uiMode === 'modal'}
  <ToolModal ariaLabel="{mode === 'add' ? 'Add' : 'Edit'} variable" onClose={onCancel} maxWidthClass="max-w-xs">
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold">{mode === 'add' ? 'Add Variable' : 'Edit Variable'}</h2>
        <button onclick={onCancel} class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close {mode === 'add' ? 'add' : 'edit'} variable modal">
          <X size={14} />
        </button>
      </div>
      <div class="space-y-2">
        <div>
          <input type="text" placeholder="NAME (uppercase, e.g. TARGET_IP)" bind:value={name}
            class="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          {#if nameError}<p class="mt-1 text-[10px] text-destructive">{nameError}</p>{/if}
          {#if mode === 'edit' && name.trim().toUpperCase() !== initialName}
            <p class="mt-1 text-[10px] text-amber-500">Renaming won't update snippets using <code class="font-mono">{'{' + initialName + '}'}</code> - update them manually.</p>
          {/if}
        </div>
        <div>
          {#if mode === 'edit'}<label class="text-sm text-muted-foreground" for="var-value">Value</label>{/if}
          <input id="var-value" type="text" placeholder="Value (optional)" bind:value={value}
            class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button onclick={onCancel} class="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
        <button onclick={handleSubmit} class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">{mode === 'add' ? 'Add Variable' : 'Save'}</button>
      </div>
    </div>
  </ToolModal>
{:else}
  <div class="border-b border-border bg-muted/40 p-3 space-y-2">
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">Name <span class="text-destructive">*</span></span>
      <input type="text" placeholder="NAME (e.g. TARGET_IP)" bind:value={name}
        class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
      {#if nameError}<p class="mt-0.5 text-[10px] text-destructive">{nameError}</p>{/if}
    </label>
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">Value</span>
      <input type="text" placeholder="Value (optional)" bind:value={value}
        class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
    </label>
    {#if mode === 'edit' && name.trim().toUpperCase() !== initialName}
      <p class="text-[10px] text-amber-500">Renaming won't update snippets using <code class="font-mono">{'{' + initialName + '}'}</code> - update them manually.</p>
    {/if}
    <div class="flex gap-2">
      <button onclick={handleSubmit} class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">{mode === 'add' ? 'Add' : 'Save'}</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent">Cancel</button>
    </div>
  </div>
{/if}
