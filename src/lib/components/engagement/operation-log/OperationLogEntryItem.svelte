<script lang="ts">
  import { Pencil, Trash2 } from '@lucide/svelte';

  import OperationLogEntryForm from '$lib/components/engagement/operation-log/OperationLogEntryForm.svelte';
  import type { OpLogCategory, OperationLogEntry } from '$lib/types';

  type CategoryOption = {
    value: OpLogCategory;
    label: string;
    color: string;
  };

  type HostOption = {
    value: string;
    label: string;
  };

  type Props = {
    entry: OperationLogEntry;
    uiMode: 'modal' | 'inline';
    editing: boolean;
    editDescription: string;
    editCategory: OpLogCategory;
    editHostId: string;
    editTimestamp: string;
    categoryOptions: CategoryOption[];
    hostOptions: HostOption[];
    formatTime: (iso: string) => string;
    onStartEdit: (entry: OperationLogEntry) => void;
    onDeleteRequest: (entry: OperationLogEntry) => void;
    onEditDescriptionChange: (value: string) => void;
    onEditCategoryChange: (value: OpLogCategory) => void;
    onEditHostChange: (value: string) => void;
    onEditTimestampChange: (value: string) => void;
    onSave: () => void;
    onCancelEdit: () => void;
  };

  const {
    entry,
    uiMode,
    editing,
    editDescription,
    editCategory,
    editHostId,
    editTimestamp,
    categoryOptions,
    hostOptions,
    formatTime,
    onStartEdit,
    onDeleteRequest,
    onEditDescriptionChange,
    onEditCategoryChange,
    onEditHostChange,
    onEditTimestampChange,
    onSave,
    onCancelEdit,
  }: Props = $props();

  const activeCategory = $derived(
    categoryOptions.find((option) => option.value === entry.category) ?? categoryOptions[categoryOptions.length - 1]
  );
</script>

{#if editing && uiMode === 'inline'}
  <OperationLogEntryForm
    variant="inline"
    description={editDescription}
    category={editCategory}
    hostId={editHostId}
    timestamp={editTimestamp}
    categoryOptions={categoryOptions}
    hostOptions={hostOptions}
    submitLabel="Save entry"
    onDescriptionChange={onEditDescriptionChange}
    onCategoryChange={onEditCategoryChange}
    onHostChange={onEditHostChange}
    onTimestampChange={onEditTimestampChange}
    onSubmit={onSave}
    onCancel={onCancelEdit}
  />
{:else}
  <article class="flex items-start gap-2">
    <div class="mt-0.5 flex-shrink-0">
      <span class={`inline-block h-2 w-2 rounded-full bg-current ${activeCategory.color}`}></span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <span class={`text-[10px] font-medium uppercase tracking-wide ${activeCategory.color}`}>
          {activeCategory.label}
        </span>

        <div class="flex items-center gap-0.5">
          <button
            type="button"
            onclick={() => onStartEdit(entry)}
            aria-label="Edit log entry"
            title="Edit"
            class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
          >
            <Pencil size={10} />
          </button>
          <button
            type="button"
            onclick={() => onDeleteRequest(entry)}
            aria-label="Delete log entry"
            title="Delete"
            class="flex h-5 w-5 items-center justify-center rounded text-destructive dark:text-red-400 transition-colors hover:bg-destructive/20 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/50"
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
  </article>
{/if}