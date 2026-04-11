<script lang="ts">
  import { Network, Plus, X, RefreshCw, Trash2, Save } from '@lucide/svelte';
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

  import type { AttackNode } from '$lib/types';
  import { searchMitreTechniques, getMitreTechnique, type MitreTechnique } from '$lib/data/mitre-attack';
  import AttackChainNodeComponent from '$lib/components/engagement/AttackChainNode.svelte';

  interface AttackEdge {
    id: string;
    source_node_id: string;
    target_node_id: string;
    label: string;
    technique: string;
  }

  interface NodeData {
    label: string;
    type: string;
    mitreId: string;
    mitreName: string;
    timestamp: string;
  }

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
  }

  let { workspaceId, onClose }: Props = $props();

  // Register the custom node renderer
  const nodeTypes: NodeTypes = { attackNode: AttackChainNodeComponent };

  // SvelteFlow state
  let nodes = $state<Node[]>([]);
  let edges = $state<Edge[]>([]);
  let loading = $state(false);
  let addingNode = $state(false);

  // Add node form
  let newLabel = $state('');
  let newType = $state('action');

  // Detail drawer for the selected node
  let selectedNodeId = $state<string | null>(null);
  let drawerTimestamp = $state('');
  let drawerMitreId = $state('');
  let drawerMitreName = $state('');
  let mitreSuggestions = $state<MitreTechnique[]>([]);
  let savingDrawer = $state(false);
  let drawerError = $state('');

  const NODE_TYPE_LIST = ['initial-access', 'recon', 'action', 'privesc', 'lateral-movement', 'data-exfil', 'flag'];

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

  /** Convert a DB AttackNode to a SvelteFlow Node with custom type data. */
  function toFlowNode(n: AttackNode): Node {
    return {
      id: n.id,
      position: { x: n.x, y: n.y },
      type: 'attackNode',
      data: {
        label: n.label,
        type: n.node_type,
        mitreId: n.mitre_technique_id,
        mitreName: n.mitre_technique_name,
        timestamp: n.timestamp ?? ''
      } satisfies NodeData
    };
  }

  async function loadChain(): Promise<void> {
    if (!workspaceId) return;
    nodes = [];
    edges = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/nodes`);
      const data = await res.json() as { nodes: AttackNode[]; edges: AttackEdge[] };

      nodes = data.nodes.map(toFlowNode);

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

  async function addNode(): Promise<void> {
    if (!workspaceId || !newLabel.trim()) return;

    // Place new nodes in a cascading grid layout
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
      nodes = [...nodes, toFlowNode(n)];
      newLabel = '';
      addingNode = false;
    } catch {
      console.error('Failed to add node');
    }
  }

  async function handleConnect(params: Connection): Promise<void> {
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

  async function deleteNode(nodeId: string): Promise<void> {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/nodes/${nodeId}`, { method: 'DELETE' });
    nodes = nodes.filter((n) => n.id !== nodeId);
    edges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    if (selectedNodeId === nodeId) closeDrawer();
  }

  /** Persist node position after a drag. */
  async function handleNodeDragStop({ targetNode }: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent }): Promise<void> {
    if (!workspaceId || !targetNode) return;
    await fetch(`/api/workspaces/${workspaceId}/nodes/${targetNode.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: targetNode.position.x, y: targetNode.position.y })
    });
  }

  /** Open the right-side detail drawer for the clicked node. */
  function handleNodeClick({ node }: { node: Node; event: MouseEvent | TouchEvent }): void {
    selectedNodeId = node.id;
    const d = node.data as unknown as NodeData;
    drawerTimestamp = d.timestamp ?? '';
    drawerMitreId = d.mitreId ?? '';
    drawerMitreName = d.mitreName ?? '';
    mitreSuggestions = [];
    drawerError = '';
  }

  function closeDrawer(): void {
    selectedNodeId = null;
    mitreSuggestions = [];
    drawerError = '';
  }

  /** Re-run suggestion search as the user types a MITRE ID. */
  function handleMitreInput(): void {
    mitreSuggestions = searchMitreTechniques(drawerMitreId);
    // Clear the auto-filled name if the ID no longer resolves exactly
    if (!getMitreTechnique(drawerMitreId)) drawerMitreName = '';
  }

  /** Autofill both fields from a chosen suggestion. */
  function selectSuggestion(t: MitreTechnique): void {
    drawerMitreId = t.id;
    drawerMitreName = t.name;
    mitreSuggestions = [];
  }

  /** PATCH the selected node with timestamp + MITRE fields, then sync local state. */
  async function saveNodeDetails(): Promise<void> {
    if (!workspaceId || !selectedNodeId) return;
    savingDrawer = true;
    drawerError = '';
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/nodes/${selectedNodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: drawerTimestamp || null,
          mitre_technique_id: drawerMitreId,
          mitre_technique_name: drawerMitreName
        })
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        drawerError = err.message ?? 'Failed to save';
        return;
      }
      // Immutable update of matching node's data
      const id = selectedNodeId;
      nodes = nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, mitreId: drawerMitreId, mitreName: drawerMitreName, timestamp: drawerTimestamp } }
          : n
      );
    } catch {
      drawerError = 'Network error — try again';
    } finally {
      savingDrawer = false;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (selectedNodeId) { closeDrawer(); return; }
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Full-screen overlay for the attack chain -->
<div
  class="fixed inset-0 z-50 flex flex-col bg-background"
  transition:fly={{ y: 20, duration: 200, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
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
      <div class="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
        <select
          bind:value={newType}
          class="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {#each NODE_TYPE_LIST as t}
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

    <!-- Canvas + optional detail drawer -->
    <div class="flex flex-1 overflow-hidden">
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
            {nodeTypes}
            fitView
            onconnect={handleConnect}
            onnodedragstop={handleNodeDragStop}
            onnodeclick={handleNodeClick}
            onpaneclick={closeDrawer}
            colorMode="system"
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls />
          </SvelteFlow>

          <!-- Node-type legend -->
          <div class="absolute bottom-12 left-4 flex flex-col gap-1 rounded border border-border bg-card p-2 text-[10px] leading-tight">
            {#each NODE_TYPE_LIST as t}
              <div class="flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background:{NODE_COLORS[t]};"></span>
                <span class="text-muted-foreground">{t}</span>
              </div>
            {/each}
          </div>

          {#if nodes.length > 0 && !selectedNodeId}
            <div class="absolute right-4 top-4 flex flex-col gap-1">
              <p class="text-[10px] text-muted-foreground">Click a node to edit details.</p>
              <p class="text-[10px] text-muted-foreground">Drag to reposition. Connect via handles.</p>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Detail drawer — visible when a node is selected -->
      {#if selectedNodeId}
        {@const selectedNode = nodes.find((n) => n.id === selectedNodeId)}
        <div
          class="flex w-72 shrink-0 flex-col border-l border-border bg-card"
          transition:fly={{ x: 20, duration: 150, easing: cubicOut }}
        >
          <!-- Drawer header -->
          <div class="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
            <span class="truncate text-xs font-semibold">
              {(selectedNode?.data as unknown as NodeData | undefined)?.label ?? 'Node details'}
            </span>
            <button
              onclick={closeDrawer}
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            >
              <X size={12} />
            </button>
          </div>

          <!-- Drawer body -->
          <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
            <!-- Timestamp -->
            <div class="flex flex-col gap-1">
              <label for="drawer-timestamp" class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Timestamp
              </label>
              <input
                id="drawer-timestamp"
                type="date"
                bind:value={drawerTimestamp}
                class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <!-- MITRE ID with live search -->
            <div class="flex flex-col gap-1">
              <label for="drawer-mitre-id" class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                MITRE ATT&amp;CK ID
              </label>
              <div class="relative">
                <input
                  id="drawer-mitre-id"
                  type="text"
                  placeholder="e.g. T1059.001"
                  bind:value={drawerMitreId}
                  oninput={handleMitreInput}
                  autocomplete="off"
                  class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {#if mitreSuggestions.length > 0}
                  <ul class="absolute left-0 right-0 top-full z-10 mt-0.5 rounded border border-border bg-popover shadow-md">
                    {#each mitreSuggestions as suggestion (suggestion.id)}
                      <li>
                        <button
                          type="button"
                          onclick={() => selectSuggestion(suggestion)}
                          class="flex w-full flex-col px-2 py-1.5 text-left hover:bg-accent"
                        >
                          <span class="text-[11px] font-semibold">{suggestion.id}</span>
                          <span class="text-[10px] text-muted-foreground">{suggestion.name}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>

            <!-- MITRE technique name (auto-filled, editable) -->
            <div class="flex flex-col gap-1">
              <label for="drawer-mitre-name" class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Technique Name
              </label>
              <input
                id="drawer-mitre-name"
                type="text"
                placeholder="Auto-filled from ID"
                bind:value={drawerMitreName}
                class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {#if drawerError}
              <p class="text-[10px] text-destructive">{drawerError}</p>
            {/if}
          </div>

          <!-- Drawer footer -->
          <div class="shrink-0 border-t border-border px-3 py-2">
            <button
              onclick={saveNodeDetails}
              disabled={savingDrawer}
              class="flex w-full items-center justify-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={11} />
              {savingDrawer ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Node list for deletion -->
    {#if nodes.length > 0}
      <div class="flex max-h-28 shrink-0 flex-wrap gap-1 overflow-y-auto border-t border-border px-4 py-2">
        {#each nodes as node (node.id)}
          <div class="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs">
            <span class="h-2 w-2 shrink-0 rounded-sm" style="background:{NODE_COLORS[(node.data as unknown as NodeData).type] ?? '#8b5cf6'};"></span>
            <span>{(node.data as unknown as NodeData).label}</span>
            <button onclick={() => deleteNode(node.id)} class="text-muted-foreground hover:text-destructive">
              <Trash2 size={10} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
