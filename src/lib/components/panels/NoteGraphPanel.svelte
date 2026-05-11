<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { X, Search, RefreshCw, Network, Crosshair } from '@lucide/svelte';
  import * as d3 from 'd3';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    name: string;
    folder: string;
    linkCount: number;
  }

  type GraphLink = d3.SimulationLinkDatum<GraphNode>;

  interface RawData {
    nodes: GraphNode[];
    links: Array<{ source: string; target: string }>;
  }

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  interface Props {
    onClose: () => void;
    onNavigate: (path: string) => void;
    workspaceFolder: string;
    activePath: string;
  }

  let { onClose, onNavigate, workspaceFolder, activePath }: Props = $props();

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const FOLDER_COLORS = [
    '#818cf8',
    '#34d399',
    '#fbbf24',
    '#f472b6',
    '#2dd4bf',
    '#fb923c',
    '#a78bfa',
    '#22d3ee',
    '#a3e635',
    '#f87171',
  ];
  const ROOT_COLOR_DARK = '#94a3b8';
  const ROOT_COLOR_LIGHT = '#64748b';

  function nodeRadius(lc: number): number {
    return 4 + Math.min(lc * 2, 12);
  }

  // ---------------------------------------------------------------------------
  // Svelte state
  // ---------------------------------------------------------------------------

  let containerEl = $state<HTMLDivElement | undefined>();
  let svgEl = $state<SVGSVGElement | undefined>();
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let nodeCount = $state(0);
  let linkCountState = $state(0);
  let viewMode = $state<'global' | 'local'>('global');

  // Folder color legend (derived after data loads)
  let folderLegend = $state<Array<{ folder: string; color: string }>>([]);

  // ---------------------------------------------------------------------------
  // Plain JS vars — NOT reactive (avoid stale closures in D3 callbacks)
  // ---------------------------------------------------------------------------

  let _hoveredId: string | null = null;
  let _activeId = '';
  let _search = '';
  let _isDark = true;
  let _currentScale = 1;
  let _graphReady = false;

  // Cached full data for view-mode switching
  let _cachedData: RawData | null = null;
  let _nodeSel: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null = null;
  let _linkSel: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null = null;
  let _simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
  let _folderColorMap = new Map<string, string>();
  let _neighborMap = new Map<string, Set<string>>();
  // Global neighbor map built from full cache — never overwritten by local view mode
  let _globalNeighborMap = new Map<string, Set<string>>();

  let _ro: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Reactive sync of plain vars
  // ---------------------------------------------------------------------------

  $effect(() => {
    _search = searchQuery;
    if (_graphReady) applyHighlight();
  });

  $effect(() => {
    _activeId = activePath;
    if (_graphReady) applyHighlight();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getColor(folder: string): string {
    if (!folder) return _isDark ? ROOT_COLOR_DARK : ROOT_COLOR_LIGHT;
    const cached = _folderColorMap.get(folder);
    if (cached) return cached;
    const idx = _folderColorMap.size % FOLDER_COLORS.length;
    const color = FOLDER_COLORS[idx];
    _folderColorMap.set(folder, color);
    return color;
  }

  function resolveLinkEndId(end: string | GraphNode | d3.SimulationNodeDatum): string {
    if (typeof end === 'object' && end !== null && 'id' in end) {
      return (end as GraphNode).id;
    }
    return end as string;
  }

  // ---------------------------------------------------------------------------
  // applyHighlight — must guard with _graphReady
  // ---------------------------------------------------------------------------

  function applyHighlight(): void {
    if (!_graphReady || !_nodeSel || !_linkSel) return;

    const nodeSel = _nodeSel;
    const linkSel = _linkSel;
    const hasSearch = _search.trim().length > 0;
    const searchLower = _search.toLowerCase();

    if (hasSearch) {
      nodeSel
        .select<SVGCircleElement>('circle.fill-circle')
        .transition().duration(150)
        .attr('fill', (d: GraphNode) =>
          d.name.toLowerCase().includes(searchLower) ? '#fde047' : getColor(d.folder)
        )
        .attr('opacity', (d: GraphNode) =>
          d.name.toLowerCase().includes(searchLower) ? 1 : 0.08
        );

      nodeSel
        .select<SVGCircleElement>('circle.ring')
        .transition().duration(150)
        .attr('opacity', 0);

      nodeSel
        .select<SVGTextElement>('text')
        .transition().duration(150)
        .attr('opacity', (d: GraphNode) =>
          d.name.toLowerCase().includes(searchLower) ? 1 : 0
        );

      linkSel.transition().duration(150).attr('stroke-opacity', 0.05).attr('stroke-width', 0.5);
      return;
    }

    if (_hoveredId) {
      const neighbors = _neighborMap.get(_hoveredId) ?? new Set<string>();

      nodeSel
        .select<SVGCircleElement>('circle.fill-circle')
        .transition().duration(150)
        .attr('fill', (d: GraphNode) => {
          if (d.id === _hoveredId) return _isDark ? '#ffffff' : '#1e293b';
          return getColor(d.folder);
        })
        .attr('opacity', (d: GraphNode) => {
          if (d.id === _hoveredId || neighbors.has(d.id)) return 1;
          return 0.1;
        });

      nodeSel
        .select<SVGCircleElement>('circle.ring')
        .transition().duration(150)
        .attr('opacity', 0);

      nodeSel
        .select<SVGTextElement>('text')
        .transition().duration(150)
        .attr('fill', (d: GraphNode) =>
          d.id === _hoveredId
            ? _isDark
              ? '#f8fafc'
              : '#0f172a'
            : _isDark
              ? '#94a3b8'
              : '#475569'
        )
        .attr('font-weight', (d: GraphNode) => (d.id === _hoveredId ? '600' : '400'))
        .attr('opacity', (d: GraphNode) => {
          if (d.id === _hoveredId || neighbors.has(d.id)) return 1;
          return 0;
        });

      linkSel
        .transition().duration(150)
        .attr('stroke', (l: GraphLink) => {
          const src = resolveLinkEndId(l.source as string | GraphNode);
          const tgt = resolveLinkEndId(l.target as string | GraphNode);
          return src === _hoveredId || tgt === _hoveredId
            ? _isDark
              ? '#a5b4fc'
              : '#4f46e5'
            : _isDark
              ? '#e2e8f0'
              : '#475569';
        })
        .attr('stroke-opacity', (l: GraphLink) => {
          const src = resolveLinkEndId(l.source as string | GraphNode);
          const tgt = resolveLinkEndId(l.target as string | GraphNode);
          return src === _hoveredId || tgt === _hoveredId ? 1 : 0.05;
        })
        .attr('stroke-width', (l: GraphLink) => {
          const src = resolveLinkEndId(l.source as string | GraphNode);
          const tgt = resolveLinkEndId(l.target as string | GraphNode);
          return src === _hoveredId || tgt === _hoveredId ? 2.5 : 0.5;
        });

      return;
    }

    // Default: no hover, no search
    nodeSel
      .select<SVGCircleElement>('circle.fill-circle')
      .transition().duration(150)
      .attr('fill', (d: GraphNode) => getColor(d.folder))
      .attr('opacity', 1);

    nodeSel
      .select<SVGCircleElement>('circle.ring')
      .transition().duration(150)
      .attr('opacity', (d: GraphNode) => (d.id === _activeId ? 0.8 : 0));

    nodeSel
      .select<SVGTextElement>('text')
      .transition().duration(150)
      .attr('fill', _isDark ? '#94a3b8' : '#475569')
      .attr('font-weight', '400')
      .attr('opacity', (d: GraphNode) => {
        if (d.id === _activeId) return 1;
        return _currentScale >= 1.5 ? 1 : 0;
      });

    linkSel
      .transition().duration(150)
      .attr('stroke', _isDark ? '#e2e8f0' : '#475569')
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', 1);
  }

  // ---------------------------------------------------------------------------
  // Build (or rebuild) the D3 graph
  // ---------------------------------------------------------------------------

  async function buildGraph(data: RawData): Promise<void> {
    if (!svgEl || !containerEl) return;

    // Tear down previous graph
    _graphReady = false;
    _simulation?.stop();
    _nodeSel = null;
    _linkSel = null;
    d3.select(svgEl).selectAll('*').remove();

    const W = containerEl.clientWidth || 800;
    const H = containerEl.clientHeight || 600;

    // Build neighbor map from string ids (before d3 mutates) — for hover highlighting
    _neighborMap = new Map<string, Set<string>>();
    for (const link of data.links) {
      const src = link.source as string;
      const tgt = link.target as string;
      if (!_neighborMap.has(src)) _neighborMap.set(src, new Set());
      if (!_neighborMap.has(tgt)) _neighborMap.set(tgt, new Set());
      _neighborMap.get(src)!.add(tgt);
      _neighborMap.get(tgt)!.add(src);
    }
    // If this is global data (not a local-mode filter), also update the global map
    if (data === _cachedData) {
      _globalNeighborMap = _neighborMap;
    }

    // Pre-warm color map & legend
    _folderColorMap = new Map<string, string>();
    const legendEntries: Array<{ folder: string; color: string }> = [];
    for (const n of data.nodes) {
      if (n.folder && !_folderColorMap.has(n.folder)) {
        const color = getColor(n.folder);
        legendEntries.push({ folder: n.folder, color });
      }
    }
    folderLegend = legendEntries;

    const svg = d3.select(svgEl).attr('width', W).attr('height', H);

    const zoomGroup = svg.append<SVGGElement>('g').attr('class', 'zoom-group');
    const linksGroup = zoomGroup.append<SVGGElement>('g').attr('class', 'links');
    const nodesGroup = zoomGroup.append<SVGGElement>('g').attr('class', 'nodes');

    // Deep-clone nodes/links so simulation doesn't mutate _cachedData
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = data.links.map((l) => ({ ...l })) as GraphLink[];

    // Link elements
    const linkSel = linksGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', _isDark ? '#e2e8f0' : '#475569')
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', 1);

    _linkSel = linkSel;

    // Node group elements
    const nodeSel = nodesGroup
      .selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Ring circle (active indicator)
    nodeSel
      .append('circle')
      .attr('class', 'ring')
      .attr('r', (d) => nodeRadius(d.linkCount) + 3)
      .attr('fill', 'none')
      .attr('stroke', _isDark ? '#a5b4fc' : '#4f46e5')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0);

    // Fill circle
    nodeSel
      .append('circle')
      .attr('class', 'fill-circle')
      .attr('r', (d) => nodeRadius(d.linkCount))
      .attr('fill', (d) => getColor(d.folder))
      .attr('stroke', 'none');

    // Label
    nodeSel
      .append('text')
      .attr('dy', (d) => nodeRadius(d.linkCount) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', _isDark ? '#94a3b8' : '#475569')
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
      .text((d) => d.name);

    _nodeSel = nodeSel;

    // Hover events — use pointerenter/pointerleave (non-bubbling) to prevent flicker
    nodeSel
      .on('pointerenter', (_event: PointerEvent, d: GraphNode) => {
        _hoveredId = d.id;
        applyHighlight();
      })
      .on('pointerleave', () => {
        _hoveredId = null;
        applyHighlight();
      })
      .on('click', (_event: MouseEvent, d: GraphNode) => {
        onNavigate(d.id);
        onClose();
      });

    // Drag
    const dragHandler = d3
      .drag<SVGGElement, GraphNode>()
      .on(
        'start',
        (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
          if (!event.active) _simulation?.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
      )
      .on(
        'drag',
        (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
          d.fx = event.x;
          d.fy = event.y;
        }
      )
      .on(
        'end',
        (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) => {
          if (!event.active) _simulation?.alphaTarget(0);
          // Keep node pinned where released (Obsidian-style)
        }
      );

    nodeSel.call(dragHandler);

    // Zoom
    const zoomHandler = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        zoomGroup.attr('transform', event.transform.toString());
        _currentScale = event.transform.k;
        if (!_hoveredId && !_search.trim()) {
          nodeSel.select<SVGTextElement>('text').attr('opacity', (d: GraphNode) => {
            if (d.id === _activeId) return 1;
            return _currentScale >= 1.5 ? 1 : 0;
          });
        }
      });

    svg.call(zoomHandler);

    // Prevent node drag from triggering pan
    nodeSel.on('mousedown.zoom', (event: MouseEvent) => event.stopPropagation());

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d: GraphNode) => d.id)
          .distance(60)
          .strength(0.5)
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-80))
      .force('center', d3.forceCenter<GraphNode>(W / 2, H / 2))
      .force(
        'collision',
        d3.forceCollide<GraphNode>().radius((d: GraphNode) => nodeRadius(d.linkCount) + 5)
      )
      .on('tick', () => {
        linkSel
          .attr('x1', (l: GraphLink) => (l.source as GraphNode).x ?? 0)
          .attr('y1', (l: GraphLink) => (l.source as GraphNode).y ?? 0)
          .attr('x2', (l: GraphLink) => (l.target as GraphNode).x ?? 0)
          .attr('y2', (l: GraphLink) => (l.target as GraphNode).y ?? 0);

        nodeSel.attr(
          'transform',
          (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`
        );
      })
      .on('end', () => {
        autoFit(nodes, svg, zoomHandler, W, H);
        _graphReady = true;
        applyHighlight();
      });

    _simulation = simulation;

    // Resize observer
    _ro?.disconnect();
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        svg.attr('width', width).attr('height', height);
        simulation.force('center', d3.forceCenter<GraphNode>(width / 2, height / 2));
      }
    });
    ro.observe(containerEl!);
    _ro = ro;
  }

  function autoFit(
    nodes: GraphNode[],
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    zoomHandler: d3.ZoomBehavior<SVGSVGElement, unknown>,
    W: number,
    H: number
  ): void {
    if (nodes.length === 0) return;
    const padding = 80;
    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    const bW = maxX - minX;
    const bH = maxY - minY;
    const scale = Math.min(W / bW, H / bH, 2);
    const tx = (W - scale * (minX + maxX)) / 2;
    const ty = (H - scale * (minY + maxY)) / 2;
    svg.transition().duration(600).call(
      zoomHandler.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }

  // ---------------------------------------------------------------------------
  // View mode toggle — filter data and rebuild
  // ---------------------------------------------------------------------------

  async function switchViewMode(mode: 'global' | 'local'): Promise<void> {
    viewMode = mode;
    if (!_cachedData) return;

    let data: RawData;

    if (mode === 'local') {
      const neighborIds = _globalNeighborMap.get(_activeId) ?? new Set<string>();
      const keepIds = new Set<string>([_activeId, ...neighborIds]);
      const filteredNodes = _cachedData.nodes.filter((n) => keepIds.has(n.id));
      const filteredLinks = _cachedData.links.filter(
        (l) =>
          keepIds.has(l.source as string) && keepIds.has(l.target as string)
      );
      data = { nodes: filteredNodes, links: filteredLinks };
    } else {
      data = _cachedData;
    }

    nodeCount = data.nodes.length;
    linkCountState = data.links.length;

    await tick();
    await buildGraph(data);
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  // ---------------------------------------------------------------------------
  // onMount
  // ---------------------------------------------------------------------------

  let _retryInit: (() => void) | null = null;

  onMount(() => {
    _isDark = document.documentElement.classList.contains('dark');
    const themeObserver = new MutationObserver(() => {
      _isDark = document.documentElement.classList.contains('dark');
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    _activeId = activePath;

    let cleanupDone = false;

    async function init(): Promise<void> {
      const wsParam = workspaceFolder
        ? `?workspace=${encodeURIComponent(workspaceFolder)}`
        : '';

      let rawData: RawData;
      try {
        const res = await fetch(`/api/notes/graph${wsParam}`);
        if (!res.ok) {
          error = 'Failed to load graph data.';
          loading = false;
          return;
        }
        rawData = (await res.json()) as RawData;
      } catch {
        error = 'Network error loading graph data.';
        loading = false;
        return;
      }

      _cachedData = rawData;
      nodeCount = rawData.nodes.length;
      linkCountState = rawData.links.length;
      loading = false;

      if (cleanupDone) return;
      await tick();
      if (!svgEl || !containerEl || cleanupDone) return;

      await buildGraph(rawData);
    }

    _retryInit = init;
    init();

    return () => {
      cleanupDone = true;
      _graphReady = false;
      _simulation?.stop();
      _ro?.disconnect();
      themeObserver.disconnect();
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <!-- Modal -->
  <div
    class="relative flex h-[80vh] w-[85vw] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Note Graph"
  >
    <!-- Header -->
    <div
      class="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3"
    >
      <!-- Title + counts -->
      <div class="flex items-center gap-2">
        <Network class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium text-foreground">Note Graph</span>
        {#if !loading && !error}
          <span
            class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            {nodeCount} notes · {linkCountState} links
          </span>
        {/if}
      </div>

      <!-- View mode toggle -->
      {#if !loading && !error}
        <div
          class="flex rounded border border-border bg-muted text-xs"
          role="group"
          aria-label="View mode"
        >
          <button
            class="flex items-center gap-1 px-2 py-1 transition-colors {viewMode === 'global'
              ? 'rounded bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => switchViewMode('global')}
            title="All notes"
          >
            <Network class="h-3 w-3" />
            Global
          </button>
          <button
            class="flex items-center gap-1 px-2 py-1 transition-colors {viewMode === 'local'
              ? 'rounded bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => switchViewMode('local')}
            title="Active note + neighbors"
          >
            <Crosshair class="h-3 w-3" />
            Local
          </button>
        </div>
      {/if}

      <!-- Search -->
      {#if !loading && !error}
        <div class="relative flex-1 max-w-xs">
          <Search
            class="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search notes…"
            bind:value={searchQuery}
            class="w-full rounded border border-border bg-background py-1 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      {/if}

      <!-- Folder legend -->
      {#if folderLegend.length > 0 && !loading && !error}
        <div class="hidden items-center gap-2 overflow-x-auto md:flex">
          {#each folderLegend.slice(0, 6) as entry (entry.folder)}
            <div class="flex shrink-0 items-center gap-1">
              <span
                class="h-2 w-2 rounded-full"
                style="background-color: {entry.color}"
              ></span>
              <span class="max-w-[80px] truncate text-xs text-muted-foreground"
                >{entry.folder}</span
              >
            </div>
          {/each}
          {#if folderLegend.length > 6}
            <span class="text-xs text-muted-foreground"
              >+{folderLegend.length - 6} more</span
            >
          {/if}
        </div>
      {/if}

      <div class="ml-auto flex items-center gap-1">
        <!-- Refresh -->
        {#if !loading && !error}
          <button
            class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onclick={() => { loading = true; _simulation?.stop(); _retryInit?.(); }}
            title="Refresh graph"
            aria-label="Refresh graph"
          >
            <RefreshCw class="h-4 w-4" />
          </button>
        {/if}

        <!-- Close -->
        <button
          class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onclick={onClose}
          aria-label="Close graph"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="relative flex-1 overflow-hidden" bind:this={containerEl}>
      {#if loading}
        <div class="flex h-full items-center justify-center gap-3 text-muted-foreground">
          <div
            class="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground"
          ></div>
          <span class="text-sm">Building graph…</span>
        </div>
      {:else if error}
        <div class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <span class="text-sm text-destructive">{error}</span>
          <button
            class="text-xs underline hover:text-foreground"
            onclick={() => {
              error = null;
              loading = true;
              _retryInit?.();
            }}>Retry</button
          >
        </div>
      {:else}
        <svg bind:this={svgEl} class="h-full w-full"></svg>

        <!-- Hint bar -->
        <div
          class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm"
        >
          Click node to open · Scroll to zoom · Drag to pan · [Esc] to close · Wait a few seconds for it to load
        </div>
      {/if}
    </div>
  </div>
</div>
