<script lang="ts">
  import { FileText, X, Copy, Download, RefreshCw } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Workspace {
    id: string; name: string; type: string;
    exam_start_date: string | null; exam_duration_days: number;
    total_flags: number; passing_flags: number;
  }

  interface Host {
    id: string; ip: string; hostname: string | null; os: string | null;
    segment: string | null; status: string; notes: string | null;
    ports_json: string;
  }

  interface Credential {
    id: string; username: string; domain: string | null;
    secret: string; credential_type: string; status: string;
    source: string | null; notes: string | null;
  }

  interface Flag {
    id: string; value: string; flag_type: string; submitted: number;
    capture_method: string | null; ip: string | null; hostname: string | null;
  }

  interface Props {
    workspaceId: string | null;
    onInsert?: (markdown: string) => void;
    onClose: () => void;
  }

  let { workspaceId, onInsert, onClose }: Props = $props();

  let workspace = $state<Workspace | null>(null);
  let hosts = $state<Host[]>([]);
  let credentials = $state<Credential[]>([]);
  let flags = $state<Flag[]>([]);
  let loading = $state(false);
  let includeCredentials = $state(false);
  let includePorts = $state(true);

  $effect(() => {
    if (workspaceId) loadReport();
  });

  async function loadReport() {
    if (!workspaceId) return;
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/report`);
      const data = await res.json() as { workspace: Workspace; hosts: Host[]; credentials: Credential[]; flags: Flag[] };
      workspace = data.workspace;
      hosts = data.hosts;
      credentials = data.credentials;
      flags = data.flags;
    } catch {
      console.error('Failed to load report data');
    } finally {
      loading = false;
    }
  }

  function parsePorts(portsJson: string): Array<{ number: number; protocol: string; service: string; state: string }> {
    try {
      const arr = JSON.parse(portsJson) as Array<{ number: number; protocol: string; service: string; state: string } | null>;
      return arr.filter(Boolean) as Array<{ number: number; protocol: string; service: string; state: string }>;
    } catch {
      return [];
    }
  }

  function generateMarkdown(): string {
    if (!workspace) return '';

    const lines: string[] = [];
    const now = new Date().toISOString().split('T')[0];

    lines.push(`# Penetration Test Report`);
    lines.push('');
    lines.push(`**Engagement:** ${workspace.name}`);
    lines.push(`**Type:** ${workspace.type}`);
    lines.push(`**Generated:** ${now}`);
    if (workspace.exam_start_date) {
      lines.push(`**Start Date:** ${workspace.exam_start_date}`);
    }
    lines.push('');

    // Summary
    const submittedFlags = flags.filter((f) => f.submitted === 1).length;
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`- **Hosts Discovered:** ${hosts.length}`);
    lines.push(`- **Flags Captured:** ${submittedFlags} / ${workspace.total_flags} (${workspace.passing_flags} required to pass)`);
    lines.push(`- **Credentials Obtained:** ${credentials.length}`);
    lines.push('');

    // Hosts
    if (hosts.length > 0) {
      lines.push('## Discovered Hosts');
      lines.push('');
      for (const host of hosts) {
        const ports = parsePorts(host.ports_json);
        lines.push(`### ${host.ip}${host.hostname ? ` (${host.hostname})` : ''}`);
        lines.push('');
        lines.push(`- **Status:** ${host.status}`);
        if (host.os) lines.push(`- **OS:** ${host.os}`);
        if (host.segment) lines.push(`- **Segment:** ${host.segment}`);
        if (includePorts && ports.length > 0) {
          lines.push('');
          lines.push('**Open Ports:**');
          lines.push('');
          lines.push('| Port | Protocol | Service | State |');
          lines.push('|------|----------|---------|-------|');
          for (const p of ports) {
            lines.push(`| ${p.number} | ${p.protocol} | ${p.service || '-'} | ${p.state} |`);
          }
        }
        if (host.notes) {
          lines.push('');
          lines.push(`**Notes:** ${host.notes}`);
        }
        lines.push('');
      }
    }

    // Flags
    if (flags.length > 0) {
      lines.push('## Captured Flags');
      lines.push('');
      lines.push('| Flag | Type | Host | Method | Submitted |');
      lines.push('|------|------|------|--------|-----------|');
      for (const flag of flags) {
        const host = flag.ip ? `${flag.ip}${flag.hostname ? `/${flag.hostname}` : ''}` : '-';
        lines.push(`| \`${flag.value}\` | ${flag.flag_type} | ${host} | ${flag.capture_method || '-'} | ${flag.submitted ? 'Yes' : 'No'} |`);
      }
      lines.push('');
    }

    // Credentials (optional)
    if (includeCredentials && credentials.length > 0) {
      lines.push('## Obtained Credentials');
      lines.push('');
      lines.push('| Username | Domain | Type | Source | Status |');
      lines.push('|----------|--------|------|--------|--------|');
      for (const cred of credentials) {
        lines.push(`| ${cred.username} | ${cred.domain || '-'} | ${cred.credential_type} | ${cred.source || '-'} | ${cred.status} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## Methodology');
    lines.push('');
    lines.push('*Add your methodology, attack path, and recommendations here.*');
    lines.push('');

    return lines.join('\n');
  }

  const reportMarkdown = $derived(generateMarkdown());

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(reportMarkdown);
    } catch {
      // Silently ignore
    }
  }

  function downloadMarkdown() {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace?.name ?? 'report'}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="flex h-full w-[480px] flex-shrink-0 flex-col border-l border-border bg-card"
  transition:fly={{ x: 480, duration: 200, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-9 items-center justify-between border-b border-border px-3">
    <div class="flex items-center gap-2">
      <FileText size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Report Generator</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={loadReport}
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={onClose}
        title="Close"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={13} />
      </button>
    </div>
  </div>

  {#if !workspaceId || !workspace}
    <div class="flex flex-1 items-center justify-center p-4">
      {#if loading}
        <RefreshCw size={20} class="animate-spin text-muted-foreground" />
      {:else}
        <p class="text-center text-xs text-muted-foreground">Select a workspace to generate a report</p>
      {/if}
    </div>
  {:else}
    <!-- Options -->
    <div class="flex items-center gap-4 border-b border-border px-3 py-2">
      <label class="flex items-center gap-1.5 text-xs">
        <input type="checkbox" bind:checked={includePorts} class="rounded" />
        Include ports
      </label>
      <label class="flex items-center gap-1.5 text-xs">
        <input type="checkbox" bind:checked={includeCredentials} class="rounded" />
        Include credentials
      </label>
    </div>

    <!-- Stats bar -->
    <div class="flex gap-3 border-b border-border px-3 py-2">
      <div class="text-center">
        <p class="text-base font-semibold">{hosts.length}</p>
        <p class="text-[10px] text-muted-foreground">Hosts</p>
      </div>
      <div class="text-center">
        <p class="text-base font-semibold">{flags.filter((f) => f.submitted).length}/{workspace.total_flags}</p>
        <p class="text-[10px] text-muted-foreground">Flags</p>
      </div>
      <div class="text-center">
        <p class="text-base font-semibold">{credentials.length}</p>
        <p class="text-[10px] text-muted-foreground">Creds</p>
      </div>
      <div class="ml-auto flex items-center gap-1">
        {#if onInsert}
          <button
            onclick={() => onInsert(reportMarkdown)}
            class="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Insert
          </button>
        {/if}
        <button
          onclick={copyMarkdown}
          class="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-accent"
          title="Copy markdown"
        >
          <Copy size={12} />
        </button>
        <button
          onclick={downloadMarkdown}
          class="flex h-7 w-7 items-center justify-center rounded border border-border hover:bg-accent"
          title="Download .md"
        >
          <Download size={12} />
        </button>
      </div>
    </div>

    <!-- Preview -->
    <div class="flex-1 overflow-y-auto p-3">
      <pre class="whitespace-pre-wrap rounded border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">{reportMarkdown}</pre>
    </div>
  {/if}
</div>
