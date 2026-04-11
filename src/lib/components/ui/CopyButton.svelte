<script lang="ts">
  import { Copy, Check } from '@lucide/svelte';

  const { text, size = 12, class: className = '' }: { text: string; size?: number; class?: string } = $props();

  let copied = $state(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 1500);
    } catch {
      // clipboard not available (non-HTTPS or permission denied)
    }
  }
</script>

<button
  onclick={handleCopy}
  class="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground {className}"
  title="Copy to clipboard"
  type="button"
>
  {#if copied}
    <Check {size} class="text-green-500" />
  {:else}
    <Copy {size} />
  {/if}
</button>
