<script lang="ts">
  import { X } from '@lucide/svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  const CATEGORIES = [
    'general', 'recon', 'exploitation', 'privesc-linux', 'privesc-windows',
    'pivoting', 'ad-attacks', 'file-transfer', 'credential-attacks'
  ];
  const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: c }));

  export interface SnippetFormData {
    title: string;
    command: string;
    category: string;
    description: string;
    global?: boolean;
  }

  interface Props {
    mode: 'add' | 'edit';
    uiMode?: 'modal' | 'inline';
    initialTitle?: string;
    initialCommand?: string;
    initialCategory?: string;
    initialDescription?: string;
    showGlobal?: boolean;
    onSubmit: (data: SnippetFormData) => void;
    onCancel: () => void;
  }

  let {
    mode,
    uiMode = 'modal',
    initialTitle = '',
    initialCommand = '',
    initialCategory = 'general',
    initialDescription = '',
    showGlobal = false,
    onSubmit,
    onCancel,
  }: Props = $props();

  let title = $state(initialTitle);
  let command = $state(initialCommand);
  let category = $state(initialCategory);
  let description = $state(initialDescription);
  let isGlobal = $state(false);

  function handleSubmit(): void {
    if (!title.trim() || !command.trim()) return;
    onSubmit({ title, command, category, description, global: isGlobal });
  }
</script>

{#snippet formFields(compact: boolean)}
  <label class="block space-y-0.5">
    <span class="{compact ? 'text-[10px]' : 'text-sm'} text-muted-foreground">Title <span class="text-destructive">*</span></span>
    <input
      type="text"
      placeholder="Title"
      bind:value={title}
      class="w-full rounded border border-border bg-background px-2 py-1 {compact ? 'text-xs' : 'text-sm py-1.5'} focus:outline-none focus:ring-1 focus:ring-primary"
    />
  </label>
  <label class="block space-y-0.5">
    <span class="{compact ? 'text-[10px]' : 'text-sm'} text-muted-foreground">Command <span class="text-destructive">*</span></span>
    <textarea
      placeholder="Command (use &#123;VARIABLE&#125; for substitution)"
      bind:value={command}
      rows={compact ? 3 : 4}
      class="w-full resize-none rounded border border-border bg-background px-2 py-1 font-mono {compact ? 'text-[10px]' : 'text-sm py-1.5'} focus:outline-none focus:ring-1 focus:ring-primary"
    ></textarea>
  </label>
  <div class="space-y-0.5">
    <span class="block {compact ? 'text-[10px]' : 'text-sm'} text-muted-foreground">Category</span>
    <Select size="sm" options={categoryOptions} value={category} onchange={(v) => { category = v; }} />
  </div>
  <label class="block space-y-0.5">
    <span class="{compact ? 'text-[10px]' : 'text-sm'} text-muted-foreground">Description</span>
    <input
      type="text"
      placeholder="Description"
      bind:value={description}
      class="w-full rounded border border-border bg-background px-2 py-1 {compact ? 'text-xs' : 'text-sm py-1.5'} focus:outline-none focus:ring-1 focus:ring-primary"
    />
  </label>
  {#if showGlobal && mode === 'add'}
    <label class="flex items-center gap-2 {compact ? 'text-[10px]' : 'text-sm'} text-muted-foreground">
      <input type="checkbox" bind:checked={isGlobal} class="rounded" />
      Global (all workspaces)
    </label>
  {/if}
{/snippet}

{#if uiMode === 'modal'}
  <ToolModal ariaLabel="{mode === 'add' ? 'Add' : 'Edit'} snippet" onClose={onCancel} maxWidthClass="max-w-sm">
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold">{mode === 'add' ? 'Add Snippet' : 'Edit Snippet'}</h2>
        <button onclick={onCancel} class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close {mode === 'add' ? 'add' : 'edit'} snippet modal">
          <X size={14} />
        </button>
      </div>
      <div class="space-y-2">
        {@render formFields(false)}
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button onclick={onCancel} class="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
        <button onclick={handleSubmit} class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">{mode === 'add' ? 'Add Snippet' : 'Save'}</button>
      </div>
    </div>
  </ToolModal>
{:else}
  <div class="border-b border-border bg-muted/40 p-3 space-y-2">
    {@render formFields(true)}
    <div class="flex gap-2">
      <button onclick={handleSubmit} class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">{mode === 'add' ? 'Add' : 'Save'}</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent">Cancel</button>
    </div>
  </div>
{/if}