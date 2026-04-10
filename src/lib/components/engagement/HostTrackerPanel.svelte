<script lang="ts">
  import { Monitor, Plus, X, ChevronDown, ChevronRight, Trash2, RefreshCw, Globe } from '@lucide/svelte';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
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

  interface Host {
    id: string;
    ip: string;
    hostname: string;
    os: string;
    segment: string;
    status: string;
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

  // Add-host form
  let addingHost = $state(false);
  let newIp = $state('');
  let newHostname = $state('');
  let newOs = $state('');
  let newStatus = $state('unknown');

  // Add-port form
  let addingPortFor = $state<string | null>(null);
  let newPortNum = $state('');
  let newPortService = $state('');
  let newPortProto = $state('tcp');

  $effect(() => {
    if (workspaceId) loadHosts();
  });

  async function loadHosts() {
    if (!workspaceId) return;
    hosts = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`);
      hosts = await res.json();
    } catch {
      console.error('Failed to load hosts');
    } finally {
      loading = false;
    }
  }

  async function addHost() {
    if (!workspaceId || !newIp.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim(), hostname: newHostname.trim(), os: newOs.trim(), status: newStatus })
      });
      if (!res.ok) return;
      const host: Host = await res.json();
      hosts = [...hosts, host];
      newIp = '';
      newHostname = '';
      newOs = '';
      newStatus = 'unknown';
      addingHost = false;
      expandedHost = host.id;
    } catch {
      console.error('Failed to add host');
    }
  }

  async function deleteHost(id: string) {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/hosts/${id}`, { method: 'DELETE' });
    hosts = hosts.filter((h) => h.id !== id);
    if (expandedHost === id) expandedHost = null;
  }

  async function updateHostStatus(host: Host, status: string) {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    hosts = hosts.map((h) => h.id === host.id ? { ...h, status } : h);
  }

  async function addPort(hostId: string) {
    if (!workspaceId || !newPortNum.trim()) return;
    const num = parseInt(newPortNum);
    if (isNaN(num) || num < 1 || num > 65535) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${hostId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num, protocol: newPortProto, service: newPortService.trim(), state: 'open' })
      });
      if (!res.ok) return;
      const port: Port = await res.json();
      hosts = hosts.map((h) => h.id === hostId ? { ...h, ports: [...h.ports, port] } : h);
      newPortNum = '';
      newPortService = '';
      newPortProto = 'tcp';
      addingPortFor = null;
    } catch {
      console.error('Failed to add port');
    }
  }

  async function deletePort(hostId: string, portId: string) {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/hosts/${hostId}/ports/${portId}`, { method: 'DELETE' });
    hosts = hosts.map((h) => h.id === hostId ? { ...h, ports: h.ports.filter((p) => p.id !== portId) } : h);
  }

  const statusDots: Record<string, string> = {
    unknown: 'bg-muted-foreground',
    up: 'bg-blue-500',
    down: 'bg-destructive',
    rooted: 'bg-green-500'
  };

  function handleKeydown(e: KeyboardEvent) {
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
        <select
          bind:value={newStatus}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="unknown">Unknown</option>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="rooted">Rooted</option>
        </select>
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

    <!-- Host list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={16} class="animate-spin text-muted-foreground" />
        </div>
      {:else if hosts.length === 0}
        <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Globe size={24} class="text-muted-foreground/40" />
          <p class="text-xs text-muted-foreground">No hosts yet. Click + to add one.</p>
        </div>
      {:else}
        {#each hosts as host (host.id)}
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
              {#if host.ports.length > 0}
                <span class="text-[10px] text-muted-foreground">{host.ports.length}p</span>
              {/if}
              <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <select
                  value={host.status}
                  onchange={(e) => updateHostStatus(host, (e.currentTarget as HTMLSelectElement).value)}
                  class="rounded border border-border bg-background px-1 py-0.5 text-[10px] focus:outline-none"
                  onclick={(e) => e.stopPropagation()}
                  title="Set status"
                >
                  <option value="unknown">?</option>
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="rooted">Root</option>
                </select>
                <button
                  onclick={() => deleteHost(host.id)}
                  class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                  title="Delete host"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            <!-- Expanded: ports + add-port -->
            {#if expandedHost === host.id}
              <div class="bg-muted/20 px-3 pb-2">
                {#if host.os || host.segment}
                  <p class="mb-1.5 text-[10px] text-muted-foreground">
                    {#if host.os}{host.os}{/if}{#if host.os && host.segment} &middot; {/if}{#if host.segment}{host.segment}{/if}
                  </p>
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
                        {#each host.ports.sort((a, b) => a.number - b.number) as port (port.id)}
                          <tr class="group/port border-t border-border">
                            <td class="px-2 py-0.5 font-mono font-medium text-foreground">{port.number}</td>
                            <td class="px-2 py-0.5 text-muted-foreground">{port.protocol}</td>
                            <td class="px-2 py-0.5 text-muted-foreground">{port.service || '-'}</td>
                            <td class="px-1 py-0.5">
                              <div class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/port:opacity-100">
                                <CopyButton
                                  text="{port.number}/{port.protocol}{port.service ? ` ${port.service}` : ''}"
                                  size={9}
                                  class="h-4 w-4"
                                />
                                <button
                                  onclick={() => deletePort(host.id, port.id)}
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
                    <select
                      bind:value={newPortProto}
                      class="rounded border border-border bg-background px-1 py-0.5 text-[10px] focus:outline-none"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
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
