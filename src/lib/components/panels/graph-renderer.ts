/**
 * GraphRenderer — encapsulates all D3 force-graph rendering logic.
 * NoteGraphPanel.svelte creates one instance per mount and drives it via
 * setSearch / setActiveId / setDark / build / destroy.
 */
import * as d3 from 'd3';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  folder: string;
  linkCount: number;
}

export type GraphLink = d3.SimulationLinkDatum<GraphNode>;

export interface RawData {
  nodes: GraphNode[];
  links: Array<{ source: string; target: string }>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FOLDER_COLORS = [
  '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#2dd4bf',
  '#fb923c', '#a78bfa', '#22d3ee', '#a3e635', '#f87171',
];
const ROOT_COLOR_DARK = '#94a3b8';
const ROOT_COLOR_LIGHT = '#64748b';

function nodeRadius(lc: number): number {
  return 4 + Math.min(lc * 2, 12);
}

type NodeSel = d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>;
type LinkSel = d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;

// ── Class ──────────────────────────────────────────────────────────────────

export class GraphRenderer {
  private _hoveredId: string | null = null;
  private _activeId = '';
  private _search = '';
  private _isDark = true;
  private _currentScale = 1;
  private _graphReady = false;
  private _nodeSel: NodeSel | null = null;
  private _linkSel: LinkSel | null = null;
  private _simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
  private _folderColorMap = new Map<string, string>();
  private _neighborMap = new Map<string, Set<string>>();
  private _globalNeighborMap = new Map<string, Set<string>>();
  private _ro: ResizeObserver | null = null;

  constructor(
    private readonly svgEl: SVGSVGElement,
    private readonly containerEl: HTMLDivElement,
    private readonly onNavigate: (id: string) => void,
    private readonly onClose: () => void,
    private readonly onFolderLegend: (legend: Array<{ folder: string; color: string }>) => void,
  ) {}

  // ── Public setters ─────────────────────────────────────────────────────

  setActiveId(id: string): void {
    this._activeId = id;
    if (this._graphReady) this.applyHighlight();
  }

  setSearch(q: string): void {
    this._search = q;
    if (this._graphReady) this.applyHighlight();
  }

  setDark(dark: boolean): void {
    this._isDark = dark;
  }

  getGlobalNeighborMap(): Map<string, Set<string>> {
    return this._globalNeighborMap;
  }

  isReady(): boolean {
    return this._graphReady;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private getColor(folder: string): string {
    if (!folder) return this._isDark ? ROOT_COLOR_DARK : ROOT_COLOR_LIGHT;
    const cached = this._folderColorMap.get(folder);
    if (cached) return cached;
    const idx = this._folderColorMap.size % FOLDER_COLORS.length;
    const color = FOLDER_COLORS[idx];
    this._folderColorMap.set(folder, color);
    return color;
  }

  private resolveLinkEndId(end: string | GraphNode | d3.SimulationNodeDatum): string {
    if (typeof end === 'object' && end !== null && 'id' in end) {
      return (end as GraphNode).id;
    }
    return end as string;
  }

  // ── applyHighlight ─────────────────────────────────────────────────────

  applyHighlight(): void {
    if (!this._graphReady || !this._nodeSel || !this._linkSel) return;
    const nodeSel = this._nodeSel;
    const linkSel = this._linkSel;
    const hasSearch = this._search.trim().length > 0;
    const searchLower = this._search.toLowerCase();

    if (hasSearch) {
      nodeSel.select<SVGCircleElement>('circle.fill-circle').transition().duration(150)
        .attr('fill', (d: GraphNode) => d.name.toLowerCase().includes(searchLower) ? '#fde047' : this.getColor(d.folder))
        .attr('opacity', (d: GraphNode) => d.name.toLowerCase().includes(searchLower) ? 1 : 0.08);
      nodeSel.select<SVGCircleElement>('circle.ring').transition().duration(150).attr('opacity', 0);
      nodeSel.select<SVGTextElement>('text').transition().duration(150)
        .attr('opacity', (d: GraphNode) => d.name.toLowerCase().includes(searchLower) ? 1 : 0);
      linkSel.transition().duration(150).attr('stroke-opacity', 0.05).attr('stroke-width', 0.5);
      return;
    }

    if (this._hoveredId) {
      const neighbors = this._neighborMap.get(this._hoveredId) ?? new Set<string>();
      nodeSel.select<SVGCircleElement>('circle.fill-circle').transition().duration(150)
        .attr('fill', (d: GraphNode) =>
          d.id === this._hoveredId ? (this._isDark ? '#ffffff' : '#1e293b') : this.getColor(d.folder))
        .attr('opacity', (d: GraphNode) =>
          d.id === this._hoveredId || neighbors.has(d.id) ? 1 : 0.1);
      nodeSel.select<SVGCircleElement>('circle.ring').transition().duration(150).attr('opacity', 0);
      nodeSel.select<SVGTextElement>('text').transition().duration(150)
        .attr('fill', (d: GraphNode) =>
          d.id === this._hoveredId
            ? (this._isDark ? '#f8fafc' : '#0f172a')
            : (this._isDark ? '#94a3b8' : '#475569'))
        .attr('font-weight', (d: GraphNode) => d.id === this._hoveredId ? '600' : '400')
        .attr('opacity', (d: GraphNode) =>
          d.id === this._hoveredId || neighbors.has(d.id) ? 1 : 0);
      linkSel.transition().duration(150)
        .attr('stroke', (l: GraphLink) => {
          const src = this.resolveLinkEndId(l.source as string | GraphNode);
          const tgt = this.resolveLinkEndId(l.target as string | GraphNode);
          return src === this._hoveredId || tgt === this._hoveredId
            ? (this._isDark ? '#a5b4fc' : '#4f46e5')
            : (this._isDark ? '#e2e8f0' : '#475569');
        })
        .attr('stroke-opacity', (l: GraphLink) => {
          const src = this.resolveLinkEndId(l.source as string | GraphNode);
          const tgt = this.resolveLinkEndId(l.target as string | GraphNode);
          return src === this._hoveredId || tgt === this._hoveredId ? 1 : 0.05;
        })
        .attr('stroke-width', (l: GraphLink) => {
          const src = this.resolveLinkEndId(l.source as string | GraphNode);
          const tgt = this.resolveLinkEndId(l.target as string | GraphNode);
          return src === this._hoveredId || tgt === this._hoveredId ? 2.5 : 0.5;
        });
      return;
    }

    // Default: no hover, no search
    nodeSel.select<SVGCircleElement>('circle.fill-circle').transition().duration(150)
      .attr('fill', (d: GraphNode) => this.getColor(d.folder)).attr('opacity', 1);
    nodeSel.select<SVGCircleElement>('circle.ring').transition().duration(150)
      .attr('opacity', (d: GraphNode) => (d.id === this._activeId ? 0.8 : 0));
    nodeSel.select<SVGTextElement>('text').transition().duration(150)
      .attr('fill', this._isDark ? '#94a3b8' : '#475569')
      .attr('font-weight', '400')
      .attr('opacity', (d: GraphNode) => {
        if (d.id === this._activeId) return 1;
        return this._currentScale >= 1.5 ? 1 : 0;
      });
    linkSel.transition().duration(150)
      .attr('stroke', this._isDark ? '#e2e8f0' : '#475569')
      .attr('stroke-opacity', 0.35).attr('stroke-width', 1);
  }

  // ── autoFit ─────────────────────────────────────────────────────────────

  private autoFit(
    nodes: GraphNode[],
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    zoomHandler: d3.ZoomBehavior<SVGSVGElement, unknown>,
    W: number,
    H: number,
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
      d3.zoomIdentity.translate(tx, ty).scale(scale),
    );
  }

  // ── build ───────────────────────────────────────────────────────────────

  async build(data: RawData, isGlobal = false): Promise<void> {
    if (!this.svgEl || !this.containerEl) return;
    this._graphReady = false;
    this._simulation?.stop();
    this._nodeSel = null;
    this._linkSel = null;
    d3.select(this.svgEl).selectAll('*').remove();

    const W = this.containerEl.clientWidth || 800;
    const H = this.containerEl.clientHeight || 600;

    // Build neighbor maps from string ids (before D3 mutates them)
    this._neighborMap = new Map<string, Set<string>>();
    for (const link of data.links) {
      const src = link.source as string;
      const tgt = link.target as string;
      if (!this._neighborMap.has(src)) this._neighborMap.set(src, new Set());
      if (!this._neighborMap.has(tgt)) this._neighborMap.set(tgt, new Set());
      this._neighborMap.get(src)!.add(tgt);
      this._neighborMap.get(tgt)!.add(src);
    }
    if (isGlobal) this._globalNeighborMap = this._neighborMap;

    // Pre-warm color map and build legend
    this._folderColorMap = new Map<string, string>();
    const legendEntries: Array<{ folder: string; color: string }> = [];
    for (const n of data.nodes) {
      if (n.folder && !this._folderColorMap.has(n.folder)) {
        legendEntries.push({ folder: n.folder, color: this.getColor(n.folder) });
      }
    }
    this.onFolderLegend(legendEntries);

    const svg = d3.select(this.svgEl).attr('width', W).attr('height', H);
    const zoomGroup = svg.append<SVGGElement>('g').attr('class', 'zoom-group');
    const linksGroup = zoomGroup.append<SVGGElement>('g').attr('class', 'links');
    const nodesGroup = zoomGroup.append<SVGGElement>('g').attr('class', 'nodes');

    // Deep-clone so simulation doesn't mutate the cached data
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = data.links.map((l) => ({ ...l })) as GraphLink[];

    const linkSel = linksGroup.selectAll<SVGLineElement, GraphLink>('line')
      .data(links).join('line')
      .attr('stroke', this._isDark ? '#e2e8f0' : '#475569')
      .attr('stroke-opacity', 0.35).attr('stroke-width', 1);
    this._linkSel = linkSel;

    const nodeSel = nodesGroup.selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes, (d) => d.id).join('g').attr('class', 'node').style('cursor', 'pointer');

    nodeSel.append('circle').attr('class', 'ring')
      .attr('r', (d) => nodeRadius(d.linkCount) + 3)
      .attr('fill', 'none')
      .attr('stroke', this._isDark ? '#a5b4fc' : '#4f46e5')
      .attr('stroke-width', 1.5).attr('opacity', 0);

    nodeSel.append('circle').attr('class', 'fill-circle')
      .attr('r', (d) => nodeRadius(d.linkCount))
      .attr('fill', (d) => this.getColor(d.folder)).attr('stroke', 'none');

    nodeSel.append('text')
      .attr('dy', (d) => nodeRadius(d.linkCount) + 12)
      .attr('text-anchor', 'middle').attr('font-size', '11px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', this._isDark ? '#94a3b8' : '#475569')
      .attr('pointer-events', 'none').attr('opacity', 0)
      .text((d) => d.name);
    this._nodeSel = nodeSel;

    nodeSel
      .on('pointerenter', (_event: PointerEvent, d: GraphNode) => {
        this._hoveredId = d.id;
        this.applyHighlight();
      })
      .on('pointerleave', () => {
        this._hoveredId = null;
        this.applyHighlight();
      })
      .on('click', (_event: MouseEvent, d: GraphNode) => {
        this.onNavigate(d.id);
        this.onClose();
      });

    const dragHandler = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        if (!event.active) this._simulation?.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) => {
        if (!event.active) this._simulation?.alphaTarget(0);
        // Keep node pinned where released (Obsidian-style)
      });
    nodeSel.call(dragHandler);

    const zoomHandler = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        zoomGroup.attr('transform', event.transform.toString());
        this._currentScale = event.transform.k;
        if (!this._hoveredId && !this._search.trim()) {
          nodeSel.select<SVGTextElement>('text').attr('opacity', (d: GraphNode) => {
            if (d.id === this._activeId) return 1;
            return this._currentScale >= 1.5 ? 1 : 0;
          });
        }
      });
    svg.call(zoomHandler);
    nodeSel.on('mousedown.zoom', (event: MouseEvent) => event.stopPropagation());

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id((d: GraphNode) => d.id).distance(60).strength(0.5))
      .force('charge', d3.forceManyBody<GraphNode>().strength(-80))
      .force('center', d3.forceCenter<GraphNode>(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d: GraphNode) => nodeRadius(d.linkCount) + 5))
      .on('tick', () => {
        linkSel
          .attr('x1', (l: GraphLink) => (l.source as GraphNode).x ?? 0)
          .attr('y1', (l: GraphLink) => (l.source as GraphNode).y ?? 0)
          .attr('x2', (l: GraphLink) => (l.target as GraphNode).x ?? 0)
          .attr('y2', (l: GraphLink) => (l.target as GraphNode).y ?? 0);
        nodeSel.attr('transform', (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      })
      .on('end', () => {
        this.autoFit(nodes, svg, zoomHandler, W, H);
        this._graphReady = true;
        this.applyHighlight();
      });
    this._simulation = simulation;

    // Resize observer — update SVG dimensions and center force
    this._ro?.disconnect();
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        svg.attr('width', width).attr('height', height);
        simulation.force('center', d3.forceCenter<GraphNode>(width / 2, height / 2));
      }
    });
    ro.observe(this.containerEl);
    this._ro = ro;
  }

  // ── destroy ─────────────────────────────────────────────────────────────

  destroy(): void {
    this._graphReady = false;
    this._simulation?.stop();
    this._ro?.disconnect();
    if (this.svgEl) d3.select(this.svgEl).selectAll('*').remove();
  }
}
