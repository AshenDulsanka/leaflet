<script lang="ts">
  import { X, GraduationCap, Crosshair, Flag, FolderOpen } from '@lucide/svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    onConfirm: (data: { name: string; type: string; icon_color: string }) => void;
    onCancel: () => void;
  }

  let { onConfirm, onCancel }: Props = $props();

  let name = $state('');
  let selectedType = $state<string>('exam');
  let inputEl: HTMLInputElement | null = $state(null);

  const typeOptions = [
    { value: 'exam', label: 'Exam', description: 'Certification exam engagement', icon: GraduationCap, color: '#6366f1' },
    { value: 'practice', label: 'Practice', description: 'Practice labs and boxes', icon: Crosshair, color: '#22c55e' },
    { value: 'ctf', label: 'CTF', description: 'Capture the flag competition', icon: Flag, color: '#f59e0b' },
    { value: 'other', label: 'Other', description: 'General-purpose workspace', icon: FolderOpen, color: '#8b5cf6' },
  ] as const;

  $effect(() => {
    inputEl?.focus();
  });

  function submit() {
    if (!name.trim()) return;
    const option = typeOptions.find((o) => o.value === selectedType);
    onConfirm({
      name: name.trim(),
      type: selectedType,
      icon_color: option?.color ?? '#6366f1',
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
  role="presentation"
>
  <div
    transition:fly={{ y: 10, duration: 200, easing: cubicOut }}
    tabindex="-1"
    class="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ws-dialog-title"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 id="ws-dialog-title" class="text-sm font-semibold text-foreground">New Workspace</h2>
      <button
        onclick={onCancel}
        class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>

    <!-- Name -->
    <label class="mb-3 block">
      <span class="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
      <input
        bind:this={inputEl}
        bind:value={name}
        type="text"
        placeholder="e.g. CPTS Exam, HTB Academy Lab…"
        class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground
               placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>

    <!-- Type selector -->
    <div class="mb-4">
      <span class="mb-2 block text-xs font-medium text-muted-foreground">Type</span>
      <div class="grid grid-cols-2 gap-2">
        {#each typeOptions as opt (opt.value)}
          <button
            type="button"
            onclick={() => (selectedType = opt.value)}
            class="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors
                   {selectedType === opt.value
                     ? 'border-primary bg-primary/10 text-foreground'
                     : 'border-border text-muted-foreground hover:border-border/80 hover:bg-accent'}"
          >
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style="background-color: {opt.color}20; color: {opt.color}"
            >
              <opt.icon size={14} />
            </div>
            <div class="min-w-0">
              <div class="text-xs font-medium">{opt.label}</div>
              <div class="truncate text-[10px] text-muted-foreground">{opt.description}</div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2">
      <button
        onclick={onCancel}
        class="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        Cancel
      </button>
      <button
        onclick={submit}
        disabled={!name.trim()}
        class="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground
               hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Create
      </button>
    </div>
  </div>
</div>
