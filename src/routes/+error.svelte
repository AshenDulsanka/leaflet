<script lang="ts">
  import { dev } from '$app/environment';
  import { goto } from '$app/navigation';

  interface Props {
    error: App.Error & { message?: string };
    status: number;
  }

  const { error, status }: Props = $props();

  const title = $derived(status === 404 ? 'Page not found' : 'Something went wrong');
  const description = $derived(
    status === 404
      ? 'The page you requested does not exist or was moved.'
      : 'The app hit an unexpected error. You can return home or retry.'
  );

  function goHome(): void {
    void goto('/');
  }

  function reloadPage(): void {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>{status} | {title}</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-background px-6 py-12">
  <section class="w-full max-w-xl rounded-xl border border-border bg-card p-8 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Error {status}</p>
    <h1 class="mt-3 text-3xl font-semibold text-foreground">{title}</h1>
    <p class="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>

    {#if dev && status !== 404 && error?.message}
      <p class="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error.message}
      </p>
    {/if}

    <div class="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
        onclick={goHome}
      >
        Go to home
      </button>
      <button
        type="button"
        class="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
        onclick={reloadPage}
      >
        Try again
      </button>
    </div>
  </section>
</main>
