<script lang="ts">
  import { Monitor, Plus, X, ChevronDown, ChevronRight, Trash2, RefreshCw, Globe, Image as ImageIcon, FileInput } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Port {
    id: string;
    number: number;
    protocol: string;
    service: string;
    version: string;
    state: string;
    notes: string;
  }

  type Scope = 'in-scope' | 'out-of-scope' | 'unknown';

  interface Host {
    id: string;
    ip: string;
    hostname: string;
    os: string;
    segment: string;
    status: string;
    scope: Scope;
    screenshot_filename: string;
    notes: string;
    ports: Port[];
  }

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
  }

  let { workspaceId, onClose }: Props = $props();

  let hosts = $state<Host[]>([]);
  let loading = $state(false);
  let expandedHost = $state<string | null>(null);
  let scopeFilter = $state<'all' | Scope>('all');
  let confirmDelete = $state<{ id: string; label: string; kind: 'host' | 'port'; parentId?: string } | null>(null);

  // Add-host form
  let addingHost = $state(false);
  let newIp = $state('');
  let newHostname = $state('');
  let newOs = $state('');
  let newStatus = $state('unknown');
  let newScope = $state<Scope>('unknown');

  // Add-port form
  let addingPortFor = $state<string | null>(null);
  let newPortNum = $state('');
  let newPortService = $state('');
  let newPortProto = $state('tcp');

  // Editing screenshot_filename inline
  let editingScreenshotFor = $state<string | null>(null);
  let newScreenshotFilename = $state('');

  // Nmap import
  let importingNmap = $state(false);
  let nmapRaw = $state('');
  let nmapImportStatus = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  let nmapErrors = $state<Array<{ line: number; message: string }>>([]);
  let nmapSummary = $state('');

  // Client-side format detection (mirrors server parser; client cannot import server modules).
  function detectNmapFormat(raw: string): 'grepable' | 'xml' | 'unknown' {
    const t = raw.trimStart();
    if (t.startsWith('<?xml') || t.startsWith('<nmaprun')) return 'xml';
    if (/# Nmap|^Host:/m.test(raw)) return 'grepable';
    return 'unknown';
  }

  const detectedFormat = $derived(detectNmapFormat(nmapRaw));

  function getSortedPorts(ports: Port[]): Port[] {
    return [...ports].sort((a, b) => a.number - b.number);
  }

  $effect(() => {
    if (workspaceId) loadHosts();
  });

  const filteredHosts = $derived(
    scopeFilter === 'all' ? hosts : hosts.filter((h) => h.scope === scopeFilter)
  );

  async function loadHosts(): Promise<void> {
    if (!workspaceId) return;
    hosts = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`);
      if (!res.ok) {
        console.error('Failed to load hosts:', { workspaceId, status: res.status });
        return;
      }
      hosts = await res.json();
    } catch (err) {
      console.error('Failed to load hosts:', { workspaceId, error: err });
    } finally {
      loading = false;
    }
  }

  async function addHost(): Promise<void> {
    if (!workspaceId || !newIp.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim(), hostname: newHostname.trim(), os: newOs.trim(), status: newStatus, scope: newScope })
      });
      if (!res.ok) {
        console.error('Failed to add host:', { workspaceId, status: res.status });
        return;
      }
      const host: Host = await res.json();
      hosts = [...hosts, host];
      newIp = '';
      newHostname = '';
      newOs = '';
      newStatus = 'unknown';
      newScope = 'unknown';
      addingHost = false;
      expandedHost = host.id;
    } catch (err) {
      console.error('Failed to add host:', { workspaceId, error: err });
    }
  }

  async function deleteHost(id: string): Promise<void> {
    if (!workspaceId) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${id}`, { method: 'DELETE' });
    if (!res.ok) { console.error('Failed to delete host:', { workspaceId, hostId: id, status: res.status }); return; }
    hosts = hosts.filter((h) => h.id !== id);
    if (expandedHost === id) expandedHost = null;
  }

  async function updateHostStatus(host: Host, status: string): Promise<void> {
    if (!workspaceId) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) { console.error('Failed to update host status:', { workspaceId, hostId: host.id, status: res.status }); return; }
    hosts = hosts.map((h) => h.id === host.id ? { ...h, status } : h);
  }

  async function updateHostScope(host: Host, scope: Scope): Promise<void> {
    if (!workspaceId) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope })
    });
    if (!res.ok) { console.error('Failed to update host scope:', { workspaceId, hostId: host.id, status: res.status }); return; }
    hosts = hosts.map((h) => h.id === host.id ? { ...h, scope } : h);
  }

  async function saveScreenshotFilename(host: Host): Promise<void> {
    if (!workspaceId) return;
    const filename = newScreenshotFilename.trim();
    const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshot_filename: filename })
    });
    if (!res.ok) { console.error('Failed to save screenshot filename:', { workspaceId, hostId: host.id, status: res.status }); return; }
    hosts = hosts.map((h) => h.id === host.id ? { ...h, screenshot_filename: filename } : h);
    editingScreenshotFor = null;
  }

  async function addPort(hostId: string): Promise<void> {
    if (!workspaceId || !newPortNum.trim()) return;
    const num = parseInt(newPortNum);
    if (isNaN(num) || num < 1 || num > 65535) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${hostId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num, protocol: newPortProto, service: newPortService.trim(), state: 'open' })
      });
      if (!res.ok) {
        console.error('Failed to add port:', { workspaceId, hostId, status: res.status });
        return;
      }
      const port: Port = await res.json();
      hosts = hosts.map((h) => h.id === hostId ? { ...h, ports: [...h.ports, port] } : h);
      newPortNum = '';
      newPortService = '';
      newPortProto = 'tcp';
      addingPortFor = null;
    } catch (err) {
      console.error('Failed to add port:', { workspaceId, hostId, error: err });
    }
  }

  async function deletePort(hostId: string, portId: string): Promise<void> {
    if (!workspaceId) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${hostId}/ports/${portId}`, { method: 'DELETE' });
    if (!res.ok) { console.error('Failed to delete port:', { workspaceId, hostId, portId, status: res.status }); return; }
    hosts = hosts.map((h) => h.id === hostId ? { ...h, ports: h.ports.filter((p) => p.id !== portId) } : h);
  }

  const statusDots: Record<string, string> = {
    unknown: 'bg-muted-foreground',
    up: 'bg-blue-500',
    down: 'bg-destructive',
    rooted: 'bg-green-500'
  };

  const scopeBadge: Record<Scope, { label: string; classes: string }> = {
    'in-scope':     { label: 'in',  classes: 'bg-green-500/15 text-green-600 dark:text-green-400' },
    'out-of-scope': { label: 'out', classes: 'bg-red-500/15 text-red-600 dark:text-red-400' },
    'unknown':      { label: '?',   classes: 'bg-muted text-muted-foreground' }
  };

  async function importNmap(): Promise<void> {
    if (!workspaceId || !nmapRaw.trim()) return;
    nmapImportStatus = 'loading';
    nmapErrors = [];
    nmapSummary = '';
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: nmapRaw }),
      });
      if (!res.ok) {
        const data = (await res.json()) as {
          error?: string;
        };
        nmapImportStatus = 'error';
        nmapErrors = [{ line: 0, message: data.error ?? 'Import failed' }];
        return;
      }
      const data = (await res.json()) as {
        imported?: number;
        updated?: number;
        portCount?: number;
        errors?: Array<{ line: number; message: string }>;
      };
      nmapErrors = data.errors ?? [];
      nmapSummary = `Imported ${data.imported ?? 0} new host(s), updated ${data.updated ?? 0}, ${data.portCount ?? 0} port(s).`;
      nmapImportStatus = 'done';
      await loadHosts();
    } catch {
      nmapImportStatus = 'error';
      nmapErrors = [{ line: 0, message: 'Network error — import failed.' }];
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="flex h-full w-80 flex-shrink-0 flex-col border-l border-border bg-card"
  transition:fly={{ x: 320, duration: 200, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-9 items-center justify-between border-b border-border px-3">
    <div class="flex items-center gap-2">
      <Monitor size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Host Tracker</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={loadHosts}
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => (importingNmap = !importingNmap)}
        title="Import from Nmap"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground {importingNmap ? 'bg-accent text-foreground' : ''}"
      >
        <FileInput size={12} />
      </button>
      <button
        onclick={() => (addingHost = !addingHost)}
        title="Add host"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
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

  <!-- No workspace -->
  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center p-4">
      <p class="text-center text-xs text-muted-foreground">Select a workspace to track hosts</p>
    </div>
  {:else}
    <!-- Add-host form -->
    {#if addingHost}
      <div class="border-b border-border bg-muted/40 p-3 space-y-2">
        <input
          type="text"
          placeholder="IP address *"
          bind:value={newIp}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => { if (e.key === 'Enter') addHost(); if (e.key === 'Escape') addingHost = false; }}
        />
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Hostname"
            bind:value={newHostname}
            class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="OS"
            bind:value={newOs}
            class="w-24 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <Select
          size="sm"
          value={newStatus}
          onchange={(v) => newStatus = v}
          options={[
            { value: 'unknown', label: 'Unknown' },
            { value: 'up', label: 'Up' },
            { value: 'down', label: 'Down' },
            { value: 'rooted', label: 'Rooted' }
          ]}
        />
        <Select
          size="sm"
          value={newScope}
          onchange={(v) => newScope = v as Scope}
          options={[
            { value: 'unknown', label: 'Scope?' },
            { value: 'in-scope', label: 'In-scope' },
            { value: 'out-of-scope', label: 'Out-of-scope' }
          ]}
        />
        <div class="flex gap-2">
          <button
            onclick={addHost}
            class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add
          </button>
          <button
            onclick={() => (addingHost = false)}
            class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <!-- Nmap import form -->
    {#if importingNmap}
      <div class="border-b border-border bg-muted/40 p-3 space-y-2">
        <!-- Format badge -->
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-muted-foreground">Format:</span>
          {#if detectedFormat === 'grepable'}
            <span class="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">Grepable (-oG)</span>
          {:else if detectedFormat === 'xml'}
            <span class="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">XML (-oX)</span>
          {:else}
            <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Unknown</span>
          {/if}
        </div>
        <textarea
          rows={8}
          bind:value={nmapRaw}
          placeholder="Paste Nmap -oG or -oX output here…"
          class="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        ></textarea>
        <!-- Error list -->
        {#if nmapErrors.length > 0}
          <ul class="space-y-0.5">
            {#each nmapErrors as err}
              <li class="text-[10px] text-destructive">{err.line > 0 ? `Line ${err.line}: ` : ''}{err.message}</li>
            {/each}
          </ul>
        {/if}
        <!-- Summary -->
        {#if nmapSummary}
          <p class="text-[10px] text-green-600 dark:text-green-400">{nmapSummary}</p>
        {/if}
        <div class="flex gap-2">
          <button
            onclick={importNmap}
            disabled={nmapRaw.trim() === '' || nmapImportStatus === 'loading'}
            class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nmapImportStatus === 'loading' ? 'Importing…' : 'Import'}
          </button>
          <button
            onclick={() => { importingNmap = false; nmapRaw = ''; nmapImportStatus = 'idle'; nmapErrors = []; nmapSummary = ''; }}
            class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <!-- Scope filter bar -->
    <div class="flex gap-1 border-b border-border px-3 py-1.5">
      {#each (['all', 'in-scope', 'out-of-scope', 'unknown'] as const) as tab}
        <button
          onclick={() => (scopeFilter = tab)}
          class="rounded px-1.5 py-0.5 text-[10px] transition-colors {scopeFilter === tab
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
        >
          {tab === 'all' ? 'All' : tab === 'in-scope' ? 'In' : tab === 'out-of-scope' ? 'Out' : '?'}
          {#if tab !== 'all'}
            <span class="opacity-60">({hosts.filter((h) => h.scope === tab).length})</span>
          {:else}
            <span class="opacity-60">({hosts.length})</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Host list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={16} class="animate-spin text-muted-foreground" />
        </div>
      {:else if filteredHosts.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Globe size={24} class="text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">{hosts.length === 0 ? 'No hosts yet. Click + to add one.' : 'No hosts match this filter.'}</p>
        </div>
      {:else}
        {#each filteredHosts as host (host.id)}
          <div class="border-b border-border last:border-b-0">
            <!-- Host row -->
            <div class="group flex items-center gap-2 px-3 py-2 hover:bg-accent/50">
              <button
                onclick={() => (expandedHost = expandedHost === host.id ? null : host.id)}
                class="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                title={expandedHost === host.id ? 'Collapse' : 'Expand'}
              >
                {#if expandedHost === host.id}
                  <ChevronDown size={11} />
                {:else}
                  <ChevronRight size={11} />
                {/if}
              </button>
              <div class="h-2 w-2 flex-shrink-0 rounded-full {statusDots[host.status] ?? statusDots.unknown}"></div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <span class="truncate text-xs font-medium">{host.ip}</span>
                  <CopyButton text={host.ip} size={10} />
                </div>
                {#if host.hostname}
                  <div class="flex items-center gap-1">
                    <span class="truncate text-[10px] text-muted-foreground">{host.hostname}</span>
                    <CopyButton text={host.hostname} size={10} />
                  </div>
                {/if}
              </div>
              <!-- Scope badge -->
              <span class="flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-medium {scopeBadge[host.scope]?.classes ?? scopeBadge.unknown.classes}">
                {scopeBadge[host.scope]?.label ?? '?'}
              </span>
              {#if host.ports.length > 0}
                <span class="text-[10px] text-muted-foreground">{host.ports.length}p</span>
              {/if}
              <div class="flex items-center gap-1">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div onclick={(e) => e.stopPropagation()}>
                  <Select
                    size="xs"
                    value={host.status}
                    onchange={(v) => updateHostStatus(host, v)}
                    options={[
                      { value: 'unknown', label: '?' },
                      { value: 'up', label: 'Up' },
                      { value: 'down', label: 'Down' },
                      { value: 'rooted', label: 'Root' }
                    ]}
                  />
                </div>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <button
                  onclick={(e) => { e.stopPropagation(); confirmDelete = { id: host.id, label: host.ip, kind: 'host' }; }}
                  class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                  title="Delete host"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            <!-- Expanded: details + ports + add-port -->
            {#if expandedHost === host.id}
              <div class="bg-muted/20 px-3 pb-2">
                {#if host.os || host.segment}
                  <p class="mb-1.5 text-[10px] text-muted-foreground">
                    {#if host.os}{host.os}{/if}{#if host.os && host.segment} &middot; {/if}{#if host.segment}{host.segment}{/if}
                  </p>
                {/if}

                <!-- Scope selector (in expanded view) -->
                <div class="mb-2 flex items-center gap-2">
                  <span class="text-[10px] text-muted-foreground">Scope:</span>
                  <Select
                    size="xs"
                    value={host.scope}
                    onchange={(v) => updateHostScope(host, v as Scope)}
                    options={[
                      { value: 'unknown', label: 'Unknown' },
                      { value: 'in-scope', label: 'In-scope' },
                      { value: 'out-of-scope', label: 'Out-of-scope' }
                    ]}
                  />
                </div>

                <!-- Screenshot filename -->
                <div class="mb-2 flex items-center gap-1.5">
                  <ImageIcon size={10} class="flex-shrink-0 text-muted-foreground" />
                  {#if editingScreenshotFor === host.id}
                    <input
                      type="text"
                      bind:value={newScreenshotFilename}
                      placeholder="screenshot.png"
                      class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                      onkeydown={(e) => {
                        if (e.key === 'Enter') saveScreenshotFilename(host);
                        if (e.key === 'Escape') editingScreenshotFor = null;
                      }}
                    />
                    <button
                      onclick={() => saveScreenshotFilename(host)}
                      class="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
                    >Save</button>
                    <button
                      onclick={() => (editingScreenshotFor = null)}
                      class="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
                    >Cancel</button>
                  {:else}
                    {#if host.screenshot_filename}
                      <a
                        href="/api/screenshots/{host.screenshot_filename}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex-1 min-w-0 truncate text-[10px] text-primary hover:underline"
                        title="Open screenshot"
                      >{host.screenshot_filename}</a>
                      <CopyButton text={host.screenshot_filename} size={9} />
                    {:else}
                      <span class="flex-1 min-w-0 truncate text-[10px] text-muted-foreground">No screenshot</span>
                    {/if}
                    <button
                      onclick={() => { editingScreenshotFor = host.id; newScreenshotFilename = host.screenshot_filename; }}
                      class="flex-shrink-0 rounded px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Edit screenshot filename"
                    >edit</button>
                  {/if}
                </div>

                <!-- Ports table -->
                {#if host.ports.length > 0}
                  <div class="mb-2 rounded border border-border overflow-hidden">
                    <table class="w-full text-[10px]">
                      <thead>
                        <tr class="bg-muted/50">
                          <th class="px-2 py-0.5 text-left font-medium text-muted-foreground">Port</th>
                          <th class="px-2 py-0.5 text-left font-medium text-muted-foreground">Proto</th>
                          <th class="px-2 py-0.5 text-left font-medium text-muted-foreground">Service</th>
                          <th class="w-5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each getSortedPorts(host.ports) as port (port.id)}
                          <tr class="group/port border-t border-border">
                            <td class="px-2 py-0.5 font-mono font-medium text-foreground">{port.number}</td>
                            <td class="px-2 py-0.5 text-muted-foreground">{port.protocol}</td>
                            <td class="px-2 py-0.5 text-muted-foreground">{port.service || '-'}</td>
                            <td class="px-1 py-0.5">
                              <div class="flex items-center gap-0.5">
                                <CopyButton
                                  text="{port.number}/{port.protocol}{port.service ? ` ${port.service}` : ''}"
                                  size={9}
                                  class="h-4 w-4"
                                />
                                <button
                                  onclick={() => confirmDelete = { id: port.id, label: `${port.number}/${port.protocol}`, kind: 'port', parentId: host.id }}
                                  class="flex h-4 w-4 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                                >
                                  <X size={9} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}

                <!-- Add-port form -->
                {#if addingPortFor === host.id}
                  <div class="flex gap-1.5 items-end flex-wrap">
                    <input
                      type="number"
                      placeholder="Port"
                      bind:value={newPortNum}
                      min="1"
                      max="65535"
                      class="w-16 rounded border border-border bg-background px-2 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                      onkeydown={(e) => { if (e.key === 'Enter') addPort(host.id); if (e.key === 'Escape') addingPortFor = null; }}
                    />
                    <Select
                      size="xs"
                      value={newPortProto}
                      onchange={(v) => newPortProto = v}
                      options={[
                        { value: 'tcp', label: 'TCP' },
                        { value: 'udp', label: 'UDP' }
                      ]}
                    />
                    <input
                      type="text"
                      placeholder="Service"
                      bind:value={newPortService}
                      class="flex-1 min-w-0 rounded border border-border bg-background px-2 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onclick={() => addPort(host.id)}
                      class="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Add
                    </button>
                    <button
                      onclick={() => (addingPortFor = null)}
                      class="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                {:else}
                  <button
                    onclick={() => { addingPortFor = host.id; newPortNum = ''; newPortService = ''; newPortProto = 'tcp'; }}
                    class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={10} />
                    Add port
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#if confirmDelete !== null}
  {@const pending = confirmDelete}
  <ConfirmDialog
    title={pending.kind === 'host' ? 'Delete Host' : 'Delete Port'}
    message="Delete '{pending.label}'? This cannot be undone."
    onConfirm={() => { 
      if (pending.kind === 'host') deleteHost(pending.id); 
      else if (pending.parentId) deletePort(pending.parentId, pending.id);
      confirmDelete = null; 
    }}
    onCancel={() => confirmDelete = null}
  />
{/if}
