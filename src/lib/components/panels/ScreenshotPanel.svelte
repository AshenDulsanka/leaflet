<script lang="ts">
  import { Camera, X, Trash2, Upload, RefreshCw, Image, Link, Link2Off } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { ScreenshotMeta, FileNode } from '$lib/types';

  interface Props {
    onClose: () => void;
    onInsert: (markdown: string) => void;
    workspaceId: string | null;
    notesFolder: string;
  }

  let { onClose, onInsert, workspaceId, notesFolder }: Props = $props();

  let screenshots = $state<ScreenshotMeta[]>([]);
  let loading = $state(false);
  let uploading = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  // Caption editing state
  let editingCaption = $state<string | null>(null); // filename currently being edited
  let captionDraft = $state('');

  // Note-link picker state
  let linkingNote = $state<string | null>(null); // filename whose note picker is open
  let noteQuery = $state('');
  let allNoteFiles = $state<{ name: string; path: string }[]>([]);
  let notesLoaded = $state(false);

  $effect(() => {
    loadScreenshots();
  });

  async function loadScreenshots(): Promise<void> {
    loading = true;
    try {
      const qs = workspaceId !== null ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      const res = await fetch(`/api/screenshots${qs}`);
      screenshots = await res.json();
    } catch {
      screenshots = [];
    } finally {
      loading = false;
    }
  }

  async function deleteScreenshot(filename: string): Promise<void> {
    try {
      await fetch(`/api/screenshots/${filename}`, { method: 'DELETE' });
      screenshots = screenshots.filter((s) => s.filename !== filename);
    } catch {
      console.error('Failed to delete screenshot');
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
      if (res.ok) await loadScreenshots();
    } catch {
      console.error('Failed to upload screenshot');
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

  // ---- caption editing ----

  function startEditCaption(ss: ScreenshotMeta): void {
    editingCaption = ss.filename;
    captionDraft = ss.caption;
    // Close any open note picker
    linkingNote = null;
  }

  async function commitCaption(ss: ScreenshotMeta): Promise<void> {
    if (workspaceId === null) return;
    const trimmed = captionDraft.trim();
    editingCaption = null;
    if (trimmed === ss.caption) return; // no change
    try {
      await fetch(`/api/screenshots/${ss.filename}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, caption: trimmed }),
      });
      screenshots = screenshots.map((s) =>
        s.filename === ss.filename ? { ...s, caption: trimmed } : s
      );
    } catch {
      console.error('Failed to save caption');
    }
  }

  function handleCaptionKeydown(e: KeyboardEvent, ss: ScreenshotMeta): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCaption(ss);
    } else if (e.key === 'Escape') {
      editingCaption = null;
    }
  }

  // ---- note linking ----

  function flattenTree(nodes: FileNode[]): { name: string; path: string }[] {
    const result: { name: string; path: string }[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        result.push({ name: node.name, path: node.path });
      } else if (node.children) {
        result.push(...flattenTree(node.children));
      }
    }
    return result;
  }

  async function openNotePicker(ss: ScreenshotMeta): Promise<void> {
    linkingNote = ss.filename;
    noteQuery = '';
    editingCaption = null;

    if (!notesLoaded) {
      try {
        const base = notesFolder ? `?base=${encodeURIComponent(notesFolder)}` : '';
        const res = await fetch(`/api/notes/tree${base}`);
        const data = await res.json();
        allNoteFiles = flattenTree(data.tree ?? []);
        notesLoaded = true;
      } catch {
        allNoteFiles = [];
      }
    }
  }

  function closeNotePicker(): void {
    linkingNote = null;
    noteQuery = '';
  }

  const filteredNotes = $derived(
    noteQuery.trim() === ''
      ? allNoteFiles.slice(0, 20)
      : allNoteFiles.filter((n) =>
          n.name.toLowerCase().includes(noteQuery.toLowerCase()) ||
          n.path.toLowerCase().includes(noteQuery.toLowerCase())
        ).slice(0, 20)
  );

  async function selectNote(ss: ScreenshotMeta, notePath: string): Promise<void> {
    if (workspaceId === null) return;
    closeNotePicker();
    try {
      await fetch(`/api/screenshots/${ss.filename}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, linked_note_path: notePath }),
      });
      screenshots = screenshots.map((s) =>
        s.filename === ss.filename ? { ...s, linked_note_path: notePath } : s
      );
    } catch {
      console.error('Failed to link note');
    }
  }

  async function unlinkNote(ss: ScreenshotMeta): Promise<void> {
    if (workspaceId === null) return;
    try {
      await fetch(`/api/screenshots/${ss.filename}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, linked_note_path: '' }),
      });
      screenshots = screenshots.map((s) =>
        s.filename === ss.filename ? { ...s, linked_note_path: '' } : s
      );
    } catch {
      console.error('Failed to unlink note');
    }
  }

  function noteName(path: string): string {
    // Return just the basename without extension for display
    const parts = path.split('/');
    return parts[parts.length - 1].replace(/\.md$/, '');
  }

  /** Programmatic focus action — avoids the a11y autofocus attribute warning. */
  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
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
          <div class="flex flex-col gap-1 rounded-md border border-border bg-muted/30 overflow-hidden">
            <!-- Thumbnail clickable area -->
            <div
              class="group relative cursor-pointer overflow-hidden transition-colors hover:border-primary/50"
              onclick={() => onInsert(`![${ss.caption || ss.filename}](${ss.url})`)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter') onInsert(`![${ss.caption || ss.filename}](${ss.url})`);
              }}
              aria-label="Insert {ss.filename}"
            >
              <img
                src={ss.url}
                alt={ss.caption || ss.filename}
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

            <!-- Caption row -->
            <div class="px-1.5 pb-0.5">
              {#if editingCaption === ss.filename}
                <input
                  type="text"
                  class="w-full rounded border border-primary/50 bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none"
                  bind:value={captionDraft}
                  onblur={() => commitCaption(ss)}
                  onkeydown={(e) => handleCaptionKeydown(e, ss)}
                  maxlength="500"
                  placeholder="Add caption…"
                  use:focusOnMount
                />
              {:else}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="cursor-text rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/60 {ss.caption ? 'text-foreground' : ''}"
                  style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;"
                  onclick={() => { if (workspaceId !== null) startEditCaption(ss); }}
                  title={workspaceId !== null ? 'Click to edit caption' : ss.caption}
                >
                  {ss.caption || 'Add caption…'}
                </div>
              {/if}
            </div>

            <!-- Note link row (only shown when workspace is active) -->
            {#if workspaceId !== null}
              <div class="px-1.5 pb-1.5">
                {#if linkingNote === ss.filename}
                  <!-- Note search picker -->
                  <div class="flex flex-col gap-1">
                    <input
                      type="text"
                      class="w-full rounded border border-primary/50 bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none"
                      bind:value={noteQuery}
                      placeholder="Search notes…"
                      use:focusOnMount
                      onkeydown={(e) => { if (e.key === 'Escape') closeNotePicker(); }}
                    />
                    {#if filteredNotes.length > 0}
                      <div class="max-h-24 overflow-y-auto rounded border border-border bg-popover text-[11px]">
                        {#each filteredNotes as note (note.path)}
                          <button
                            class="flex w-full items-center px-2 py-1 text-left hover:bg-muted/60"
                            onclick={() => selectNote(ss, note.path)}
                          >
                            {note.name}
                          </button>
                        {/each}
                      </div>
                    {:else if noteQuery.length > 0}
                      <p class="px-1 text-[10px] text-muted-foreground">No notes found</p>
                    {/if}
                    <button
                      class="text-left text-[10px] text-muted-foreground hover:text-foreground"
                      onclick={closeNotePicker}
                    >
                      Cancel
                    </button>
                  </div>
                {:else if ss.linked_note_path}
                  <!-- Linked note display -->
                  <div class="flex items-center gap-1">
                    <Link size={10} class="shrink-0 text-primary" />
                    <span class="flex-1 truncate text-[10px] text-primary" title={ss.linked_note_path}>
                      {noteName(ss.linked_note_path)}
                    </span>
                    <button
                      class="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                      onclick={() => unlinkNote(ss)}
                      title="Unlink note"
                    >
                      <Link2Off size={9} />
                    </button>
                  </div>
                {:else}
                  <!-- Link note button -->
                  <button
                    class="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    onclick={() => openNotePicker(ss)}
                  >
                    <Link size={10} />
                    Link note
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</aside>

