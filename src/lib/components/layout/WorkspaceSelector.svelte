<script lang="ts">
  import { ChevronDown, Pencil, Trash2, Plus } from '@lucide/svelte';
  import { notifications } from '$lib/notifications.svelte';
  import Dialog from '$lib/components/modals/Dialog.svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import type { Workspace } from '$lib/types';

  interface Props {
    workspaces: Workspace[];
    activeWorkspace: Workspace | null;
    onSelectWorkspace?: (ws: Workspace) => void;
    onCreateWorkspace?: () => void;
    onDeleteWorkspace?: (id: string) => void;
    onRenameWorkspace?: (id: string, newName: string) => void;
    onReorderWorkspaces?: (reordered: Workspace[]) => void;
  }

  let {
    workspaces,
    activeWorkspace,
    onSelectWorkspace,
    onCreateWorkspace,
    onDeleteWorkspace,
    onRenameWorkspace,
    onReorderWorkspaces,
  }: Props = $props();

  let dropdownOpen = $state(false);
  let draggingWsId = $state<string | null>(null);
  let dragOverWsId = $state<string | null>(null);
  let contextMenu = $state<{ x: number; y: number } | null>(null);
  let renameModalId = $state<string | null>(null);
  let renameModalName = $state('');
  let confirmDelete = $state<{ id: string; label: string } | null>(null);

  function selectWorkspace(ws: Workspace) {
    dropdownOpen = false;
    onSelectWorkspace?.(ws);
  }

  async function handleReorder(e: DragEvent, targetId: string): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    const fromId = e.dataTransfer?.getData('text/plain') ?? '';
    draggingWsId = null;
    dragOverWsId = null;
    if (!fromId || fromId === targetId) return;

    const ids = workspaces.map((w) => w.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newOrder = [...ids];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, fromId);

    const previousOrder = [...workspaces];
    const reordered = newOrder.map((id) => workspaces.find((w) => w.id === id)!);
    onReorderWorkspaces?.(reordered);

    try {
      const res = await fetch('/api/workspaces/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      });
      if (!res.ok) throw new Error(`Workspace reorder failed: ${res.status}`);
    } catch (err) {
      console.error('Failed to reorder workspaces:', err);
      onReorderWorkspaces?.(previousOrder);
      notifications.add('error', 'Failed to reorder workspaces. Please try again.');
    }
  }

  function openRename(id: string, name: string) {
    renameModalId = id;
    renameModalName = name;
    dropdownOpen = false;
    contextMenu = null;
  }

  function openDelete(id: string, label: string) {
    confirmDelete = { id, label };
    contextMenu = null;
  }
</script>

<svelte:window
  onclick={() => {
    dropdownOpen = false;
    contextMenu = null;
  }}
/>

<div class="relative px-2 pb-2">
  <div class="rounded-md border border-border bg-card p-0.5 shadow-sm ring-1 ring-border/60">
    <!-- Workspace trigger button -->
    <div
      class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-accent"
      onclick={(e) => { e.stopPropagation(); dropdownOpen = !dropdownOpen; }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dropdownOpen = !dropdownOpen; } }}
      oncontextmenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeWorkspace) contextMenu = { x: e.clientX, y: e.clientY };
      }}
      role="button"
      tabindex="0"
      aria-haspopup="listbox"
      aria-expanded={dropdownOpen}
      title="Switch workspace"
    >
      <div
        class="h-3 w-3 flex-shrink-0 rounded-sm"
        style={activeWorkspace ? `background-color: ${activeWorkspace.icon_color}` : 'background-color: #6366f1'}
      ></div>
      <span class="flex-1 truncate text-xs font-medium text-foreground">
        {activeWorkspace?.name ?? 'No workspace'}
      </span>
      <ChevronDown size={11} class="flex-shrink-0 text-muted-foreground" />
    </div>
  </div>

  <!-- Dropdown list -->
  {#if dropdownOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="absolute left-2 right-2 top-full z-50 rounded-md border border-border bg-popover shadow-lg"
      onclick={(e) => e.stopPropagation()}
    >
      {#each workspaces as ws (ws.id)}
        <div
          class="flex w-full items-center gap-2 px-3 text-left text-xs
            {activeWorkspace?.id === ws.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent'}
            {dragOverWsId === ws.id && draggingWsId !== ws.id ? 'bg-primary/10' : ''}"
          draggable={true}
          ondragstart={(e) => {
            e.stopPropagation();
            draggingWsId = ws.id;
            e.dataTransfer?.setData('text/plain', ws.id);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          }}
          ondragover={(e) => { e.preventDefault(); e.stopPropagation(); dragOverWsId = ws.id; }}
          ondragleave={() => { if (dragOverWsId === ws.id) dragOverWsId = null; }}
          ondragend={() => { draggingWsId = null; dragOverWsId = null; }}
          ondrop={(e) => handleReorder(e, ws.id)}
        >
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
            onclick={() => selectWorkspace(ws)}
            role="button"
            tabindex="0"
          >
            <div class="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style="background-color: {ws.icon_color}"></div>
            <span class="flex-1 truncate text-left">{ws.name}</span>
          </div>

          <div class="ml-2 flex shrink-0 items-center gap-1.5">
            {#if ws.host_count || ws.flag_count}
              <span class="text-[10px] text-muted-foreground">{ws.host_count ?? 0}H / {ws.flag_count ?? 0}F</span>
            {/if}
            <div class="flex items-center gap-0.5">
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); openRename(ws.id, ws.name); }}
                class="inline-flex h-7 w-7 items-center justify-center rounded text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
                title="Rename workspace"
                aria-label="Rename workspace"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); openDelete(ws.id, ws.name); }}
                class="inline-flex h-7 w-7 items-center justify-center rounded text-destructive transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:outline-2 focus-visible:outline-destructive"
                title="Delete workspace"
                aria-label="Delete workspace {ws.name}"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      {/each}

      {#if onCreateWorkspace}
        {#if workspaces.length > 0}
          <div class="my-1 border-t border-border"></div>
        {/if}
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          onclick={() => { dropdownOpen = false; onCreateWorkspace?.(); }}
        >
          <Plus size={11} /> New workspace
        </button>
      {/if}
    </div>
  {/if}
</div>

<!-- Right-click context menu on the active workspace trigger -->
{#if contextMenu}
  {@const m = contextMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed z-50 min-w-44 rounded-md border border-border bg-popover py-1 shadow-lg"
    style="left: {m.x}px; top: {m.y}px"
    onclick={(e) => e.stopPropagation()}
  >
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      onclick={() => { if (activeWorkspace) openRename(activeWorkspace.id, activeWorkspace.name); }}
    >
      <Pencil size={13} /> Rename
    </button>
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent"
      onclick={() => { if (activeWorkspace) openDelete(activeWorkspace.id, activeWorkspace.name); }}
    >
      <Trash2 size={13} /> Delete
    </button>
  </div>
{/if}

<!-- Rename dialog -->
{#if renameModalId !== null}
  <Dialog
    title="Rename Workspace"
    defaultValue={renameModalName}
    confirmLabel="Save"
    onConfirm={(value) => {
      if (renameModalId && value.trim()) onRenameWorkspace?.(renameModalId, value.trim());
      renameModalId = null;
      renameModalName = '';
    }}
    onCancel={() => { renameModalId = null; renameModalName = ''; }}
  />
{/if}

<!-- Delete confirm dialog -->
{#if confirmDelete}
  <ConfirmDialog
    title="Delete Workspace"
    message={`Are you sure you want to delete the workspace "${confirmDelete.label}"? This action cannot be undone.`}
    confirmLabel="Delete"
    destructive={true}
    onConfirm={() => {
      onDeleteWorkspace?.(confirmDelete!.id);
      confirmDelete = null;
    }}
    onCancel={() => (confirmDelete = null)}
  />
{/if}
