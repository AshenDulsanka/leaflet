<script lang="ts">
  import { Bug, X, Plus, RefreshCw, Upload, Pencil, Trash2, Tag } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import FindingForm from '$lib/components/engagement/FindingForm.svelte';
  import type { FindingFormData } from '$lib/components/engagement/FindingForm.svelte';
  import type { Finding, FindingSeverity, FindingStatus } from '$lib/types';

  interface HostOption {
    id: string;
    ip: string;
    hostname: string;
  }

  interface MitreTechnique {
    external_id: string;
    name: string;
    tactic: string;
    description: string;
    url: string;
  }

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
    uiMode?: 'modal' | 'inline';
  }

  let { workspaceId, onClose, uiMode = 'modal' }: Props = $props();

  let findings = $state<Finding[]>([]);
  let hosts = $state<HostOption[]>([]);
  let loading = $state(false);
  let addingFinding = $state(false);
  let importStatus = $state<{ imported: number; skipped: number } | null>(null);
  let deleteError = $state<string | null>(null);
  let importing = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let mitreData = $state<MitreTechnique[]>([]);
  let mitreLoading = $state(false);

  let editingId = $state<string | null>(null);

  let severityFilter = $state<'all' | FindingSeverity>('all');
  let statusFilter = $state<'all' | FindingStatus>('all');
  let findingQuery = $state('');

  const SEVERITIES: { value: FindingSeverity; label: string; color: string; bg: string }[] = [
    { value: 'critical',  label: 'Critical',      color: 'text-red-400',            bg: 'bg-red-400/10'   },
    { value: 'high',      label: 'High',          color: 'text-orange-400',         bg: 'bg-orange-400/10'},
    { value: 'medium',    label: 'Medium',        color: 'text-yellow-400',         bg: 'bg-yellow-400/10'},
    { value: 'low',       label: 'Low',           color: 'text-blue-400',           bg: 'bg-blue-400/10'  },
    { value: 'info',      label: 'Info',          color: 'text-cyan-400',           bg: 'bg-cyan-400/10'  },
    { value: 'none',      label: 'None',          color: 'text-muted-foreground',   bg: 'bg-muted'        },
  ];

  const STATUSES: { value: FindingStatus; label: string; color: string }[] = [
    { value: 'open',           label: 'Open',          color: 'text-orange-400'       },
    { value: 'confirmed',      label: 'Confirmed',     color: 'text-red-400'          },
    { value: 'remediated',     label: 'Remediated',    color: 'text-green-400'        },
    { value: 'false-positive', label: 'False Positive',color: 'text-muted-foreground' },
  ];

  const severityMeta = Object.fromEntries(SEVERITIES.map((s) => [s.value, s]));
  const statusMeta   = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

  const filteredFindings = $derived.by(() => {
    const query = findingQuery.trim().toLowerCase();
    return findings.filter((f) => {
      const matchesFilters =
        (severityFilter === 'all' || f.severity === severityFilter) &&
        (statusFilter === 'all' || f.status === statusFilter);
      if (!matchesFilters) return false;
      if (!query) return true;
      return [
        f.title ?? '',
        f.description ?? '',
        f.note_path ?? '',
        f.severity ?? '',
        f.status ?? '',
        f.mitre_technique_id ?? '',
        f.mitre_technique_name ?? '',
      ].some((value) => value.toLowerCase().includes(query));
    });
  });

  $effect(() => {
    if (workspaceId) {
      loadFindings();
      loadHosts();
    }
  });

  $effect(() => {
    loadMitreData();
  });

  async function handleImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !workspaceId) return;
    importing = true;
    importStatus = null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/workspaces/${workspaceId}/findings/import`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = (await res.json()) as { imported: number; skipped: number };
        importStatus = data;
        if (data.imported > 0) await loadFindings();
      } else {
        console.error('Failed to import findings:', { workspaceId, status: res.status });
      }
    } finally {
      importing = false;
      input.value = '';
    }
  }

  async function loadFindings(): Promise<void> {
    if (!workspaceId) return;
    findings = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/findings`);
      if (!res.ok) { console.error('Failed to load findings:', { workspaceId, status: res.status }); return; }
      findings = await res.json();
    } catch { console.error('Failed to load findings'); }
    finally { loading = false; }
  }

  async function loadHosts(): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`);
      if (!res.ok) { console.error('Failed to load hosts:', { workspaceId, status: res.status }); return; }
      const data = await res.json();
      hosts = (data as Array<{ id: string; ip: string; hostname: string }>).map((h) => ({
        id: h.id, ip: h.ip, hostname: h.hostname,
      }));
    } catch { console.error('Failed to load hosts'); }
  }

  async function loadMitreData(): Promise<void> {
    if (mitreData.length > 0) return;
    mitreLoading = true;
    try {
      const res = await fetch('/api/mitre');
      if (!res.ok) { console.error('Failed to fetch MITRE data:', res.status); return; }
      mitreData = await res.json();
    } catch (err) { console.error('Failed to fetch MITRE data:', err); }
    finally { mitreLoading = false; }
  }

  async function addFinding(data: FindingFormData): Promise<void> {
    if (!workspaceId || !data.title.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:                data.title.trim(),
          description:          data.description.trim(),
          severity:             data.severity,
          status:               data.status,
          cvss_score:           data.cvssScore,
          cvss_vector:          data.cvssVector,
          host_id:              data.hostId || null,
          note_path:            data.notePath.trim(),
          mitre_technique_id:   data.mitreTechId,
          mitre_technique_name: data.mitreTechName,
        }),
      });
      if (!res.ok) return;
      const finding: Finding = await res.json();
      findings = [finding, ...findings];
      addingFinding = false;
    } catch { console.error('Failed to add finding'); }
  }

  function startEdit(finding: Finding): void {
    editingId = finding.id;
    addingFinding = false;
  }

  async function saveEdit(id: string, data: FindingFormData): Promise<void> {
    if (!workspaceId || !data.title.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:                data.title.trim(),
          description:          data.description.trim(),
          severity:             data.severity,
          status:               data.status,
          cvss_score:           data.cvssScore,
          cvss_vector:          data.cvssVector,
          host_id:              data.hostId || null,
          note_path:            data.notePath.trim(),
          mitre_technique_id:   data.mitreTechId,
          mitre_technique_name: data.mitreTechName,
        }),
      });
      if (!res.ok) return;
      const updated: Finding = await res.json();
      findings = findings.map((f) => (f.id === id ? updated : f));
      editingId = null;
    } catch { console.error('Failed to update finding'); }
  }

  async function deleteFinding(id: string): Promise<void> {
    if (!workspaceId) return;
    deleteError = null;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/findings/${id}`, { method: 'DELETE' });
      if (!res.ok) { deleteError = 'Failed to delete finding. Please try again.'; return; }
      findings = findings.filter((f) => f.id !== id);
    } catch { deleteError = 'Failed to delete finding. Please try again.'; }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.key !== 'Escape') return;
    if (editingId) { e.preventDefault(); editingId = null; return; }
    if (addingFinding) { e.preventDefault(); addingFinding = false; return; }
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="flex h-full w-80 flex-shrink-0 flex-col border-l border-border bg-card"
  transition:fly={{ x: 320, duration: 200, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-9 flex-shrink-0 items-center justify-between border-b border-border px-3">
    <div class="flex items-center gap-2">
      <Bug size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Findings Tracker</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={loadFindings}
        title="Refresh"
        aria-label="Refresh findings"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => { addingFinding = true; editingId = null; }}
        title="Add finding"
        aria-label="Add finding"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      <!-- Hidden file input for scanner XML import -->
      <input
        bind:this={fileInputEl}
        type="file"
        accept=".nessus,.xml"
        class="hidden"
        onchange={handleImport}
      />
      <button
        title="Import from Nessus / Burp Suite XML"
        onclick={() => fileInputEl?.click()}
        disabled={importing}
        aria-label="Import findings from XML"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <Upload size={13} />
      </button>
      <button
        onclick={onClose}
        title="Close"
        aria-label="Close findings tracker"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={13} />
      </button>
    </div>
  </div>

  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center p-4">
      <p class="text-center text-xs text-muted-foreground">Select a workspace to view findings</p>
    </div>
  {:else}
    <!-- Dual filter bar -->
    <div class="flex-shrink-0 space-y-1.5 border-b border-border px-3 py-2">
      <!-- Severity filter chips -->
      <div class="flex flex-wrap gap-1">
        <button
          onclick={() => (severityFilter = 'all')}
          class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {severityFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}"
        >
          All
        </button>
        {#each SEVERITIES.filter(s => s.value !== 'none') as sev}
          <button
            onclick={() => (severityFilter = severityFilter === sev.value ? 'all' : sev.value)}
            class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {severityFilter === sev.value ? `bg-accent text-foreground` : `text-muted-foreground hover:bg-accent`}"
          >
            {sev.label}
          </button>
        {/each}
      </div>
      <!-- Status filter chips -->
      <div class="flex flex-wrap gap-1">
        <button
          onclick={() => (statusFilter = 'all')}
          class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}"
        >
          All
        </button>
        {#each STATUSES as st}
          <button
            onclick={() => (statusFilter = statusFilter === st.value ? 'all' : st.value)}
            class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {statusFilter === st.value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent'}"
          >
            {st.label}
          </button>
        {/each}
      </div>

      <div class="border-t border-border pt-1.5">
        <input
          type="text"
          placeholder="Search findings..."
          bind:value={findingQuery}
          aria-label="Search findings"
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>

    {#if importStatus}
      <div class="mx-2 mb-1 mt-1 rounded border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground">
        Imported {importStatus.imported} finding{importStatus.imported === 1 ? '' : 's'}{importStatus.skipped > 0 ? `, skipped ${importStatus.skipped} duplicate${importStatus.skipped === 1 ? '' : 's'}` : ''}.
      </div>
    {/if}
    {#if deleteError}
      <div
        class="mx-2 mb-1 mt-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {deleteError}
      </div>
    {/if}

    <!-- Scrollable content: add form + findings list -->
    <div class="flex-1 overflow-y-auto">

      <!-- Add-finding form -->
      {#if addingFinding}
        <div class="border-b border-border bg-muted/40 p-3">
          <FindingForm
            mode="add"
            {uiMode}
            {hosts}
            {mitreData}
            {mitreLoading}
            onSubmit={(data) => addFinding(data)}
            onCancel={() => (addingFinding = false)}
          />
        </div>
      {/if}

      <!-- Findings list -->
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <RefreshCw size={14} class="animate-spin text-muted-foreground" />
        </div>
      {:else if filteredFindings.length === 0}
        <div class="flex items-center justify-center py-8">
          <p class="text-center text-xs text-muted-foreground">
            {severityFilter !== 'all' || statusFilter !== 'all' || findingQuery.trim().length > 0
              ? 'No findings match the active filters or search'
              : 'No findings yet'}
          </p>
        </div>
      {:else}
        <ul class="divide-y divide-border">
          {#each filteredFindings as finding (finding.id)}
            <li class="group px-3 py-2.5">
              {#if editingId === finding.id}
                <FindingForm
                  mode="edit"
                  {uiMode}
                  {hosts}
                  {mitreData}
                  {mitreLoading}
                  initialTitle={finding.title}
                  initialDescription={finding.description}
                  initialSeverity={finding.severity}
                  initialStatus={finding.status}
                  initialHostId={finding.host_id ?? ''}
                  initialNotePath={finding.note_path}
                  initialCvssVector={finding.cvss_vector}
                  initialMitreTechId={finding.mitre_technique_id}
                  initialMitreTechName={finding.mitre_technique_name}
                  onSubmit={(data) => saveEdit(finding.id, data)}
                  onCancel={() => (editingId = null)}
                />
              {:else}
                <!-- Display row -->
                <div class="space-y-1">
                  <div class="flex items-start justify-between gap-1">
                    <div class="flex min-w-0 flex-wrap items-center gap-1">
                      <!-- Severity badge -->
                      <span
                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold {severityMeta[finding.severity]?.color ?? 'text-muted-foreground'} {severityMeta[finding.severity]?.bg ?? 'bg-muted'}"
                      >
                        {severityMeta[finding.severity]?.label ?? finding.severity}
                      </span>
                      <!-- Status chip -->
                      <span class="text-[10px] font-medium {statusMeta[finding.status]?.color ?? 'text-muted-foreground'}">
                        {statusMeta[finding.status]?.label ?? finding.status}
                      </span>
                    </div>
                    <div class="flex flex-shrink-0 items-center gap-0.5">
                      <button
                        onclick={() => startEdit(finding)}
                        title="Edit"
                        aria-label="Edit finding"
                        class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onclick={() => deleteFinding(finding.id)}
                        title="Delete"
                        aria-label="Delete finding"
                        class="flex h-5 w-5 items-center justify-center rounded text-destructive dark:text-red-400 hover:bg-destructive/20 hover:text-destructive focus-visible:outline-2 focus-visible:outline-destructive"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  <p class="text-xs font-medium text-foreground">{finding.title}</p>
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {#if finding.cvss_score > 0}
                      <span class="font-mono text-[10px] text-muted-foreground">
                        CVSS {finding.cvss_score.toFixed(1)}
                      </span>
                    {/if}
                    {#if finding.host_ip}
                      <span class="font-mono text-[10px] text-muted-foreground">
                        {finding.host_ip}{finding.host_hostname ? ` · ${finding.host_hostname}` : ''}
                      </span>
                    {/if}
                    {#if finding.note_path}
                      <span class="text-[10px] text-muted-foreground truncate max-w-[12rem]" title={finding.note_path}>
                        {finding.note_path.split('/').pop() ?? finding.note_path}
                      </span>
                    {/if}
                  </div>
                  {#if finding.mitre_technique_id}
                    <div class="flex items-center gap-1">
                      <Tag size={9} class="text-muted-foreground" />
                      <span class="font-mono text-[10px] font-semibold text-primary">{finding.mitre_technique_id}</span>
                      <span class="truncate text-[10px] text-muted-foreground">{finding.mitre_technique_name}</span>
                    </div>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

