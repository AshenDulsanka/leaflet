<script lang="ts">
  import { PanelLeftClose, PanelLeftOpen, FileText, Pin, PinOff, Pencil, Trash2, ChevronDown, Plus } from '@lucide/svelte';
  import FileTree from './FileTree.svelte';
  import SyncButton from './SyncButton.svelte';
  import Dialog from '$lib/components/modals/Dialog.svelte';
  import type { FileNode, Workspace } from '$lib/types';

  interface Props {
    tree: FileNode[];
    activeFile: string | null;
    collapsed?: boolean;
    workspaces?: Workspace[];
    activeWorkspace?: Workspace | null;
    onOpenFile: (path: string) => void;
    onCreateFile: (path: string) => void;
    onCreateFolder: (path: string) => void;
    onDeleteItem: (path: string) => void;
    onRenameItem: (fromPath: string, toPath: string) => void;
    onMoveItem: (fromPath: string, toFolderPath: string) => void;
    onSelectWorkspace?: (ws: Workspace) => void;
    onCreateWorkspace?: () => void;
    onPullSuccess?: () => void;
  }

  let { tree, activeFile, collapsed = $bindable(false), workspaces = [], activeWorkspace = null, onOpenFile, onCreateFile, onCreateFolder, onDeleteItem, onRenameItem, onMoveItem, onSelectWorkspace, onCreateWorkspace, onPullSuccess }: Props = $props();

  let wsDropdownOpen = $state(false);

  function handleSelectWorkspace(ws: Workspace) {
    wsDropdownOpen = false;
    onSelectWorkspace?.(ws);
  }

  // Intercept delete/rename to keep pin list in sync.
  function handleDeleteItem(path: string) {
    pinned = pinned.filter((p) => p !== path);
    savePinned(pinned);
    onDeleteItem(path);
  }

  function handleRenameItem(fromPath: string, toPath: string) {
    if (pinned.includes(fromPath)) {
      pinned = pinned.map((p) => (p === fromPath ? toPath : p));
      savePinned(pinned);
    }
    onRenameItem(fromPath, toPath);
  }

  // Pinned notes - persisted in localStorage, scoped per workspace
  function storageKey(): string {
    const wsId = activeWorkspace?.id ?? 'global';
    return `notes-pinned-${wsId}`;
  }

  function loadPinned(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
    } catch {
      return [];
    }
  }

  function savePinned(paths: string[]) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey(), JSON.stringify(paths));
  }

  let pinned = $state<string[]>(loadPinned());

  // Reload pinned list when workspace changes
  $effect(() => {
    // Access activeWorkspace to track it as a dependency
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    activeWorkspace;
    pinned = loadPinned();
  });

  // Context menu for pinned items
  let pinnedMenu = $state<{ x: number; y: number; path: string } | null>(null);
  let pinnedDialog = $state<{ type: 'rename' | 'delete'; path: string } | null>(null);

  function openPinnedMenu(e: MouseEvent, path: string) {
    e.preventDefault();
    e.stopPropagation();
    pinnedMenu = { x: e.clientX, y: e.clientY, path };
  }

  function closePinnedMenu() { pinnedMenu = null; }

  function togglePin(path: string) {
    if (pinned.includes(path)) {
      pinned = pinned.filter((p) => p !== path);
    } else {
      pinned = [...pinned, path];
    }
    savePinned(pinned);
  }

  // Resize state
  let sidebarWidth = $state(260);
  let isResizing = $state(false);

  function startResize(e: MouseEvent) {
    isResizing = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onMouseMove(e: MouseEvent) {
      const newWidth = startWidth + (e.clientX - startX);
      sidebarWidth = Math.min(400, Math.max(180, newWidth));
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

<svelte:window onclick={() => { closePinnedMenu(); wsDropdownOpen = false; }} />

<aside
  class="relative flex flex-shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200"
  style={collapsed ? 'width: 40px' : `width: ${sidebarWidth}px`}
>
  <!-- Header: title + sync + collapse toggle -->
  <div class="flex h-8 items-center justify-between pl-3 pr-1">
    {#if !collapsed}
      <span class="text-xs font-medium tracking-widest text-muted-foreground uppercase">Notes</span>
      <div class="ml-auto flex items-center gap-0.5">
        <SyncButton {onPullSuccess} />
        <button
          title="Collapse sidebar (Ctrl+B)"
          onclick={() => (collapsed = !collapsed)}
          class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={13} />
        </button>
      </div>
    {:else}
      <button
        title="Expand sidebar (Ctrl+B)"
        onclick={() => (collapsed = !collapsed)}
        class="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Expand sidebar"
      >
        <PanelLeftOpen size={13} />
      </button>
    {/if}
  </div>

  <!-- Workspace selector (hidden when collapsed) -->
  {#if !collapsed && (workspaces.length > 0 || onCreateWorkspace)}
    <div class="relative px-2 pb-2">
      <div
        class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 hover:bg-accent"
        onclick={(e) => { e.stopPropagation(); wsDropdownOpen = !wsDropdownOpen; }}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wsDropdownOpen = !wsDropdownOpen; } }}
        role="button"
        tabindex="0"
        aria-haspopup="listbox"
        aria-expanded={wsDropdownOpen}
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

      {#if wsDropdownOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="absolute left-2 right-2 top-full z-50 mt-0.5 rounded-md border border-border bg-popover py-1 shadow-lg"
          onclick={(e) => e.stopPropagation()}
        >
          {#each workspaces as ws (ws.id)}
            <button
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent
                     {activeWorkspace?.id === ws.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}"
              onclick={() => handleSelectWorkspace(ws)}
            >
              <div class="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style="background-color: {ws.icon_color}"></div>
              <span class="flex-1 truncate">{ws.name}</span>
              {#if ws.host_count || ws.flag_count}
                <span class="text-[10px] text-muted-foreground">{ws.host_count ?? 0}H / {ws.flag_count ?? 0}F</span>
              {/if}
            </button>
          {/each}
          {#if onCreateWorkspace}
            {#if workspaces.length > 0}
              <div class="my-1 border-t border-border"></div>
            {/if}
            <button
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onclick={() => { wsDropdownOpen = false; onCreateWorkspace?.(); }}
            >
              <Plus size={11} />
              New workspace
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- File tree (hidden when collapsed) -->
  {#if !collapsed}
    <!-- Pinned section -->
    {#if pinned.length > 0}
      <div class="px-3 pb-1">
        <p class="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pinned</p>
        {#each pinned as path (path)}
          {@const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path}
          <button
            class="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-sm hover:bg-accent
                   {activeFile === path ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}"
            onclick={() => onOpenFile(path)}
            oncontextmenu={(e) => openPinnedMenu(e, path)}
            title={path}
          >
            <Pin size={11} class="shrink-0 text-primary/70" />
            <FileText size={13} class="shrink-0 text-muted-foreground" />
            <span class="truncate">{name}</span>
          </button>
        {/each}
        <div class="mt-1 border-t border-border"></div>
      </div>
    {/if}

    <div
      class="flex-1 overflow-y-auto px-1 pb-4"
      role="tree"
      tabindex="-1"
      aria-label="File tree"
      onkeydown={(e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const btns = Array.from(
          (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button[oncontextmenu]')
        );
        const active = document.activeElement as HTMLElement;
        const idx = btns.indexOf(active as HTMLButtonElement);
        if (e.key === 'ArrowDown') btns[Math.min(idx + 1, btns.length - 1)]?.focus();
        if (e.key === 'ArrowUp')   btns[Math.max(idx - 1, 0)]?.focus();
      }}
    >
      <FileTree
        nodes={tree}
        {activeFile}
        depth={0}
        {pinned}
        {onOpenFile}
        {onCreateFile}
        {onCreateFolder}
        onDeleteItem={handleDeleteItem}
        onRenameItem={handleRenameItem}
        onTogglePin={togglePin}
        {onMoveItem}
      />
    </div>
  {/if}

  <!-- Resize handle (only when expanded) -->
  {#if !collapsed}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/30 {isResizing
        ? 'bg-primary/50'
        : ''}"
      onmousedown={startResize}
    ></div>
  {/if}
</aside>

<!-- Pinned-item context menu -->
{#if pinnedMenu}
  {@const m = pinnedMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed z-50 min-w-44 rounded-md border border-border bg-popover py-1 shadow-lg"
    style="left: {m.x}px; top: {m.y}px"
    onclick={(e) => e.stopPropagation()}
  >
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      onclick={() => { const path = m.path; closePinnedMenu(); togglePin(path); }}
    >
      <PinOff size={13} /> Unpin from favorites
    </button>
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      onclick={() => { const path = m.path; closePinnedMenu(); pinnedDialog = { type: 'rename', path }; }}
    >
      <Pencil size={13} /> Rename
    </button>
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent"
      onclick={() => { const path = m.path; closePinnedMenu(); pinnedDialog = { type: 'delete', path }; }}
    >
      <Trash2 size={13} /> Delete
    </button>
  </div>
{/if}

<!-- Pinned-item dialogs (rename / delete) -->
{#if pinnedDialog !== null}
  {#if pinnedDialog.type === 'rename'}
    {@const d = pinnedDialog}
    {@const name = d.path.split('/').pop()?.replace(/\.md$/, '') ?? d.path}
    <Dialog
      title="Rename"
      defaultValue={name}
      confirmLabel="Rename"
      onConfirm={(newName) => {
        const p = d.path;
        const currentName = name; // capture before nullifying reactive state
        pinnedDialog = null;
        if (!newName || newName === currentName) return;
        const dir = p.includes('/') ? p.substring(0, p.lastIndexOf('/') + 1) : '';
        const newPath = `${dir}${newName}.md`;
        // Remove old pin and add new path
        pinned = pinned.map((x) => (x === p ? newPath : x));
        savePinned(pinned);
        handleRenameItem(p, newPath);
      }}
      onCancel={() => (pinnedDialog = null)}
    />
  {:else if pinnedDialog.type === 'delete'}
    {@const d = pinnedDialog}
    {@const name = d.path.split('/').pop()?.replace(/\.md$/, '') ?? d.path}
    <Dialog
      title="Delete {name}"
      message={`Delete "${name}"? This cannot be undone.`}
      variant="confirm"
      confirmLabel="Delete"
      destructive={true}
      onConfirm={() => {
        const p = d.path;
        pinnedDialog = null;
        pinned = pinned.filter((x) => x !== p);
        savePinned(pinned);
        handleDeleteItem(p);
      }}
      onCancel={() => (pinnedDialog = null)}
    />
  {/if}
{/if}
