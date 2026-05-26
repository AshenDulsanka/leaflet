<script lang="ts">
  import { X, BookOpen, ChevronDown } from '@lucide/svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import { calculateCvss, METRIC_OPTIONS } from '$lib/data/cvss';
  import type { CvssMetrics } from '$lib/data/cvss';
  import { FINDING_TEMPLATES, searchFindingTemplates } from '$lib/data/finding-templates';
  import type { Finding, FindingSeverity, FindingStatus, FindingTemplate, FindingTemplateCategory } from '$lib/types';

  interface MitreTechnique {
    external_id: string;
    name: string;
    tactic: string;
    description: string;
    url: string;
  }

  interface HostOption {
    id: string;
    ip: string;
    hostname: string;
  }

  interface Props {
    /** 'add' = new finding; 'edit' = editing existing */
    mode: 'add' | 'edit';
    uiMode?: 'modal' | 'inline';
    hosts: HostOption[];
    mitreData: MitreTechnique[];
    mitreLoading: boolean;
    /** Initial values (used for edit mode) */
    initialTitle?: string;
    initialDescription?: string;
    initialSeverity?: FindingSeverity;
    initialStatus?: FindingStatus;
    initialHostId?: string;
    initialNotePath?: string;
    initialCvssVector?: string;
    initialMitreTechId?: string;
    initialMitreTechName?: string;
    onSubmit: (data: FindingFormData) => void;
    onCancel: () => void;
  }

  export interface FindingFormData {
    title: string;
    description: string;
    severity: FindingSeverity;
    status: FindingStatus;
    hostId: string;
    notePath: string;
    cvssScore: number;
    cvssVector: string;
    mitreTechId: string;
    mitreTechName: string;
  }

  const SEVERITIES: { value: FindingSeverity; label: string }[] = [
    { value: 'critical', label: 'Critical' },
    { value: 'high',     label: 'High'     },
    { value: 'medium',   label: 'Medium'   },
    { value: 'low',      label: 'Low'      },
    { value: 'info',     label: 'Info'     },
    { value: 'none',     label: 'None'     },
  ];

  const STATUSES: { value: FindingStatus; label: string }[] = [
    { value: 'open',           label: 'Open'          },
    { value: 'confirmed',      label: 'Confirmed'     },
    { value: 'remediated',     label: 'Remediated'    },
    { value: 'false-positive', label: 'False Positive'},
  ];

  const TEMPLATE_CATEGORIES: { value: FindingTemplateCategory | 'all'; label: string }[] = [
    { value: 'all',       label: 'All'       },
    { value: 'injection', label: 'Injection' },
    { value: 'auth',      label: 'Auth'      },
    { value: 'crypto',    label: 'Crypto'    },
    { value: 'exposure',  label: 'Exposure'  },
    { value: 'misc',      label: 'Misc'      },
  ];

  let {
    mode,
    uiMode = 'modal',
    hosts,
    mitreData,
    mitreLoading,
    initialTitle = '',
    initialDescription = '',
    initialSeverity = 'info',
    initialStatus = 'open',
    initialHostId = '',
    initialNotePath = '',
    initialCvssVector = '',
    initialMitreTechId = '',
    initialMitreTechName = '',
    onSubmit,
    onCancel,
  }: Props = $props();

  let title = $state(initialTitle);
  let description = $state(initialDescription);
  let severity = $state<FindingSeverity>(initialSeverity);
  let status = $state<FindingStatus>(initialStatus);
  let hostId = $state(initialHostId);
  let notePath = $state(initialNotePath);
  let cvssScore = $state(0);
  let cvssVector = $state(initialCvssVector);
  let metrics = $state<CvssMetrics>(parseCvssVector(initialCvssVector));
  // For add mode auto-fill: true = CVSS controls severity; for edit mode: start false to preserve stored severity
  let cvssAutoFilled = $state(mode === 'add');
  let mitreQuery = $state('');
  let mitreTechId = $state(initialMitreTechId);
  let mitreTechName = $state(initialMitreTechName);

  // Template picker (add mode only)
  let showTemplates = $state(false);
  let templateQuery = $state('');
  let templateCategory = $state<FindingTemplateCategory | 'all'>('all');

  const cvssResult = $derived(calculateCvss(metrics));

  const mitreSuggestions = $derived(
    mitreTechId || !mitreQuery.trim()
      ? []
      : mitreData
          .filter((t) => {
            const q = mitreQuery.toLowerCase();
            return (
              t.external_id.toLowerCase().includes(q) ||
              t.name.toLowerCase().includes(q) ||
              t.tactic.toLowerCase().includes(q)
            );
          })
          .slice(0, 10)
  );

  const filteredTemplates = $derived.by(() => {
    let list = FINDING_TEMPLATES;
    if (templateCategory !== 'all') {
      list = list.filter((t) => t.category === templateCategory);
    }
    return searchFindingTemplates(templateQuery, list);
  });

  $effect(() => {
    const result = cvssResult;
    if (result) {
      cvssScore = result.score;
      cvssVector = result.vector;
      if (cvssAutoFilled) {
        severity = scoreToSeverity(result.score);
      }
    }
  });

  function scoreToSeverity(score: number): FindingSeverity {
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    if (score > 0)    return 'low';
    return 'none';
  }

  function parseCvssVector(vector: string): CvssMetrics {
    const empty: CvssMetrics = { AV: null, AC: null, PR: null, UI: null, S: null, C: null, I: null, A: null };
    if (!vector.startsWith('CVSS:3.1/')) return empty;
    const map: Record<string, string> = {};
    for (const part of vector.slice('CVSS:3.1/'.length).split('/')) {
      const idx = part.indexOf(':');
      if (idx > -1) map[part.slice(0, idx)] = part.slice(idx + 1);
    }
    return {
      AV: (map['AV'] as CvssMetrics['AV']) ?? null,
      AC: (map['AC'] as CvssMetrics['AC']) ?? null,
      PR: (map['PR'] as CvssMetrics['PR']) ?? null,
      UI: (map['UI'] as CvssMetrics['UI']) ?? null,
      S:  (map['S']  as CvssMetrics['S'])  ?? null,
      C:  (map['C']  as CvssMetrics['C'])  ?? null,
      I:  (map['I']  as CvssMetrics['I'])  ?? null,
      A:  (map['A']  as CvssMetrics['A'])  ?? null,
    };
  }

  function applyTemplate(template: FindingTemplate): void {
    title         = template.title;
    description   = template.description;
    severity      = template.severity;
    mitreTechId   = template.mitre_technique_id;
    mitreTechName = template.mitre_technique_name;
    mitreQuery    = '';
    cvssAutoFilled = false;
    showTemplates  = false;
    templateQuery  = '';
  }

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      severity,
      status,
      hostId,
      notePath: notePath.trim(),
      cvssScore,
      cvssVector,
      mitreTechId,
      mitreTechName,
    });
  }

  const isModal = uiMode === 'modal';
  const inputClass = isModal
    ? 'w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'
    : 'w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
  const textareaClass = isModal
    ? 'w-full resize-none rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'
    : 'w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
  const selectSize = isModal ? 'sm' : 'xs';
  const labelClass = isModal ? 'text-xs text-muted-foreground' : 'text-[10px] text-muted-foreground';
</script>

{#snippet formBody()}
  <!-- Template picker (add mode only) -->
  {#if mode === 'add'}
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
        <ChevronDown size={11} class="transition-transform duration-150 {showTemplates ? 'rotate-180' : ''}" />
      </button>
      {#if showTemplates}
        <div class="border-t border-border px-2 py-1.5">
          <input
            type="text"
            placeholder="Search templates..."
            bind:value={templateQuery}
            class={inputClass}
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="flex gap-1 overflow-x-auto px-2 pb-1.5">
          {#each TEMPLATE_CATEGORIES as cat (cat.value)}
            <button
              type="button"
              onclick={() => (templateCategory = cat.value)}
              class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {templateCategory === cat.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}"
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
  {/if}

  <!-- Title -->
  <input
    type="text"
    placeholder="Finding title (required)"
    bind:value={title}
    class={inputClass}
    onkeydown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
  />

  <!-- Description -->
  <textarea
    placeholder="Description (optional)"
    bind:value={description}
    rows={2}
    class={textareaClass}
  ></textarea>

  <!-- CVSS Metric Pickers -->
  <div class="space-y-1.5 rounded border border-border bg-background p-2">
    <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">CVSS 3.1 Metrics</p>
    {#each METRIC_OPTIONS as metric (metric.key)}
      <div>
        <p class="mb-1 text-[10px] text-muted-foreground">{metric.label}</p>
        <div class="flex flex-wrap gap-1">
          {#each metric.options as opt (opt.value)}
            <button
              type="button"
              onclick={() => { metrics = { ...metrics, [metric.key]: opt.value }; if (mode === 'edit') cvssAutoFilled = true; }}
              class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {metrics[metric.key] === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}"
            >
              {opt.abbr} – {opt.label}
            </button>
          {/each}
        </div>
      </div>
    {/each}
    {#if cvssResult}
      <div class="mt-1 flex items-center gap-2">
        <span class="text-sm font-bold tabular-nums">{cvssResult.score.toFixed(1)}</span>
        <span class="text-[10px] text-muted-foreground">/ 10.0 · {cvssResult.severity}</span>
      </div>
    {:else if cvssScore > 0}
      <div class="mt-1 flex items-center gap-2">
        <span class="text-sm font-bold tabular-nums">{cvssScore.toFixed(1)}</span>
        <span class="text-[10px] text-muted-foreground">/ 10.0</span>
      </div>
    {/if}
  </div>

  <!-- Severity + Status row -->
  <div class="flex gap-2">
    <Select
      size={selectSize}
      value={severity}
      onchange={(v) => { severity = v as FindingSeverity; cvssAutoFilled = false; }}
      class="flex-1"
      options={SEVERITIES.map((s) => ({ value: s.value, label: s.label }))}
    />
    <Select
      size={selectSize}
      value={status}
      onchange={(v) => (status = v as FindingStatus)}
      class="flex-1"
      options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
    />
  </div>

  <!-- Host dropdown -->
  <Select
    size={selectSize}
    value={hostId}
    onchange={(v) => (hostId = v)}
    class="w-full"
    options={[
      { value: '', label: 'No host' },
      ...hosts.map((h) => ({ value: h.id, label: h.hostname ? `${h.ip} (${h.hostname})` : h.ip }))
    ]}
  />

  <!-- Note path -->
  <input
    type="text"
    placeholder="Note path (optional)"
    bind:value={notePath}
    class={inputClass}
  />

  <!-- MITRE ATT&CK technique -->
  <div class="relative">
    {#if mitreTechId}
      <div class="flex items-center justify-between rounded border border-border bg-background px-2 py-1">
        <div class="flex min-w-0 flex-col">
          <span class="font-mono text-[10px] font-semibold text-primary">{mitreTechId}</span>
          <span class="truncate text-[10px] text-muted-foreground">{mitreTechName}</span>
        </div>
        <button
          type="button"
          onclick={() => { mitreTechId = ''; mitreTechName = ''; mitreQuery = ''; }}
          class="ml-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
          title="Remove MITRE tag"
          aria-label="Remove MITRE tag"
        >
          <X size={10} />
        </button>
      </div>
    {:else}
      <input
        type="text"
        placeholder={mitreLoading ? 'Loading MITRE data...' : mitreData.length === 0 ? 'No MITRE data' : 'Search MITRE ATT&CK technique...'}
        bind:value={mitreQuery}
        disabled={mitreLoading}
        class="{inputClass} disabled:opacity-60"
      />
      {#if mitreSuggestions.length > 0}
        <ul class="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-y-auto rounded border border-border bg-popover shadow-md">
          {#each mitreSuggestions as technique (technique.external_id)}
            <li>
              <button
                type="button"
                onclick={() => { mitreTechId = technique.external_id; mitreTechName = technique.name; mitreQuery = ''; }}
                class="flex w-full flex-col px-2 py-1.5 text-left hover:bg-accent"
              >
                <span class="font-mono text-[10px] font-semibold text-primary">{technique.external_id}</span>
                <span class="text-[10px] text-foreground">{technique.name}</span>
                <span class="text-[10px] text-muted-foreground">{technique.tactic}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
{/snippet}

{#if uiMode === 'inline'}
  <div class="space-y-1.5">
    {@render formBody()}
    <div class="flex gap-1.5 pt-1">
      <button
        onclick={handleSubmit}
        class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        {mode === 'add' ? 'Add finding' : 'Save'}
      </button>
      <button
        onclick={onCancel}
        class="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  </div>
{:else}
  <ToolModal ariaLabel={mode === 'add' ? 'Add Finding' : 'Edit Finding'} onClose={onCancel} dialogClass="overflow-hidden">
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <h2 class="flex-1 text-sm font-semibold">{mode === 'add' ? 'Add Finding' : 'Edit Finding'}</h2>
      <button onclick={onCancel} aria-label="Close" class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"><X size={14} /></button>
    </div>
    <div class="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
      {@render formBody()}
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3">
      <button
        onclick={handleSubmit}
        class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {mode === 'add' ? 'Add Finding' : 'Save Changes'}
      </button>
      <button
        onclick={onCancel}
        class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  </ToolModal>
{/if}
