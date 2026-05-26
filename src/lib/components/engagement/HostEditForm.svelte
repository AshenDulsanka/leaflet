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
    host: Host;
    uiMode?: 'modal' | 'inline';
    onUpdated: (updated: Partial<Host>) => void;
    onPortAdded: (port: Port) => void;
    onDeletePort: (portId: string, label: string) => void;
    onCancel: () => void;
  }

  let { workspaceId, host, uiMode = 'modal', onUpdated, onPortAdded, onDeletePort, onCancel }: Props = $props();

  // Form state synced when a different host is opened for editing.
  let syncedHostId = $state<string | null>(null);
  let editIp = $state('');
  let editHostname = $state('');
  let editOs = $state('');
  let editStatus = $state('');
  let editScope = $state<Scope>('unknown');
  let editNotes = $state('');
  let editScreenshotChoice = $state<string>('');
  let editScreenshotUploadFile = $state<File | null>(null);
  let editAddingPort = $state(false);
  let editNewPortNum = $state('');
  let editNewPortService = $state('');
  let editNewPortProto = $state('tcp');

  let availableScreenshots = $state<Array<{ filename: string; url: string }>>([]);
  let screenshotsLoading = $state(false);

  $effect(() => {
    if (syncedHostId === host.id) return;
    syncedHostId = host.id;
    editIp = host.ip;
    editHostname = host.hostname;
    editOs = host.os;
    editStatus = host.status;
    editScope = host.scope;
    editNotes = host.notes;
    editScreenshotChoice = host.screenshot_filename || '';
    editScreenshotUploadFile = null;
    editAddingPort = false;
    editNewPortNum = '';
    editNewPortService = '';
    editNewPortProto = 'tcp';
  });

  async function loadScreenshots(): Promise<void> {
    screenshotsLoading = true;
    try {
      const res = await fetch(`/api/screenshots?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) availableScreenshots = await res.json();
    } catch {
      console.error('[HostEditForm] Failed to load screenshots');
    } finally {
      screenshotsLoading = false;
    }
  }

  loadScreenshots();

  function getSortedPorts(ports: Port[]): Port[] {
    return [...ports].sort((a, b) => a.number - b.number);
  }

  async function updateHost(): Promise<void> {
    let resolvedScreenshotFilename = host.screenshot_filename;
    if (editScreenshotChoice !== 'upload') {
      resolvedScreenshotFilename = editScreenshotChoice;
    } else if (editScreenshotUploadFile) {
      const fd = new FormData();
      fd.append('image', editScreenshotUploadFile);
      fd.append('workspace_id', workspaceId);
      const upRes = await fetch('/api/screenshots', { method: 'POST', body: fd });
      if (upRes.ok) {
        const data = (await upRes.json()) as { url: string };
        resolvedScreenshotFilename = data.url.replace('/api/screenshots/', '');
      }
    }
    const trimmedFilename = resolvedScreenshotFilename.trim();
    if (trimmedFilename && /\.{2}|\/|\\/.test(trimmedFilename)) {
      console.error('[HostEditForm] Invalid screenshot filename — path traversal rejected');
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: editIp.trim(),
          hostname: editHostname.trim(),
          os: editOs.trim(),
          notes: editNotes.trim(),
          status: editStatus,
          scope: editScope,
          screenshot_filename: trimmedFilename
        })
      });
      if (!res.ok) { console.error('[HostEditForm] Failed to update host:', res.status); return; }
      const updated = (await res.json()) as Partial<Host>;
      onUpdated(updated);
    } catch (err) {
      console.error('[HostEditForm] Failed to update host:', err);
    }
  }

  async function addPortInEdit(): Promise<void> {
    if (editNewPortNum === '') return;
    const num = parseInt(String(editNewPortNum));
    if (isNaN(num) || num < 1 || num > 65535) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts/${host.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num, protocol: editNewPortProto, service: editNewPortService.trim(), state: 'open' })
      });
      if (!res.ok) { console.error('[HostEditForm] Failed to add port:', res.status); return; }
      const port: Port = await res.json();
      onPortAdded(port);
      editNewPortNum = '';
      editNewPortService = '';
      editNewPortProto = 'tcp';
      editAddingPort = false;
    } catch (err) {
      console.error('[HostEditForm] Failed to add port:', err);
    }
  }

  const inputClass = 'w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
  const inputLgClass = 'w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary';
</script>

{#if uiMode === 'inline'}
  <div class="border-t border-border bg-muted/40 px-3 pb-3 pt-2 space-y-2">
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
      <input type="text" bind:value={editIp} class={inputClass}
        onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }} />
    </label>
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">Hostname</span>
      <input type="text" bind:value={editHostname} class={inputClass} />
    </label>
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">OS</span>
      <input type="text" bind:value={editOs} class={inputClass} />
    </label>
    <div class="space-y-0.5">
      <p class="text-[10px] text-muted-foreground">Status</p>
      <Select size="sm" value={editStatus} onchange={(v) => (editStatus = v)} options={[
        { value: 'unknown', label: 'Unknown' }, { value: 'up', label: 'Up' },
        { value: 'down', label: 'Down' }, { value: 'rooted', label: 'Rooted' }
      ]} />
    </div>
    <div class="space-y-0.5">
      <p class="text-[10px] text-muted-foreground">Scope</p>
      <Select size="sm" value={editScope} onchange={(v) => (editScope = v as Scope)} options={[
        { value: 'unknown', label: 'Scope?' }, { value: 'in-scope', label: 'In-scope' },
        { value: 'out-of-scope', label: 'Out-of-scope' }
      ]} />
    </div>
    <label class="block space-y-0.5">
      <span class="text-[10px] text-muted-foreground">Notes</span>
      <textarea rows={3} bind:value={editNotes} class="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
    </label>
    <!-- Screenshot -->
    <div class="space-y-1">
      <span class="text-[10px] text-muted-foreground">Screenshot</span>
      {#if screenshotsLoading}
        <p class="text-[10px] text-muted-foreground">Loading…</p>
      {:else}
        <Select size="sm" value={editScreenshotChoice} onchange={(v) => (editScreenshotChoice = v)} options={[
          { value: '', label: 'None' },
          ...availableScreenshots.map((s) => ({ value: s.filename, label: s.filename })),
          { value: 'upload', label: 'Upload new…' }
        ]} />
        {#if editScreenshotChoice === 'upload'}
          <input type="file" accept="image/*" onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; editScreenshotUploadFile = f ?? null; }} class="w-full text-[10px] text-muted-foreground" aria-label="Upload screenshot" />
        {/if}
      {/if}
    </div>
    <!-- Ports -->
    <div class="space-y-0.5">
      <div class="flex items-center justify-between">
        <p class="text-[10px] text-muted-foreground">Ports</p>
        <button onclick={() => (editAddingPort = !editAddingPort)} class="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground" type="button">
          <Plus size={9} /> Add
        </button>
      </div>
      {#if host.ports.length > 0}
        <div class="rounded border border-border overflow-hidden">
          <table class="w-full text-[10px]">
            <tbody>
              {#each getSortedPorts(host.ports) as port (port.id)}
                <tr class="border-b border-border last:border-b-0">
                  <td class="px-2 py-0.5 font-mono font-medium text-foreground">{port.number}/{port.protocol}</td>
                  <td class="px-2 py-0.5 text-muted-foreground">{port.service || '-'}</td>
                  <td class="px-1 py-0.5">
                    <button onclick={() => onDeletePort(port.id, `${port.number}/${port.protocol}`)} class="flex h-4 w-4 items-center justify-center rounded text-destructive hover:bg-destructive/10" aria-label="Delete port"><X size={9} /></button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      {#if editAddingPort}
        <div class="flex items-center gap-1 pt-0.5">
          <input type="number" placeholder="Port" min="1" max="65535" bind:value={editNewPortNum} class="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary" />
          <Select size="xs" value={editNewPortProto} onchange={(v) => (editNewPortProto = v)} options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} />
          <input type="text" placeholder="Service" bind:value={editNewPortService} class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary" />
          <button onclick={addPortInEdit} class="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90" type="button" aria-label="Confirm add port"><Plus size={9} /></button>
          <button onclick={() => { editAddingPort = false; editNewPortNum = ''; editNewPortService = ''; editNewPortProto = 'tcp'; }} class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent" type="button" aria-label="Cancel add port"><X size={9} /></button>
        </div>
      {/if}
    </div>
    <div class="flex gap-2 pt-1">
      <button onclick={updateHost} class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent">Cancel</button>
    </div>
  </div>
{:else}
  <ToolModal ariaLabel="Edit host" onClose={onCancel} maxWidthClass="max-w-sm">
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <Monitor size={16} class="shrink-0 text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Edit Host</h2>
      <button onclick={onCancel} class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close edit host modal"><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">IP Address <span class="text-destructive">*</span></span>
        <input type="text" bind:value={editIp} class={inputLgClass}
          onkeydown={(e) => { if (e.key === 'Enter') updateHost(); if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }} />
      </label>
      <div class="flex gap-2">
        <label class="flex-1 space-y-1">
          <span class="block text-xs text-muted-foreground">Hostname</span>
          <input type="text" bind:value={editHostname} class={inputLgClass} />
        </label>
        <label class="w-24 space-y-1">
          <span class="block text-xs text-muted-foreground">OS</span>
          <input type="text" bind:value={editOs} class={inputLgClass} />
        </label>
      </div>
      <div class="flex gap-2">
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Status</p>
          <Select size="sm" value={editStatus} onchange={(v) => (editStatus = v)} options={[
            { value: 'unknown', label: 'Unknown' }, { value: 'up', label: 'Up' },
            { value: 'down', label: 'Down' }, { value: 'rooted', label: 'Rooted' }
          ]} />
        </div>
        <div class="flex-1 space-y-1">
          <p class="text-xs text-muted-foreground">Scope</p>
          <Select size="sm" value={editScope} onchange={(v) => (editScope = v as Scope)} options={[
            { value: 'unknown', label: 'Scope?' }, { value: 'in-scope', label: 'In-scope' },
            { value: 'out-of-scope', label: 'Out-of-scope' }
          ]} />
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Notes</span>
        <textarea rows={3} bind:value={editNotes} class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
      </label>
      <div class="space-y-1">
        <p class="text-xs text-muted-foreground">Screenshot</p>
        {#if screenshotsLoading}
          <p class="text-xs text-muted-foreground">Loading screenshots…</p>
        {:else}
          <Select size="sm" value={editScreenshotChoice} onchange={(v) => (editScreenshotChoice = v)} options={[
            { value: '', label: 'None' },
            ...availableScreenshots.map((s) => ({ value: s.filename, label: s.filename })),
            { value: 'upload', label: 'Upload new…' }
          ]} />
          {#if editScreenshotChoice === 'upload'}
            <input type="file" accept="image/*" onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; editScreenshotUploadFile = f ?? null; }} class="w-full text-xs text-muted-foreground mt-1" aria-label="Upload screenshot" />
          {:else if editScreenshotChoice}
            <img src="/api/screenshots/{encodeURIComponent(editScreenshotChoice)}" alt="Screenshot preview" class="mt-1 max-h-32 w-full rounded border border-border object-contain" />
          {/if}
        {/if}
      </div>
      <!-- Ports -->
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <p class="text-xs text-muted-foreground">Ports</p>
          <button onclick={() => { editAddingPort = !editAddingPort; editNewPortNum = ''; editNewPortService = ''; editNewPortProto = 'tcp'; }} class="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground" type="button">
            <Plus size={10} /> Add port
          </button>
        </div>
        {#if host.ports.length > 0}
          <div class="rounded border border-border overflow-hidden">
            <table class="w-full text-xs">
              <tbody>
                {#each getSortedPorts(host.ports) as port (port.id)}
                  <tr class="border-b border-border last:border-b-0">
                    <td class="px-2 py-1 font-mono font-medium text-foreground">{port.number}/{port.protocol}</td>
                    <td class="px-2 py-1 text-muted-foreground">{port.service || '-'}</td>
                    <td class="px-1 py-1">
                      <button onclick={() => onDeletePort(port.id, `${port.number}/${port.protocol}`)} class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10" aria-label="Delete port"><X size={11} /></button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        {#if editAddingPort}
          <div class="flex items-center gap-1 mt-1">
            <input type="number" placeholder="Port" min="1" max="65535" bind:value={editNewPortNum} class="w-16 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
            <Select size="xs" value={editNewPortProto} onchange={(v) => (editNewPortProto = v)} options={[{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }]} />
            <input type="text" placeholder="Service" bind:value={editNewPortService} class="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
            <button onclick={addPortInEdit} class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90" type="button" aria-label="Confirm add port"><Plus size={10} /></button>
            <button onclick={() => { editAddingPort = false; editNewPortNum = ''; editNewPortService = ''; editNewPortProto = 'tcp'; }} class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent" type="button" aria-label="Cancel add port"><X size={10} /></button>
          </div>
        {/if}
      </div>
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button onclick={updateHost} class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Save</button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">Cancel</button>
    </div>
  </ToolModal>
{/if}
