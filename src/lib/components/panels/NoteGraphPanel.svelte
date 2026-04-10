<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { X, Search, RefreshCw } from '@lucide/svelte';

  interface Props {
    onClose: () => void;
    onNavigate: (path: string) => void;
  }

  const { onClose, onNavigate }: Props = $props();

  interface GraphNode {
    id: string;
    name: string;
    folder: string;
    linkCount: number;
    // force-graph adds x/y at runtime
    x?: number;
    y?: number;
  }

  interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
  }

  let containerEl: HTMLDivElement | undefined = $state();
  let hoveredNodeId = $state<string | null>(null);
  let neighborMap = new Map<string, Set<string>>();
  // force-graph types declare it as a class but it's callable as a factory function;
  // using object to avoid ReturnType constraint error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let graph: any = null;
  let graphReady = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let nodeCount = $state(0);
  let linkCount = $state(0);
  // Stable folder→color palette (uses CSS vars so dark/light works)
  const FOLDER_COLORS = [
    '#6366f1', // indigo
    '#22c55e', // green
    '#f59e0b', // amber
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#ef4444', // red
  ];

  const folderColorMap = new Map<string, string>();
  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function folderColor(folder: string): string {
    if (!folder) return '#94a3b8'; // slate for root
    if (!folderColorMap.has(folder)) {
      folderColorMap.set(folder, FOLDER_COLORS[folderColorMap.size % FOLDER_COLORS.length]);
    }
    return folderColorMap.get(folder)!;
  }

  function nodeRadius(node: GraphNode): number {
    const base = 4;
    const bonus = Math.min(node.linkCount * 1.5, 10);
    return base + bonus;
  }

  function applyColors(): void {
    if (!graph) return;

    if (searchQuery.trim()) {
      // Dim links during search — nodes handle search coloring via nodeCanvasObject
      graph.linkColor(() => '#1e293b');
      return;
    }

    if (hoveredNodeId) {
      graph.linkColor((link: GraphLink) => {
        const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
        return (src === hoveredNodeId || tgt === hoveredNodeId) ? '#6366f1' : '#1e293b';
      });
      return;
    }

    // Default
    graph.linkColor(() => '#334155');
  }

  // Re-apply link colors and force a canvas re-render whenever state changes
  $effect(() => {
    hoveredNodeId; // track
    searchQuery;   // track
    if (!graphReady) return;
    applyColors();   // update link colors
    graph.refresh(); // force canvas re-render so nodeCanvasObject picks up new state
  });

  onMount(async () => {
    // Dynamic import so it only runs in the browser
    const [{ default: ForceGraphCtor }, dataRes] = await Promise.all([
      import('force-graph'),
      fetch('/api/notes/graph')
    ]);

    if (!dataRes.ok) {
      error = 'Failed to load graph data.';
      loading = false;
      return;
    }

    const data: { nodes: GraphNode[]; links: GraphLink[] } = await dataRes.json();
    nodeCount = data.nodes.length;
    linkCount = data.links.length;
    loading = false;
    await tick(); // wait for Svelte to render the containerEl div

    if (!containerEl) {
      error = 'Failed to initialize graph container.';
      return;
    }

    // Build adjacency map for hover highlighting
    neighborMap = new Map<string, Set<string>>();
    for (const link of data.links) {
      const src = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgt = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!neighborMap.has(src)) neighborMap.set(src, new Set());
      if (!neighborMap.has(tgt)) neighborMap.set(tgt, new Set());
      neighborMap.get(src)!.add(tgt);
      neighborMap.get(tgt)!.add(src);
    }

    // force-graph is a factory function; cast to any to bypass tsc class-check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ForceGraph = ForceGraphCtor as any;
    graph = ForceGraph()(containerEl)
      .backgroundColor('#0f172a')
      .width(containerEl.clientWidth)
      .height(containerEl.clientHeight)
      .graphData(data)
      .nodeId('id')
      .nodeLabel((n: GraphNode) =>
        `<div style="background:#1e293b;color:#e2e8f0;padding:4px 8px;border-radius:4px;font-size:12px;border:1px solid #334155">${escapeHtml(n.name)}${n.folder ? ` <span style="opacity:0.5">(${escapeHtml(n.folder)})</span>` : ''}</div>`)
      .nodeVal((n: GraphNode) => nodeRadius(n) * nodeRadius(n))
      .nodeColor((n: GraphNode) => folderColor(n.folder))
      .nodeCanvasObject((n: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const r = nodeRadius(n);

        // Determine fill color — priority: search filter > hover > default
        let nodeColor: string;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const isMatch = n.name.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q);
          nodeColor = isMatch ? '#facc15' : '#334155';
        } else if (hoveredNodeId) {
          if (n.id === hoveredNodeId) nodeColor = '#818cf8';
          else if (neighborMap.get(hoveredNodeId)?.has(n.id)) nodeColor = '#6366f1';
          else nodeColor = '#1e293b';
        } else {
          nodeColor = folderColor(n.folder);
        }

        // Draw circle
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColor;
        ctx.fill();

        // Label — always visible, size scales with zoom
        const label = n.name;
        const fontSize = Math.max(8, 12 / globalScale);
        ctx.font = `${fontSize}px Inter, sans-serif`;

        if (hoveredNodeId && !searchQuery.trim()) {
          if (n.id === hoveredNodeId) ctx.fillStyle = '#e2e8f0';
          else if (neighborMap.get(hoveredNodeId)?.has(n.id)) ctx.fillStyle = '#94a3b8';
          else ctx.fillStyle = '#334155';
        } else if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const isMatch = n.name.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q);
          ctx.fillStyle = isMatch ? '#fef08a' : '#475569';
        } else {
          ctx.fillStyle = '#94a3b8';
        }

        ctx.textAlign = 'center';
        ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + r + fontSize + 1);
      })
      .nodeCanvasObjectMode(() => 'replace')
      .linkColor(() => '#334155')
      .linkWidth((link: GraphLink) => {
        if (!hoveredNodeId) return 0.8;
        const src = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
        return src === hoveredNodeId || tgt === hoveredNodeId ? 2 : 0.4;
      })
      .linkDirectionalParticles(0)
      .enableNodeDrag(true)
      .onNodeClick((n: GraphNode) => {
        onNavigate(n.id);
        onClose();
      })
      .onNodeHover((n: GraphNode | null) => {
        hoveredNodeId = n ? n.id : null;
        if (containerEl) containerEl.style.cursor = n ? 'pointer' : 'default';
      });

    // Resize observer
    const ro = new ResizeObserver(([entry]) => {
      if (graph) {
        graph.width(entry.contentRect.width);
        graph.height(entry.contentRect.height);
      }
    });
    ro.observe(containerEl!);

    graphReady = true;

    // Store cleanup ref
    (graph as unknown as { _ro: ResizeObserver })._ro = ro;
  });

  onDestroy(() => {
    if (graph) {
      (graph as unknown as { _ro?: ResizeObserver })._ro?.disconnect();
      if (typeof graph.pauseAnimation === 'function') graph.pauseAnimation();
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Full-screen overlay -->
<div class="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/80 px-4 py-2.5 backdrop-blur">
    <div class="flex items-center gap-3">
      <span class="text-sm font-semibold text-slate-100">Note Graph</span>
      {#if !loading}
        <span class="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
          {nodeCount} notes &middot; {linkCount} links
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <!-- Search filter -->
      <div class="relative">
        <Search class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
        <input
          type="text"
          placeholder="Filter notes..."
          bind:value={searchQuery}
          class="w-48 rounded-md border border-slate-700 bg-slate-800 py-1 pl-7 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <!-- Legend -->
      {#if folderColorMap.size > 0}
        <div class="hidden items-center gap-1.5 lg:flex">
          {#each [...folderColorMap.entries()] as [folder, color]}
            <span class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-300">
              <span class="inline-block h-2 w-2 rounded-full" style="background:{color}"></span>
              {folder}
            </span>
          {/each}
          <span class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-300">
            <span class="inline-block h-2 w-2 rounded-full bg-slate-500"></span>
            root
          </span>
        </div>
      {/if}

      <button
        onclick={onClose}
        class="ml-1 rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100"
        aria-label="Close graph"
      >
        <X size={16} />
      </button>
    </div>
  </div>

  <!-- Canvas area -->
  <div class="relative flex-1 overflow-hidden">
    {#if loading}
      <div class="flex h-full items-center justify-center gap-2 text-slate-400">
        <RefreshCw size={18} class="animate-spin" />
        <span class="text-sm">Building graph...</span>
      </div>
    {:else if error}
      <div class="flex h-full items-center justify-center text-red-400 text-sm">{error}</div>
    {:else}
      <div bind:this={containerEl} class="h-full w-full"></div>
      <!-- Hint overlay -->
      <div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-4 py-1.5 text-[11px] text-slate-400 backdrop-blur">
        Click a node to open &middot; Scroll to zoom &middot; Drag to pan &middot; Esc to close
      </div>
    {/if}
  </div>
</div>
