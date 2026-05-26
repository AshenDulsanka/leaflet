<script lang="ts">
  import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/svelte';

  import {
    buildCalendarDays,
    monthLabel,
    WEEKDAY_LABELS,
  } from '$lib/components/ui/date-time';

  type Props = {
    month: Date;
    selectedDate: string | null;
    onchangeMonth: (offset: number) => void;
    onselectDate: (dateKey: string) => void;
    density?: 'compact' | 'comfortable';
    class?: string;
  };

  const {
    month,
    selectedDate,
    onchangeMonth,
    onselectDate,
    density = 'comfortable',
    class: className = '',
  }: Props = $props();

  const isCompact = $derived(density === 'compact');
  const calendarDays = $derived(buildCalendarDays(month, selectedDate));
  const headingLabel = $derived(monthLabel(month));
  const selectionLabel = $derived.by(() => {
    if (!selectedDate) return 'Choose day';

    return new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  });

  function monthControlLabel(offset: number): string {
    const targetMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    const action = offset < 0 ? 'Show previous month' : 'Show next month';
    return `${action}, ${monthLabel(targetMonth)}`;
  }
</script>

<section class={`rounded-xl border border-border bg-background/90 ${className}`}>
  <div class={`flex items-center justify-between gap-3 border-b border-border bg-muted/35 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
    <div class="min-w-0 flex items-center gap-2">
      <div class={`flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground ${isCompact ? 'h-7 w-7' : 'h-9 w-9'}`}>
        <CalendarDays size={isCompact ? 13 : 16} />
      </div>
      <div class="min-w-0">
        <p class={`${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-muted-foreground`}>Calendar</p>
        <p class={`truncate ${isCompact ? 'text-[13px]' : 'text-sm'} font-semibold text-foreground`}>{headingLabel}</p>
      </div>
    </div>

    <div class={`flex items-center ${isCompact ? 'gap-1.5' : 'gap-2'}`}>
      <button
        type="button"
        onclick={() => onchangeMonth(-1)}
        aria-label={monthControlLabel(-1)}
        class={`flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-border/80 hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 ${isCompact ? 'h-7 w-7' : 'h-9 w-9'}`}
      >
        <ChevronLeft size={isCompact ? 13 : 16} />
      </button>
      <button
        type="button"
        onclick={() => onchangeMonth(1)}
        aria-label={monthControlLabel(1)}
        class={`flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-border/80 hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 ${isCompact ? 'h-7 w-7' : 'h-9 w-9'}`}
      >
        <ChevronRight size={isCompact ? 13 : 16} />
      </button>
    </div>
  </div>

  <div class={`space-y-3 ${isCompact ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
    <div class={`rounded-lg border border-dashed border-border/80 bg-muted/20 ${isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
      <p class={`${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-muted-foreground`}>Selected day</p>
      <p class={`${isCompact ? 'text-[13px]' : 'text-sm'} font-semibold ${selectedDate ? 'text-foreground' : 'text-muted-foreground'}`}>
        {selectionLabel}
      </p>
    </div>

    <div class={`grid grid-cols-7 ${isCompact ? 'gap-0.5' : 'gap-1'}`} aria-hidden="true">
      {#each WEEKDAY_LABELS as weekday}
        <div class={`flex items-center justify-center font-semibold uppercase tracking-[0.14em] text-muted-foreground/85 ${isCompact ? 'h-6 text-[10px]' : 'h-7 text-[11px]'}`}>
          {weekday}
        </div>
      {/each}
    </div>

    <div class={`grid grid-cols-7 ${isCompact ? 'gap-0.5' : 'gap-1'}`}>
      {#each calendarDays as day}
        <button
          type="button"
          onclick={() => onselectDate(day.dateKey)}
          aria-label={day.ariaLabel}
          aria-pressed={day.isSelected}
          aria-current={day.isToday ? 'date' : undefined}
          class={`flex items-center justify-center rounded-lg border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 ${isCompact ? 'h-8 text-[13px]' : 'h-10 text-sm'} ${day.isSelected
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : day.isToday
              ? 'border-primary/50 bg-primary/10 text-foreground'
              : day.inCurrentMonth
                ? 'border-transparent text-foreground hover:border-border hover:bg-accent/70'
                : 'border-transparent text-muted-foreground/60 hover:bg-accent/35'}`}
        >
          <span>{day.dayNumber}</span>
        </button>
      {/each}
    </div>
  </div>
</section>