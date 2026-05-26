<script lang="ts">
  import { ZoomIn, Trash2, X } from '@lucide/svelte';

  interface Props {
    rect: DOMRect;
    onOpenLightbox: () => void;
    onDelete: () => void;
    onClose: () => void;
  }

  let { rect, onOpenLightbox, onDelete, onClose }: Props = $props();

  // Toolbar dimensions
  const W = 108;
  const H = 36;
  const MARGIN = 8;

  // Position above the image, centered horizontally, clamped to viewport
  const top = $derived(
    rect.top - H - MARGIN < MARGIN ? rect.bottom + MARGIN : rect.top - H - MARGIN
  );
  const left = $derived(
    Math.min(
      (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - MARGIN,
      Math.max(MARGIN, rect.left + rect.width / 2 - W / 2)
    )
  );
</script>

<!-- Absorb pointer events so window pointerdown listener doesn't close us -->
<div
  class="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-card px-1.5 py-1 shadow-xl"
  style="top: {top}px; left: {left}px; width: {W}px;"
  onpointerdown={(e) => e.stopPropagation()}
  role="toolbar"
  aria-label="Image options"
  tabindex="-1"
>
  <!-- Open in lightbox / zoom -->
  <button
    class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    title="Open full size"
    aria-label="Open image full size"
    onclick={onOpenLightbox}
  >
    <ZoomIn size={13} />
  </button>

  <span class="mx-1 h-4 w-px bg-border"></span>

  <!-- Delete image -->
  <button
    class="flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10"
    title="Delete image"
    aria-label="Delete image"
    onclick={onDelete}
  >
    <Trash2 size={13} />
  </button>

  <span class="mx-1 h-4 w-px bg-border"></span>

  <!-- Close toolbar -->
  <button
    class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    title="Close (Esc)"
    aria-label="Close image toolbar"
    onclick={onClose}
  >
    <X size={13} />
  </button>
</div>
