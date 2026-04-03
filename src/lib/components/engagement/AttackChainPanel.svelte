<script lang="ts">
  import { Network, Plus, X, RefreshCw, Trash2 } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
    SvelteFlow,
    Controls,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
    addEdge,
    type Connection
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  interface AttackNode {
    id: string;
    workspace_id: string;
    label: string;
    node_type: string;
    x: number;
    y: number;
    host_id: string | null;
    metadata: string;
  }

  interface AttackEdge {
    id: string;
    source_node_id: string;
    target_node_id: string;
    label: string;
    technique: string;
  }

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
  }

  let { workspaceId, onClose }: Props = $props();

  // SvelteFlow state (reactive stores required by @xyflow/svelte)
  let nodes = $state<Node[]>([]);
  let edges = $state<Edge[]>([]);
  let loading = $state(false);
  let addingNode = $state(false);

  // Add node form
  let newLabel = $state('');
  let newType = $state('action');

  const NODE_TYPES = ['initial-access', 'recon', 'action', 'privesc', 'lateral-movement', 'data-exfil', 'flag'];

  const NODE_COLORS: Record<string, string> = {
    'initial-access': '#f97316',
    'recon': '#3b82f6',
    'action': '#8b5cf6',
    'privesc': '#ef4444',
    'lateral-movement': '#ec4899',
    'data-exfil': '#14b8a6',
    'flag': '#22c55e'
  };

  $effect(() => {
    if (workspaceId) loadChain();
  });

  async function loadChain() {
    if (!workspaceId) return;
    nodes = [];
    edges = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/nodes`);
      const data = await res.json() as { nodes: AttackNode[]; edges: AttackEdge[] };

      nodes = data.nodes.map((n) => ({
        id: n.id,
        position: { x: n.x, y: n.y },
        data: { label: n.label, type: n.node_type },
        style: `background:${NODE_COLORS[n.node_type] ?? '#8b5cf6'};color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;`,
        type: 'default'
      }));

      edges = data.edges.map((e) => ({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        label: e.label || undefined,
        animated: true,
        style: 'stroke:#8b5cf6;stroke-width:2;'
      }));
    } catch {
      console.error('Failed to load attack chain');
    } finally {
      loading = false;
    }
  }

  async function addNode() {
    if (!workspaceId || !newLabel.trim()) return;

    // Place new nodes in a cascading layout
    const offsetX = (nodes.length % 5) * 180 + 50;
    const offsetY = Math.floor(nodes.length / 5) * 100 + 50;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel, node_type: newType, x: offsetX, y: offsetY })
      });
      if (!res.ok) return;
      const n: AttackNode = await res.json();
      nodes = [...nodes, {
        id: n.id,
        position: { x: n.x, y: n.y },
        data: { label: n.label, type: n.node_type },
        style: `background:${NODE_COLORS[n.node_type] ?? '#8b5cf6'};color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;`,
        type: 'default'
      }];
      newLabel = '';
      addingNode = false;
    } catch {
      console.error('Failed to add node');
    }
  }

  async function handleConnect(params: Connection) {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_node_id: params.source, target_node_id: params.target })
      });
      if (!res.ok) return;
      const e: AttackEdge = await res.json();
      edges = addEdge({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        animated: true,
        style: 'stroke:#8b5cf6;stroke-width:2;'
      }, edges);
    } catch {
      console.error('Failed to create edge');
    }
  }

  async function deleteNode(nodeId: string) {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/nodes/${nodeId}`, { method: 'DELETE' });
    nodes = nodes.filter((n) => n.id !== nodeId);
    edges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  }

  /** Persist node position on drag end */
  async function handleNodeDragStop({ targetNode }: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent }) {
    if (!workspaceId || !targetNode) return;
    await fetch(`/api/workspaces/${workspaceId}/nodes/${targetNode.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: targetNode.position.x, y: targetNode.position.y })
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Full-screen modal overlay for the attack chain -->
<div
  class="fixed inset-0 z-50 flex flex-col bg-background"
  transition:fly={{ y: 20, duration: 200, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-10 items-center justify-between border-b border-border px-4">
    <div class="flex items-center gap-2">
      <Network size={15} class="text-muted-foreground" />
      <span class="text-sm font-semibold">Attack Chain</span>
      {#if workspaceId}
        <span class="text-xs text-muted-foreground">({nodes.length} nodes, {edges.length} edges)</span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={() => loadChain()}
        class="flex h-7 items-center gap-1.5 rounded border border-border px-2 text-xs text-muted-foreground hover:bg-accent"
      >
        <RefreshCw size={11} class={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
      <button
        onclick={() => (addingNode = !addingNode)}
        class="flex h-7 items-center gap-1.5 rounded bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        disabled={!workspaceId}
      >
        <Plus size={11} />
        Add Node
      </button>
      <button
        onclick={onClose}
        class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
      >
        <X size={13} />
      </button>
    </div>
  </div>

  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-sm text-muted-foreground">Select a workspace to build an attack chain</p>
    </div>
  {:else}
    <!-- Add node form (inline toolbar) -->
    {#if addingNode}
      <div class="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
        <select
          bind:value={newType}
          class="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {#each NODE_TYPES as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
        <input
          type="text"
          placeholder="Node label *"
          bind:value={newLabel}
          class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => { if (e.key === 'Enter') addNode(); if (e.key === 'Escape') addingNode = false; }}
        />
        <button
          onclick={addNode}
          class="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add
        </button>
        <button
          onclick={() => (addingNode = false)}
          class="rounded border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    {/if}

    <!-- Flow canvas -->
    <div class="relative flex-1">
      {#if loading}
        <div class="absolute inset-0 flex items-center justify-center">
          <RefreshCw size={24} class="animate-spin text-muted-foreground" />
        </div>
      {:else}
        <SvelteFlow
          bind:nodes
          bind:edges
          fitView
          onconnect={handleConnect}
          onnodedragstop={handleNodeDragStop}
          colorMode="system"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
        </SvelteFlow>

        <!-- Node legend -->
        <div class="absolute bottom-12 left-4 flex flex-col gap-1 rounded border border-border bg-card p-2 text-[10px] leading-tight">
          {#each NODE_TYPES as t}
            <div class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style="background:{NODE_COLORS[t]};"></span>
              <span class="text-muted-foreground">{t}</span>
            </div>
          {/each}
        </div>

        <!-- Selected-node delete button via a separate panel (since SvelteFlow handles node selection) -->
        {#if nodes.length > 0}
          <div class="absolute right-4 top-4 flex flex-col gap-1">
            <p class="text-[10px] text-muted-foreground">Drag nodes to reposition.</p>
            <p class="text-[10px] text-muted-foreground">Drag from a node handle to connect.</p>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Node list for deletion -->
    {#if nodes.length > 0}
      <div class="flex max-h-28 flex-wrap gap-1 overflow-y-auto border-t border-border px-4 py-2">
        {#each nodes as node (node.id)}
          <div class="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs">
            <span class="h-2 w-2 rounded-sm flex-shrink-0" style="background:{NODE_COLORS[(node.data as {type:string}).type] ?? '#8b5cf6'};"></span>
            <span>{(node.data as {label:string}).label}</span>
            <button onclick={() => deleteNode(node.id)} class="text-muted-foreground hover:text-destructive">
              <Trash2 size={10} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
