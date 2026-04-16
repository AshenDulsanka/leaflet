<script lang="ts">
  import { Camera, X, Trash2, Upload, RefreshCw, Image, Eye } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import ImageLightbox from '$lib/components/editor/ImageLightbox.svelte';
  import type { ScreenshotMeta } from '$lib/types';

  interface Props {
    onClose: () => void;
    onInsert: (markdown: string) => void;
    workspaceId: string | null;
  }

  let { onClose, onInsert, workspaceId }: Props = $props();

  let screenshots = $state<ScreenshotMeta[]>([]);
  let loading = $state(false);
  let uploading = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  
  let lightboxImage = $state<string | null>(null);
  let confirmDelete = $state<{ id: string; label: string } | null>(null);

  $effect(() => {
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
      const res = await fetch(`/api/screenshots/${filename}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete screenshot:', { filename, status: res.status }); return; }
      screenshots = screenshots.filter((s) => s.filename !== filename);
    } catch (err) {
      console.error('Failed to delete screenshot:', err);
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
    if (e.key === 'Escape') onClose();
  }
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
    >
      <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
    </button>
    <button
      class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
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
    {:else}
      <p class="mb-2 text-[11px] text-muted-foreground">
        {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''} - click to insert into note
      </p>
      <div class="grid grid-cols-2 gap-2">
        {#each screenshots as ss (ss.filename)}
          <div class="flex flex-col gap-1 rounded-md border border-border bg-muted/30 overflow-hidden">
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
              <!-- Persistent top-right controls -->
              <div class="absolute right-1 top-1 flex flex-col gap-1">
                <button
                  class="flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-muted"
                  onclick={(e) => { e.stopPropagation(); lightboxImage = ss.url; }}
                  title="View full image"
                  aria-label="View {ss.filename}"
                >
                  <Eye size={12} />
                </button>
                <button
                  class="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/90 text-white shadow hover:bg-destructive"
                  onclick={(e) => { e.stopPropagation(); confirmDelete = { id: ss.filename, label: ss.filename }; }}
                  title="Delete screenshot"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              
              <!-- File size and insert hint at bottom -->
              <div class="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5 pt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <span class="text-[9px] text-white/90 drop-shadow-sm">
                  {formatSize(ss.sizeBytes)}
                </span>
                <span class="rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm backdrop-blur-md">
                  Click to Insert
                </span>
              </div>
            </div>
            <p class="truncate px-1.5 pb-1.5 text-[10px] leading-4 text-muted-foreground" title={ss.filename}>
              {ss.filename}
            </p>
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

