<script lang="ts">
  import { Link2, X, ExternalLink, RefreshCw } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface BacklinkResult {
    path: string;
    fileName: string;
    line: number;
    lineText: string;
    context: string;
  }

  interface Props {
    activeFile: string | null;
    onClose: () => void;
    onNavigate: (path: string, line: number, lineText: string) => void;
  }

  let { activeFile, onClose, onNavigate }: Props = $props();

  let backlinks = $state<BacklinkResult[]>([]);
  let loading = $state(false);
  let fetchError = $state(false);

  // Note name without folder or .md extension - used as the [[link]] target text
  const noteName = $derived(
    activeFile ? (activeFile.split('/').pop()?.replace(/\.md$/i, '') ?? null) : null
  );

  $effect(() => {
    if (noteName) {
      loadBacklinks(noteName);
    } else {
      backlinks = [];
    }
  });

  async function loadBacklinks(name: string) {
    loading = true;
    fetchError = false;
    try {
      const res = await fetch(
        `/api/notes/search?q=${encodeURIComponent(`[[${name}]]`)}`
      );
      const data: BacklinkResult[] = await res.json();
      // Exclude the current note from results (self-references)
      backlinks = data.filter((r) => r.path !== activeFile);
    } catch {
      fetchError = true;
      backlinks = [];
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<aside
  transition:fly={{ x: 320, duration: 250, easing: cubicOut }}
  class="absolute right-0 top-0 flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-card"
>
  <!-- Header -->
  <div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
    <Link2 size={14} class="shrink-0 text-muted-foreground" />
    <span class="flex-1 text-xs font-semibold text-foreground">Backlinks</span>
    {#if noteName}
      <button
        class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        onclick={() => noteName && loadBacklinks(noteName)}
        title="Refresh"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
    {/if}
    <button
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
    >
      <X size={13} />
    </button>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto">
    {#if !activeFile}
      <p class="p-4 text-xs text-muted-foreground">Open a note to see which other notes link to it.</p>
    {:else if loading}
      <div class="flex items-center gap-2 p-4">
        <RefreshCw size={12} class="animate-spin text-muted-foreground" />
        <span class="text-xs text-muted-foreground">Searching for [[{noteName}]]...</span>
      </div>
    {:else if fetchError}
      <p class="p-4 text-xs text-destructive">Failed to load backlinks.</p>
    {:else if backlinks.length === 0}
      <div class="p-4 text-center">
        <Link2 size={20} class="mx-auto mb-2 text-muted-foreground/40" />
        <p class="text-xs font-medium text-muted-foreground">No backlinks</p>
        <p class="mt-1 text-[11px] text-muted-foreground">
          No notes contain <span class="font-mono">[[{noteName}]]</span>.
        </p>
      </div>
    {:else}
      <p class="px-3 py-2 text-[11px] text-muted-foreground">
        {backlinks.length} note{backlinks.length !== 1 ? 's' : ''} link here
      </p>
      {#each backlinks as link (link.path + ':' + link.line)}
        <button
          class="w-full border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-accent"
          onclick={() => onNavigate(link.path, link.line, link.lineText)}
        >
          <div class="mb-1 flex items-center gap-1.5">
            <ExternalLink size={11} class="shrink-0 text-primary/70" />
            <span class="truncate text-xs font-medium text-foreground">{link.fileName}</span>
            <span class="ml-auto shrink-0 text-[10px] text-muted-foreground">:{link.line}</span>
          </div>
          <p class="line-clamp-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {link.context}
          </p>
        </button>
      {/each}
    {/if}
  </div>
</aside>
