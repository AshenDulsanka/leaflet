<script lang="ts">
  import { Camera, Pencil, X, Trash2, Upload, RefreshCw, Image, Eye } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import ImageLightbox from '$lib/components/editor/ImageLightbox.svelte';
  import type { ScreenshotMeta } from '$lib/types';

  interface Props {
    onClose: () => void;
    onInsert: (markdown: string) => void;
    workspaceId: string | null;
    refreshTrigger?: number;
    uiMode?: 'modal' | 'inline';
  }

  let { onClose, onInsert, workspaceId, refreshTrigger = 0, uiMode = 'modal' }: Props = $props();

  let screenshots = $state<ScreenshotMeta[]>([]);
  let loading = $state(false);
  let uploading = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  
  let lightboxImage = $state<string | null>(null);
  let confirmDelete = $state<{ id: string; label: string } | null>(null);
  let renaming = $state<{ filename: string; value: string } | null>(null);
  let screenshotQuery = $state('');

  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    refreshTrigger; // track changes to force refresh when editor uploads an image
    loadScreenshots();
  });

  async function loadScreenshots(): Promise<void> {
    loading = true;
    try {
      const qs = workspaceId !== null ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const res = await fetch(`/api/screenshots${qs}`);
      if (!res.ok) {
        console.error('Failed to load screenshots:', { workspaceId, status: res.status });
        screenshots = [];
        return;
      }
      const data: unknown = await res.json();
      screenshots = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Failed to load screenshots:', { workspaceId, error: err });
      screenshots = [];
    } finally {
      loading = false;
    }
  }

  async function deleteScreenshot(filename: string): Promise<void> {
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const res = await fetch(`/api/screenshots/${encodeURIComponent(filename)}${qs}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete screenshot:', { filename, status: res.status }); return; }
      screenshots = screenshots.filter((s) => s.filename !== filename);
    } catch (err) {
      console.error('Failed to delete screenshot:', err);
    }
  }

  async function renameScreenshot(filename: string, newName: string): Promise<void> {
    if (!workspaceId) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/screenshots/${encodeURIComponent(filename)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, caption: trimmed, newFilename: trimmed }),
      });
      if (!res.ok) {
        console.error('Failed to rename screenshot:', { filename, status: res.status });
        return; // keep renaming open
      }
      const raw: unknown = await res.json();
      if (typeof raw !== 'object' || raw === null || !('filename' in raw)) {
        console.error('Unexpected rename response shape:', raw);
        renaming = null;
        return;
      }
      const data = raw as { filename: string; url?: string; caption?: string };
      screenshots = screenshots.map((s) =>
        s.filename === filename
          ? { ...s, filename: data.filename, url: data.url ?? s.url, caption: data.caption ?? trimmed }
          : s
      );
      renaming = null; // only clear on success
    } catch (err) {
      console.error('Failed to rename screenshot:', err);
      // do NOT clear renaming — keep form open for retry
    }
  }

  async function uploadFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) return;
    uploading = true;
    const formData = new FormData();
    formData.append('image', file);
    if (workspaceId !== null) formData.append('workspace_id', workspaceId);
    try {
      const res = await fetch('/api/screenshots', { method: 'POST', body: formData });
      if (!res.ok) {
        console.error('Failed to upload screenshot:', { workspaceId, status: res.status });
        return;
      }
      await loadScreenshots();
    } catch (err) {
      console.error('Failed to upload screenshot:', { workspaceId, error: err });
    } finally {
      uploading = false;
    }
  }

  async function handleFileChange(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await uploadFile(file);
    input.value = '';
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
      f.type.startsWith('image/')
    );
    if (file) await uploadFile(file);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.key !== 'Escape') return;

    if (confirmDelete !== null) {
      e.preventDefault();
      confirmDelete = null;
      return;
    }

    if (lightboxImage !== null) {
      e.preventDefault();
      lightboxImage = null;
      return;
    }

    if (renaming !== null) {
      e.preventDefault();
      renaming = null;
      return;
    }

    onClose();
  }

  const filteredScreenshots = $derived(
    screenshotQuery.trim()
      ? screenshots.filter(
          (s) =>
            s.filename.toLowerCase().includes(screenshotQuery.toLowerCase()) ||
            (s.caption ?? '').toLowerCase().includes(screenshotQuery.toLowerCase())
        )
      : screenshots
  );
</script>

<svelte:window onkeydown={handleKeydown} />

<aside
  transition:fly={{ x: 320, duration: 250, easing: cubicOut }}
  class="absolute right-0 top-0 flex h-full w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-card"
>
  <!-- Header -->
  <div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
    <Camera size={14} class="shrink-0 text-muted-foreground" />
    <span class="flex-1 text-xs font-semibold text-foreground">Screenshots</span>
    <button
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={loadScreenshots}
      title="Refresh"
      aria-label="Refresh screenshots"
    >
      <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
    </button>
    <button
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
      aria-label="Close screenshots panel"
    >
      <X size={13} />
    </button>
  </div>

  <!-- Upload area -->
  <div
    class="mx-3 mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 p-4 transition-colors hover:border-primary/40 {uploading
      ? 'pointer-events-none opacity-50'
      : ''}"
    onclick={() => fileInput?.click()}
    ondragover={(e) => e.preventDefault()}
    ondrop={handleDrop}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') fileInput?.click();
    }}
    aria-label="Upload screenshot"
  >
    {#if uploading}
      <RefreshCw size={16} class="animate-spin text-primary" />
      <span class="text-xs text-muted-foreground">Uploading...</span>
    {:else}
      <Upload size={16} class="text-muted-foreground" />
      <span class="text-center text-xs text-muted-foreground">Click or drop an image to upload</span>
    {/if}
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    class="hidden"
    onchange={handleFileChange}
  />

  <div class="border-b border-border px-3 py-2">
    <input
      type="text"
      aria-label="Filter screenshots"
      placeholder="Filter screenshots..."
      bind:value={screenshotQuery}
      class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
    />
  </div>

  <!-- Screenshot grid -->
  <div class="flex-1 overflow-y-auto p-3">
    {#if loading && screenshots.length === 0}
      <div class="flex items-center justify-center py-8">
        <RefreshCw size={16} class="animate-spin text-muted-foreground" />
      </div>
    {:else if screenshots.length === 0}
      <div class="py-8 text-center">
        <Image size={24} class="mx-auto mb-2 text-muted-foreground/40" />
        <p class="text-xs text-muted-foreground">No screenshots yet</p>
        <p class="mt-1 text-[11px] text-muted-foreground">Upload an image or paste one into the editor</p>
      </div>
    {:else if filteredScreenshots.length === 0}
      <div class="py-8 text-center">
        <p class="text-xs text-muted-foreground">No screenshots match your filter</p>
      </div>
    {:else}
      <p class="mb-2 text-[11px] text-muted-foreground">
        {filteredScreenshots.length} screenshot{filteredScreenshots.length !== 1 ? 's' : ''}{#if screenshotQuery.trim()} (filtered){/if} - click to insert into note
      </p>
      <div class="grid grid-cols-2 gap-2">
        {#each filteredScreenshots as ss (ss.filename)}
          <div class="flex flex-col rounded-md border border-border bg-muted/30">
            <!-- Thumbnail clickable area -->
            <div
              class="group relative cursor-pointer overflow-hidden transition-colors hover:border-primary/50"
              onclick={() => onInsert(`![${ss.filename}](${ss.url})`)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter') onInsert(`![${ss.filename}](${ss.url})`);
              }}
              aria-label="Insert {ss.filename}"
            >
              <img
                src={ss.url}
                alt={ss.filename}
                class="aspect-video w-full object-cover"
                loading="lazy"
              />
              <!-- File size and insert hint at bottom -->
              <div class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 pt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <span class="text-[9px] text-white/90 drop-shadow-sm">
                  {formatSize(ss.sizeBytes)}
                </span>
                <span class="rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm backdrop-blur-md">
                  Click to Insert
                </span>
              </div>
            </div>

            <!-- Action row -->
            <div class="flex items-center gap-1 border-t border-border/50 bg-background/50 px-1 py-0.5">
              {#if renaming !== null && renaming.filename === ss.filename && uiMode === 'inline'}
                <form
                  class="flex w-full items-center gap-1"
                  onsubmit={(e) => { e.preventDefault(); renameScreenshot(ss.filename, renaming!.value); }}
                >
                  <!-- svelte-ignore a11y_autofocus -->
                  <input
                    type="text"
                    class="min-w-0 flex-1 rounded border border-input bg-background px-1 py-0.5 text-[10px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    bind:value={renaming.value}
                    onkeydown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        renaming = null;
                      }
                    }}
                    autofocus
                  />
                  <button type="submit" class="shrink-0 px-1 text-[10px] font-medium text-primary hover:underline">Save</button>
                </form>
              {:else}
                <span class="min-w-0 flex-1 truncate px-1 text-[10px] text-muted-foreground" title={ss.caption || ss.filename}>
                  {ss.caption || ss.filename}
                </span>
                <button
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                  onclick={(e) => { e.stopPropagation(); lightboxImage = ss.url; }}
                  title="View full image"
                  aria-label="View {ss.filename}"
                >
                  <Eye size={12} />
                </button>
                <button
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                  onclick={(e) => { e.stopPropagation(); renaming = { filename: ss.filename, value: ss.caption || ss.filename.replace(/\.[^.]+$/, '') }; }}
                  title="Rename screenshot"
                  aria-label="Rename {ss.filename}"
                >
                  <Pencil size={12} />
                </button>
                <button
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-destructive dark:text-red-400 transition-colors hover:bg-destructive/20 hover:text-destructive focus-visible:outline-2 focus-visible:outline-destructive"
                  onclick={(e) => { e.stopPropagation(); confirmDelete = { id: ss.filename, label: ss.filename }; }}
                  title="Delete screenshot"
                  aria-label="Delete {ss.filename}"
                >
                  <Trash2 size={12} />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</aside>

{#if lightboxImage}
  <ImageLightbox src={lightboxImage} onClose={() => lightboxImage = null} />
{/if}

{#if confirmDelete !== null}
  {@const pending = confirmDelete}
  <ConfirmDialog
    title="Delete Screenshot"
    message="Delete '{pending.label}'? This cannot be undone."
    onConfirm={() => { deleteScreenshot(pending.id); confirmDelete = null; }}
    onCancel={() => confirmDelete = null}
  />
{/if}

{#if renaming !== null && uiMode === 'modal'}
  {@const r = renaming}
  <ToolModal
    ariaLabel="Rename screenshot"
    onClose={() => (renaming = null)}
    maxWidthClass="max-w-xs"
  >
    <div class="p-4">
      <h3 class="mb-3 text-sm font-semibold text-foreground">Rename Screenshot</h3>
      <form
        onsubmit={(e) => { e.preventDefault(); renameScreenshot(r.filename, r.value); }}
      >
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="mb-3 w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          bind:value={renaming.value}
          onkeydown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              renaming = null;
            }
          }}
          autofocus
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            onclick={() => renaming = null}
            class="rounded px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/30"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  </ToolModal>
{/if}

