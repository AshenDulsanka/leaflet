<script lang="ts">
  import { fly } from 'svelte/transition';
  import { notifications, type Notification } from '$lib/notifications.svelte';
  import { CheckCircle, XCircle, Info, AlertTriangle, X } from '@lucide/svelte';

  const iconCircleClass: Record<Notification['type'], string> = {
    success: 'bg-green-500/10 text-green-600 dark:text-green-500',
    error: 'bg-red-500/10 text-red-600 dark:text-red-500',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-500',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  };

  function getIcon(type: Notification['type']) {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'error':
        return XCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
    }
  }
</script>

<div
  class="pointer-events-none fixed right-5 bottom-5 z-[9999] flex flex-col-reverse gap-2"
  aria-live="polite"
  aria-label="Notifications"
>
  {#each notifications.items as notif (notif.id)}
    {@const IconComponent = getIcon(notif.type)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      in:fly={{ x: 20, duration: 200 }}
      out:fly={{ x: 20, duration: 200 }}
      class="border-border bg-popover pointer-events-auto flex w-72 items-start gap-3 rounded-lg border p-3 shadow-md"
      onclick={() => notifications.dismiss(notif.id)}
    >
      <div
        class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full {iconCircleClass[
          notif.type
        ]}"
      >
        <IconComponent size={12} />
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-popover-foreground text-sm">{notif.message}</p>
      </div>

      <button
        type="button"
        class="text-muted-foreground hover:text-foreground focus:ring-border mt-0.5 shrink-0 rounded-sm transition-colors focus:ring-1 focus:outline-none"
        onclick={(e) => {
          e.stopPropagation();
          notifications.dismiss(notif.id);
        }}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  {/each}
</div>
