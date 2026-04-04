<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X, Copy, CornerDownLeft, Terminal } from '@lucide/svelte';
  import { DEFAULT_COMMANDS, searchCommands } from '$lib/data/commands';
  import type { SnippetCategory } from '$lib/types';

  interface Props {
    onClose: () => void;
    onInsert: (text: string) => void;
  }

  let { onClose, onInsert }: Props = $props();

  let query = $state('');
  let selectedCategory = $state<SnippetCategory | 'all'>('all');
  let inputEl = $state<HTMLInputElement | null>(null);
  let copied = $state<string | null>(null);

  const CATEGORIES: { value: SnippetCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'recon', label: 'Recon' },
    { value: 'exploitation', label: 'Exploit' },
    { value: 'file-transfer', label: 'File Transfer' },
    { value: 'privesc-linux', label: 'PrivEsc Linux' },
    { value: 'privesc-windows', label: 'PrivEsc Win' },
    { value: 'credential-attacks', label: 'Creds' },
    { value: 'pivoting', label: 'Pivoting' },
    { value: 'ad-attacks', label: 'AD Attacks' },
  ];

  const filtered = $derived.by(() => {
    let cmds = DEFAULT_COMMANDS;
    if (selectedCategory !== 'all') {
      cmds = cmds.filter((c) => c.category === selectedCategory);
    }
    return searchCommands(query, cmds);
  });

  function insert(command: string) {
    onInsert('```bash\n' + command + '\n```');
    onClose();
  }

  async function copyCommand(command: string, id: string) {
    await navigator.clipboard.writeText(command);
    copied = id;
    setTimeout(() => (copied = null), 1500);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  onMount(() => inputEl?.focus());
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20"
  role="button"
  tabindex="-1"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
  aria-label="Close command palette"
>
  <div
    transition:fly={{ y: -10, duration: 180, easing: cubicOut }}
    class="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Command Palette"
  >
    <!-- Search input -->
    <div class="flex items-center gap-2 border-b border-border px-4 py-3">
      <Terminal size={16} class="shrink-0 text-muted-foreground" />
      <input
        bind:this={inputEl}
        bind:value={query}
        class="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        placeholder="Search commands…"
        type="text"
        autocomplete="off"
        spellcheck="false"
      />
      <button
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        onclick={onClose}
        title="Close"
      >
        <X size={14} />
      </button>
    </div>

    <!-- Category filter chips -->
    <div class="flex gap-1 overflow-x-auto px-3 py-2">
      {#each CATEGORIES as cat (cat.value)}
        <button
          class="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors {selectedCategory === cat.value
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
          onclick={() => (selectedCategory = cat.value)}
        >
          {cat.label}
        </button>
      {/each}
    </div>

    <!-- Results list -->
    <div class="max-h-96 overflow-y-auto">
      {#if filtered.length === 0}
        <div class="py-10 text-center text-sm text-muted-foreground">
          No commands match "{query}"
        </div>
      {:else}
        {#each filtered as cmd (cmd.id)}
          <div
            class="group flex cursor-pointer items-start gap-3 border-b border-border/50 px-4 py-3 hover:bg-accent"
          >
            <!-- Main info (click to insert) -->
            <button
              class="flex-1 text-left"
              onclick={() => insert(cmd.command)}
              title="Insert into editor"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-foreground">{cmd.title}</span>
                <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {cmd.category}
                </span>
              </div>
              <code class="mt-0.5 block truncate text-xs text-primary/80">
                {cmd.command.split('\n')[0]}
              </code>
              {#if cmd.description}
                <p class="mt-0.5 text-xs text-muted-foreground">{cmd.description}</p>
              {/if}
            </button>

            <!-- Action buttons -->
            <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Copy command to clipboard"
                onclick={() => copyCommand(cmd.command, cmd.id)}
              >
                {#if copied === cmd.id}
                  <span class="text-[9px] text-green-500">✓</span>
                {:else}
                  <Copy size={13} />
                {/if}
              </button>
              <button
                class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Insert into editor"
                onclick={() => insert(cmd.command)}
              >
                <CornerDownLeft size={13} />
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Footer hint -->
    <div class="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
      <span><kbd class="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Enter</kbd> insert</span>
      <span><kbd class="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Esc</kbd> close</span>
      <span class="ml-auto">{filtered.length} command{filtered.length !== 1 ? 's' : ''}</span>
    </div>
  </div>
</div>
