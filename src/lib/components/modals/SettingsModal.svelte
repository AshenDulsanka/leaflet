<script lang="ts">
  import { X, Settings, Moon, Sun, FileCode, Eye, Info } from '@lucide/svelte';
  import { theme } from '$lib/theme.svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    editorMode: 'wysiwyg' | 'source';
    onClose: () => void;
    onEditorModeChange: (mode: 'wysiwyg' | 'source') => void;
  }

  let { editorMode, onClose, onEditorModeChange }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  const APP_VERSION = '0.1.0';
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
  aria-label="Close settings"
></div>

<!-- Modal -->
<div
  transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
  class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
  role="dialog"
  aria-modal="true"
  aria-label="Settings"
>
  <!-- Header -->
  <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
    <Settings size={16} class="shrink-0 text-muted-foreground" />
    <h2 class="flex-1 text-sm font-semibold text-foreground">Settings</h2>
    <button
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
    >
      <X size={14} />
    </button>
  </div>

  <div class="space-y-5 px-5 py-4">
    <!-- Theme -->
    <section>
      <h3 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Appearance
      </h3>
      <div class="flex items-center justify-between">
        <span class="text-sm text-foreground">Color theme</span>
        <div class="flex gap-1">
          <button
            class="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors {!theme.isDark
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
            onclick={() => { if (theme.isDark) theme.toggle(); }}
          >
            <Sun size={12} />
            Light
          </button>
          <button
            class="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors {theme.isDark
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
            onclick={() => { if (!theme.isDark) theme.toggle(); }}
          >
            <Moon size={12} />
            Dark
          </button>
        </div>
      </div>
    </section>

    <!-- Editor mode -->
    <section>
      <h3 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Editor
      </h3>
      <div class="flex items-center justify-between">
        <span class="text-sm text-foreground">Default editor mode</span>
        <div class="flex gap-1">
          <button
            class="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors {editorMode === 'wysiwyg'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
            onclick={() => onEditorModeChange('wysiwyg')}
          >
            <Eye size={12} />
            WYSIWYG
          </button>
          <button
            class="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors {editorMode === 'source'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
            onclick={() => onEditorModeChange('source')}
          >
            <FileCode size={12} />
            Source
          </button>
        </div>
      </div>
      <p class="mt-1.5 text-xs text-muted-foreground">Toggle anytime with Ctrl+M while editing.</p>
    </section>

    <!-- System info -->
    <section>
      <h3 class="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Info size={11} />
        About
      </h3>
      <div class="space-y-1 text-xs text-muted-foreground">
        <div class="flex justify-between">
          <span>App</span>
          <span>CPTS Notes</span>
        </div>
        <div class="flex justify-between">
          <span>Version</span>
          <span>{APP_VERSION}</span>
        </div>
        <div class="flex justify-between">
          <span>Editor</span>
          <span>Milkdown / Crepe</span>
        </div>
      </div>
    </section>
  </div>

  <!-- Footer -->
  <div class="border-t border-border px-5 py-2.5">
    <p class="text-xs text-muted-foreground">
      Press <kbd class="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">?</kbd>
      to open keyboard shortcuts
    </p>
  </div>
</div>
