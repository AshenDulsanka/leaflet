<script lang="ts">
  import { X, ChevronDown, ChevronRight, RotateCcw } from '@lucide/svelte';
  import { METHODOLOGY } from '$lib/data/methodology';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let collapsed = $state<Set<string>>(new Set());

  function loadChecked(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('cpts-methodology-v1');
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  function saveChecked(c: Set<string>) {
    try {
      localStorage.setItem('cpts-methodology-v1', JSON.stringify([...c]));
    } catch {
      // ignore storage errors
    }
  }

  let checked = $state(loadChecked());

  function toggle(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    checked = next;
    saveChecked(checked);
  }

  function toggleCollapse(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  function reset() {
    checked = new Set();
    saveChecked(checked);
  }

  const total = $derived(
    METHODOLOGY.reduce((acc, phase) => acc + (phase.steps?.length ?? 0), 0),
  );
  const done = $derived(checked.size);
  const pct = $derived(total > 0 ? Math.round((done / total) * 100) : 0);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<aside
  transition:fly={{ x: 320, duration: 220, easing: cubicOut }}
  class="fixed bottom-6 right-0 top-10 z-40 flex w-80 flex-col border-l border-border bg-card shadow-xl"
>
  <!-- Header -->
  <div class="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
    <div class="flex-1">
      <h2 class="text-sm font-semibold text-foreground">Methodology</h2>
      <p class="text-xs text-muted-foreground">{done}/{total} steps - {pct}%</p>
    </div>
    <button
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
    >
      <X size={14} />
    </button>
  </div>

  <!-- Progress bar -->
  <div class="h-1 shrink-0 bg-muted">
    <div
      class="h-full bg-primary transition-all duration-300"
      style="width: {pct}%"
    ></div>
  </div>

  <!-- Steps list -->
  <div class="flex-1 overflow-y-auto px-2 py-2">
    {#each METHODOLOGY as phase (phase.id)}
      <div class="mb-1">
        <!-- Phase header -->
        <button
          class="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-accent"
          onclick={() => toggleCollapse(phase.id)}
        >
          {#if collapsed.has(phase.id)}
            <ChevronRight size={12} class="shrink-0 text-muted-foreground" />
          {:else}
            <ChevronDown size={12} class="shrink-0 text-muted-foreground" />
          {/if}
          <span class="flex-1">{phase.label}</span>
          {#if phase.steps}
            {@const phaseDone = phase.steps.filter((s) => checked.has(s.id)).length}
            <span class="text-[10px] text-muted-foreground">{phaseDone}/{phase.steps.length}</span>
          {/if}
        </button>

        <!-- Sub-steps -->
        {#if !collapsed.has(phase.id) && phase.steps}
          <div class="ml-3">
            {#each phase.steps as step (step.id)}
              <label
                class="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-xs hover:bg-accent"
              >
                <input
                  type="checkbox"
                  class="mt-0.5 shrink-0 accent-primary"
                  checked={checked.has(step.id)}
                  onchange={() => toggle(step.id)}
                />
                <span
                  class="leading-relaxed {checked.has(step.id)
                    ? 'text-muted-foreground line-through'
                    : 'text-foreground'}"
                >
                  {step.label}
                </span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Footer reset -->
  <div class="shrink-0 border-t border-border px-3 py-2">
    <button
      class="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      onclick={reset}
      title="Reset all checkboxes"
    >
      <RotateCcw size={12} />
      Reset progress
    </button>
  </div>
</aside>
