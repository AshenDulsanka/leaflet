<script lang="ts">
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
</script>

<!-- Stacked pill container — fixed bottom-right, pointer-events only on pills -->
<div
  class="pointer-events-none fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2"
  aria-live="polite"
  aria-label="Notifications"
>
  {#each notifications.items as notif (notif.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      in:fly={{ x: 80, duration: 300 }}
      out:fly={{ x: 80, duration: 200 }}
      class="pointer-events-auto flex w-72 items-stretch overflow-hidden rounded-full border border-border bg-popover shadow-lg"
      onclick={() => notifications.dismiss(notif.id)}
      title="Click to dismiss"
    >
      <!-- Colored left accent strip -->
      <div class="w-1 shrink-0 {accentClass[notif.type]}"></div>

      <!-- Content -->
      <div class="flex min-w-0 flex-1 flex-col px-3 py-2">
        <span class="truncate text-xs font-medium text-popover-foreground">
          {notif.message}
        </span>
        <!-- Progress drain bar -->
        <div class="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-border">
          <div
            class="h-full origin-left {accentClass[notif.type]} opacity-60"
            style="animation: drain 4s linear forwards;"
          ></div>
        </div>
      </div>

      <!-- Type label -->
      <div class="flex shrink-0 items-center pr-3">
        <span class="text-[10px] font-semibold uppercase tracking-wider {labelClass[notif.type]}">
          {notif.type}
        </span>
      </div>
    </div>
  {/each}
</div>

<style>
  @keyframes drain {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }
</style>
