<script lang="ts">
  import { FileText, Folder, FolderOpen, ChevronRight, FilePlus, FolderPlus, Pencil, Trash2, Pin, PinOff } from '@lucide/svelte';
  import type { FileNode } from '$lib/types';
  import FileTree from './FileTree.svelte';
  import Dialog from '$lib/components/modals/Dialog.svelte';

  interface Props {
    nodes: FileNode[];
    activeFile: string | null;
    depth: number;
    pinned?: string[];
    onOpenFile: (path: string) => void;
    onCreateFile: (path: string) => void;
    onCreateFolder: (path: string) => void;
    onDeleteItem: (path: string) => void;
    onRenameItem: (fromPath: string, toPath: string) => void;
    onTogglePin?: (path: string) => void;
    onMoveItem?: (fromPath: string, toFolderPath: string) => void;
    onNewNoteInFolder?: (parentPath: string) => void;
    onReorderNotes?: (orderedPaths: string[]) => void;
  }

  let { nodes, activeFile, depth, pinned = [], onOpenFile, onCreateFile, onCreateFolder, onDeleteItem, onRenameItem, onTogglePin, onMoveItem, onNewNoteInFolder, onReorderNotes }: Props =
    $props();

  // Track which folders are expanded
  let expanded = $state<Record<string, boolean>>({});

  // Drag-and-drop: highlight the folder being hovered as a drop target
  let dropTargetPath = $state<string | null>(null);

  // Sibling reorder drag indicator
  let reorderDragOver = $state<{ path: string; position: 'before' | 'after' } | null>(null);

  // Module-level dragged path — avoids browser protected-mode getData() restriction during dragover
  let draggedPath = $state<string | null>(null);

  // Flat set of all known paths (including children) for drag validation
  function flattenPaths(ns: FileNode[]): Set<string> {
    const paths = new Set<string>();
    const collect = (items: FileNode[]) => {
      for (const n of items) {
        paths.add(n.path);
        if (n.children) collect(n.children);
      }
    };
    collect(ns);
    return paths;
  }

  const knownPaths = $derived(flattenPaths(nodes));

  function getDirname(filePath: string): string {
    const idx = filePath.lastIndexOf('/');
    return idx >= 0 ? filePath.substring(0, idx) : '';
  }

  function handleDragStart(e: DragEvent, nodePath: string) {
    draggedPath = nodePath;
    e.dataTransfer?.setData('text/plain', nodePath);
    e.stopPropagation();
  }

  function handleFolderDragOver(e: DragEvent, node: FileNode) {
    if (!draggedPath || draggedPath === node.path) return;
    if (draggedPath.startsWith(node.path + '/')) return; // ancestor guard
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    const sameSiblings = getDirname(draggedPath) === getDirname(node.path);

    if (sameSiblings && onReorderNotes && pct < 0.3) {
      reorderDragOver = { path: node.path, position: 'before' };
      dropTargetPath = null;
    } else if (sameSiblings && onReorderNotes && pct > 0.7) {
      reorderDragOver = { path: node.path, position: 'after' };
      dropTargetPath = null;
    } else {
      dropTargetPath = node.path;
      reorderDragOver = null;
    }
  }

  function handleFolderDragLeave(e: DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      dropTargetPath = null;
      reorderDragOver = null;
    }
  }

  function handleFolderDrop(e: DragEvent, node: FileNode, siblings: FileNode[]) {
    e.preventDefault();
    e.stopPropagation();

    const fromPath = draggedPath || e.dataTransfer?.getData('text/plain');
    dropTargetPath = null;
    reorderDragOver = null;

    if (!fromPath || fromPath === node.path) return;
    if (!knownPaths.has(fromPath)) return; // reject untrusted drag source
    if (fromPath.startsWith(node.path + '/')) return; // prevent drop into descendant

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;
    const sameSiblings = getDirname(fromPath) === getDirname(node.path);

    if (sameSiblings && onReorderNotes && (pct < 0.3 || pct > 0.7)) {
      const position: 'before' | 'after' = pct < 0.3 ? 'before' : 'after';
      const paths = siblings.map((n) => n.path);
      const fromIdx = paths.indexOf(fromPath);
      if (fromIdx === -1) return;
      const newPaths = [...paths];
      newPaths.splice(fromIdx, 1);
      const targetIdx = newPaths.indexOf(node.path);
      if (targetIdx === -1) return;
      const insertAt = position === 'after' ? targetIdx + 1 : targetIdx;
      newPaths.splice(insertAt, 0, fromPath);
      onReorderNotes(newPaths);
    } else {
      onMoveItem?.(fromPath, node.path);
      expanded[node.path] = true;
    }
  }
  function handleReorderDragOver(e: DragEvent, targetNode: FileNode) {
    if (!onReorderNotes || !draggedPath) return;
    if (draggedPath === targetNode.path) return;
    // Only allow within same folder
    if (getDirname(draggedPath) !== getDirname(targetNode.path)) return;
    e.preventDefault();
    e.stopPropagation(); // prevent folder drop handlers from firing
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    reorderDragOver = { path: targetNode.path, position };
  }

  function handleReorderDragLeave(_e: DragEvent) {
    reorderDragOver = null;
  }

  function handleReorderDrop(e: DragEvent, targetNode: FileNode, siblings: FileNode[]) {
    if (!onReorderNotes) return;
    // getData IS readable in drop events; prefer trusted in-memory state
    const fromPath = draggedPath || e.dataTransfer?.getData('text/plain');
    if (!fromPath || fromPath === targetNode.path) return;
    if (!knownPaths.has(fromPath)) return; // reject untrusted drag source
    if (getDirname(fromPath) !== getDirname(targetNode.path)) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    reorderDragOver = null;

    const paths = siblings.map((n) => n.path);
    const fromIdx = paths.indexOf(fromPath);
    if (fromIdx === -1) return;

    const newPaths = [...paths];
    newPaths.splice(fromIdx, 1);

    const targetIdx = newPaths.indexOf(targetNode.path);
    if (targetIdx === -1) return;

    const insertAt = position === 'after' ? targetIdx + 1 : targetIdx;
    newPaths.splice(insertAt, 0, fromPath);

    onReorderNotes(newPaths);
  }

  let contextMenu = $state<{ x: number; y: number; node: FileNode } | null>(null);

  // Dialog state
  type DialogKind =
    | { type: 'rename'; node: FileNode }
    | { type: 'delete'; node: FileNode }
    | { type: 'newFile'; parent: FileNode }
    | { type: 'newFolder'; parent: FileNode };
  let activeDialog = $state<DialogKind | null>(null);

  function toggleFolder(path: string) {
    expanded[path] = !expanded[path];
  }

  function handleContextMenu(e: MouseEvent, node: FileNode) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, node };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function handleRename(node: FileNode) {
    closeContextMenu();
    activeDialog = { type: 'rename', node };
  }

  function handleDelete(node: FileNode) {
    closeContextMenu();
    activeDialog = { type: 'delete', node };
  }

  function handleNewFile(node: FileNode) {
    closeContextMenu();
    expanded[node.path] = true;
    if (onNewNoteInFolder) {
      // Let the parent open the rich NewNoteDialog with template picker
      onNewNoteInFolder(node.path);
    } else {
      activeDialog = { type: 'newFile', parent: node };
    }
  }

  function handleNewFolder(node: FileNode) {
    closeContextMenu();
    expanded[node.path] = true;
    activeDialog = { type: 'newFolder', parent: node };
  }
</script>

<!-- Close context menu on outside click -->
<svelte:window onclick={closeContextMenu} />

<!-- Dialogs -->
{#if activeDialog !== null}
  {#if activeDialog.type === 'rename'}
    {@const d = activeDialog}
    <Dialog
      title="Rename"
      defaultValue={d.node.name}
      confirmLabel="Rename"
      onConfirm={(newName) => {
        const node = d.node; // capture before nullifying reactive state
        activeDialog = null;
        if (!newName || newName === node.name) return;
        const dir = node.path.includes('/')
          ? node.path.substring(0, node.path.lastIndexOf('/') + 1)
          : '';
        const newPath = node.type === 'file' ? `${dir}${newName}.md` : `${dir}${newName}`;
        onRenameItem(node.path, newPath);
      }}
      onCancel={() => (activeDialog = null)}
    />
  {:else if activeDialog.type === 'delete'}
    {@const d = activeDialog}
    <Dialog
      title="Delete {d.node.name}"
      message={`Delete "${d.node.name}"${d.node.type === 'folder' ? ' and all its contents' : ''}? This cannot be undone.`}
      variant="confirm"
      confirmLabel="Delete"
      destructive={true}
      onConfirm={() => {
        const path = d.node.path; // capture before nullifying reactive state
        activeDialog = null;
        onDeleteItem(path);
      }}
      onCancel={() => (activeDialog = null)}
    />
  {:else if activeDialog.type === 'newFile'}
    {@const d = activeDialog}
    <Dialog
      title="New Note"
      placeholder="note-name"
      confirmLabel="Create"
      onConfirm={(name) => {
        const parentPath = d.parent.path; // capture before nullifying reactive state
        activeDialog = null;
        if (!name) return;
        onCreateFile(`${parentPath}/${name.endsWith('.md') ? name : `${name}.md`}`);
      }}
      onCancel={() => (activeDialog = null)}
    />
  {:else if activeDialog.type === 'newFolder'}
    {@const d = activeDialog}
    <Dialog
      title="New Folder"
      placeholder="folder-name"
      confirmLabel="Create"
      onConfirm={(name) => {
        const parentPath = d.parent.path; // capture before nullifying reactive state
        activeDialog = null;
        if (name) onCreateFolder(`${parentPath}/${name}`);
      }}
      onCancel={() => (activeDialog = null)}
    />
  {/if}
{/if}

{#each nodes as node (node.path)}
  <div style="padding-left: {depth * 12}px">
    {#if node.type === 'folder'}
      <!-- Folder row with drop target and reorder support -->
      <div class="rounded {dropTargetPath === node.path ? 'ring-1 ring-primary/60 bg-primary/5' : ''}">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <button
        class="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'before' ? 'border-t-2 border-blue-500' : ''}
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'after' ? 'border-b-2 border-blue-500' : ''}"
        draggable={true}
        ondragstart={(e) => handleDragStart(e, node.path)}
        ondragover={(e) => handleFolderDragOver(e, node)}
        ondragleave={handleFolderDragLeave}
        ondrop={(e) => handleFolderDrop(e, node, nodes)}
        ondragend={() => { draggedPath = null; reorderDragOver = null; dropTargetPath = null; }}
        onclick={() => toggleFolder(node.path)}
        oncontextmenu={(e) => handleContextMenu(e, node)}
        onkeydown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); expanded[node.path] = true; }
          if (e.key === 'ArrowLeft')  { e.preventDefault(); expanded[node.path] = false; }
        }}
      >
        <span
          class="text-muted-foreground transition-transform duration-100"
          style="transform: rotate({expanded[node.path] ? '90deg' : '0deg'})"
        >
          <ChevronRight size={12} />
        </span>
        {#if expanded[node.path]}
          <FolderOpen size={14} class="shrink-0 text-yellow-500 dark:text-yellow-400" />
        {:else}
          <Folder size={14} class="shrink-0 text-yellow-500 dark:text-yellow-400" />
        {/if}
        <span class="truncate">{node.name}</span>
      </button>

      <!-- Recursive children -->
      {#if expanded[node.path] && node.children}
        <FileTree
          nodes={node.children}
          {activeFile}
          depth={depth + 1}
          {pinned}
          {onOpenFile}
          {onCreateFile}
          {onCreateFolder}
          {onDeleteItem}
          {onRenameItem}
          {onTogglePin}
          {onMoveItem}
          {onNewNoteInFolder}
          {onReorderNotes}
        />
      {/if}
      </div>
    {:else}
      <!-- File row -->
      <button
        class="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-sm hover:bg-accent
               {activeFile === node.path ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'before' ? 'border-t-2 border-blue-500' : ''}
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'after' ? 'border-b-2 border-blue-500' : ''}"
        draggable={true}
        ondragstart={(e) => handleDragStart(e, node.path)}
        ondragover={(e) => handleReorderDragOver(e, node)}
        ondragleave={handleReorderDragLeave}
        ondrop={(e) => handleReorderDrop(e, node, nodes)}
        ondragend={() => { draggedPath = null; reorderDragOver = null; dropTargetPath = null; }}
        onclick={() => onOpenFile(node.path)}
        oncontextmenu={(e) => handleContextMenu(e, node)}
      >
        <span class="w-3 shrink-0"></span>
        <FileText size={14} class="shrink-0 text-muted-foreground" />
        <span class="truncate">{node.name}</span>
      </button>
    {/if}
  </div>
{/each}

<!-- Context menu -->
{#if contextMenu}
  {@const menuNode = contextMenu.node}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed z-50 min-w-40 rounded-md border border-border bg-popover py-1 shadow-lg"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    onclick={(e) => e.stopPropagation()}
  >
    {#if menuNode.type === 'folder'}
      <button
        class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
        onclick={() => handleNewFile(menuNode)}
      >
        <FilePlus size={13} /> New note
      </button>
      <button
        class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
        onclick={() => handleNewFolder(menuNode)}
      >
        <FolderPlus size={13} /> New folder
      </button>
      <div class="my-1 border-t border-border"></div>
    {/if}
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
      onclick={() => handleRename(menuNode)}
    >
      <Pencil size={13} /> Rename
    </button>
    {#if menuNode.type === 'file'}
      <button
        class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
        onclick={() => { const path = menuNode.path; closeContextMenu(); onTogglePin?.(path); }}
      >
        {#if pinned.includes(menuNode.path)}
          <PinOff size={13} /> Unpin from favorites
        {:else}
          <Pin size={13} /> Pin to favorites
        {/if}
      </button>
    {/if}
    <button
      class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent"
      onclick={() => handleDelete(menuNode)}
    >
      <Trash2 size={13} /> Delete
    </button>
  </div>
{/if}
