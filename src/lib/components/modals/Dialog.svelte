<script lang="ts">
  import { X } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    variant?: 'input' | 'confirm';
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: (value: string) => void;
    onCancel: () => void;
  }

  let {
    title,
    message,
    placeholder = '',
    defaultValue = '',
    variant = 'input',
    confirmLabel = 'OK',
    destructive = false,
    onConfirm,
    onCancel,
  }: Props = $props();

  let value = $state(untrack(() => defaultValue));
  let inputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (variant === 'input' && inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  });

  function submit() {
    onConfirm(value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
  role="presentation"
>
  <!-- Panel - stop clicks from bubbling to the backdrop -->
  <div
    transition:fly={{ y: 10, duration: 200, easing: cubicOut }}
    tabindex="-1"
    class="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 id="dialog-title" class="text-sm font-semibold text-foreground">{title}</h2>
      <button
        onclick={onCancel}
        class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>

    {#if message}
      <p class="mb-4 text-sm text-muted-foreground">{message}</p>
    {/if}

    {#if variant === 'input'}
      <input
        bind:this={inputEl}
        bind:value
        type="text"
        {placeholder}
        class="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    {/if}

    <div class="flex justify-end gap-2">
      <button
        onclick={submit}
        class="rounded-md px-3 py-1.5 text-xs text-primary-foreground {destructive
          ? 'bg-destructive hover:bg-destructive/90'
          : 'bg-primary hover:bg-primary/90'}"
      >
        {confirmLabel}
      </button>
      <button
        onclick={onCancel}
        class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  </div>
</div>
