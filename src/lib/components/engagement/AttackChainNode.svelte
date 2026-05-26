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

  const NODE_VISUALS = {
    'initial-access': { label: 'Initial Access', short: 'ENTRY', accent: '#f97316' },
    'recon': { label: 'Recon', short: 'RECON', accent: '#3b82f6' },
    'action': { label: 'Action', short: 'ACTION', accent: '#8b5cf6' },
    'privesc': { label: 'Privilege Esc', short: 'PRIV', accent: '#ef4444' },
    'lateral-movement': { label: 'Lateral Move', short: 'LATERAL', accent: '#ec4899' },
    'data-exfil': { label: 'Data Exfil', short: 'EXFIL', accent: '#14b8a6' },
    'flag': { label: 'Flag', short: 'FLAG', accent: '#22c55e' }
  } as const;

  type KnownNodeType = keyof typeof NODE_VISUALS;

  function isKnownNodeType(value: string): value is KnownNodeType {
    return Object.prototype.hasOwnProperty.call(NODE_VISUALS, value);
  }

  // NodeProps from @xyflow/svelte - data is Record<string,unknown> at the framework level
  const { data }: NodeProps = $props();

  // Cast through unknown so TypeScript accepts the narrowing; wrapped in $derived so it
  // re-evaluates whenever the parent passes new data (Svelte 5 reactive tracking).
  const nodeData = $derived(data as unknown as AttackNodeData);
  const typeKey = $derived(isKnownNodeType(nodeData.type) ? nodeData.type : 'action');
  const visual = $derived(NODE_VISUALS[typeKey]);
  const typeClass = $derived(`type-${typeKey}`);
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
  class={`attack-node ${typeClass}`}
  style={`--node-accent: ${visual.accent};`}
>
  <Handle type="target" position={Position.Left} />

  <div class="node-header">
    <span class="node-type-chip">{visual.short}</span>
    <span class="node-type-label">{visual.label}</span>
  </div>

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
    border-radius: 8px;
    padding: 8px 12px;
    color: #f8fafc;
    border: 2px solid var(--node-accent);
    background: #0f172a;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-width: 140px;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  .node-type-chip {
    border: 1px solid color-mix(in srgb, var(--node-accent) 80%, #fff 20%);
    background: color-mix(in srgb, var(--node-accent) 20%, #111827 80%);
    color: #f8fafc;
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.2;
  }

  .node-type-label {
    font-size: 10px;
    font-weight: 600;
    color: color-mix(in srgb, var(--node-accent) 55%, #e2e8f0 45%);
    letter-spacing: 0.01em;
  }

  .node-label {
    line-height: 1.2;
  }

  .mitre-badge {
    font-size: 10px;
    font-weight: 700;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid color-mix(in srgb, var(--node-accent) 55%, #94a3b8 45%);
    border-radius: 3px;
    padding: 1px 5px;
    color: #f8fafc;
    text-decoration: none;
    letter-spacing: 0.02em;
  }

  .mitre-badge:hover {
    background: rgba(15, 23, 42, 0.9);
    text-decoration: underline;
  }

  .node-timestamp {
    font-size: 10px;
    font-weight: 500;
    color: #cbd5e1;
  }

  .type-initial-access {
    border-left-width: 6px;
  }

  .type-recon {
    border-style: dashed;
    border-radius: 10px 4px 10px 4px;
  }

  .type-action {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 0 0 2px rgba(15, 23, 42, 0.25) inset;
  }

  .type-privesc {
    border-style: double;
    border-width: 3px;
    border-left-width: 6px;
  }

  .type-lateral-movement {
    border-radius: 4px;
    background:
      repeating-linear-gradient(
        -45deg,
        rgba(236, 72, 153, 0.16),
        rgba(236, 72, 153, 0.16) 6px,
        rgba(15, 23, 42, 0.96) 6px,
        rgba(15, 23, 42, 0.96) 12px
      ),
      #0f172a;
  }

  .type-data-exfil {
    border-style: dotted;
    border-radius: 10px;
  }

  .type-flag {
    border-width: 3px;
    border-radius: 12px 12px 4px 4px;
  }
</style>
