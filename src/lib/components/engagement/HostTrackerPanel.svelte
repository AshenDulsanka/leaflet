<script module lang="ts">
  const hostCache = new Map<string, string>();
</script>

<script lang="ts">
  import { Monitor, Plus, X, ChevronDown, ChevronRight, Trash2, RefreshCw, Globe, Image as ImageIcon, FileInput, Pencil } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import ImageLightbox from '$lib/components/editor/ImageLightbox.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { onDestroy } from 'svelte';
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
  let newIp = $state('');
  let newHostname = $state('');
  let newOs = $state('');
  let newStatus = $state('unknown');
  let newScope = $state<Scope>('unknown');
  let newNotes = $state('');

  // Add-host: initial port
  let newPortsOnCreate = $state<Array<{ number: string; protocol: string; service: string }>>([]);

  // Add-host: screenshot
  let availableScreenshots = $state<Array<{ filename: string; url: string }>>([]);
  let screenshotsLoading = $state(false);
  let newScreenshotChoice = $state<string>(''); // selected filename from dropdown, or '' for none, or 'upload' for file upload
  let screenshotUploadFile = $state<File | null>(null);

  // Edit-host form state
  let editingHostId = $state<string | null>(null);
  let editIp = $state('');
  let editHostname = $state('');
  let editOs = $state('');
  let editStatus = $state('unknown');
  let editScope = $state<Scope>('unknown');
  let editNotes = $state('');
  let editScreenshotFilename = $state('');
  let editAddingPort = $state(false);
  let editNewPortNum = $state('');
  let editNewPortService = $state('');
  let editNewPortProto = $state('tcp');
  let lightboxImage = $state<string | null>(null);

  // Nmap import
  let importingNmap = $state(false);
  let nmapRaw = $state('');
  let nmapImportStatus = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  let nmapErrors = $state<Array<{ line: number; message: string }>>([]);
  let nmapSummary = $state('');
  let _autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
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

  async function loadScreenshots(): Promise<void> {
    if (!workspaceId) return;
    screenshotsLoading = true;
    try {
      const res = await fetch(`/api/screenshots?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        availableScreenshots = await res.json();
      } else {
        console.error('[HostTracker] Failed to load screenshots:', { workspaceId, status: res.status });
      }
    } catch (err) {
      console.error('[HostTracker] Failed to load screenshots:', err);
    } finally {
      screenshotsLoading = false;
    }
  }

  function openAddForm(): void {
    addingHost = !addingHost;
    if (addingHost) {
      newPortsOnCreate = [];
      newScreenshotChoice = '';
      screenshotUploadFile = null;
      loadScreenshots();
    }
  }

  async function addHost(): Promise<void> {
    if (!workspaceId || !newIp.trim()) return;
    const targetWorkspaceId = workspaceId;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim(), hostname: newHostname.trim(), os: newOs.trim(), status: newStatus, scope: newScope, notes: newNotes.trim() })
      });
      if (!res.ok) {
        console.error('Failed to add host:', { workspaceId, status: res.status });
        return;
      }
      const host: Host = await res.json();
      hosts = [...hosts, host];
      writeCachedHosts(targetWorkspaceId, hosts);

      // Add initial ports
      for (const p of newPortsOnCreate) {
        const num = parseInt(p.number);
        if (isNaN(num) || num < 1 || num > 65535) continue;
        const pRes = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts/${host.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: num, protocol: p.protocol, service: p.service.trim(), state: 'open' })
        });
        if (pRes.ok) {
          const port: Port = await pRes.json();
          hosts = hosts.map((h) => h.id === host.id ? { ...h, ports: [...h.ports, port] } : h);
          writeCachedHosts(targetWorkspaceId, hosts);
        }
      }

      // Handle screenshot
      let screenshotFilename = '';
      if (newScreenshotChoice && newScreenshotChoice !== 'upload') {
        screenshotFilename = newScreenshotChoice;
      } else if (newScreenshotChoice === 'upload' && screenshotUploadFile) {
        const fd = new FormData();
        fd.append('image', screenshotUploadFile);
        fd.append('workspace_id', targetWorkspaceId);
        const upRes = await fetch('/api/screenshots', { method: 'POST', body: fd });
        if (upRes.ok) {
          const data = await upRes.json() as { url: string };
          screenshotFilename = data.url.replace('/api/screenshots/', '');
        }
      }
      if (screenshotFilename) {
        const patchRes = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts/${host.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenshot_filename: screenshotFilename })
        });
        if (patchRes.ok) {
          hosts = hosts.map((h) => h.id === host.id ? { ...h, screenshot_filename: screenshotFilename } : h);
          writeCachedHosts(targetWorkspaceId, hosts);
        }
      }

      // Reset form
      newIp = '';
      newHostname = '';
      newOs = '';
      newStatus = 'unknown';
      newScope = 'unknown';
      newNotes = '';
      newPortsOnCreate = [];
      newScreenshotChoice = '';
      screenshotUploadFile = null;
      addingHost = false;
      expandedHost = host.id;
    } catch (err) {
      console.error('Failed to add host:', { workspaceId, error: err });
    }
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

  async function importNmap(): Promise<void> {
    if (!workspaceId || !nmapRaw.trim()) return;
    const targetWorkspaceId = workspaceId;
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
      await loadHosts(targetWorkspaceId);
      if (nmapErrors.length === 0) {
        if (_autoCloseTimer !== null) clearTimeout(_autoCloseTimer);
        _autoCloseTimer = setTimeout(() => {
          importingNmap = false;
          nmapRaw = '';
          nmapImportStatus = 'idle';
          nmapErrors = [];
          nmapSummary = '';
          _autoCloseTimer = null;
        }, 2500);
      }
    } catch {
      nmapImportStatus = 'error';
      nmapErrors = [{ line: 0, message: 'Network error — import failed.' }];
    }
  }

  async function updateHost(): Promise<void> {
    if (!workspaceId || !editingHostId) return;
    const targetWorkspaceId = workspaceId;
    const targetHostId = editingHostId;
    const trimmedFilename = editScreenshotFilename.trim();
    if (trimmedFilename && /\.{2}|\/|\\/.test(trimmedFilename)) {
      console.error('Invalid screenshot filename — path traversal rejected');
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts/${targetHostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: editIp.trim(),
          hostname: editHostname.trim(),
          os: editOs.trim(),
          notes: editNotes.trim(),
          status: editStatus,
          scope: editScope,
          screenshot_filename: editScreenshotFilename.trim()
        })
      });
      if (!res.ok) {
        console.error('Failed to update host:', { workspaceId: targetWorkspaceId, hostId: targetHostId, status: res.status });
        return;
      }
      const updated = await res.json() as Partial<Host>;
      hosts = hosts.map((h) => h.id === targetHostId ? { ...h, ...updated } : h);
      writeCachedHosts(targetWorkspaceId, hosts);
      if (editingHostId === targetHostId) {
        editingHostId = null;
      }
    } catch (err) {
      console.error('Failed to update host:', { workspaceId: targetWorkspaceId, hostId: targetHostId, error: err });
    }
  }

  function startEditingHost(host: Host): void {
    editingHostId = host.id;
    editIp = host.ip;
    editHostname = host.hostname;
    editOs = host.os;
    editStatus = host.status;
    editScope = host.scope;
    editNotes = host.notes;
    editScreenshotFilename = host.screenshot_filename;
    editAddingPort = false;
    editNewPortNum = '';
    editNewPortService = '';
    editNewPortProto = 'tcp';
    loadScreenshots();
  }

  async function addPortInEdit(): Promise<void> {
    if (!workspaceId || !editingHostId || !editNewPortNum.trim()) return;
    const targetWorkspaceId = workspaceId;
    const targetHostId = editingHostId;
    const num = parseInt(editNewPortNum);
    if (isNaN(num) || num < 1 || num > 65535) return;
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/hosts/${targetHostId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num, protocol: editNewPortProto, service: editNewPortService.trim(), state: 'open' })
      });
      if (!res.ok) {
        console.error('Failed to add port in edit:', { workspaceId: targetWorkspaceId, hostId: targetHostId, status: res.status });
        return;
      }
      const port: Port = await res.json();
      hosts = hosts.map((h) => h.id === targetHostId ? { ...h, ports: [...h.ports, port] } : h);
      writeCachedHosts(targetWorkspaceId, hosts);
      editNewPortNum = '';
      editNewPortService = '';
      editNewPortProto = 'tcp';
      editAddingPort = false;
    } catch (err) {
      console.error('Failed to add port in edit:', { workspaceId: targetWorkspaceId, hostId: targetHostId, error: err });
    }
  }

  onDestroy(() => {
    if (_autoCloseTimer !== null) clearTimeout(_autoCloseTimer);
  });

  function resetNmapImportState(): void {
    importingNmap = false;
    nmapRaw = '';
    nmapImportStatus = 'idle';
    nmapErrors = [];
    nmapSummary = '';
  }

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
      resetNmapImportState();
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
    <!-- Add-host form (Inline) -->
    {#if addingHost && uiMode === 'inline'}
      <div class="border-b border-border bg-muted/40 p-3 space-y-2">
        <label class="block space-y-0.5">
          <span class="text-[10px] text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
          <input
            type="text"
            placeholder="IP address *"
            bind:value={newIp}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            onkeydown={(e) => {
              if (e.key === 'Enter') addHost();
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                addingHost = false;
              }
            }}
          />
        </label>
        <div class="flex gap-2">
          <label class="flex-1 space-y-0.5">
            <span class="block text-[10px] text-muted-foreground">Hostname</span>
            <input
              type="text"
              placeholder="Hostname"
              bind:value={newHostname}
              class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label class="w-24 space-y-0.5">
            <span class="block text-[10px] text-muted-foreground">OS</span>
            <input
              type="text"
              placeholder="OS"
              bind:value={newOs}
              class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>
        <div class="space-y-0.5">
          <p class="text-[10px] text-muted-foreground">Status</p>
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
        </div>
        <div class="space-y-0.5">
          <p class="text-[10px] text-muted-foreground">Scope</p>
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
        </div>

        <!-- Initial ports -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-muted-foreground">Initial ports</span>
            <button
              onclick={() => (newPortsOnCreate = [...newPortsOnCreate, { number: '', protocol: 'tcp', service: '' }])}
              class="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              type="button"
            >
              <Plus size={9} /> Add
            </button>
          </div>
          {#each newPortsOnCreate as portEntry, i}
            <div class="flex items-center gap-1">
              <input
                type="number" placeholder="Port" min="1" max="65535"
                bind:value={portEntry.number}
                class="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Select size="xs" value={portEntry.protocol} onchange={(v) => (newPortsOnCreate[i] = { ...portEntry, protocol: v })} options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} />
              <input
                type="text" placeholder="Service"
                bind:value={portEntry.service}
                class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onclick={() => (newPortsOnCreate = newPortsOnCreate.filter((_, idx) => idx !== i))}
                class="text-destructive hover:text-destructive/80"
                type="button"
                aria-label="Remove initial port"
              ><X size={10} /></button>
            </div>
          {/each}
        </div>

        <!-- Screenshot -->
        <div class="space-y-1">
          <span class="text-[10px] text-muted-foreground">Screenshot</span>
          {#if screenshotsLoading}
            <p class="text-[10px] text-muted-foreground">Loading…</p>
          {:else}
            <Select
              size="sm"
              value={newScreenshotChoice}
              onchange={(v) => (newScreenshotChoice = v)}
              options={[
                { value: '', label: 'None' },
                ...availableScreenshots.map((s) => ({ value: s.filename, label: s.filename })),
                { value: 'upload', label: 'Upload new…' }
              ]}
            />
            {#if newScreenshotChoice === 'upload'}
              <input
                type="file" accept="image/*"
                onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; screenshotUploadFile = f ?? null; }}
                class="w-full text-[10px] text-muted-foreground"
                aria-label="Upload screenshot"
              />
            {/if}
          {/if}
        </div>

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
    {#if importingNmap && uiMode === 'inline'}
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
                  onclick={(e) => { e.stopPropagation(); startEditingHost(host); }}
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

            {#if editingHostId === host.id && uiMode === 'inline'}
              <div class="border-t border-border bg-muted/40 px-3 pb-3 pt-2 space-y-2">
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
                  <input
                    type="text"
                    bind:value={editIp}
                    class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    onkeydown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        editingHostId = null;
                      }
                    }}
                  />
                </label>
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Hostname</span>
                  <input
                    type="text"
                    bind:value={editHostname}
                    class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">OS</span>
                  <input
                    type="text"
                    bind:value={editOs}
                    class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <div class="space-y-0.5">
                  <p class="text-[10px] text-muted-foreground">Status</p>
                  <Select
                    size="sm"
                    value={editStatus}
                    onchange={(v) => editStatus = v}
                    options={[
                      { value: 'unknown', label: 'Unknown' },
                      { value: 'up', label: 'Up' },
                      { value: 'down', label: 'Down' },
                      { value: 'rooted', label: 'Rooted' }
                    ]}
                  />
                </div>
                <div class="space-y-0.5">
                  <p class="text-[10px] text-muted-foreground">Scope</p>
                  <Select
                    size="sm"
                    value={editScope}
                    onchange={(v) => editScope = v as Scope}
                    options={[
                      { value: 'unknown', label: 'Scope?' },
                      { value: 'in-scope', label: 'In-scope' },
                      { value: 'out-of-scope', label: 'Out-of-scope' }
                    ]}
                  />
                </div>
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Notes</span>
                  <textarea
                    rows={3}
                    bind:value={editNotes}
                    class="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  ></textarea>
                </label>
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Screenshot</span>
                  <input
                    type="text"
                    placeholder="filename.png"
                    bind:value={editScreenshotFilename}
                    class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                {#if host.ports.length > 0}
                  <div class="space-y-0.5">
                    <p class="text-[10px] text-muted-foreground">Ports</p>
                    <div class="rounded border border-border overflow-hidden">
                      <table class="w-full text-[10px]">
                        <tbody>
                          {#each getSortedPorts(host.ports) as port (port.id)}
                            <tr class="border-b border-border last:border-b-0">
                              <td class="px-2 py-0.5 font-mono font-medium text-foreground">{port.number}/{port.protocol}</td>
                              <td class="px-2 py-0.5 text-muted-foreground">{port.service || '-'}</td>
                              <td class="px-1 py-0.5">
                                <button
                                  onclick={() => confirmDelete = { id: port.id, label: `${port.number}/${port.protocol}`, kind: 'port', parentId: host.id }}
                                  class="flex h-4 w-4 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                                  aria-label="Delete port"
                                >
                                  <X size={9} />
                                </button>
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                {/if}
                <div class="flex gap-2 pt-1">
                  <button
                    onclick={updateHost}
                    class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >Save</button>
                  <button
                    onclick={() => (editingHostId = null)}
                    class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                  >Cancel</button>
                </div>
              </div>
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

{#if importingNmap && uiMode === 'modal'}
  <ToolModal
    ariaLabel="Import from Nmap"
    onClose={resetNmapImportState}
    maxWidthClass="max-w-lg"
    dialogClass="overflow-hidden"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <FileInput size={16} class="shrink-0 text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Import from Nmap</h2>
      <button
        onclick={resetNmapImportState}
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Close"
      ><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <!-- Format badge -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Detected format:</span>
        {#if detectedFormat === 'grepable'}
          <span class="rounded bg-green-500/15 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">Grepable (-oG)</span>
        {:else if detectedFormat === 'xml'}
          <span class="rounded bg-blue-500/15 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">XML (-oX)</span>
        {:else}
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Unknown</span>
        {/if}
      </div>
      <textarea
        rows={10}
        bind:value={nmapRaw}
        placeholder="Paste Nmap -oG or -oX output here…"
        class="w-full rounded border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      ></textarea>
      {#if nmapErrors.length > 0}
        <ul class="space-y-0.5">
          {#each nmapErrors as err}
            <li class="text-xs text-destructive">{err.line > 0 ? `Line ${err.line}: ` : ''}{err.message}</li>
          {/each}
        </ul>
      {/if}
      {#if nmapSummary}
        <p class="text-xs text-green-600 dark:text-green-400">{nmapSummary}</p>
      {/if}
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button
        onclick={importNmap}
        disabled={nmapRaw.trim() === '' || nmapImportStatus === 'loading'}
        class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {nmapImportStatus === 'loading' ? 'Importing…' : 'Import'}
      </button>
      <button
        onclick={resetNmapImportState}
        class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
      >
        Cancel
      </button>
    </div>
  </ToolModal>
{/if}

{#if addingHost && uiMode === 'modal'}
  <ToolModal
    ariaLabel="Add host"
    onClose={() => (addingHost = false)}
    maxWidthClass="max-w-sm"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <Monitor size={16} class="shrink-0 text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Add Host</h2>
      <button onclick={() => (addingHost = false)} class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close add host modal"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
        <input
          type="text"
          placeholder="IP address *"
          bind:value={newIp}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => {
            if (e.key === 'Enter') addHost();
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              addingHost = false;
            }
          }}
        />
      </label>
      <div class="flex gap-2">
        <label class="flex-1 space-y-1">
          <span class="block text-xs text-muted-foreground">Hostname</span>
          <input
            type="text"
            placeholder="Hostname"
            bind:value={newHostname}
            class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label class="w-24 space-y-1">
          <span class="block text-xs text-muted-foreground">OS</span>
          <input
            type="text"
            placeholder="OS"
            bind:value={newOs}
            class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>
      <div class="flex gap-2">
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Status</p>
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
        </div>
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Scope</p>
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
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Notes</span>
        <textarea
          rows={2}
          bind:value={newNotes}
          placeholder="Optional notes about this host"
          class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        ></textarea>
      </label>

      <!-- Initial ports -->
      <div class="space-y-1 mt-2 border-t border-border pt-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-foreground">Initial ports</span>
          <button
            onclick={() => (newPortsOnCreate = [...newPortsOnCreate, { number: '', protocol: 'tcp', service: '' }])}
            class="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
            type="button"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        {#each newPortsOnCreate as portEntry, i}
          <div class="flex items-center gap-1 mt-1">
            <input
              type="number" placeholder="Port" min="1" max="65535"
              bind:value={portEntry.number}
              class="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Select size="xs" value={portEntry.protocol} onchange={(v) => (newPortsOnCreate[i] = { ...portEntry, protocol: v })} options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} />
            <input
              type="text" placeholder="Service"
              bind:value={portEntry.service}
              class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onclick={() => (newPortsOnCreate = newPortsOnCreate.filter((_, idx) => idx !== i))} class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10" type="button" aria-label="Remove port"><X size={12} /></button>
          </div>
        {/each}
      </div>

      <!-- Screenshot -->
      <div class="space-y-1 mt-2 border-t border-border pt-2">
        <span class="text-xs font-medium text-foreground">Screenshot</span>
        {#if screenshotsLoading}
          <p class="text-xs text-muted-foreground">Loading…</p>
        {:else}
          <Select
            size="sm"
            value={newScreenshotChoice}
            onchange={(v) => (newScreenshotChoice = v)}
            options={[
              { value: '', label: 'None' },
              ...availableScreenshots.map((s) => ({ value: s.filename, label: s.filename })),
              { value: 'upload', label: 'Upload new…' }
            ]}
          />
          {#if newScreenshotChoice === 'upload'}
            <input
              type="file" accept="image/*"
              onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; screenshotUploadFile = f ?? null; }}
              class="w-full text-xs text-muted-foreground mt-1"
              aria-label="Upload screenshot"
            />
          {/if}
        {/if}
      </div>
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button onclick={addHost} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Add Host</button>
      <button onclick={() => (addingHost = false)} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">Cancel</button>
    </div>
  </ToolModal>
{/if}

{#if editingHostId !== null && uiMode === 'modal'}
  <ToolModal
    ariaLabel="Edit host"
    onClose={() => (editingHostId = null)}
    maxWidthClass="max-w-sm"
  >
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <Monitor size={16} class="shrink-0 text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Edit Host</h2>
      <button onclick={() => (editingHostId = null)} class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close edit host modal"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
        <input
          type="text"
          bind:value={editIp}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          onkeydown={(e) => {
            if (e.key === 'Enter') updateHost();
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              editingHostId = null;
            }
          }}
        />
      </label>
      <div class="flex gap-2">
        <label class="flex-1 space-y-1">
          <span class="block text-xs text-muted-foreground">Hostname</span>
          <input
            type="text"
            bind:value={editHostname}
            class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label class="w-24 space-y-1">
          <span class="block text-xs text-muted-foreground">OS</span>
          <input
            type="text"
            bind:value={editOs}
            class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      </div>
      <div class="flex gap-2">
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Status</p>
          <Select
            size="sm"
            value={editStatus}
            onchange={(v) => editStatus = v}
            options={[
              { value: 'unknown', label: 'Unknown' },
              { value: 'up', label: 'Up' },
              { value: 'down', label: 'Down' },
              { value: 'rooted', label: 'Rooted' }
            ]}
          />
        </div>
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Scope</p>
          <Select
            size="sm"
            value={editScope}
            onchange={(v) => editScope = v as Scope}
            options={[
              { value: 'unknown', label: 'Scope?' },
              { value: 'in-scope', label: 'In-scope' },
              { value: 'out-of-scope', label: 'Out-of-scope' }
            ]}
          />
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Notes</span>
        <textarea
          rows={3}
          bind:value={editNotes}
          class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        ></textarea>
      </label>
      <div class="space-y-1">
        <p class="text-xs text-muted-foreground">Screenshot</p>
        {#if screenshotsLoading}
          <p class="text-xs text-muted-foreground">Loading screenshots…</p>
        {:else}
          <Select
            size="sm"
            value={editScreenshotFilename}
            onchange={(v) => (editScreenshotFilename = v)}
            options={[
              { value: '', label: 'None' },
              ...availableScreenshots.map((s) => ({ value: s.filename, label: s.filename }))
            ]}
          />
          {#if editScreenshotFilename}
            <img
              src="/api/screenshots/{encodeURIComponent(editScreenshotFilename)}"
              alt="Screenshot preview"
              class="mt-1 max-h-32 w-full rounded border border-border object-contain"
            />
          {/if}
        {/if}
      </div>
      {#each hosts.filter((h) => h.id === editingHostId) as editingHost (editingHost.id)}
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <p class="text-xs text-muted-foreground">Ports</p>
            <button
              onclick={() => { editAddingPort = !editAddingPort; editNewPortNum = ''; editNewPortService = ''; editNewPortProto = 'tcp'; }}
              class="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
              type="button"
            >
              <Plus size={10} /> Add port
            </button>
          </div>
          {#if editingHost.ports.length > 0}
            <div class="rounded border border-border overflow-hidden">
              <table class="w-full text-xs">
                <tbody>
                  {#each getSortedPorts(editingHost.ports) as port (port.id)}
                    <tr class="border-b border-border last:border-b-0">
                      <td class="px-2 py-1 font-mono font-medium text-foreground">{port.number}/{port.protocol}</td>
                      <td class="px-2 py-1 text-muted-foreground">{port.service || '-'}</td>
                      <td class="px-1 py-1">
                        <button
                          onclick={() => confirmDelete = { id: port.id, label: `${port.number}/${port.protocol}`, kind: 'port', parentId: editingHost.id }}
                          class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                          aria-label="Delete port"
                        >
                          <X size={11} />
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
          {#if editAddingPort}
            <div class="flex items-center gap-1 mt-1">
              <input
                type="number" placeholder="Port" min="1" max="65535"
                bind:value={editNewPortNum}
                class="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                onkeydown={(e) => {
                  if (e.key === 'Enter') addPortInEdit();
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    editAddingPort = false;
                  }
                }}
              />
              <Select size="xs" value={editNewPortProto} onchange={(v) => (editNewPortProto = v)} options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} />
              <input
                type="text" placeholder="Service"
                bind:value={editNewPortService}
                class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                onkeydown={(e) => {
                  if (e.key === 'Enter') addPortInEdit();
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    editAddingPort = false;
                  }
                }}
              />
              <button onclick={addPortInEdit} class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90" type="button" aria-label="Add port"><Plus size={10} /></button>
              <button onclick={() => (editAddingPort = false)} class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border hover:bg-accent" type="button" aria-label="Cancel"><X size={10} /></button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button onclick={updateHost} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Save Changes</button>
      <button onclick={() => (editingHostId = null)} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">Cancel</button>
    </div>
  </ToolModal>
{/if}

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
