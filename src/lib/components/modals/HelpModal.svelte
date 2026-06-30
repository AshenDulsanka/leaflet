<script lang="ts">
  import { X, Keyboard } from '@lucide/svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === '?') onClose();
  }

  const SHORTCUTS: { section: string; items: { keys: string[]; description: string }[] }[] = [
    {
      section: 'File',
      items: [
        { keys: ['Ctrl', 'S'], description: 'Force save current note' },
        { keys: ['Ctrl', 'Shift', 'E'], description: 'New note dialog' },
        { keys: ['Ctrl', 'M'], description: 'Toggle WYSIWYG / Source mode' },
      ],
    },
    {
      section: 'Navigation',
      items: [
        { keys: ['Ctrl', 'P'], description: 'Open full-text search' },
        { keys: ['Ctrl', 'Shift', 'L'], description: 'Collapse / expand sidebar' },
        { keys: ['Ctrl', 'Shift', 'K'], description: 'Open command palette (pentest snippets)' },
        { keys: ['Ctrl', '.'], description: 'Toggle methodology checklist panel' },
        { keys: ['Arrow keys'], description: 'Navigate file tree items when focused' },
        { keys: ['?'], description: 'Show this shortcuts help' },
      ],
    },
    {
      section: 'AI Assistant',
      items: [
        { keys: ['Ctrl', 'Shift', 'A'], description: 'Toggle AI chat panel' },
        { keys: ['Ctrl', 'Shift', 'S'], description: 'AI summarize current note (opens in chat)' },
      ],
    },
    {
      section: 'Editor',
      items: [
        { keys: ['Ctrl', 'F'], description: 'Find in current note (case / word / regex options)' },
        { keys: ['Ctrl', 'Shift', 'B'], description: 'Toggle backlinks panel (notes linking here)' },
        { keys: ['Ctrl', 'Shift', 'X'], description: 'Export current note (MD / HTML / PDF)' },
        { keys: ['Click image'], description: 'Show image toolbar (align, zoom, delete)' },
        { keys: ['Ctrl', 'Z'], description: 'Undo (browser native)' },
        { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (browser native)' },
        { keys: ['Paste image'], description: 'Auto-upload + insert screenshot (Ctrl+V with image)' },
        { keys: ['Drop image'], description: 'Drag an image file onto the editor to upload + insert' },
      ],
    },
    {
      section: 'Panels',
      items: [
        { keys: ['Ctrl', 'Shift', 'G'], description: 'Toggle screenshot manager panel' },
        { keys: ['Esc'], description: 'Close any open panel, modal, or palette' },
        { keys: ['Enter'], description: 'Confirm in command palette / dialogs' },
      ],
    },
    {
      section: 'File Tree',
      items: [
        { keys: ['Drag file'], description: 'Drag a note or folder onto another folder to move it' },
      ],
    },
  ];
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
  role="button"
  tabindex="-1"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
  aria-label="Close help"
></div>

<!-- Modal -->
<div
  transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
  class="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
  role="dialog"
  aria-modal="true"
  aria-label="Keyboard shortcuts"
>
  <!-- Header -->
  <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
    <Keyboard size={16} class="shrink-0 text-muted-foreground" />
    <h2 class="flex-1 text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
    <button
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
    >
      <X size={14} />
    </button>
  </div>

  <!-- Shortcuts list -->
  <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
    {#each SHORTCUTS as section (section.section)}
      <div class="mb-5 last:mb-0">
        <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {section.section}
        </h3>
        <div class="space-y-1.5">
          {#each section.items as item}
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-foreground">{item.description}</span>
              <div class="flex shrink-0 items-center gap-1">
                {#each item.keys as key}
                  <kbd
                    class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {key}
                  </kbd>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- Footer -->
  <div class="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
    Press <kbd class="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> or
    <kbd class="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">?</kbd> to close
  </div>
</div>
