<script lang="ts">
  import { dev } from '$app/environment';
  import { goto } from '$app/navigation';

  interface Props {
    error: App.Error & { message?: string };
    status: number;
  }

  const { error, status }: Props = $props();

  function returnHome(): void {
    void goto('/');
  }
</script>

<svelte:head>
  <title>{status} | Leaflet</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-background px-6 py-12">
  <section class="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
    <h1 class="text-2xl font-semibold text-foreground">Application error</h1>
    <p class="mt-3 text-sm leading-6 text-muted-foreground">
      A critical error interrupted rendering. Return to home and retry your action.
    </p>
    <p class="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Status: {status}
    </p>
    {#if dev && error?.message}
      <p class="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error.message}
      </p>
    {/if}
    <div class="mt-6">
      <button
        type="button"
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
        onclick={returnHome}
      >
        Back to home
      </button>
    </div>
  </section>
</main>
