<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/theme.svelte';
  import FloatingPill from '$lib/components/ui/FloatingPill.svelte';

  // Initialize theme from localStorage on mount (client-side only)
  onMount(() => {
    theme.init();
  });

  let { children } = $props();
</script>

<svelte:head>
  <!--
    Inline script to set theme class before any content renders.
    This prevents a flash of wrong theme on page load.
  -->
  <script>
    (function () {
      const stored = localStorage.getItem('notes-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = stored === 'dark' || (!stored && prefersDark);
      if (isDark) document.documentElement.classList.add('dark');
    })();
  </script>
</svelte:head>

{@render children()}
<FloatingPill />
