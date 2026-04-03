<script lang="ts">
  import { CloudUpload, CloudDownload, RefreshCw, AlertCircle, Check } from '@lucide/svelte';

  type SyncStatus = 'idle' | 'pushing' | 'pulling' | 'success' | 'error' | 'no-repo';

  let status = $state<SyncStatus>('idle');
  let message = $state('');
  let showTooltip = $state(false);

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
          message = 'No git repo in data dir';
        }
      }
    } catch {
      // Silently fail — user can still try push/pull
    }
  }

  async function sync(action: 'push' | 'pull') {
    if (status === 'pushing' || status === 'pulling') return;
    status = action === 'push' ? 'pushing' : 'pulling';
    message = '';

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (!res.ok) {
        status = 'error';
        message = data.error ?? 'Sync failed';
        return;
      }

      status = 'success';
      message = data.message ?? 'Done';
    } catch (err: unknown) {
      status = 'error';
      message = err instanceof Error ? err.message : 'Network error';
    } finally {
      // Auto-reset after 3s
      setTimeout(() => {
        if (status === 'success' || status === 'error') {
          status = 'idle';
          message = '';
        }
      }, 3000);
    }
  }

  // Check git repo status on mount
  $effect(() => {
    checkRepo();
  });
</script>

<div
  class="relative flex items-center gap-0.5"
  onmouseenter={() => (showTooltip = true)}
  onmouseleave={() => (showTooltip = false)}
  role="group"
  aria-label="Git sync"
>
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

  <!-- Status indicator -->
  {#if status === 'success'}
    <Check size={11} class="text-green-500" />
  {:else if status === 'error' || status === 'no-repo'}
    <AlertCircle size={11} class="text-destructive" />
  {/if}

  <!-- Tooltip -->
  {#if showTooltip && message}
    <div
      class="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded
             border border-border bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-md"
    >
      {message}
    </div>
  {/if}
</div>
