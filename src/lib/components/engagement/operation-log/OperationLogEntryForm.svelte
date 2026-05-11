<script lang="ts">
  import Select from '$lib/components/ui/Select.svelte';
  import DateTimePicker from '$lib/components/ui/DateTimePicker.svelte';
  import type { OpLogCategory } from '$lib/types';

  type CategoryOption = {
    value: OpLogCategory;
    label: string;
  };

  type HostOption = {
    value: string;
    label: string;
  };

  type Props = {
    variant: 'inline' | 'modal';
    description: string;
    category: OpLogCategory;
    hostId: string;
    timestamp: string;
    categoryOptions: CategoryOption[];
    hostOptions: HostOption[];
    submitLabel: string;
    onDescriptionChange: (value: string) => void;
    onCategoryChange: (value: OpLogCategory) => void;
    onHostChange: (value: string) => void;
    onTimestampChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
  };

  const {
    variant,
    description,
    category,
    hostId,
    timestamp,
    categoryOptions,
    hostOptions,
    submitLabel,
    onDescriptionChange,
    onCategoryChange,
    onHostChange,
    onTimestampChange,
    onSubmit,
    onCancel,
  }: Props = $props();

  const isInline = $derived(variant === 'inline');
  let formContainer: HTMLDivElement | null = $state(null);

  function requestCancel(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }

  function requestSubmit(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  }

  function handleFormKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      requestCancel(event);
      return;
    }

    if (event.key === 'Enter' && event.ctrlKey) {
      requestSubmit(event);
    }
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return;
    if (!formContainer?.contains(activeElement)) return;
    handleFormKeydown(event);
  }

  function handleDescriptionKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      requestCancel(event);
      return;
    }

    if (event.key === 'Enter' && event.ctrlKey) {
      requestSubmit(event);
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div
  bind:this={formContainer}
  class={`space-y-3 ${isInline ? '' : 'px-5 py-4'}`}
>
  <label class="block space-y-1.5">
    <span class={`block font-medium text-muted-foreground ${isInline ? 'text-[11px]' : 'text-xs'}`}>
      Action details
    </span>
    <textarea
      placeholder="Describe what happened..."
      rows={isInline ? 2 : 3}
      value={description}
      oninput={(event) => onDescriptionChange((event.currentTarget as HTMLTextAreaElement).value)}
      onkeydown={handleDescriptionKeydown}
      class={`w-full resize-none rounded-lg border border-border bg-background text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 ${isInline ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}`}
    ></textarea>
  </label>

  <div class="grid gap-2 sm:grid-cols-2">
    <label class="block space-y-1.5">
      <span class={`block font-medium text-muted-foreground ${isInline ? 'text-[11px]' : 'text-xs'}`}>
        Category
      </span>
      <Select
        size="sm"
        value={category}
        onchange={(value) => onCategoryChange(value as OpLogCategory)}
        options={categoryOptions}
        class="w-full"
      />
    </label>

    <label class="block space-y-1.5">
      <span class={`block font-medium text-muted-foreground ${isInline ? 'text-[11px]' : 'text-xs'}`}>
        Host
      </span>
      <Select
        size="sm"
        value={hostId}
        onchange={onHostChange}
        options={hostOptions}
        class="w-full"
      />
    </label>
  </div>

  <DateTimePicker
    value={timestamp}
    onchange={onTimestampChange}
    density="comfortable"
    class="w-full"
  />

  <div class={`flex gap-2 ${isInline ? '' : 'border-t border-border bg-muted/30 -mx-5 px-5 py-3'}`}>
    <button
      type="button"
      onclick={onSubmit}
      disabled={!description.trim()}
      class={`rounded-lg bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 ${isInline ? 'flex-1 px-3 py-2 text-xs' : 'flex-1 px-3 py-2 text-sm'}`}
    >
      {submitLabel}
    </button>
    <button
      type="button"
      onclick={onCancel}
      class={`rounded-lg border border-border transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/60 ${isInline ? 'px-3 py-2 text-xs text-muted-foreground' : 'flex-1 px-3 py-2 text-sm'}`}
    >
      Cancel
    </button>
  </div>
</div>