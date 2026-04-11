<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { NodeProps } from '@xyflow/svelte';

  interface TopologyNodeData {
    label: string;
    status: string;
    portCount: number;
  }

  const STATUS_COLORS: Record<string, string> = {
    up:      '#22c55e',
    down:    '#ef4444',
    rooted:  '#f97316',
    unknown: '#6b7280',
  };

  // NodeProps from @xyflow/svelte — data is Record<string,unknown> at framework level
  const { data }: NodeProps = $props();

  // Cast through unknown so TypeScript accepts the narrowing; $derived re-evaluates
  // whenever the parent passes new data (Svelte 5 reactive tracking).
  const nodeData = $derived(data as unknown as TopologyNodeData);
  const bg = $derived(STATUS_COLORS[nodeData.status] ?? '#6b7280');
</script>

<div class="topo-node" style="background:{bg};">
  <Handle type="target" position={Position.Top} />
  <span class="node-label">{nodeData.label}</span>
  {#if nodeData.portCount > 0}
    <span class="port-badge">{nodeData.portCount} port{nodeData.portCount === 1 ? '' : 's'}</span>
  {/if}
  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .topo-node {
    border-radius: 6px;
    padding: 6px 12px;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-width: 130px;
  }

  .node-label {
    line-height: 1.2;
    word-break: break-all;
  }

  .port-badge {
    font-size: 10px;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 3px;
    padding: 1px 5px;
  }
</style>
