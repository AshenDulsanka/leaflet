<script lang="ts">
  import { CloudDownload, CloudUpload, RefreshCw } from '@lucide/svelte';
  import { notifications } from '$lib/notifications.svelte';

  type SyncAction = 'idle' | 'status' | 'pushing' | 'pulling';
  type SyncRecommendation = 'pull' | 'push' | 'both' | 'none';

  type SyncState = {
    initialized: boolean;
    hasRemote: boolean;
    dirty: boolean;
    changes: string | null;
    ahead: number;
    behind: number;
    recommendation: SyncRecommendation;
    branch: string | null;
  };

  interface Props {
    onPullSuccess?: () => void;
  }

  let { onPullSuccess }: Props = $props();

  let action = $state<SyncAction>('idle');
  let notifiedMissingRepo = $state(false);
  let hasStatusSnapshot = $state(false);
  let statusRefreshError = $state<string | null>(null);
  let statusInitialized = false;

  let syncState = $state<SyncState>({
    initialized: false,
    hasRemote: false,
    dirty: false,
    changes: null,
    ahead: 0,
    behind: 0,
    recommendation: 'none',
    branch: null,
  });

  function toRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  }

  function readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  function readNullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  function readBoolean(value: unknown, fallback = false): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  function readNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  function readRecommendation(value: unknown, ahead: number, behind: number, hasRemote: boolean): SyncRecommendation {
    if (value === 'pull' || value === 'push' || value === 'both' || value === 'none') {
      return value;
    }
    if (!hasRemote) {
      return 'none';
    }
    if (ahead > 0 && behind > 0) {
      return 'both';
    }
    if (ahead > 0) {
      return 'push';
    }
    if (behind > 0) {
      return 'pull';
    }
    return 'none';
  }

  function applyStatus(payload: Record<string, unknown>): void {
    const hasRemote = readBoolean(payload.hasRemote, false);
    const ahead = readNumber(payload.ahead, 0);
    const behind = readNumber(payload.behind, 0);

    syncState = {
      initialized: readBoolean(payload.initialized, true),
      hasRemote,
      dirty: readBoolean(payload.dirty, false),
      changes: readNullableString(payload.changes),
      ahead,
      behind,
      recommendation: readRecommendation(payload.recommendation, ahead, behind, hasRemote),
      branch: readString(payload.branch, '') || null,
    };

    hasStatusSnapshot = true;
    statusRefreshError = null;
  }

  async function refreshStatus(notifyErrors = false): Promise<void> {
    if (action === 'pulling' || action === 'pushing') {
      return;
    }
    action = 'status';

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', includeRemote: true }),
      });
      const payload = toRecord(await res.json());

      if (!res.ok) {
        statusRefreshError = readString(payload.error, 'Sync status unavailable');

        if (notifyErrors || !notifiedMissingRepo) {
          notifications.add('warning', statusRefreshError);
          notifiedMissingRepo = true;
        }
        return;
      }

      applyStatus(payload);
      notifiedMissingRepo = false;
    } catch (error: unknown) {
      statusRefreshError = error instanceof Error ? error.message : 'Failed to read sync status';
      if (notifyErrors) {
        notifications.add('error', statusRefreshError);
      }
    } finally {
      action = 'idle';
    }
  }

  const canPull = $derived(
    syncState.initialized &&
      syncState.hasRemote &&
      (syncState.recommendation === 'pull' || syncState.recommendation === 'both')
  );

  const canPush = $derived(
    syncState.initialized &&
      syncState.hasRemote &&
      syncState.behind === 0 &&
      (syncState.recommendation === 'push' || syncState.recommendation === 'both')
  );

  const shouldRetryStatus = $derived(!hasStatusSnapshot || statusRefreshError !== null);

  $effect(() => {
    if (statusInitialized) {
      return;
    }
    statusInitialized = true;
    void refreshStatus(false);
  });

  async function sync(nextAction: 'push' | 'pull'): Promise<void> {
    if (action !== 'idle') {
      return;
    }

    if (shouldRetryStatus) {
      await refreshStatus(true);
      return;
    }

    if (nextAction === 'pull' && !canPull) {
      notifications.add(
        'info',
        hasStatusSnapshot ? 'Pull unavailable right now.' : 'Sync status unavailable right now.'
      );
      return;
    }

    if (nextAction === 'push' && !canPush) {
      notifications.add(
        'info',
        hasStatusSnapshot ? 'Push unavailable right now.' : 'Sync status unavailable right now.'
      );
      return;
    }

    notifications.add('info', nextAction === 'pull' ? 'Starting pull...' : 'Starting push...');
    action = nextAction === 'push' ? 'pushing' : 'pulling';

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction }),
      });
      const payload = toRecord(await res.json());
      const message = readString(payload.message, 'Sync complete');

      if (!res.ok) {
        notifications.add('error', readString(payload.error, 'Sync failed'));
        return;
      }

      if (nextAction === 'pull') {
        const isUpToDate = message.toLowerCase().includes('up to date');
        notifications.add(isUpToDate ? 'info' : 'success', message);
        onPullSuccess?.();
      } else {
        const nothingToPush = message.toLowerCase().includes('nothing to push');
        notifications.add(nothingToPush ? 'info' : 'success', message);
      }

    } catch (err: unknown) {
      notifications.add('error', err instanceof Error ? err.message : 'Network error');
    } finally {
      action = 'idle';
      await refreshStatus(false);
    }
  }
</script>

<div class="flex items-center gap-0.5" role="group" aria-label="Git sync">
  <button
    onclick={() => sync('pull')}
    disabled={action !== 'idle' || (!canPull && !shouldRetryStatus)}
    title={shouldRetryStatus ? 'Retry sync status' : canPull ? 'Pull latest changes from remote' : syncState.dirty ? 'Cannot pull — commit local changes first' : 'Pull unavailable'}
    class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    aria-label={shouldRetryStatus ? 'Retry sync status' : 'Pull latest changes'}
  >
    {#if action === 'pulling'}
      <RefreshCw size={13} class="animate-spin" />
    {:else if shouldRetryStatus}
      <RefreshCw size={13} />
    {:else}
      <CloudDownload size={13} />
    {/if}
  </button>

  <button
    onclick={() => sync('push')}
    disabled={action !== 'idle' || (!canPush && !shouldRetryStatus)}
    title={shouldRetryStatus ? 'Retry sync status' : canPush ? 'Push local changes to remote' : !syncState.dirty ? 'Nothing to push — no local changes' : 'Push unavailable'}
    class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    aria-label={shouldRetryStatus ? 'Retry sync status' : 'Push changes'}
  >
    {#if action === 'pushing'}
      <RefreshCw size={13} class="animate-spin" />
    {:else if shouldRetryStatus}
      <RefreshCw size={13} />
    {:else}
      <CloudUpload size={13} />
    {/if}
  </button>
</div>
