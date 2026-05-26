<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    width: number;
    isResizing: boolean;
    onStartResize: (e: MouseEvent) => void;
    children: Snippet;
  }

  let { open, width, isResizing, onStartResize, children }: Props = $props();
</script>

<div
  class="right-panel-container relative shrink-0 {open ? '' : 'pointer-events-none'}"
  style="width: {open ? `${width}px` : '0'}; overflow: hidden; transition: width {isResizing ? '0ms' : '200ms'} cubic-bezier(0.4, 0, 0.2, 1); --panel-width: {width}px;"
>
  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute left-0 top-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-primary/30 {isResizing ? 'bg-primary/50' : ''}"
      style="height: 100%"
      onmousedown={onStartResize}
    ></div>
  {/if}

  {@render children()}
</div>

<style>
  /* Allow right panels to fill the resize container */
  .right-panel-container > :global(aside),
  .right-panel-container > :global(div[class*="h-full"]) {
    width: 100% !important;
    max-width: none !important;
  }
</style>
