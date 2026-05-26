<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Workflow, X, RefreshCw, Trash2 } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
    SvelteFlow,
    Controls,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
    type NodeTypes,
    addEdge,
    type Connection
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import type { TopologyEdge, TopologyHost } from '$lib/types';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import NetworkTopologyNode from '$lib/components/engagement/NetworkTopologyNode.svelte';

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
  }

  const { workspaceId, onClose }: Props = $props();

  // Register the custom node renderer
  const nodeTypes: NodeTypes = { topoNode: NetworkTopologyNode };

  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let loading = $state(false);
  let selectedEdgeId = $state<string | null>(null);
  let confirmDeleteOpen = $state(false);
  let pendingDeleteEdgeId = $state<string | null>(null);

  // Debounce timers per node — avoid spamming PATCH on every drag tick
  const posTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearPositionTimers(): void {
    for (const timer of posTimers.values()) clearTimeout(timer);
    posTimers.clear();
  }

  /** Arrange hosts in a circle when no stored position exists. */
  function autoPosition(index: number, total: number): { x: number; y: number } {
    if (total <= 1) return { x: 300, y: 300 };
    const radius = Math.max(150, total * 40);
    const angle = (2 * Math.PI * index) / total;
    return {
      x: Math.round(300 + radius * Math.cos(angle)),
      y: Math.round(300 + radius * Math.sin(angle)),
    };
  }

  async function loadTopology(): Promise<void> {
    if (!workspaceId) return;
    clearPositionTimers();
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/topology`);
      if (!res.ok) return;
      const data = (await res.json()) as { hosts: TopologyHost[]; edges: TopologyEdge[] };
      const total = data.hosts.length;

      nodes = data.hosts.map((h, i) => {
        const pos =
          h.topo_x !== null && h.topo_y !== null
            ? { x: h.topo_x, y: h.topo_y }
            : autoPosition(i, total);
        const label = h.hostname ? `${h.ip} (${h.hostname})` : h.ip;
        return {
          id: String(h.id),
          position: pos,
          type: 'topoNode',
          data: { label, status: h.status, portCount: h.port_count },
        };
      });

      edges = data.edges.map((e) => ({
        id: e.id,
        source: String(e.source_host_id),
        target: String(e.target_host_id),
        label: e.label || undefined,
        style: 'stroke:#6366f1;stroke-width:2;',
      }));
    } catch {
      console.error('Failed to load topology');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    clearPositionTimers();
    if (workspaceId) {
      loadTopology();
      return;
    }

    selectedEdgeId = null;
    confirmDeleteOpen = false;
    pendingDeleteEdgeId = null;
  });

  async function handleConnect(params: Connection): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/topology/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_host_id: params.source,
          target_host_id: params.target,
        }),
      });
      // 409 = already exists, 400/404 = validation errors — silently ignore
      if (!res.ok) return;
      const created = (await res.json()) as TopologyEdge;
      edges = addEdge(
        {
          id: created.id,
          source: String(created.source_host_id),
          target: String(created.target_host_id),
          style: 'stroke:#6366f1;stroke-width:2;',
        },
        edges
      );
    } catch {
      console.error('Failed to create topology edge');
    }
  }

  /** Persist node position after a drag — debounced to 500 ms. */
  function handleNodeDragStop({
    targetNode,
  }: {
    targetNode: Node | null;
    nodes: Node[];
    event: MouseEvent | TouchEvent;
  }): void {
    if (!workspaceId || !targetNode) return;
    const existing = posTimers.get(targetNode.id);
    if (existing) clearTimeout(existing);
    posTimers.set(
      targetNode.id,
      setTimeout(async () => {
        try {
          await fetch(`/api/workspaces/${workspaceId}/hosts/${targetNode.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topo_x: targetNode.position.x, topo_y: targetNode.position.y }),
          });
        } finally {
          posTimers.delete(targetNode.id);
        }
      }, 500)
    );
  }

  function handleEdgeClick({ edge }: { edge: Edge; event: MouseEvent | TouchEvent }): void {
    selectedEdgeId = selectedEdgeId === edge.id ? null : edge.id;
  }

  async function deleteSelectedEdge(): Promise<void> {
    const edgeId = pendingDeleteEdgeId;
    if (!workspaceId || !edgeId) return;
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/topology/edges/${edgeId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        edges = edges.filter((e) => e.id !== edgeId);
      }
    } catch {
      console.error('Failed to delete topology edge');
    } finally {
      selectedEdgeId = null;
      confirmDeleteOpen = false;
      pendingDeleteEdgeId = null;
    }
  }

  function requestDeleteSelectedEdge(): void {
    if (!selectedEdgeId) return;
    pendingDeleteEdgeId = selectedEdgeId;
    confirmDeleteOpen = true;
  }

  function cancelDeleteSelectedEdge(): void {
    confirmDeleteOpen = false;
    pendingDeleteEdgeId = null;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;

    if (confirmDeleteOpen) {
      cancelDeleteSelectedEdge();
      e.preventDefault();
      return;
    }

    if (selectedEdgeId) {
      selectedEdgeId = null;
      e.preventDefault();
      return;
    }

    onClose();
  }

  onDestroy(() => {
    clearPositionTimers();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div
    class="relative flex h-[80vh] w-[85vw] max-w-[1400px] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-label="Network Topology"
    transition:fly={{ y: 20, duration: 200, easing: cubicOut }}
  >
  <!-- Header -->
  <div class="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
    <div class="flex items-center gap-2">
      <Workflow size={15} class="text-muted-foreground" />
      <span class="text-sm font-semibold text-foreground">Network Topology</span>
      <span class="text-xs text-muted-foreground">
        ({nodes.length} host{nodes.length === 1 ? '' : 's'}, {edges.length} connection{edges.length === 1 ? '' : 's'})
      </span>
    </div>
    <div class="flex items-center gap-1">
      {#if selectedEdgeId}
        <button
          onclick={requestDeleteSelectedEdge}
          class="flex items-center gap-1 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
          title="Delete selected connection"
        >
          <Trash2 size={12} />
          Delete connection
        </button>
      {/if}
      <button
        onclick={() => loadTopology()}
        class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        title="Refresh"
        aria-label="Refresh topology"
        disabled={loading}
      >
        <RefreshCw size={14} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={onClose}
        class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        title="Close (Esc)"
        aria-label="Close network topology panel"
      >
        <X size={14} />
      </button>
    </div>
  </div>

  <!-- Canvas or empty state -->
  {#if nodes.length === 0 && !loading}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-sm text-muted-foreground">
        No hosts tracked yet. Add hosts in the Host Tracker to populate the topology.
      </p>
    </div>
  {:else}
    <div class="relative flex-1">
      <SvelteFlow
        bind:nodes
        bind:edges
        {nodeTypes}
        fitView
        onconnect={handleConnect}
        onnodedragstop={handleNodeDragStop}
        onedgeclick={handleEdgeClick}
        colorMode="system"
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </SvelteFlow>

      <!-- Status legend -->
      <div
        class="absolute bottom-4 right-4 z-10 flex gap-3 rounded border border-border bg-background/80 px-3 py-1.5 text-[10px] backdrop-blur-sm"
      >
        <span class="flex items-center gap-1">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-[#22c55e]"></span>up
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]"></span>down
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-[#f97316]"></span>rooted
        </span>
        <span class="flex items-center gap-1">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-[#6b7280]"></span>unknown
        </span>
      </div>

      {#if nodes.length > 0}
        <div class="absolute right-4 top-4 flex flex-col gap-1">
          <p class="text-[10px] text-muted-foreground">Drag to reposition. Connect via handles.</p>
          <p class="text-[10px] text-muted-foreground">Click a connection to select, then delete.</p>
        </div>
      {/if}
    </div>
  {/if}
  </div>
</div>

{#if confirmDeleteOpen}
  <ConfirmDialog
    title="Delete Connection"
    message="Delete selected connection? This cannot be undone."
    confirmLabel="Delete"
    onConfirm={deleteSelectedEdge}
    onCancel={cancelDeleteSelectedEdge}
  />
{/if}
