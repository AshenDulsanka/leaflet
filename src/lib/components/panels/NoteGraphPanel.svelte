<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { X, Search, RefreshCw, Network, Crosshair } from '@lucide/svelte';

  interface Props {
    onClose: () => void;
    onNavigate: (path: string) => void;
    workspaceFolder: string;
    activePath: string;
  }

  const { onClose, onNavigate, workspaceFolder, activePath }: Props = $props();

  interface GraphNode {
    id: string;
    name: string;
    folder: string;
    linkCount: number;
    x?: number;
    y?: number;
  }

  interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
  }

  interface ThemeColors {
    bg: string;
    muted: string;
    border: string;
    foreground: string;
    mutedFg: string;
    primary: string;
    isDark: boolean;
  }

  let containerEl: HTMLDivElement | undefined = $state();
  let hoveredNodeId = $state<string | null>(null);
  let neighborMap = new Map<string, Set<string>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let graph: any = null;
  let graphReady = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let nodeCount = $state(0);
  let linkCount = $state(0);
  let viewMode = $state<'global' | 'local'>('global');
  let fullData = $state<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  let colors = $state<ThemeColors>({
    bg: '#0f172a', muted: '#1e293b', border: '#334155',
    foreground: '#e2e8f0', mutedFg: '#94a3b8', primary: '#6366f1',
    isDark: true
  });

  const FOLDER_COLORS = [
    '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6',
    '#f97316', '#8b5cf6', '#06b6d4', '#84cc16', '#ef4444',
  ];

  const folderColorMap = new Map<string, string>();

  function readBgColor(cls: string): string {
    const el = document.createElement('div');
    el.className = cls;
    el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;pointer-events:none';
    document.body.appendChild(el);
    const c = getComputedStyle(el).backgroundColor;
    el.remove();
    return c;
  }

  function readTextColor(cls: string): string {
    const el = document.createElement('div');
    el.className = cls;
    el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;pointer-events:none';
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }

  function readBorderColor(cls: string): string {
    const el = document.createElement('div');
    el.className = `border border-solid ${cls}`;
    el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;pointer-events:none';
    document.body.appendChild(el);
    const c = getComputedStyle(el).borderTopColor;
    el.remove();
    return c;
  }

  function getThemeColors(): ThemeColors {
    return {
      bg:         readBgColor('bg-card'),
      muted:      readBgColor('bg-muted'),
      border:     readBorderColor('border-border'),
      foreground: readTextColor('text-foreground'),
      mutedFg:    readTextColor('text-muted-foreground'),
      primary:    readTextColor('text-primary'),
      isDark:     document.documentElement.classList.contains('dark'),
    };
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function folderColor(folder: string): string {
    if (!folder) return colors.mutedFg;
    if (!folderColorMap.has(folder)) {
      folderColorMap.set(folder, FOLDER_COLORS[folderColorMap.size % FOLDER_COLORS.length]);
    }
    return folderColorMap.get(folder)!;
  }

  function nodeRadius(node: GraphNode): number {
    return 4 + Math.min(node.linkCount * 1.5, 10);
  }

  const localData = $derived.by(() => {
    if (!activePath || !fullData.nodes.length) return fullData;
    const neighborIds = new Set<string>([activePath]);
    for (const link of fullData.links) {
      const src = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgt = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (src === activePath) neighborIds.add(tgt);
      if (tgt === activePath) neighborIds.add(src);
    }
    const nodes = fullData.nodes.filter((n) => neighborIds.has(n.id));
    const links = fullData.links.filter((l) => {
      const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return neighborIds.has(src) && neighborIds.has(tgt);
    });
    return { nodes, links };
  });

  function buildNeighborMap(data: { nodes: GraphNode[]; links: GraphLink[] }): void {
    neighborMap = new Map<string, Set<string>>();
    for (const link of data.links) {
      const src = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgt = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!neighborMap.has(src)) neighborMap.set(src, new Set());
      if (!neighborMap.has(tgt)) neighborMap.set(tgt, new Set());
      neighborMap.get(src)!.add(tgt);
      neighborMap.get(tgt)!.add(src);
    }
  }

  function setGraphData(data: { nodes: GraphNode[]; links: GraphLink[] }): void {
    if (!graph) return;
    buildNeighborMap(data);
    nodeCount = data.nodes.length;
    linkCount = data.links.length;
    graph.graphData(data);
  }

  function applyColors(): void {
    if (!graph) return;
    if (searchQuery.trim()) { graph.linkColor(() => colors.muted); return; }
    if (hoveredNodeId) {
      graph.linkColor((link: GraphLink) => {
        const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
        return (src === hoveredNodeId || tgt === hoveredNodeId) ? colors.primary : colors.muted;
      });
      return;
    }
    graph.linkColor(() => colors.border);
  }

  $effect(() => {
    if (!graphReady) return;
    applyColors();
    graph.refresh();
  });

  $effect(() => {
    const mode = viewMode;
    if (!graphReady || !graph) return;
    setGraphData(mode === 'local' ? localData : fullData);
  });

  onMount(async () => {
    colors = getThemeColors();

    const themeObserver = new MutationObserver(() => {
      colors = getThemeColors();
      if (graph) {
        graph.backgroundColor(colors.bg);
        applyColors();
        graph.refresh();
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const wsParam = workspaceFolder ? `?workspace=${encodeURIComponent(workspaceFolder)}` : '';
    const [{ default: ForceGraphCtor }, dataRes] = await Promise.all([
      import('force-graph'),
      fetch(`/api/notes/graph${wsParam}`)
    ]);
    if (!dataRes.ok) { error = 'Failed to load graph data.'; loading = false; return; }
    const data: { nodes: GraphNode[]; links: GraphLink[] } = await dataRes.json();
    fullData = data;
    nodeCount = data.nodes.length;
    linkCount = data.links.length;
    loading = false;
    await tick();
    if (!containerEl) { error = 'Failed to initialize graph container.'; return; }

    buildNeighborMap(data);

    const initData = viewMode === 'local' ? localData : fullData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ForceGraph = ForceGraphCtor as any;
    graph = ForceGraph()(containerEl)
      .backgroundColor(colors.bg)
      .width(containerEl.clientWidth)
      .height(containerEl.clientHeight)
      .graphData(initData)
      .nodeId('id')
      .nodeLabel((n: GraphNode) =>
        `<div style="background:${escapeHtml(colors.muted)};color:${escapeHtml(colors.foreground)};padding:4px 8px;border-radius:4px;font-size:12px;border:1px solid ${escapeHtml(colors.border)}">${escapeHtml(n.name)}${n.folder ? ` <span style="opacity:0.5">(${escapeHtml(n.folder)})</span>` : ''}</div>`)
      .nodeVal((n: GraphNode) => nodeRadius(n) * nodeRadius(n))
      .nodeColor((n: GraphNode) => folderColor(n.folder))
      .nodeCanvasObject((n: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const r = nodeRadius(n);
        let nodeColor: string;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const isMatch = n.name.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q);
          nodeColor = isMatch ? '#facc15' : colors.border;
        } else if (hoveredNodeId) {
          if (n.id === hoveredNodeId) nodeColor = colors.primary;
          else if (neighborMap.get(hoveredNodeId)?.has(n.id)) nodeColor = colors.primary;
          else nodeColor = colors.muted;
        } else {
          nodeColor = folderColor(n.folder);
        }
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColor;
        ctx.fill();
        const label = n.name;
        const fontSize = Math.max(8, 12 / globalScale);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        if (hoveredNodeId && !searchQuery.trim()) {
          if (n.id === hoveredNodeId) ctx.fillStyle = colors.foreground;
          else if (neighborMap.get(hoveredNodeId)?.has(n.id)) ctx.fillStyle = colors.mutedFg;
          else ctx.fillStyle = colors.muted;
        } else if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const isMatch = n.name.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q);
          ctx.fillStyle = isMatch ? (colors.isDark ? '#fef08a' : '#92400e') : colors.mutedFg;
        } else {
          ctx.fillStyle = colors.mutedFg;
        }
        ctx.textAlign = 'center';
        ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + r + fontSize + 1);
      })
      .nodeCanvasObjectMode(() => 'replace')
      .linkColor(() => colors.border)
      .linkWidth((link: GraphLink) => {
        const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
        return src === hoveredNodeId || tgt === hoveredNodeId ? 2 : 0.4;
      })
      .linkDirectionalParticles(0)
      .enableNodeDrag(true)
      .onNodeClick((n: GraphNode) => { onNavigate(n.id); onClose(); })
      .onNodeHover((n: GraphNode | null) => {
        hoveredNodeId = n ? n.id : null;
        if (containerEl) containerEl.style.cursor = n ? 'pointer' : 'default';
      });

    const ro = new ResizeObserver(([entry]) => {
      if (graph) { graph.width(entry.contentRect.width); graph.height(entry.contentRect.height); }
    });
    ro.observe(containerEl!);
    graphReady = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (graph as any)._ro = ro;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (graph as any)._themeObserver = themeObserver;
  });

  onDestroy(() => {
    if (graph) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (graph as any)._ro?.disconnect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (graph as any)._themeObserver?.disconnect();
      if (typeof graph.pauseAnimation === 'function') graph.pauseAnimation();
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <!-- Modal panel -->
  <div
    class="relative flex h-[80vh] w-[85vw] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Note Graph"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2.5 backdrop-blur">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-foreground">Note Graph</span>
        {#if !loading}
          <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {nodeCount} notes &middot; {linkCount} links
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <!-- View mode toggle -->
        <div class="flex overflow-hidden rounded border border-border">
          <button
            title="Workspace graph - all notes in this workspace"
            class="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground {viewMode === 'global' ? 'bg-accent text-accent-foreground' : ''}"
            onclick={() => (viewMode = 'global')}
          >
            <Network size={12} />
          </button>
          <button
            title="Local graph - current note and its connections"
            class="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground {viewMode === 'local' ? 'bg-accent text-accent-foreground' : ''}"
            onclick={() => (viewMode = 'local')}
          >
            <Crosshair size={12} />
          </button>
        </div>

        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
          <input
            type="text"
            placeholder="Filter notes..."
            bind:value={searchQuery}
            class="w-48 rounded-md border border-border bg-card py-1 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <!-- Workspace folder legend -->
        {#if folderColorMap.size > 0}
          <div class="hidden items-center gap-1.5 lg:flex">
            {#each [...folderColorMap.entries()] as [folder, color]}
              <span class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <span class="inline-block h-2 w-2 rounded-full" style="background:{color}"></span>
                {folder}
              </span>
            {/each}
            <span class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <span class="inline-block h-2 w-2 rounded-full bg-muted-foreground/50"></span>
              root
            </span>
          </div>
        {/if}

        <button
          onclick={onClose}
          class="ml-1 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Close graph"
        >
          <X size={16} />
        </button>
      </div>
    </div>

    <!-- Canvas area -->
    <div class="relative flex-1 overflow-hidden">
      {#if loading}
        <div class="flex h-full items-center justify-center gap-2 text-muted-foreground">
          <RefreshCw size={18} class="animate-spin" />
          <span class="text-sm">Building graph...</span>
        </div>
      {:else if error}
        <div class="flex h-full items-center justify-center text-sm text-destructive">{error}</div>
      {:else}
        <div bind:this={containerEl} class="h-full w-full"></div>
        <div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card/70 px-4 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
          Click a node to open &middot; Scroll to zoom &middot; Drag to pan &middot; Esc to close
        </div>
      {/if}
    </div>
  </div>
</div>
