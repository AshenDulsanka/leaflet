<script lang="ts">
  import { AlertTriangle, CheckCircle2, CircleX, Info } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { notifications, type Notification } from '$lib/notifications.svelte';

  const accentClass: Record<Notification['type'], string> = {
    success: 'bg-green-500',
    error:   'bg-destructive',
    info:    'bg-blue-500',
    warning: 'bg-amber-500',
  };

  const labelClass: Record<Notification['type'], string> = {
    success: 'text-green-500',
    error:   'text-destructive',
    info:    'text-blue-500',
    warning: 'text-amber-500',
  };

  const iconClass: Record<Notification['type'], string> = {
    success: 'text-green-500',
    error: 'text-destructive',
    info: 'text-blue-500',
    warning: 'text-amber-500',
  };

  function remainingMs(notification: Notification): number {
    if (notification.expiresAt === null) {
      return 0;
    }
    return Math.max(notification.expiresAt - Date.now(), 0);
  }

  function isHighSignal(notification: Notification): boolean {
    return notification.type === 'error' || notification.type === 'warning';
  }
</script>

<!-- Stacked pill container - fixed bottom-right, pointer-events only on pills -->
<div
  class="pointer-events-none fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2"
  aria-live="polite"
  aria-label="Notifications"
>
  {#each notifications.items as notif (notif.id)}
    {@const highSignal = isHighSignal(notif)}
    <button
      type="button"
      in:fly={{ x: 36, y: 8, duration: 240 }}
      out:fly={{ x: 30, y: -6, duration: 180 }}
      class="pointer-events-auto flex w-80 max-w-[calc(100vw-2.5rem)] items-stretch overflow-hidden rounded-full bg-popover shadow-lg transition-transform duration-150 ease-out hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onclick={() => notifications.dismiss(notif.id)}
      title="Dismiss notification"
      aria-label={`Dismiss ${notif.type} notification`}
    >
      <!-- Content -->
      <div class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
        <span class="shrink-0 {iconClass[notif.type]}">
          {#if notif.type === 'success'}
            <CheckCircle2 size={14} />
          {:else if notif.type === 'error'}
            <CircleX size={14} />
          {:else if notif.type === 'warning'}
            <AlertTriangle size={14} />
          {:else}
            <Info size={14} />
          {/if}
        </span>
        <div class="min-w-0 flex-1">
          <span class="block text-xs font-medium leading-snug text-popover-foreground {highSignal ? 'line-clamp-2 pr-1' : 'truncate'}">
            {notif.message}
          </span>
          {#if notif.expiresAt !== null}
            <div class="mt-1.5 h-0.5 w-full overflow-hidden rounded-full">
              <div
                class="h-full origin-left {accentClass[notif.type]} opacity-60"
                style={`animation: drain ${remainingMs(notif)}ms linear forwards;`}
              ></div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Type label -->
      <div class="flex shrink-0 items-center pr-3">
        <span class="text-[10px] font-semibold uppercase tracking-wide {labelClass[notif.type]}">
          {notif.type}
        </span>
      </div>
    </button>
  {/each}
</div>

<style>
  @keyframes drain {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }
</style>
