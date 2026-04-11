<script lang="ts">
  import { ShieldAlert, X, RotateCcw, ArrowDownToLine } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import CopyButton from '$lib/components/ui/CopyButton.svelte';
  import { calculateCvss, formatCvssInsert, METRIC_OPTIONS } from '$lib/data/cvss';
  import type { CvssMetrics, CvssSeverity } from '$lib/data/cvss';

  interface Props {
    onClose: () => void;
    onInsert: (text: string) => void;
  }

  let { onClose, onInsert }: Props = $props();

  let metrics = $state<CvssMetrics>({
    AV: null,
    AC: null,
    PR: null,
    UI: null,
    S: null,
    C: null,
    I: null,
    A: null,
  });

  // calculateCvss accepts CvssMetrics and returns null when any field is null.
  const result = $derived(calculateCvss(metrics));

  const SEVERITY_CLASSES: Record<CvssSeverity, string> = {
    Critical: 'text-red-400 bg-red-400/10 border border-red-400/20',
    High: 'text-orange-400 bg-orange-400/10 border border-orange-400/20',
    Medium: 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20',
    Low: 'text-blue-400 bg-blue-400/10 border border-blue-400/20',
    None: 'text-muted-foreground bg-muted',
  };

  function reset(): void {
    metrics = {
      AV: null,
      AC: null,
      PR: null,
      UI: null,
      S: null,
      C: null,
      I: null,
      A: null,
    };
  }

  function handleInsert(): void {
    if (!result) return;
    onInsert(formatCvssInsert(result));
    onClose();
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
      <ShieldAlert size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">CVSS 3.1 Calculator</span>
    </div>
    <button
      onclick={onClose}
      title="Close"
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <X size={13} />
    </button>
  </div>

  <!-- Metric pickers -->
  <div class="flex-1 overflow-y-auto">
    <div class="space-y-3 p-3">
      {#each METRIC_OPTIONS as metric (metric.key)}
        <div>
          <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <div class="flex flex-wrap gap-1">
            {#each metric.options as opt (opt.value)}
              <button
                type="button"
                onclick={() => {
                  metrics = { ...metrics, [metric.key]: opt.value };
                }}
                class="rounded px-2 py-1 text-xs font-medium transition-colors {metrics[metric.key] === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
                title="{opt.label} ({opt.value})"
              >
                {opt.abbr} - {opt.label}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Score section (only shown when all metrics are selected) -->
    {#if result}
      <div class="border-t border-border p-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold tabular-nums text-foreground">
              {result.score.toFixed(1)}
            </span>
            <span class="text-xs text-muted-foreground">/ 10.0</span>
          </div>
          <span class="rounded px-2 py-0.5 text-xs font-semibold {SEVERITY_CLASSES[result.severity]}">
            {result.severity}
          </span>
        </div>
        <div class="flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-1.5">
          <code class="flex-1 break-all text-[10px] text-muted-foreground">{result.vector}</code>
          <CopyButton text={result.vector} size={11} />
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="flex items-center justify-between border-t border-border px-3 py-2">
    <button
      type="button"
      onclick={reset}
      class="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      title="Reset all metrics"
    >
      <RotateCcw size={11} />
      Reset
    </button>
    <button
      type="button"
      onclick={handleInsert}
      disabled={!result}
      class="flex items-center gap-1.5 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      title="Insert vector into note"
    >
      <ArrowDownToLine size={11} />
      Insert
    </button>
  </div>
</div>
