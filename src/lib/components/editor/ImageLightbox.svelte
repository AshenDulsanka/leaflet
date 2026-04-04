<script lang="ts">
  import { X, ZoomIn, ZoomOut, Download } from '@lucide/svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    src: string;
    alt?: string;
    onClose: () => void;
  }

  let { src, alt = '', onClose }: Props = $props();

  let zoomed = $state(false);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === '+' || e.key === '=') zoomed = true;
    if (e.key === '-') zoomed = false;
  }

  function download() {
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'image';
    a.click();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  role="presentation"
>
  <!-- Toolbar -->
  <div
    transition:fly={{ y: -8, duration: 200, easing: cubicOut }}
    class="absolute top-3 right-3 flex items-center gap-1"
  >
    <button
      onclick={() => (zoomed = !zoomed)}
      title={zoomed ? 'Zoom out (-)' : 'Zoom in (+)'}
      class="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20"
    >
      {#if zoomed}
        <ZoomOut size={14} />
      {:else}
        <ZoomIn size={14} />
      {/if}
    </button>
    <button
      onclick={download}
      title="Download"
      class="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20"
    >
      <Download size={14} />
    </button>
    <button
      onclick={onClose}
      title="Close (Esc)"
      class="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20"
    >
      <X size={14} />
    </button>
  </div>

  <!-- Image -->
  <div
    transition:fly={{ y: 12, duration: 220, easing: cubicOut }}
    class="flex p-10 {zoomed ? 'overflow-auto' : 'max-h-screen max-w-full items-center justify-center'}"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <img
      {src}
      {alt}
      onclick={() => (zoomed = !zoomed)}
      class="rounded shadow-2xl transition-all duration-200 {zoomed
        ? 'cursor-zoom-out'
        : 'max-h-[85vh] max-w-[85vw] cursor-zoom-in object-contain'}"
    />
  </div>

  <!-- Alt text caption -->
  {#if alt}
    <p
      class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/50 px-3 py-1 text-xs text-white/80"
    >
      {alt}
    </p>
  {/if}
</div>
