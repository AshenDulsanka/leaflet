<script lang="ts">
  import { Camera, X, Trash2, Upload, RefreshCw, Image } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Screenshot {
    filename: string;
    url: string;
    sizeBytes: number;
  }

  interface Props {
    onClose: () => void;
    onInsert: (markdown: string) => void;
  }

  let { onClose, onInsert }: Props = $props();

  let screenshots = $state<Screenshot[]>([]);
  let loading = $state(false);
  let uploading = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    loadScreenshots();
  });

  async function loadScreenshots() {
    loading = true;
    try {
      const res = await fetch('/api/screenshots');
      screenshots = await res.json();
    } catch {
      screenshots = [];
    } finally {
      loading = false;
    }
  }

  async function deleteScreenshot(filename: string) {
    try {
      await fetch(`/api/screenshots/${filename}`, { method: 'DELETE' });
      screenshots = screenshots.filter((s) => s.filename !== filename);
    } catch {
      console.error('Failed to delete screenshot');
    }
  }

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    uploading = true;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/api/screenshots', { method: 'POST', body: formData });
      if (res.ok) await loadScreenshots();
    } catch {
      console.error('Failed to upload screenshot');
    } finally {
      uploading = false;
    }
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await uploadFile(file);
    input.value = '';
  }

  async function handleDrop(e: DragEvent) {
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<aside
  transition:fly={{ x: 320, duration: 250, easing: cubicOut }}
  class="flex w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-card"
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
          <div
            class="group relative cursor-pointer overflow-hidden rounded-md border border-border bg-muted/30 transition-colors hover:border-primary/50"
            onclick={() => onInsert(`![screenshot](${ss.url})`)}
            role="button"
            tabindex="0"
            onkeydown={(e) => { if (e.key === 'Enter') onInsert(`![screenshot](${ss.url})`); }}
            aria-label="Insert {ss.filename}"
          >
            <img
              src={ss.url}
              alt={ss.filename}
              class="aspect-video w-full object-cover"
              loading="lazy"
            />
            <!-- Hover overlay -->
            <div
              class="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <span
                class="rounded bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground"
              >
                Insert
              </span>
            </div>
            <!-- Delete button -->
            <button
              class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-destructive/90 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
              onclick={(e) => { e.stopPropagation(); deleteScreenshot(ss.filename); }}
              title="Delete screenshot"
            >
              <Trash2 size={10} />
            </button>
            <!-- File size label -->
            <span class="absolute bottom-1 right-1.5 text-[9px] text-white drop-shadow">
              {formatSize(ss.sizeBytes)}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</aside>
