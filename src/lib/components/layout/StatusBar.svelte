<script lang="ts">
  import { Save, Circle, FileCode, Eye } from '@lucide/svelte';

  interface Props {
    activeFile: string | null;
    isSaving: boolean;
    isDirty: boolean;
    wordCount: number;
    editorMode: 'wysiwyg' | 'source';
  }

  let { activeFile, isSaving, isDirty, wordCount, editorMode }: Props = $props();

  // Display only the last two path segments so the bar doesn't overflow
  const displayPath = $derived.by(() => {
    if (!activeFile) return null;
    const parts = activeFile.split('/');
    return parts.length > 2 ? '...' + parts.slice(-2).join('/') : activeFile;
  });
</script>

<footer
  class="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-muted/50 px-3 text-xs text-muted-foreground"
>
  {#if activeFile}
    <!-- File path -->
    <span class="truncate max-w-xs" title={activeFile}>{displayPath}</span>

    <!-- Divider -->
    <span class="text-border">|</span>

    <!-- Save status -->
    <span class="flex items-center gap-1">
      {#if isSaving}
        <Save size={10} class="animate-pulse text-primary" />
        <span>Saving...</span>
      {:else if isDirty}
        <Circle size={8} class="fill-yellow-500 text-yellow-500" />
        <span>Unsaved</span>
      {:else}
        <Circle size={8} class="fill-green-500 text-green-500" />
        <span>Saved</span>
      {/if}
    </span>

    <!-- Divider -->
    <span class="text-border">|</span>

    <!-- Word count -->
    <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>

    <!-- Divider -->
    <span class="text-border">|</span>

    <!-- Editor mode -->
    <span class="flex items-center gap-1">
      {#if editorMode === 'wysiwyg'}
        <Eye size={10} />
        <span>WYSIWYG</span>
      {:else}
        <FileCode size={10} />
        <span>Source</span>
      {/if}
    </span>
  {:else}
    <span>No file open</span>
  {/if}

  <!-- Push remaining info to the right -->
  <span class="ml-auto">CPTS Notes</span>
</footer>
