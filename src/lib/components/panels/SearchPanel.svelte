<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Search, X, FileText, ChevronRight, ChevronDown } from '@lucide/svelte';
  import type { SearchResult } from '$lib/types';

  interface Props {
    onClose: () => void;
    onSelectResult: (path: string, line: number, lineText: string) => void;
  }

  let { onClose, onSelectResult }: Props = $props();

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Set of file paths whose results are collapsed
  let collapsed = $state(new Set<string>());

  // Group results by file path
  let grouped = $derived((() => {
    const map = new Map<string, { fileName: string; path: string; matches: SearchResult[] }>();
    for (const r of results) {
      if (!map.has(r.path)) map.set(r.path, { fileName: r.fileName, path: r.path, matches: [] });
      map.get(r.path)!.matches.push(r);
    }
    return Array.from(map.values());
  })());

  onMount(() => {
    inputEl?.focus();
  });

  $effect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (query.trim().length < 2) {
      results = [];
      error = null;
      collapsed = new Set();
      return;
    }

    debounceTimer = setTimeout(async () => {
      isLoading = true;
      error = null;
      try {
        const res = await fetch(`/api/notes/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error('Search failed');
        results = await res.json();
        collapsed = new Set(); // expand all on new search
      } catch {
        error = 'Search failed. Please try again.';
        results = [];
      } finally {
        isLoading = false;
      }
    }, 250);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function selectResult(result: SearchResult) {
    onSelectResult(result.path, result.line, result.lineText);
    onClose();
  }

  function toggleGroup(path: string) {
    const next = new Set(collapsed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsed = next;
  }

  // Highlight the matching portion of the result
  function highlight(text: string, q: string): string {
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-primary/20 rounded-sm">$1</mark>');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
  onclick={onClose}
></div>

<!-- Panel -->
<div
  transition:fly={{ y: -10, duration: 180, easing: cubicOut }}
  class="fixed left-1/2 top-24 z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-border bg-background shadow-2xl"
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  aria-label="Search notes"
  tabindex="0"
>
  <!-- Input row -->
  <div class="flex items-center gap-2 border-b border-border px-4 py-3">
    <Search size={16} class="shrink-0 text-muted-foreground" />
    <input
      bind:this={inputEl}
      bind:value={query}
      type="text"
      placeholder="Search all notes..."
      class="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
    />
    {#if query}
      <button
        class="text-muted-foreground hover:text-foreground"
        onclick={() => (query = '')}
        aria-label="Clear search"
      >
        <X size={14} />
      </button>
    {/if}
    <kbd class="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Esc</kbd>
  </div>

  <!-- Results -->
  <div class="max-h-[28rem] overflow-y-auto">
    {#if isLoading}
      <div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Searching...
      </div>
    {:else if error}
      <div class="px-4 py-6 text-center text-sm text-destructive">{error}</div>
    {:else if query.trim().length >= 2 && grouped.length === 0}
      <div class="px-4 py-6 text-center text-sm text-muted-foreground">
        No results for "{query}"
      </div>
    {:else if query.trim().length < 2 && query.length > 0}
      <div class="px-4 py-4 text-center text-xs text-muted-foreground">
        Type at least 2 characters to search
      </div>
    {:else if grouped.length === 0}
      <div class="px-4 py-8 text-center text-sm text-muted-foreground">
        Start typing to search your notes
      </div>
    {:else}
      <ul class="py-1">
        {#each grouped as group (group.path)}
          <!-- File header -->
          <li>
            <button
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
              onclick={() => toggleGroup(group.path)}
              aria-expanded={!collapsed.has(group.path)}
            >
              {#if collapsed.has(group.path)}
                <ChevronRight size={13} class="shrink-0 text-muted-foreground" />
              {:else}
                <ChevronDown size={13} class="shrink-0 text-muted-foreground" />
              {/if}
              <FileText size={13} class="shrink-0 text-primary" />
              <span class="flex-1 truncate text-xs font-semibold text-foreground">{group.fileName}</span>
              <span class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{group.matches.length}</span>
            </button>

            <!-- Per-file match rows -->
            {#if !collapsed.has(group.path)}
              <ul>
                {#each group.matches as match (match.path + ':' + match.line)}
                  <li>
                    <button
                      class="flex w-full flex-col gap-0.5 py-2 pl-9 pr-4 text-left hover:bg-accent"
                      onclick={() => selectResult(match)}
                    >
                      <div class="flex items-center gap-2">
                        <span class="shrink-0 font-mono text-[10px] text-muted-foreground">:{match.line}</span>
                        <span class="truncate text-xs text-muted-foreground">{match.lineText.trim()}</span>
                      </div>
                      {#if match.context}
                        <p class="pl-8 text-[10px] leading-relaxed text-muted-foreground/70 line-clamp-2">
                          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                          {@html highlight(match.context, query)}
                        </p>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Footer hint -->
  <div class="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
    <span><kbd class="rounded border border-border px-1 py-0.5">Enter</kbd> to open</span>
    <span><kbd class="rounded border border-border px-1 py-0.5">Esc</kbd> to close</span>
    {#if results.length > 0}
      <span class="ml-auto">{results.length} match{results.length === 1 ? '' : 'es'} in {grouped.length} file{grouped.length === 1 ? '' : 's'}</span>
    {/if}
  </div>
</div>
