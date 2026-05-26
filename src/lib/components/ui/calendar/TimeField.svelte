<script lang="ts">
  import { Clock3 } from '@lucide/svelte';

  import {
    padNumber,
    parseDateTimeValue,
    withSelectedTime,
  } from '$lib/components/ui/date-time';

  type Props = {
    value: string;
    onchange: (value: string) => void;
    density?: 'compact' | 'comfortable';
    class?: string;
    disabled?: boolean;
  };

  const {
    value,
    onchange,
    density = 'comfortable',
    class: className = '',
    disabled = false,
  }: Props = $props();

  const isCompact = $derived(density === 'compact');
  let hourInput = $state('');
  let minuteInput = $state('');
  let syncedValue = $state<string | null>(null);

  function syncInputs(nextValue: string): void {
    const parsed = parseDateTimeValue(nextValue);
    hourInput = parsed ? padNumber(parsed.hour) : '';
    minuteInput = parsed ? padNumber(parsed.minute) : '';
    syncedValue = nextValue;
  }

  $effect(() => {
    if (value !== syncedValue) {
      syncInputs(value);
    }
  });

  function digitsOnly(nextValue: string): string {
    return nextValue.replace(/\D/g, '').slice(0, 2);
  }

  function commitIfComplete(nextHour: string, nextMinute: string): void {
    if (nextHour.length !== 2 || nextMinute.length !== 2) return;

    const hour = Math.min(Number(nextHour), 23);
    const minute = Math.min(Number(nextMinute), 59);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return;

    const nextValue = withSelectedTime(value, hour, minute);
    syncedValue = nextValue;
    onchange(nextValue);
  }

  function normalizeSegment(rawValue: string, max: number, fallback: number): number {
    if (!rawValue) return fallback;

    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return fallback;

    return Math.min(Math.max(numericValue, 0), max);
  }

  function commitNormalizedValue(): void {
    if (!hourInput && !minuteInput && !value) {
      syncedValue = value;
      return;
    }

    const parsed = parseDateTimeValue(value);
    const now = new Date();
    const normalizedHour = normalizeSegment(hourInput, 23, parsed?.hour ?? now.getHours());
    const normalizedMinute = normalizeSegment(minuteInput, 59, parsed?.minute ?? now.getMinutes());
    const nextValue = withSelectedTime(value, normalizedHour, normalizedMinute);

    hourInput = padNumber(normalizedHour);
    minuteInput = padNumber(normalizedMinute);
    syncedValue = nextValue;
    onchange(nextValue);
  }

  function handleHourInput(event: Event): void {
    const nextValue = digitsOnly((event.currentTarget as HTMLInputElement).value);
    hourInput = nextValue;
    commitIfComplete(nextValue, minuteInput);
  }

  function handleMinuteInput(event: Event): void {
    const nextValue = digitsOnly((event.currentTarget as HTMLInputElement).value);
    minuteInput = nextValue;
    commitIfComplete(hourInput, nextValue);
  }
</script>

<section class={`rounded-xl border border-border bg-muted/20 ${className}`}>
  <div class={`flex items-center gap-2 border-b border-border ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
    <div class={`flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground ${isCompact ? 'h-7 w-7' : 'h-9 w-9'}`}>
      <Clock3 size={isCompact ? 13 : 16} />
    </div>
    <div>
      <p class={`${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-muted-foreground`}>Time</p>
      <p class={`${isCompact ? 'text-[13px]' : 'text-sm'} font-semibold text-foreground`}>24-hour entry</p>
    </div>
  </div>

  <div class={`space-y-3 ${isCompact ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
    <div class={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end ${isCompact ? 'gap-1.5' : 'gap-2'}`}>
      <label class={`${isCompact ? 'space-y-1.5' : 'space-y-2'}`}>
        <span class={`block font-medium text-muted-foreground ${isCompact ? 'text-[11px]' : 'text-xs'}`}>Hour</span>
        <input
          type="text"
          inputmode="numeric"
          maxlength="2"
          placeholder="08"
          value={hourInput}
          oninput={handleHourInput}
          onblur={commitNormalizedValue}
          {disabled}
          class={`w-full rounded-lg border border-border bg-background font-semibold text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60 ${isCompact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'}`}
        />
      </label>

      <div class={`${isCompact ? 'pb-1.5 text-base' : 'pb-2 text-lg'} font-semibold text-muted-foreground`}>:</div>

      <label class={`${isCompact ? 'space-y-1.5' : 'space-y-2'}`}>
        <span class={`block font-medium text-muted-foreground ${isCompact ? 'text-[11px]' : 'text-xs'}`}>Minute</span>
        <input
          type="text"
          inputmode="numeric"
          maxlength="2"
          placeholder="30"
          value={minuteInput}
          oninput={handleMinuteInput}
          onblur={commitNormalizedValue}
          {disabled}
          class={`w-full rounded-lg border border-border bg-background font-semibold text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60 ${isCompact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'}`}
        />
      </label>
    </div>

    <p class={`${isCompact ? 'text-[10px]' : 'text-[11px]'} leading-relaxed text-muted-foreground`}>
      Partial edits stay local until both fields are complete or focus leaves the control.
    </p>
  </div>
</section>