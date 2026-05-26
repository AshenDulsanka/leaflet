<script lang="ts">
  import { X, Download } from '@lucide/svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    src: string;
    alt?: string;
    onClose: () => void;
  }

  let { src, alt = '', onClose }: Props = $props();

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onClose();
  }

  function download(): void {
    const a = document.createElement('a');
    a.href = src;
    a.download = src.split('/').pop() ?? (alt || 'image');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    class="flex p-10 max-h-screen max-w-full items-center justify-center"
  >
    <img
      {src}
      {alt}
      class="max-h-[85vh] max-w-[85vw] rounded object-contain shadow-2xl"
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
