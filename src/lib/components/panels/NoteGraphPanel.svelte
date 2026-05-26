<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { X, Search, RefreshCw, Network, Crosshair } from '@lucide/svelte';
  import { GraphRenderer } from './graph-renderer';
  import type { RawData } from './graph-renderer';

  interface Props {
    onClose: () => void;
    onNavigate: (path: string) => void;
    workspaceFolder: string;
    activePath: string;
  }

  let { onClose, onNavigate, workspaceFolder, activePath }: Props = $props();

  let containerEl = $state<HTMLDivElement | undefined>();
  let svgEl = $state<SVGSVGElement | undefined>();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let nodeCount = $state(0);
  let linkCountState = $state(0);
  let viewMode = $state<'global' | 'local'>('global');
  let folderLegend = $state<Array<{ folder: string; color: string }>>([]);

  let _cachedData: RawData | null = null;
  let _retryInit: (() => void) | null = null;
  let renderer: GraphRenderer | null = null;

  $effect(() => {
    renderer?.setSearch(searchQuery);
  });

  $effect(() => {
    renderer?.setActiveId(activePath);
  });

  async function switchViewMode(mode: 'global' | 'local'): Promise<void> {
    viewMode = mode;
    if (!_cachedData || !renderer) return;

    let data: RawData;
    if (mode === 'local') {
      const neighborIds = renderer.getGlobalNeighborMap().get(activePath) ?? new Set<string>();
      const keepIds = new Set<string>([activePath, ...neighborIds]);
      const filteredNodes = _cachedData.nodes.filter((n) => keepIds.has(n.id));
      const filteredLinks = _cachedData.links.filter(
        (l) => keepIds.has(l.source as string) && keepIds.has(l.target as string),
      );
      data = { nodes: filteredNodes, links: filteredLinks };
    } else {
      data = _cachedData;
    }

    nodeCount = data.nodes.length;
    linkCountState = data.links.length;
    await tick();
    await renderer.build(data, mode === 'global');
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  onMount(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const themeObserver = new MutationObserver(() => {
      renderer?.setDark(document.documentElement.classList.contains('dark'));
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    let cleanupDone = false;

    async function init(): Promise<void> {
      const wsParam = workspaceFolder ? `?workspace=${encodeURIComponent(workspaceFolder)}` : '';
      let rawData: RawData;
      try {
        const res = await fetch(`/api/notes/graph${wsParam}`);
        if (!res.ok) { error = 'Failed to load graph data.'; loading = false; return; }
        rawData = (await res.json()) as RawData;
      } catch {
        error = 'Network error loading graph data.'; loading = false; return;
      }

      _cachedData = rawData;
      nodeCount = rawData.nodes.length;
      linkCountState = rawData.links.length;
      loading = false;

      if (cleanupDone) return;
      await tick();
      if (!svgEl || !containerEl || cleanupDone) return;

      renderer = new GraphRenderer(
        svgEl!,
        containerEl!,
        onNavigate,
        onClose,
        (legend) => { folderLegend = legend; },
      );
      renderer.setActiveId(activePath);
      renderer.setDark(isDark);
      await renderer.build(rawData, true);
    }

    _retryInit = init;
    void init();

    return () => {
      cleanupDone = true;
      renderer?.destroy();
      renderer = null;
      themeObserver.disconnect();
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <!-- Modal -->
  <div
    class="relative flex h-[80vh] w-[85vw] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Note Graph"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
      <div class="flex items-center gap-2">
        <Network class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium text-foreground">Note Graph</span>
        {#if !loading && !error}
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {nodeCount} notes · {linkCountState} links
          </span>
        {/if}
      </div>

      {#if !loading && !error}
        <div class="flex rounded border border-border bg-muted text-xs" role="group" aria-label="View mode">
          <button
            class="flex items-center gap-1 px-2 py-1 transition-colors {viewMode === 'global' ? 'rounded bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => switchViewMode('global')} title="All notes"
          >
            <Network class="h-3 w-3" /> Global
          </button>
          <button
            class="flex items-center gap-1 px-2 py-1 transition-colors {viewMode === 'local' ? 'rounded bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => switchViewMode('local')} title="Active note + neighbors"
          >
            <Crosshair class="h-3 w-3" /> Local
          </button>
        </div>
      {/if}

      {#if !loading && !error}
        <div class="relative max-w-xs flex-1">
          <Search class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes…"
            bind:value={searchQuery}
            class="w-full rounded border border-border bg-background py-1 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      {/if}

      {#if folderLegend.length > 0 && !loading && !error}
        <div class="hidden items-center gap-2 overflow-x-auto md:flex">
          {#each folderLegend.slice(0, 6) as entry (entry.folder)}
            <div class="flex shrink-0 items-center gap-1">
              <span class="h-2 w-2 rounded-full" style="background-color: {entry.color}"></span>
              <span class="max-w-[80px] truncate text-xs text-muted-foreground">{entry.folder}</span>
            </div>
          {/each}
          {#if folderLegend.length > 6}
            <span class="text-xs text-muted-foreground">+{folderLegend.length - 6} more</span>
          {/if}
        </div>
      {/if}

      <div class="ml-auto flex items-center gap-1">
        {#if !loading && !error}
          <button
            class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onclick={() => { loading = true; renderer?.destroy(); _retryInit?.(); }}
            title="Refresh graph" aria-label="Refresh graph"
          >
            <RefreshCw class="h-4 w-4" />
          </button>
        {/if}
        <button
          class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onclick={onClose} aria-label="Close graph"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="relative flex-1 overflow-hidden" bind:this={containerEl}>
      {#if loading}
        <div class="flex h-full items-center justify-center gap-3 text-muted-foreground">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground"></div>
          <span class="text-sm">Building graph…</span>
        </div>
      {:else if error}
        <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <span class="text-sm text-destructive">{error}</span>
          <button
            class="text-xs underline hover:text-foreground"
            onclick={() => { error = null; loading = true; _retryInit?.(); }}
          >Retry</button>
        </div>
      {:else}
        <svg bind:this={svgEl} class="h-full w-full"></svg>
        <div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          Click node to open · Scroll to zoom · Drag to pan · [Esc] to close · Wait a few seconds for it to load
        </div>
      {/if}
    </div>
  </div>
</div>