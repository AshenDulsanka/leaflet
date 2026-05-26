<script lang="ts">
  import { FilePlus, FolderPlus, Pencil, Trash2, Pin, PinOff, FolderInput } from '@lucide/svelte';
  import type { FileNode } from '$lib/types';

  interface Props {
    x: number;
    y: number;
    node: FileNode;
    pinned: string[];
    onNewFile: () => void;
    onNewFolder: () => void;
    onRename: () => void;
    onTogglePin: () => void;
    onMove: () => void;
    onDelete: () => void;
    onClose: () => void;
  }

  let { x, y, node, pinned, onNewFile, onNewFolder, onRename, onTogglePin, onMove, onDelete }: Props =
    $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="fixed z-50 min-w-40 rounded-md border border-border bg-popover py-1 shadow-lg"
  style="left: {x}px; top: {y}px"
  onclick={(e) => e.stopPropagation()}
>
  {#if node.type === 'folder'}
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      onclick={onNewFile}
    >
      <FilePlus size={13} /> New note
    </button>
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      onclick={onNewFolder}
    >
      <FolderPlus size={13} /> New folder
    </button>
    <div class="my-1 border-t border-border"></div>
  {/if}

  <button
    class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
    onclick={onRename}
  >
    <Pencil size={13} /> Rename
  </button>

  {#if node.type === 'file'}
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      onclick={onTogglePin}
    >
      {#if pinned.includes(node.path)}
        <PinOff size={13} /> Unpin from favorites
      {:else}
        <Pin size={13} /> Pin to favorites
      {/if}
    </button>
  {/if}

  <button
    class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
    onclick={onMove}
  >
    <FolderInput size={13} /> Move to...
  </button>

  <button
    class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent"
    onclick={onDelete}
  >
    <Trash2 size={13} /> Delete
  </button>
</div>
