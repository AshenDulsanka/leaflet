<script lang="ts">
  import { CloudUpload, CloudDownload, RefreshCw } from '@lucide/svelte';
  import { notifications } from '$lib/notifications.svelte';

  type SyncStatus = 'idle' | 'pushing' | 'pulling' | 'no-repo';

  interface Props {
    onPullSuccess?: () => void;
  }

  let { onPullSuccess }: Props = $props();

  let status = $state<SyncStatus>('idle');

  async function checkRepo() {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error?.includes('not a git repository')) {
          status = 'no-repo';
          notifications.add('warning', 'No git repo found in data directory');
        }
      }
    } catch {
      // Silently fail - user can still try push/pull
    }
  }

  async function sync(action: 'push' | 'pull') {
    if (status === 'pushing' || status === 'pulling') return;
    status = action === 'push' ? 'pushing' : 'pulling';

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        notifications.add('error', data.error ?? 'Sync failed');
        return;
      }

      notifications.add('success', data.message ?? 'Done');

      if (action === 'pull') {
        onPullSuccess?.();
      }
    } catch (err: unknown) {
      notifications.add('error', err instanceof Error ? err.message : 'Network error');
    } finally {
      status = 'idle';
    }
  }

  // Check git repo status on mount
  $effect(() => {
    checkRepo();
  });
</script>

<div class="flex items-center gap-0.5" role="group" aria-label="Git sync">
  <button
    onclick={() => sync('pull')}
    disabled={status === 'pushing' || status === 'pulling' || status === 'no-repo'}
    title="Pull latest changes"
    class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground
           hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {#if status === 'pulling'}
      <RefreshCw size={13} class="animate-spin" />
    {:else}
      <CloudDownload size={13} />
    {/if}
  </button>

  <button
    onclick={() => sync('push')}
    disabled={status === 'pushing' || status === 'pulling' || status === 'no-repo'}
    title="Push changes"
    class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground
           hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {#if status === 'pushing'}
      <RefreshCw size={13} class="animate-spin" />
    {:else}
      <CloudUpload size={13} />
    {/if}
  </button>
</div>
