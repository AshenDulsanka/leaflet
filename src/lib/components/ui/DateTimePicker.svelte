<script lang="ts">
  import { CalendarDays } from '@lucide/svelte';

  import CalendarGrid from '$lib/components/ui/calendar/CalendarGrid.svelte';
  import TimeField from '$lib/components/ui/calendar/TimeField.svelte';
  import {
    localDateTimeValue,
    monthAnchorFromValue,
    parseDateTimeValue,
    selectedDateKey,
    withSelectedDate,
  } from '$lib/components/ui/date-time';

  type Props = {
    value: string;
    onchange: (value: string) => void;
    placeholder?: string;
    density?: 'compact' | 'comfortable';
    class?: string;
  };

  const {
    value,
    onchange,
    placeholder = 'Select date and time',
    density = 'comfortable',
    class: className = '',
  }: Props = $props();

  let internalValue = $state('');
  let visibleMonth = $state(new Date());
  let syncedValue = $state<string | null>(null);

  function syncFromValue(nextValue: string): void {
    internalValue = nextValue;
    visibleMonth = monthAnchorFromValue(nextValue);
    syncedValue = nextValue;
  }

  $effect(() => {
    if (value !== syncedValue) {
      syncFromValue(value);
    }
  });

  const selectedKey = $derived(selectedDateKey(internalValue));
  const isCompact = $derived(density === 'compact');
  const selectionSummary = $derived.by(() => {
    const parsed = parseDateTimeValue(internalValue);
    if (!parsed) return placeholder;

    return new Date(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      parsed.hour,
      parsed.minute,
    ).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  function updateValue(nextValue: string): void {
    internalValue = nextValue;
    syncedValue = nextValue;
    onchange(nextValue);
  }

  function handleSelectDate(dateKey: string): void {
    const nextValue = withSelectedDate(internalValue, dateKey);
    updateValue(nextValue);
    visibleMonth = monthAnchorFromValue(nextValue);
  }

  function handleMonthChange(offset: number): void {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
  }

  function handleNow(): void {
    const nextValue = localDateTimeValue();
    updateValue(nextValue);
    visibleMonth = monthAnchorFromValue(nextValue);
  }
</script>

<div class={`overflow-hidden rounded-xl border border-border bg-card shadow-sm ${className}`}>
  <div class={`flex items-center justify-between gap-3 border-b border-border bg-muted/35 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
    <div class="min-w-0 flex items-center gap-2">
      <div class={`flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground ${isCompact ? 'h-8 w-8' : 'h-9 w-9'}`}>
        <CalendarDays size={isCompact ? 14 : 16} />
      </div>
      <div class="min-w-0">
        <p class={`${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-muted-foreground`}>Timestamp</p>
        <p class={`truncate ${isCompact ? 'text-[13px]' : 'text-sm'} font-semibold ${selectedKey ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selectionSummary}
        </p>
      </div>
    </div>

    <button
      type="button"
      onclick={handleNow}
      class={`rounded-lg border border-border bg-background font-medium text-foreground transition-colors hover:border-border/80 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/60 ${isCompact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'}`}
    >
      Now
    </button>
  </div>

  <div class={`grid lg:grid-cols-[minmax(0,1.45fr)_minmax(12rem,1fr)] ${isCompact ? 'gap-2.5 p-3' : 'gap-3 p-4'}`}>
    <CalendarGrid
      month={visibleMonth}
      selectedDate={selectedKey}
      onchangeMonth={handleMonthChange}
      onselectDate={handleSelectDate}
    />

    <TimeField
      value={internalValue}
      onchange={updateValue}
    />
  </div>
</div>
