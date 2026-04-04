<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X, ChevronUp, ChevronDown } from '@lucide/svelte';

  interface FindOptions {
    caseSensitive: boolean;
    useRegex: boolean;
    wholeWord: boolean;
  }

  interface EditorFindApi {
    findOccurrenceCount: (query: string, opts: FindOptions) => number;
    scrollToOccurrence: (query: string, opts: FindOptions, index: number) => void;
    setFindHighlights: (query: string, opts: FindOptions, currentIndex: number) => void;
    clearFindHighlights: () => void;
  }

  interface Props {
    editorApi: EditorFindApi | null;
    onClose: () => void;
  }

  let { editorApi, onClose }: Props = $props();

  let query = $state('');
  let caseSensitive = $state(false);
  let useRegex = $state(false);
  let wholeWord = $state(false);
  let currentIndex = $state(0);
  let matchCount = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);
  let regexError = $state(false);

  const opts = $derived<FindOptions>({ caseSensitive, useRegex, wholeWord });

  // Recount matches whenever query or options change
  $effect(() => {
    if (!query) {
      matchCount = 0;
      currentIndex = 0;
      regexError = false;
      editorApi?.clearFindHighlights();
      return;
    }
    // Validate regex before asking editor
    if (useRegex) {
      try { new RegExp(query); regexError = false; }
      catch { regexError = true; matchCount = 0; return; }
    } else {
      regexError = false;
    }
    const count = editorApi?.findOccurrenceCount(query, opts) ?? 0;
    matchCount = count;
    // Clamp index when count shrinks
    if (count === 0) {
      currentIndex = 0;
    } else if (currentIndex >= count) {
      currentIndex = count - 1;
      editorApi?.scrollToOccurrence(query, opts, currentIndex);
    } else if (count > 0) {
      editorApi?.scrollToOccurrence(query, opts, currentIndex);
    }
  });

  function goNext() {
    if (matchCount === 0) return;
    currentIndex = (currentIndex + 1) % matchCount;
    editorApi?.scrollToOccurrence(query, opts, currentIndex);
  }

  function goPrev() {
    if (matchCount === 0) return;
    currentIndex = (currentIndex - 1 + matchCount) % matchCount;
    editorApi?.scrollToOccurrence(query, opts, currentIndex);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) goPrev(); else goNext();
    }
  }

  onMount(() => inputEl?.focus());

  onDestroy(() => editorApi?.clearFindHighlights());
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && e.target === inputEl) {
      e.preventDefault();
      if (e.shiftKey) goPrev(); else goNext();
    }
    if ((e.key === 'F3') || (e.ctrlKey && e.key === 'g')) {
      e.preventDefault();
      if (e.shiftKey) goPrev(); else goNext();
    }
  }}
/>

<!-- Floating find bar anchored to top-right of the editor -->
<div
  transition:fly={{ y: -6, duration: 150, easing: cubicOut }}
  class="absolute right-3 top-2 z-30 flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-lg"
  role="search"
  aria-label="Find in file"
>
  <!-- Input row -->
  <div class="flex items-center gap-1.5">
    <input
      bind:this={inputEl}
      bind:value={query}
      type="text"
      placeholder="Find..."
      onkeydown={handleKeydown}
      class="h-7 w-48 rounded border border-border bg-background px-2 text-xs text-foreground outline-none
             placeholder:text-muted-foreground focus:border-primary
             {regexError ? 'border-destructive' : ''}"
      aria-label="Find text"
    />

    <!-- Match count -->
    <span class="min-w-[4rem] text-center text-[11px] text-muted-foreground">
      {#if regexError}
        bad regex
      {:else if query}
        {matchCount === 0 ? 'No match' : `${currentIndex + 1} / ${matchCount}`}
      {/if}
    </span>

    <button
      type="button"
      disabled={matchCount === 0}
      onclick={goPrev}
      title="Previous match (Shift+Enter)"
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
    >
      <ChevronUp size={13} />
    </button>
    <button
      type="button"
      disabled={matchCount === 0}
      onclick={goNext}
      title="Next match (Enter)"
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
    >
      <ChevronDown size={13} />
    </button>
    <button
      type="button"
      onclick={onClose}
      title="Close (Esc)"
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
    >
      <X size={13} />
    </button>
  </div>

  <!-- Options row -->
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      onclick={() => (caseSensitive = !caseSensitive)}
      title="Case sensitive"
      class="rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors
             {caseSensitive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}"
    >
      Aa
    </button>
    <button
      type="button"
      onclick={() => (wholeWord = !wholeWord)}
      title="Whole word"
      class="rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors
             {wholeWord ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}"
    >
      W
    </button>
    <button
      type="button"
      onclick={() => (useRegex = !useRegex)}
      title="Use regular expression"
      class="rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors
             {useRegex ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}"
    >
      .*
    </button>
    <span class="ml-auto text-[10px] text-muted-foreground">Shift+Enter for prev</span>
  </div>
</div>
