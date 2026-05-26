<script module lang="ts">
  const hostCache = new Map<string, string>();
</script>

<script lang="ts">
  import { Monitor, Plus, X, ChevronDown, ChevronRight, Trash2, RefreshCw, Globe, Image as ImageIcon, Pencil, FileInput } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import ImageLightbox from '$lib/components/editor/ImageLightbox.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import NmapImportForm from '$lib/components/engagement/NmapImportForm.svelte';
  import HostAddForm from '$lib/components/engagement/HostAddForm.svelte';
  import HostEditForm from '$lib/components/engagement/HostEditForm.svelte';
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
    uiMode?: 'modal' | 'inline';
  }

  let { workspaceId, onClose, uiMode = 'modal' }: Props = $props();

  let hosts = $state<Host[]>([]);
  let loading = $state(false);
  let expandedHost = $state<string | null>(null);
  let scopeFilter = $state<'all' | Scope>('all');
  let hostQuery = $state('');
  let confirmDelete = $state<{ id: string; label: string; kind: 'host' | 'port'; parentId?: string } | null>(null);

  // Add-host form
  let addingHost = $state(false);

  // Edit-host form state
  let editingHostId = $state<string | null>(null);
  let lightboxImage = $state<string | null>(null);

  // Nmap import
  let importingNmap = $state(false);
  let latestLoadRequest = 0;

  function readCachedHosts(id: string): Host[] | null {
    const cached = hostCache.get(id);
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? (parsed as Host[]) : null;
    } catch {
      return null;
    }
  }

  function writeCachedHosts(id: string, items: Host[]): void {
    hostCache.set(id, JSON.stringify(items));
  }


  function getSortedPorts(ports: Port[]): Port[] {
    return [...ports].sort((a, b) => a.number - b.number);
  }

  $effect(() => {
    if (!workspaceId) {
      hosts = [];
      loading = false;
      return;
    }

    const currentWorkspaceId = workspaceId;
    const cached = readCachedHosts(currentWorkspaceId);
    if (cached !== null) {
      hosts = cached;
    }

    void loadHosts(currentWorkspaceId, cached === null);
  });

  const filteredHosts = $derived.by(() => {
    let result = scopeFilter === 'all' ? hosts : hosts.filter((h) => h.scope === scopeFilter);
    if (hostQuery.trim()) {
      const q = hostQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.ip.toLowerCase().includes(q) ||
          h.hostname.toLowerCase().includes(q) ||
          (h.os ?? '').toLowerCase().includes(q) ||
          (h.notes ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  });

  async function loadHosts(targetWorkspaceId: string, blocking = false): Promise<void> {
    const requestId = latestLoadRequest + 1;
    latestLoadRequest = requestId;
    loading = blocking;

    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts`);
      if (!res.ok) {
        console.error('Failed to load hosts:', { workspaceId: targetWorkspaceId, status: res.status });
        return;
      }

      const nextHosts = await res.json() as Host[];
      if (requestId !== latestLoadRequest || workspaceId !== targetWorkspaceId) {
        return;
      }

      hosts = nextHosts;
      writeCachedHosts(targetWorkspaceId, nextHosts);
    } catch (err) {
      console.error('Failed to load hosts:', { workspaceId: targetWorkspaceId, error: err });
    } finally {
      if (requestId === latestLoadRequest) {
        loading = false;
      }
    }
  }

  function openAddForm(): void {
    addingHost = !addingHost;
  }

  async function deleteHost(id: string): Promise<void> {
    if (!workspaceId) return;
    const targetWorkspaceId = workspaceId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts/${id}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete host:', { workspaceId: targetWorkspaceId, hostId: id, status: res.status }); return; }
      hosts = hosts.filter((h) => h.id !== id);
      writeCachedHosts(targetWorkspaceId, hosts);
      if (expandedHost === id) expandedHost = null;
    } catch (err) {
      console.error('Failed to delete host:', { workspaceId: targetWorkspaceId, hostId: id, error: err });
    }
  }

  async function deletePort(hostId: string, portId: string): Promise<void> {
    if (!workspaceId) return;
    const targetWorkspaceId = workspaceId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts/${hostId}/ports/${portId}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete port:', { workspaceId: targetWorkspaceId, hostId, portId, status: res.status }); return; }
      hosts = hosts.map((h) => h.id === hostId ? { ...h, ports: h.ports.filter((p) => p.id !== portId) } : h);
      writeCachedHosts(targetWorkspaceId, hosts);
    } catch (err) {
      console.error('Failed to delete port:', { workspaceId: targetWorkspaceId, hostId, portId, error: err });
    }
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

  function handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.key !== 'Escape') return;

    if (confirmDelete !== null) {
      e.preventDefault();
      confirmDelete = null;
      return;
    }

    if (lightboxImage !== null) {
      e.preventDefault();
      lightboxImage = null;
      return;
    }

    if (importingNmap) {
      e.preventDefault();
      importingNmap = false;
      return;
    }

    if (editingHostId !== null) {
      e.preventDefault();
      editingHostId = null;
      return;
    }

    if (addingHost) {
      e.preventDefault();
      addingHost = false;
      return;
    }

    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="absolute right-0 top-0 flex h-full w-80 flex-shrink-0 flex-col border-l border-border bg-card"
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
        onclick={() => {
          if (!workspaceId) return;
          void loadHosts(workspaceId, true);
        }}
        title="Refresh"
        aria-label="Refresh hosts"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => (importingNmap = !importingNmap)}
        title="Import from Nmap"
        aria-label="Import hosts from Nmap"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground {importingNmap ? 'bg-accent text-foreground' : ''}"
      >
        <FileInput size={12} />
      </button>
      <button
        onclick={openAddForm}
        title="Add host"
        aria-label="Add host"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      <button
        onclick={onClose}
        title="Close"
        aria-label="Close host tracker"
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
      <HostAddForm
        workspaceId={workspaceId}
        {uiMode}
        onHostAdded={(newHost) => { hosts = [...hosts, newHost]; addingHost = false; expandedHost = newHost.id; writeCachedHosts(workspaceId, hosts); }}
        onCancel={() => (addingHost = false)}
      />
    {/if}

    <!-- Nmap import form -->
    {#if importingNmap}
      <NmapImportForm
        workspaceId={workspaceId}
        {uiMode}
        onImportComplete={() => { void loadHosts(workspaceId); }}
        onCancel={() => (importingNmap = false)}
      />
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

    {#if hosts.length > 0}
    <div class="border-b border-border px-3 py-2">
      <input
        type="text"
        aria-label="Filter hosts"
        placeholder="Filter hosts..."
        bind:value={hostQuery}
        class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
    {/if}

    <!-- Host list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading && hosts.length === 0}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={16} class="animate-spin text-muted-foreground" />
        </div>
      {:else if filteredHosts.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Globe size={24} class="text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">{hosts.length === 0 ? 'No hosts yet. Click + to add one.' : 'No hosts match your filter.'}</p>
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
                aria-label={expandedHost === host.id ? `Collapse host ${host.ip}` : `Expand host ${host.ip}`}
                aria-expanded={expandedHost === host.id}
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
                <button
                  onclick={(e) => { e.stopPropagation(); editingHostId = host.id; }}
                  class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Edit host"
                  aria-label={`Edit host ${host.ip}`}
                >
                  <Pencil size={11} />
                </button>
                <button
                  onclick={(e) => { e.stopPropagation(); confirmDelete = { id: host.id, label: host.ip, kind: 'host' }; }}
                  class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                  title="Delete host"
                  aria-label={`Delete host ${host.ip}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {#if editingHostId === host.id}
              <HostEditForm
                workspaceId={workspaceId}
                host={host}
                {uiMode}
                onUpdated={(updated) => { hosts = hosts.map((h) => h.id === host.id ? { ...h, ...updated } : h); editingHostId = null; writeCachedHosts(workspaceId, hosts); }}
                onPortAdded={(port) => { hosts = hosts.map((h) => h.id === host.id ? { ...h, ports: [...h.ports, port] } : h); writeCachedHosts(workspaceId, hosts); }}
                onDeletePort={(portId, label) => { confirmDelete = { id: portId, label, kind: 'port', parentId: host.id }; }}
                onCancel={() => (editingHostId = null)}
              />
            {/if}

            <!-- Expanded: details + ports + add-port -->
            {#if expandedHost === host.id}
              <div class="bg-muted/20 px-3 pb-2">
                {#if host.os || host.segment}
                  <p class="mb-1.5 text-[10px] text-muted-foreground">
                    {#if host.os}{host.os}{/if}{#if host.os && host.segment} &middot; {/if}{#if host.segment}{host.segment}{/if}
                  </p>
                {/if}

                <!-- Screenshot -->
                <div class="mb-2">
                  {#if host.screenshot_filename}
                    <button
                      onclick={() => (lightboxImage = `/api/screenshots/${encodeURIComponent(host.screenshot_filename ?? '')}`)}
                      class="w-full text-left"
                      type="button"
                      title="Click to enlarge"
                    >
                      <img
                        src="/api/screenshots/{encodeURIComponent(host.screenshot_filename ?? '')}"
                        alt="Screenshot for {host.ip}"
                        class="max-h-32 w-full rounded border border-border object-contain"
                      />
                    </button>
                  {:else}
                    <div class="flex items-center gap-1.5">
                      <ImageIcon size={10} class="flex-shrink-0 text-muted-foreground" />
                      <span class="text-[10px] text-muted-foreground">No screenshot</span>
                    </div>
                  {/if}
                </div>

                <!-- Notes -->
                {#if host.notes}
                  <div class="mb-2">
                    <p class="mb-0.5 text-[10px] text-muted-foreground">Notes</p>
                    <p class="text-[10px] text-foreground whitespace-pre-wrap break-words max-h-20 overflow-y-auto">{host.notes}</p>
                  </div>
                {/if}

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
                              <CopyButton
                                text="{port.number}/{port.protocol}{port.service ? ` ${port.service}` : ''}"
                                size={9}
                                class="h-4 w-4"
                              />
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}


              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

{#if lightboxImage}
  <ImageLightbox src={lightboxImage} alt="Host screenshot" onClose={() => (lightboxImage = null)} />
{/if}

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
