<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X, Copy, CornerDownLeft, Terminal, FileText, ShieldAlert } from '@lucide/svelte';
  import { DEFAULT_COMMANDS, searchCommands } from '$lib/data/commands';
  import { NOTE_TEMPLATES, searchTemplates } from '$lib/data/templates';
  import type { SnippetCategory } from '$lib/types';

  interface Props {
    onClose: () => void;
    onInsert: (text: string) => void;
    onOpenCvss?: () => void;
  }

  let { onClose, onInsert, onOpenCvss }: Props = $props();

  let query = $state('');
  let mode = $state<'commands' | 'templates'>('commands');
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

  const filteredCommands = $derived.by(() => {
    let cmds = DEFAULT_COMMANDS;
    if (selectedCategory !== 'all') {
      cmds = cmds.filter((c) => c.category === selectedCategory);
    }
    return searchCommands(query, cmds);
  });

  const filteredTemplates = $derived(searchTemplates(query));

  function switchMode(next: 'commands' | 'templates') {
    mode = next;
    query = '';
    inputEl?.focus();
  }

  function insertCommand(command: string) {
    onInsert('```bash\n' + command + '\n```');
    onClose();
  }

  function insertTemplate(content: string) {
    onInsert(content);
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
    <!-- Mode tabs -->
    <div class="flex border-b border-border">
      <button
        class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors {mode === 'commands'
          ? 'border-b-2 border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => switchMode('commands')}
      >
        <Terminal size={13} />
        Commands
      </button>
      <button
        class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors {mode === 'templates'
          ? 'border-b-2 border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => switchMode('templates')}
      >
        <FileText size={13} />
        Templates
      </button>
      <div class="ml-auto flex items-center px-3">
        <button
          class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onclick={onClose}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Search input -->
    <div class="flex items-center gap-2 border-b border-border px-4 py-3">
      {#if mode === 'commands'}
        <Terminal size={16} class="shrink-0 text-muted-foreground" />
      {:else}
        <FileText size={16} class="shrink-0 text-muted-foreground" />
      {/if}
      <input
        bind:this={inputEl}
        bind:value={query}
        class="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        placeholder={mode === 'commands' ? 'Search commands…' : 'Search templates…'}
        type="text"
        autocomplete="off"
        spellcheck="false"
      />
    </div>

    {#if mode === 'commands'}
      <!-- CVSS Calculator quick action -->
      <div class="border-b border-border/50 px-3 py-2">
        <button
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onclick={() => { onOpenCvss?.(); onClose(); }}
        >
          <ShieldAlert size={13} class="shrink-0" />
          Open CVSS Calculator
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

      <!-- Commands list -->
      <div class="max-h-96 overflow-y-auto">
        {#if filteredCommands.length === 0}
          <div class="py-10 text-center text-sm text-muted-foreground">
            No commands match "{query}"
          </div>
        {:else}
          {#each filteredCommands as cmd (cmd.id)}
            <div
              class="group flex cursor-pointer items-start gap-3 border-b border-border/50 px-4 py-3 hover:bg-accent"
            >
              <!-- Main info (click to insert) -->
              <button
                class="flex-1 text-left"
                onclick={() => insertCommand(cmd.command)}
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
                  onclick={() => insertCommand(cmd.command)}
                >
                  <CornerDownLeft size={13} />
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer hint (commands) -->
      <div class="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span><kbd class="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Enter</kbd> insert</span>
        <span><kbd class="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Esc</kbd> close</span>
        <span class="ml-auto">{filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}</span>
      </div>

    {:else}
      <!-- Templates list -->
      <div class="max-h-96 overflow-y-auto">
        {#if filteredTemplates.length === 0}
          <div class="py-10 text-center text-sm text-muted-foreground">
            No templates match "{query}"
          </div>
        {:else}
          {#each filteredTemplates as tmpl (tmpl.id)}
            <div
              class="group flex cursor-pointer items-start gap-3 border-b border-border/50 px-4 py-3 hover:bg-accent"
            >
              <button
                class="flex-1 text-left"
                onclick={() => insertTemplate(tmpl.content)}
                title="Insert template into editor"
              >
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-foreground">{tmpl.title}</span>
                  <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    template
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-muted-foreground">{tmpl.description}</p>
              </button>

              <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Insert template into editor"
                  onclick={() => insertTemplate(tmpl.content)}
                >
                  <CornerDownLeft size={13} />
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer hint (templates) -->
      <div class="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span><kbd class="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Enter</kbd> insert</span>
        <span><kbd class="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Esc</kbd> close</span>
        <span class="ml-auto">{filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}</span>
      </div>
    {/if}
  </div>
</div>
