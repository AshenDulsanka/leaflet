<script lang="ts">
  import { Monitor, Plus, X } from '@lucide/svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import Select from '$lib/components/ui/Select.svelte';

  type Scope = 'in-scope' | 'out-of-scope' | 'unknown';

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
    scope: Scope;
    screenshot_filename: string;
    notes: string;
    ports: Port[];
  }

  interface Props {
    workspaceId: string;
    uiMode?: 'modal' | 'inline';
    onHostAdded: (host: Host) => void;
    onCancel: () => void;
  }

  let { workspaceId, uiMode = 'modal', onHostAdded, onCancel }: Props = $props();

  let newIp = $state('');
  let newHostname = $state('');
  let newOs = $state('');
  let newStatus = $state('unknown');
  let newScope = $state<Scope>('unknown');
  let newNotes = $state('');
  let newPortsOnCreate = $state<Array<{ number: string; protocol: string; service: string }>>([]);
  let availableScreenshots = $state<Array<{ filename: string; url: string }>>([]);
  let screenshotsLoading = $state(false);
  let newScreenshotChoice = $state<string>('');
  let screenshotUploadFile = $state<File | null>(null);

  async function loadScreenshots(): Promise<void> {
    screenshotsLoading = true;
    try {
      const res = await fetch(`/api/screenshots?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) availableScreenshots = await res.json();
    } catch {
      console.error('[HostAddForm] Failed to load screenshots');
    } finally {
      screenshotsLoading = false;
    }
  }

  loadScreenshots();

  async function addHost(): Promise<void> {
    if (!newIp.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: newIp.trim(),
          hostname: newHostname.trim(),
          os: newOs.trim(),
          status: newStatus,
          scope: newScope,
          notes: newNotes.trim()
        })
      });
      if (!res.ok) { console.error('Failed to add host:', res.status); return; }
      const host: Host = await res.json();

      // Add initial ports
      for (const p of newPortsOnCreate) {
        const num = parseInt(p.number);
        if (isNaN(num) || num < 1 || num > 65535) continue;
        const pRes = await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: num, protocol: p.protocol, service: p.service.trim(), state: 'open' })
        });
        if (pRes.ok) {
          const port: Port = await pRes.json();
          host.ports = [...host.ports, port];
        }
      }

      // Handle screenshot
      let screenshotFilename = '';
      if (newScreenshotChoice && newScreenshotChoice !== 'upload') {
        screenshotFilename = newScreenshotChoice;
      } else if (newScreenshotChoice === 'upload' && screenshotUploadFile) {
        const fd = new FormData();
        fd.append('image', screenshotUploadFile);
        fd.append('workspace_id', workspaceId);
        const upRes = await fetch('/api/screenshots', { method: 'POST', body: fd });
        if (upRes.ok) {
          const data = await upRes.json() as { url: string };
          screenshotFilename = data.url.replace('/api/screenshots/', '');
        }
      }
      if (screenshotFilename) {
        const patchRes = await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenshot_filename: screenshotFilename })
        });
        if (patchRes.ok) host.screenshot_filename = screenshotFilename;
      }

      onHostAdded(host);
    } catch (err) {
      console.error('Failed to add host:', err);
    }
  }

  // Shared form fields snippet — used by both inline and modal variants
  const inputClass = (size: 'sm' | 'lg') =>
    `w-full rounded border border-border bg-background px-2 ${size === 'lg' ? 'py-1.5 text-sm' : 'py-1 text-xs'} focus:outline-none focus:ring-1 focus:ring-primary`;
</script>

{#if uiMode === 'inline'}
  <div class="border-b border-border bg-muted/40 p-3 space-y-2">
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
      <input
        type="text" placeholder="IP address *"
        bind:value={newIp}
        class={inputClass('sm')}
        onkeydown={(e) => { if (e.key === 'Enter') addHost(); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }}
      />
    </label>
    <div class="flex gap-2">
      <label class="flex-1 space-y-0.5">
        <span class="block text-[10px] text-muted-foreground">Hostname</span>
        <input type="text" placeholder="Hostname" bind:value={newHostname} class={inputClass('sm')} />
      </label>
      <label class="w-24 space-y-0.5">
        <span class="block text-[10px] text-muted-foreground">OS</span>
        <input type="text" placeholder="OS" bind:value={newOs} class={inputClass('sm')} />
      </label>
    </div>
    <div class="space-y-0.5">
      <p class="text-[10px] text-muted-foreground">Status</p>
      <Select size="sm" value={newStatus} onchange={(v) => (newStatus = v)} options={[
        { value: 'unknown', label: 'Unknown' }, { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' }, { value: 'rooted', label: 'Rooted' }
      ]} />
    </div>
    <div class="space-y-0.5">
      <p class="text-[10px] text-muted-foreground">Scope</p>
      <Select size="sm" value={newScope} onchange={(v) => (newScope = v as Scope)} options={[
        { value: 'unknown', label: 'Scope?' }, { value: 'in-scope', label: 'In-scope' },
        { value: 'out-of-scope', label: 'Out-of-scope' }
      ]} />
    </div>
    <!-- Initial ports -->
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-muted-foreground">Initial ports</span>
        <button onclick={() => (newPortsOnCreate = [...newPortsOnCreate, { number: '', protocol: 'tcp', service: '' }])} class="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground" type="button">
          <Plus size={9} /> Add
        </button>
      </div>
      {#each newPortsOnCreate as portEntry, i}
        <div class="flex items-center gap-1">
          <input type="number" placeholder="Port" min="1" max="65535" bind:value={portEntry.number} class="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary" />
          <Select size="xs" value={portEntry.protocol} onchange={(v) => (newPortsOnCreate[i] = { ...portEntry, protocol: v })} options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} />
          <input type="text" placeholder="Service" bind:value={portEntry.service} class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary" />
          <button onclick={() => (newPortsOnCreate = newPortsOnCreate.filter((_, idx) => idx !== i))} class="text-destructive hover:text-destructive/80" type="button" aria-label="Remove initial port"><X size={10} /></button>
        </div>
      {/each}
    </div>
    <!-- Screenshot -->
    <div class="space-y-1">
      <span class="text-[10px] text-muted-foreground">Screenshot</span>
      {#if screenshotsLoading}
        <p class="text-[10px] text-muted-foreground">Loading…</p>
      {:else}
        <Select size="sm" value={newScreenshotChoice} onchange={(v) => (newScreenshotChoice = v)} options={[
          { value: '', label: 'None' },
          ...availableScreenshots.map((s) => ({ value: s.filename, label: s.filename })),
          { value: 'upload', label: 'Upload new…' }
        ]} />
        {#if newScreenshotChoice === 'upload'}
          <input type="file" accept="image/*" onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; screenshotUploadFile = f ?? null; }} class="w-full text-[10px] text-muted-foreground" aria-label="Upload screenshot" />
        {/if}
      {/if}
    </div>
    <div class="flex gap-2">
      <button onclick={addHost} class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Add</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent">Cancel</button>
    </div>
  </div>
{:else}
  <ToolModal ariaLabel="Add host" onClose={onCancel} maxWidthClass="max-w-sm">
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <Monitor size={16} class="shrink-0 text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Add Host</h2>
      <button onclick={onCancel} class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close add host modal"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
        <input type="text" placeholder="IP address *" bind:value={newIp} class={inputClass('lg')}
          onkeydown={(e) => { if (e.key === 'Enter') addHost(); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }} />
      </label>
      <div class="flex gap-2">
        <label class="flex-1 space-y-1">
          <span class="block text-xs text-muted-foreground">Hostname</span>
          <input type="text" placeholder="Hostname" bind:value={newHostname} class={inputClass('lg')} />
        </label>
        <label class="w-24 space-y-1">
          <span class="block text-xs text-muted-foreground">OS</span>
          <input type="text" placeholder="OS" bind:value={newOs} class={inputClass('lg')} />
        </label>
      </div>
      <div class="flex gap-2">
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Status</p>
          <Select size="sm" value={newStatus} onchange={(v) => (newStatus = v)} options={[
            { value: 'unknown', label: 'Unknown' }, { value: 'up', label: 'Up' },
            { value: 'down', label: 'Down' }, { value: 'rooted', label: 'Rooted' }
          ]} />
        </div>
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Scope</p>
          <Select size="sm" value={newScope} onchange={(v) => (newScope = v as Scope)} options={[
            { value: 'unknown', label: 'Scope?' }, { value: 'in-scope', label: 'In-scope' },
            { value: 'out-of-scope', label: 'Out-of-scope' }
          ]} />
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Notes</span>
        <textarea rows={2} bind:value={newNotes} placeholder="Optional notes about this host" class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
      </label>
      <!-- Initial ports -->
      <div class="space-y-1 mt-2 border-t border-border pt-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-foreground">Initial ports</span>
          <button onclick={() => (newPortsOnCreate = [...newPortsOnCreate, { number: '', protocol: 'tcp', service: '' }])} class="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground" type="button">
            <Plus size={10} /> Add
          </button>
        </div>
        {#each newPortsOnCreate as portEntry, i}
          <div class="flex items-center gap-1 mt-1">
            <input type="number" placeholder="Port" min="1" max="65535" bind:value={portEntry.number} class="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
            <Select size="xs" value={portEntry.protocol} onchange={(v) => (newPortsOnCreate[i] = { ...portEntry, protocol: v })} options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} />
            <input type="text" placeholder="Service" bind:value={portEntry.service} class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
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
          <Select size="sm" value={newScreenshotChoice} onchange={(v) => (newScreenshotChoice = v)} options={[
            { value: '', label: 'None' },
            ...availableScreenshots.map((s) => ({ value: s.filename, label: s.filename })),
            { value: 'upload', label: 'Upload new…' }
          ]} />
          {#if newScreenshotChoice === 'upload'}
            <input type="file" accept="image/*" onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; screenshotUploadFile = f ?? null; }} class="w-full text-xs text-muted-foreground mt-1" aria-label="Upload screenshot" />
          {:else if newScreenshotChoice}
            <img src="/api/screenshots/{encodeURIComponent(newScreenshotChoice)}" alt="Screenshot preview" class="mt-1 max-h-32 w-full rounded border border-border object-contain" />
          {/if}
        {/if}
      </div>
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button onclick={addHost} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Add Host</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">Cancel</button>
    </div>
  </ToolModal>
{/if}
