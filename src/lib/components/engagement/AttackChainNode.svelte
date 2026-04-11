<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { NodeProps } from '@xyflow/svelte';

  interface AttackNodeData {
    label: string;
    type: string;
    mitreId: string;
    mitreName: string;
    timestamp: string;
  }

  const NODE_COLORS: Record<string, string> = {
    'initial-access': '#f97316',
    'recon': '#3b82f6',
    'action': '#8b5cf6',
    'privesc': '#ef4444',
    'lateral-movement': '#ec4899',
    'data-exfil': '#14b8a6',
    'flag': '#22c55e'
  };

  // NodeProps from @xyflow/svelte - data is Record<string,unknown> at the framework level
  const { data }: NodeProps = $props();

  // Cast through unknown so TypeScript accepts the narrowing; wrapped in $derived so it
  // re-evaluates whenever the parent passes new data (Svelte 5 reactive tracking).
  const nodeData = $derived(data as unknown as AttackNodeData);
  const bg = $derived(NODE_COLORS[nodeData.type] ?? '#8b5cf6');
  const mitreUrl = $derived(
    nodeData.mitreId
      ? `https://attack.mitre.org/techniques/${nodeData.mitreId.replace('.', '/')}/`
      : ''
  );
  const dateDisplay = $derived(
    nodeData.timestamp ? nodeData.timestamp.slice(0, 10) : ''
  );
</script>

<div
  class="attack-node"
  style="background:{bg};"
>
  <Handle type="target" position={Position.Left} />

  <span class="node-label">{nodeData.label}</span>

  {#if nodeData.mitreId}
    <a
      href={mitreUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="mitre-badge"
      onclick={(e) => e.stopPropagation()}
    >
      {nodeData.mitreId}
    </a>
  {/if}

  {#if dateDisplay}
    <time class="node-timestamp" datetime={nodeData.timestamp}>{dateDisplay}</time>
  {/if}

  <Handle type="source" position={Position.Right} />
</div>

<style>
  .attack-node {
    border-radius: 6px;
    padding: 6px 12px;
    color: #fff;
    border: none;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-width: 120px;
  }

  .node-label {
    line-height: 1.2;
  }

  .mitre-badge {
    font-size: 10px;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 3px;
    padding: 1px 5px;
    color: #fff;
    text-decoration: none;
    letter-spacing: 0.02em;
  }

  .mitre-badge:hover {
    background: rgba(0, 0, 0, 0.4);
    text-decoration: underline;
  }

  .node-timestamp {
    font-size: 10px;
    font-weight: 400;
    opacity: 0.8;
  }
</style>
