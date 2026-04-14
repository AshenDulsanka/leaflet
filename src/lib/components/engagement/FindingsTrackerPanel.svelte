<script lang="ts">
  import { Bug, X, Plus, RefreshCw, Pencil, Trash2, Check, Tag, BookOpen, ChevronDown, Upload } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Select from '$lib/components/ui/Select.svelte';
  import { calculateCvss, METRIC_OPTIONS } from '$lib/data/cvss';
  import type { CvssMetrics } from '$lib/data/cvss';
  import { searchMitreTechniques } from '$lib/data/mitre-attack';
  import { FINDING_TEMPLATES, searchFindingTemplates } from '$lib/data/finding-templates';
  import type { Finding, FindingSeverity, FindingStatus, FindingTemplate, FindingTemplateCategory } from '$lib/types';

  interface HostOption {
    id: string;
    ip: string;
    hostname: string;
  }

  interface Props {
    workspaceId: string | null;
    onClose: () => void;
  }

  let { workspaceId, onClose }: Props = $props();

  let findings = $state<Finding[]>([]);
  let hosts = $state<HostOption[]>([]);
  let loading = $state(false);
  let addingFinding = $state(false);
  let importStatus = $state<{ imported: number; skipped: number } | null>(null);
  let importing = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  // ─── Add form state ────────────────────────────────────────────────────────
  let newTitle = $state('');
  let newDescription = $state('');
  let newSeverity = $state<FindingSeverity>('info');
  let newStatus = $state<FindingStatus>('open');
  let newHostId = $state('');
  let newNotePath = $state('');
  let newCvssScore = $state(0);
  let newCvssVector = $state('');
  let newMetrics = $state<CvssMetrics>({
    AV: null,
    AC: null,
    PR: null,
    UI: null,
    S: null,
    C: null,
    I: null,
    A: null,
  });
  // true = CVSS auto-fill controls severity; false = user manually overrode it
  let cvssAutoFilled = $state(true);

  // ─── Add form MITRE state ──────────────────────────────────────────────────
  let newMitreQuery    = $state('');
  let newMitreTechId   = $state('');
  let newMitreTechName = $state('');

  // ─── Template picker state ─────────────────────────────────────────────────
  let showTemplates    = $state(false);
  let templateQuery    = $state('');
  let templateCategory = $state<FindingTemplateCategory | 'all'>('all');

  // ─── Edit form state ───────────────────────────────────────────────────────
  let editingId = $state<string | null>(null);
  let editTitle = $state('');
  let editDescription = $state('');
  let editSeverity = $state<FindingSeverity>('info');
  let editStatus = $state<FindingStatus>('open');
  let editHostId = $state('');
  let editNotePath = $state('');
  let editCvssScore = $state(0);
  let editCvssVector = $state('');
  let editMetrics = $state<CvssMetrics>({
    AV: null,
    AC: null,
    PR: null,
    UI: null,
    S: null,
    C: null,
    I: null,
    A: null,
  });
  // false on edit start so stored severity is preserved; true again once CVSS auto-fills
  let editCvssAutoFilled = $state(false);

  // ─── Edit form MITRE state ─────────────────────────────────────────────────
  let editMitreQuery    = $state('');
  let editMitreTechId   = $state('');
  let editMitreTechName = $state('');

  // ─── Filters ───────────────────────────────────────────────────────────────
  let severityFilter = $state<'all' | FindingSeverity>('all');
  let statusFilter = $state<'all' | FindingStatus>('all');

  // ─── Constants ─────────────────────────────────────────────────────────────
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

  const TEMPLATE_CATEGORIES: { value: FindingTemplateCategory | 'all'; label: string }[] = [
    { value: 'all',       label: 'All'       },
    { value: 'injection', label: 'Injection' },
    { value: 'auth',      label: 'Auth'      },
    { value: 'crypto',    label: 'Crypto'    },
    { value: 'exposure',  label: 'Exposure'  },
    { value: 'misc',      label: 'Misc'      },
  ];

  // ─── Derived ───────────────────────────────────────────────────────────────
  const newCvssResult  = $derived(calculateCvss(newMetrics));
  const editCvssResult = $derived(calculateCvss(editMetrics));

  // Suppress suggestions once a technique is selected (newMitreTechId non-empty)
  const newMitreSuggestions  = $derived(newMitreTechId  ? [] : searchMitreTechniques(newMitreQuery));
  const editMitreSuggestions = $derived(editMitreTechId ? [] : searchMitreTechniques(editMitreQuery));

  const filteredFindings = $derived(
    findings.filter(
      (f) =>
        (severityFilter === 'all' || f.severity === severityFilter) &&
        (statusFilter   === 'all' || f.status   === statusFilter)
    )
  );

  const filteredTemplates = $derived.by(() => {
    let list = FINDING_TEMPLATES;
    if (templateCategory !== 'all') {
      list = list.filter((tmpl) => tmpl.category === templateCategory);
    }
    return searchFindingTemplates(templateQuery, list);
  });

  // ─── CVSS auto-fill effects ────────────────────────────────────────────────
  $effect(() => {
    const result = newCvssResult;
    if (result) {
      newCvssScore  = result.score;
      newCvssVector = result.vector;
      if (cvssAutoFilled) {
        newSeverity = scoreToFindingSeverity(result.score);
      }
    }
  });

  $effect(() => {
    const result = editCvssResult;
    if (result) {
      editCvssScore  = result.score;
      editCvssVector = result.vector;
      if (editCvssAutoFilled) {
        editSeverity = scoreToFindingSeverity(result.score);
      }
    }
  });

  // ─── Load on workspaceId change ────────────────────────────────────────────
  $effect(() => {
    if (workspaceId) {
      loadFindings();
      loadHosts();
    }
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function scoreToFindingSeverity(score: number): FindingSeverity {
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    if (score > 0)    return 'low';
    return 'none';
  }

  function parseCvssVector(vector: string): CvssMetrics {
    const empty: CvssMetrics = {
      AV: null, AC: null, PR: null, UI: null,
      S: null, C: null, I: null, A: null,
    };
    if (!vector.startsWith('CVSS:3.1/')) return empty;
    const map: Record<string, string> = {};
    for (const part of vector.slice('CVSS:3.1/'.length).split('/')) {
      const idx = part.indexOf(':');
      if (idx > -1) map[part.slice(0, idx)] = part.slice(idx + 1);
    }
    return {
      AV: (map['AV'] as CvssMetrics['AV'])   ?? null,
      AC: (map['AC'] as CvssMetrics['AC'])   ?? null,
      PR: (map['PR'] as CvssMetrics['PR'])   ?? null,
      UI: (map['UI'] as CvssMetrics['UI'])   ?? null,
      S:  (map['S']  as CvssMetrics['S'])    ?? null,
      C:  (map['C']  as CvssMetrics['C'])    ?? null,
      I:  (map['I']  as CvssMetrics['I'])    ?? null,
      A:  (map['A']  as CvssMetrics['A'])    ?? null,
    };
  }

  // ─── Import ────────────────────────────────────────────────────────────────
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
      }
    } finally {
      importing = false;
      input.value = '';
    }
  }

  // ─── Data fetching ─────────────────────────────────────────────────────────
  async function loadFindings(): Promise<void> {
    if (!workspaceId) return;
    findings = [];
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/findings`);
      findings = await res.json();
    } catch {
      console.error('Failed to load findings');
    } finally {
      loading = false;
    }
  }

  async function loadHosts(): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts`);
      const data = await res.json();
      hosts = (data as Array<{ id: string; ip: string; hostname: string }>).map((h) => ({
        id: h.id,
        ip: h.ip,
        hostname: h.hostname,
      }));
    } catch {
      console.error('Failed to load hosts');
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  function openAddForm(): void {
    addingFinding = true;
    editingId = null;
  }

  function resetAddForm(): void {
    newTitle       = '';
    newDescription = '';
    newSeverity    = 'info';
    newStatus      = 'open';
    newHostId      = '';
    newNotePath    = '';
    newCvssScore   = 0;
    newCvssVector  = '';
    newMetrics     = { AV: null, AC: null, PR: null, UI: null, S: null, C: null, I: null, A: null };
    cvssAutoFilled = true;
    newMitreQuery    = '';
    newMitreTechId   = '';
    newMitreTechName = '';
    showTemplates    = false;
    templateQuery    = '';
    templateCategory = 'all';
    addingFinding  = false;
  }

  function applyTemplate(template: FindingTemplate): void {
    newTitle         = template.title;
    newDescription   = template.description;
    newSeverity      = template.severity;
    newMitreTechId   = template.mitre_technique_id;
    newMitreTechName = template.mitre_technique_name;
    newMitreQuery    = '';
    cvssAutoFilled   = false;
    showTemplates    = false;
    templateQuery    = '';
  }

  async function addFinding(): Promise<void> {
    if (!workspaceId || !newTitle.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:                newTitle.trim(),
          description:          newDescription.trim(),
          severity:             newSeverity,
          status:               newStatus,
          cvss_score:           newCvssScore,
          cvss_vector:          newCvssVector,
          host_id:              newHostId || null,
          note_path:            newNotePath.trim(),
          mitre_technique_id:   newMitreTechId,
          mitre_technique_name: newMitreTechName,
        }),
      });
      if (!res.ok) return;
      const finding: Finding = await res.json();
      findings = [finding, ...findings];
      resetAddForm();
    } catch {
      console.error('Failed to add finding');
    }
  }

  function startEdit(finding: Finding): void {
    editingId        = finding.id;
    editTitle        = finding.title;
    editDescription  = finding.description;
    editSeverity     = finding.severity;
    editStatus       = finding.status;
    editHostId       = finding.host_id ?? '';
    editNotePath     = finding.note_path;
    editCvssScore    = finding.cvss_score;
    editCvssVector   = finding.cvss_vector;
    // Parse stored vector back to metric pickers; disable auto-fill to preserve stored severity
    editMetrics      = parseCvssVector(finding.cvss_vector);
    editCvssAutoFilled = false;
    editMitreTechId   = finding.mitre_technique_id;
    editMitreTechName = finding.mitre_technique_name;
    editMitreQuery    = '';
    addingFinding    = false;
  }

  async function saveEdit(id: string): Promise<void> {
    if (!workspaceId || !editTitle.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:                editTitle.trim(),
          description:          editDescription.trim(),
          severity:             editSeverity,
          status:               editStatus,
          cvss_score:           editCvssScore,
          cvss_vector:          editCvssVector,
          host_id:              editHostId || null,
          note_path:            editNotePath.trim(),
          mitre_technique_id:   editMitreTechId,
          mitre_technique_name: editMitreTechName,
        }),
      });
      if (!res.ok) return;
      const updated: Finding = await res.json();
      findings = findings.map((f) => (f.id === id ? updated : f));
      editingId = null;
    } catch {
      console.error('Failed to update finding');
    }
  }

  async function deleteFinding(id: string): Promise<void> {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/findings/${id}`, { method: 'DELETE' });
    findings = findings.filter((f) => f.id !== id);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (editingId)    { editingId = null; return; }
      if (addingFinding){ resetAddForm(); return; }
      onClose();
    }
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
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={openAddForm}
        title="Add finding"
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
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <Upload size={13} />
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
    </div>

    {#if importStatus}
      <div class="mx-2 mb-1 mt-1 rounded border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground">
        Imported {importStatus.imported} finding{importStatus.imported === 1 ? '' : 's'}{importStatus.skipped > 0 ? `, skipped ${importStatus.skipped} duplicate${importStatus.skipped === 1 ? '' : 's'}` : ''}.
      </div>
    {/if}

    <!-- Scrollable content: add form + findings list -->
    <div class="flex-1 overflow-y-auto">

      <!-- Add-finding form -->
      {#if addingFinding}
        <div class="space-y-2 border-b border-border bg-muted/40 p-3">
          <!-- Template picker (collapsible) -->
          <div class="rounded border border-border bg-background">
            <button
              type="button"
              onclick={() => { showTemplates = !showTemplates; templateQuery = ''; templateCategory = 'all'; }}
              class="flex w-full items-center justify-between px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span class="flex items-center gap-1.5">
                <BookOpen size={11} />
                Use Template
              </span>
              <ChevronDown
                size={11}
                class="transition-transform duration-150 {showTemplates ? 'rotate-180' : ''}"
              />
            </button>

            {#if showTemplates}
              <div class="border-t border-border px-2 py-1.5">
                <input
                  type="text"
                  placeholder="Search templates..."
                  bind:value={templateQuery}
                  class="w-full rounded border border-border bg-muted px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
              <div class="flex gap-1 overflow-x-auto px-2 pb-1.5">
                {#each TEMPLATE_CATEGORIES as cat (cat.value)}
                  <button
                    type="button"
                    onclick={() => (templateCategory = cat.value)}
                    class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {templateCategory === cat.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'}"
                  >
                    {cat.label}
                  </button>
                {/each}
              </div>
              <ul class="max-h-44 overflow-y-auto border-t border-border">
                {#if filteredTemplates.length === 0}
                  <li class="px-2 py-3 text-center text-[10px] text-muted-foreground">No templates match</li>
                {:else}
                  {#each filteredTemplates as tpl (tpl.id)}
                    <li>
                      <button
                        type="button"
                        onclick={() => applyTemplate(tpl)}
                        class="flex w-full flex-col gap-0.5 px-2 py-1.5 text-left hover:bg-accent"
                      >
                        <span class="text-xs font-medium text-foreground">{tpl.title}</span>
                        <span class="line-clamp-1 text-[10px] text-muted-foreground">{tpl.description}</span>
                      </button>
                    </li>
                  {/each}
                {/if}
              </ul>
            {/if}
          </div>

          <!-- Title -->
          <input
            type="text"
            placeholder="Finding title (required)"
            bind:value={newTitle}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <!-- Description -->
          <textarea
            placeholder="Description (optional)"
            bind:value={newDescription}
            rows={2}
            class="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          ></textarea>

          <!-- CVSS Metric Pickers -->
          <div class="space-y-1.5 rounded border border-border bg-background p-2">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              CVSS 3.1 Metrics
            </p>
            {#each METRIC_OPTIONS as metric (metric.key)}
              <div>
                <p class="mb-1 text-[10px] text-muted-foreground">{metric.label}</p>
                <div class="flex flex-wrap gap-1">
                  {#each metric.options as opt (opt.value)}
                    <button
                      type="button"
                      onclick={() => { newMetrics = { ...newMetrics, [metric.key]: opt.value }; }}
                      class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {newMetrics[metric.key] === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'}"
                    >
                      {opt.abbr} – {opt.label}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
            <!-- Live score display -->
            {#if newCvssResult}
              <div class="mt-1 flex items-center gap-2">
                <span class="text-sm font-bold tabular-nums">{newCvssResult.score.toFixed(1)}</span>
                <span class="text-[10px] text-muted-foreground">/ 10.0 · {newCvssResult.severity}</span>
              </div>
            {:else if newCvssScore > 0}
              <div class="mt-1 flex items-center gap-2">
                <span class="text-sm font-bold tabular-nums">{newCvssScore.toFixed(1)}</span>
                <span class="text-[10px] text-muted-foreground">/ 10.0</span>
              </div>
            {/if}
          </div>

          <!-- Severity + Status row -->
          <div class="flex gap-2">
            <Select
              size="sm"
              value={newSeverity}
              onchange={(v) => {
                newSeverity = v as FindingSeverity;
                cvssAutoFilled = false;
              }}
              class="flex-1"
              options={SEVERITIES.map((sev) => ({ value: sev.value, label: sev.label }))}
            />
            <Select
              size="sm"
              value={newStatus}
              onchange={(v) => (newStatus = v as FindingStatus)}
              class="flex-1"
              options={STATUSES.map((st) => ({ value: st.value, label: st.label }))}
            />
          </div>

          <!-- Host dropdown -->
          <Select
            size="sm"
            value={newHostId}
            onchange={(v) => (newHostId = v)}
            class="w-full"
            options={[
              { value: '', label: 'No host' },
              ...hosts.map((h) => ({
                value: h.id,
                label: h.hostname ? `${h.ip} (${h.hostname})` : h.ip
              }))
            ]}
          />

          <!-- Note path -->
          <input
            type="text"
            placeholder="Note path (optional)"
            bind:value={newNotePath}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <!-- MITRE ATT&CK technique -->
          <div class="relative">
            {#if newMitreTechId}
              <div class="flex items-center justify-between rounded border border-border bg-background px-2 py-1">
                <div class="flex min-w-0 flex-col">
                  <span class="font-mono text-[10px] font-semibold text-primary">{newMitreTechId}</span>
                  <span class="truncate text-[10px] text-muted-foreground">{newMitreTechName}</span>
                </div>
                <button
                  type="button"
                  onclick={() => { newMitreTechId = ''; newMitreTechName = ''; newMitreQuery = ''; }}
                  class="ml-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
                  title="Remove MITRE tag"
                >
                  <X size={10} />
                </button>
              </div>
            {:else}
              <input
                type="text"
                placeholder="Search MITRE ATT&CK technique..."
                bind:value={newMitreQuery}
                class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {#if newMitreSuggestions.length > 0}
                <ul class="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-y-auto rounded border border-border bg-popover shadow-md">
                  {#each newMitreSuggestions as technique (technique.id)}
                    <li>
                      <button
                        type="button"
                        onclick={() => { newMitreTechId = technique.id; newMitreTechName = technique.name; newMitreQuery = ''; }}
                        class="flex w-full flex-col px-2 py-1.5 text-left hover:bg-accent"
                      >
                        <span class="font-mono text-[10px] font-semibold text-primary">{technique.id}</span>
                        <span class="text-[10px] text-foreground">{technique.name}</span>
                        <span class="text-[10px] text-muted-foreground">{technique.tactic}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            {/if}
          </div>

          <div class="flex gap-2">
            <button
              onclick={addFinding}
              class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add finding
            </button>
            <button
              onclick={resetAddForm}
              class="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
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
            {severityFilter !== 'all' || statusFilter !== 'all'
              ? 'No findings match the active filters'
              : 'No findings yet'}
          </p>
        </div>
      {:else}
        <ul class="divide-y divide-border">
          {#each filteredFindings as finding (finding.id)}
            <li class="group px-3 py-2.5">
              {#if editingId === finding.id}
                <!-- Inline edit form -->
                <div class="space-y-1.5">
                  <input
                    type="text"
                    bind:value={editTitle}
                    placeholder="Finding title"
                    class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <textarea
                    bind:value={editDescription}
                    rows={2}
                    class="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  ></textarea>

                  <!-- Edit CVSS Metric Pickers -->
                  <div class="space-y-1.5 rounded border border-border bg-background p-2">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      CVSS 3.1 Metrics
                    </p>
                    {#each METRIC_OPTIONS as metric (metric.key)}
                      <div>
                        <p class="mb-1 text-[10px] text-muted-foreground">{metric.label}</p>
                        <div class="flex flex-wrap gap-1">
                          {#each metric.options as opt (opt.value)}
                            <button
                              type="button"
                              onclick={() => {
                                editMetrics = { ...editMetrics, [metric.key]: opt.value };
                                editCvssAutoFilled = true;
                              }}
                              class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {editMetrics[metric.key] === opt.value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-accent'}"
                            >
                              {opt.abbr} – {opt.label}
                            </button>
                          {/each}
                        </div>
                      </div>
                    {/each}
                    {#if editCvssResult}
                      <div class="mt-1 flex items-center gap-2">
                        <span class="text-sm font-bold tabular-nums">{editCvssResult.score.toFixed(1)}</span>
                        <span class="text-[10px] text-muted-foreground">/ 10.0 · {editCvssResult.severity}</span>
                      </div>
                    {:else if editCvssScore > 0}
                      <div class="mt-1 flex items-center gap-2">
                        <span class="text-sm font-bold tabular-nums">{editCvssScore.toFixed(1)}</span>
                        <span class="text-[10px] text-muted-foreground">/ 10.0</span>
                      </div>
                    {/if}
                  </div>

                  <div class="flex gap-1.5">
                    <Select
                      size="xs"
                      value={editSeverity}
                      onchange={(v) => {
                        editSeverity = v as FindingSeverity;
                        editCvssAutoFilled = false;
                      }}
                      class="flex-1"
                      options={SEVERITIES.map((sev) => ({ value: sev.value, label: sev.label }))}
                    />
                    <Select
                      size="xs"
                      value={editStatus}
                      onchange={(v) => (editStatus = v as FindingStatus)}
                      class="flex-1"
                      options={STATUSES.map((st) => ({ value: st.value, label: st.label }))}
                    />
                  </div>
                  <Select
                    size="xs"
                    value={editHostId}
                    onchange={(v) => (editHostId = v)}
                    class="w-full"
                    options={[
                      { value: '', label: 'No host' },
                      ...hosts.map((h) => ({
                        value: h.id,
                        label: h.hostname ? `${h.ip} (${h.hostname})` : h.ip
                      }))
                    ]}
                  />
                  <input
                    type="text"
                    bind:value={editNotePath}
                    placeholder="Note path"
                    class="w-full rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  <!-- MITRE ATT&CK technique (edit) -->
                  <div class="relative">
                    {#if editMitreTechId}
                      <div class="flex items-center justify-between rounded border border-border bg-background px-2 py-1">
                        <div class="flex min-w-0 flex-col">
                          <span class="font-mono text-[10px] font-semibold text-primary">{editMitreTechId}</span>
                          <span class="truncate text-[10px] text-muted-foreground">{editMitreTechName}</span>
                        </div>
                        <button
                          type="button"
                          onclick={() => { editMitreTechId = ''; editMitreTechName = ''; editMitreQuery = ''; }}
                          class="ml-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
                          title="Remove MITRE tag"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    {:else}
                      <input
                        type="text"
                        placeholder="Search MITRE ATT&CK technique..."
                        bind:value={editMitreQuery}
                        class="w-full rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {#if editMitreSuggestions.length > 0}
                        <ul class="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-y-auto rounded border border-border bg-popover shadow-md">
                          {#each editMitreSuggestions as technique (technique.id)}
                            <li>
                              <button
                                type="button"
                                onclick={() => { editMitreTechId = technique.id; editMitreTechName = technique.name; editMitreQuery = ''; }}
                                class="flex w-full flex-col px-2 py-1.5 text-left hover:bg-accent"
                              >
                                <span class="font-mono text-[10px] font-semibold text-primary">{technique.id}</span>
                                <span class="text-[10px] text-foreground">{technique.name}</span>
                                <span class="text-[10px] text-muted-foreground">{technique.tactic}</span>
                              </button>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                    {/if}
                  </div>

                  <div class="flex gap-1.5">
                    <button
                      onclick={() => saveEdit(finding.id)}
                      class="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      <Check size={10} /> Save
                    </button>
                    <button
                      onclick={() => (editingId = null)}
                      class="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
                        class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onclick={() => deleteFinding(finding.id)}
                        title="Delete"
                        class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
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
