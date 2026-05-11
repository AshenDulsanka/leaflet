<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface MockNode {
    id: string;
  }

  interface MockEdge {
    id: string;
  }

  interface Props {
    nodes?: MockNode[];
    edges?: MockEdge[];
    onnodeclick?: (payload: { node: MockNode; event: MouseEvent }) => void;
    onedgeclick?: (payload: { edge: MockEdge; event: MouseEvent }) => void;
  }

  let { nodes = [], edges = [], onnodeclick, onedgeclick }: Props = $props();

  const dispatch = createEventDispatcher<{
    nodeclick: { node: MockNode; event: MouseEvent };
    edgeclick: { edge: MockEdge; event: MouseEvent };
  }>();

  function emitNodeClick(): void {
    if (nodes.length === 0) return;
    const payload = { node: nodes[0], event: new MouseEvent('click') };
    onnodeclick?.(payload);
    dispatch('nodeclick', payload);
  }

  function emitEdgeClick(): void {
    if (edges.length === 0) return;
    const payload = { edge: edges[0], event: new MouseEvent('click') };
    onedgeclick?.(payload);
    dispatch('edgeclick', payload);
  }
</script>

<div data-testid="svelteflow-mock"><slot /></div>
<button type="button" data-testid="mock-node-click" onclick={emitNodeClick}>Node click</button>
<button type="button" data-testid="mock-edge-click" onclick={emitEdgeClick}>Edge click</button>