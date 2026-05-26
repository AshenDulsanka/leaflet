<script lang="ts">
  import { FileText, Folder, FolderOpen, ChevronRight, Home } from '@lucide/svelte';
  import type { FileNode } from '$lib/types';
  import FileTree from './FileTree.svelte';
  import FileTreeContextMenu from './FileTreeContextMenu.svelte';
  import Dialog from '$lib/components/modals/Dialog.svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
    getDirname,
    flattenPathTypeMap,
    isInvalidFolderDropTarget,
    getFileDropReorderPosition,
    getFolderOptions,
  } from './file-tree-dnd';

  interface Props {
    nodes: FileNode[];
    allNodes?: FileNode[];
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

  let { nodes, allNodes, activeFile, depth, pinned = [], onOpenFile, onCreateFile, onCreateFolder, onDeleteItem, onRenameItem, onTogglePin, onMoveItem, onNewNoteInFolder, onReorderNotes }: Props =
    $props();

  const DRAG_SOURCE_KEY = '__leaflet_filetree_drag_source';
  const DRAG_BODY_CLASS = 'leaflet-filetree-drag-active';
  const INDENT_PX = 16;
  const FOLDER_DROP_ZONE = 0.25;

  // Track which folders are expanded
  let expanded = $state<Record<string, boolean>>({});

  // Drag-and-drop: highlight folder target or root zones while dragging
  let dropTargetPath = $state<string | null>(null);

  // Edge drop zone indicator (top/bottom of the list)
  let edgeDropActive = $state<'top' | 'bottom' | null>(null);

  // Sibling reorder drag indicator
  let reorderDragOver = $state<{ path: string; position: 'before' | 'after' } | null>(null);

  // Module-level dragged path — avoids browser protected-mode getData() restriction during dragover
  let draggedPath = $state<string | null>(null);

  // Move dialog: currently selected target folder path ('' = root)
  let moveTo = $state<string>('');

  // Root instance receives full tree via `nodes`; child instances can receive
  // explicit `allNodes` from parent. This stays reactive as tree updates.
  const dragValidationNodes = $derived(allNodes ?? nodes);
  const pathTypeMap = $derived(flattenPathTypeMap(dragValidationNodes));
  const knownPaths = $derived(new Set(pathTypeMap.keys()));

  function handleDragStart(e: DragEvent, nodePath: string) {
    draggedPath = nodePath;
    (globalThis as { [DRAG_SOURCE_KEY]?: string })[DRAG_SOURCE_KEY] = nodePath;
    document.body.classList.add(DRAG_BODY_CLASS);
    e.dataTransfer?.setData('text/plain', nodePath);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
    e.stopPropagation();
  }

  function getDragSourcePath(): string | null {
    return draggedPath ?? (globalThis as { [DRAG_SOURCE_KEY]?: string })[DRAG_SOURCE_KEY] ?? null;
  }

  function getDragSourcePathFromEvent(e: DragEvent): string | null {
    const fromState = getDragSourcePath();
    if (fromState) {
      return fromState;
    }

    const fromTransfer = e.dataTransfer?.getData('text/plain')?.trim() ?? '';
    return fromTransfer || null;
  }

  function clearDragState(): void {
    draggedPath = null;
    delete (globalThis as { [DRAG_SOURCE_KEY]?: string })[DRAG_SOURCE_KEY];
    document.body.classList.remove(DRAG_BODY_CLASS);
    reorderDragOver = null;
    dropTargetPath = null;
    edgeDropActive = null;
  }

  function handleFolderDragOver(e: DragEvent, node: FileNode) {
    const fromPath = getDragSourcePath();
    if (!fromPath || fromPath === node.path) return;
    if (!knownPaths.has(fromPath)) return;
    if (isInvalidFolderDropTarget(pathTypeMap, fromPath, node.path)) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;

    // Root-edge: first/last node at depth=0 from a different parent → root move
    if (depth === 0 && getDirname(fromPath) !== '') {
      const isFirstNode = nodes.indexOf(node) === 0;
      const isLastNode = nodes.indexOf(node) === nodes.length - 1;
      const ROOT_EDGE = 0.20;
      if (isFirstNode && pct < ROOT_EDGE) {
        reorderDragOver = { path: node.path, position: 'before' };
        dropTargetPath = null;
        return;
      }
      if (isLastNode && pct > 1 - ROOT_EDGE) {
        reorderDragOver = { path: node.path, position: 'after' };
        dropTargetPath = null;
        return;
      }
    }

    const sameSiblings = getDirname(fromPath) === getDirname(node.path);
    if (sameSiblings && onReorderNotes) {
      if (pct < FOLDER_DROP_ZONE) {
        reorderDragOver = { path: node.path, position: 'before' };
        dropTargetPath = null;
      } else if (pct > 1 - FOLDER_DROP_ZONE) {
        reorderDragOver = { path: node.path, position: 'after' };
        dropTargetPath = null;
      } else {
        dropTargetPath = node.path;
        reorderDragOver = null;
      }
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

    try {
      const fromPath = getDragSourcePathFromEvent(e);
      dropTargetPath = null;
      reorderDragOver = null;

      if (!fromPath || fromPath === node.path) return;
      if (!knownPaths.has(fromPath)) return; // reject untrusted drag source
      if (isInvalidFolderDropTarget(pathTypeMap, fromPath, node.path)) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const pct = (e.clientY - rect.top) / rect.height;

      // Root-edge: first/last node at depth=0 from a different parent → root move
      if (depth === 0 && getDirname(fromPath) !== '') {
        const isFirstNode = nodes.indexOf(node) === 0;
        const isLastNode = nodes.indexOf(node) === nodes.length - 1;
        const ROOT_EDGE = 0.20;
        if ((isFirstNode && pct < ROOT_EDGE) || (isLastNode && pct > 1 - ROOT_EDGE)) {
          onMoveItem?.(fromPath, '');
          return;
        }
      }

      const sameSiblings = getDirname(fromPath) === getDirname(node.path);
      if (sameSiblings && onReorderNotes) {
        if (pct >= FOLDER_DROP_ZONE && pct <= 1 - FOLDER_DROP_ZONE) {
          onMoveItem?.(fromPath, node.path);
          expanded[node.path] = true;
        } else {
          const reorderPosition = pct < FOLDER_DROP_ZONE ? 'before' : 'after';
          const paths = siblings.map((n) => n.path);
          const fromIdx = paths.indexOf(fromPath);
          if (fromIdx === -1) return;
          const newPaths = [...paths];
          newPaths.splice(fromIdx, 1);
          const targetIdx = newPaths.indexOf(node.path);
          if (targetIdx === -1) return;
          const insertAt = reorderPosition === 'after' ? targetIdx + 1 : targetIdx;
          newPaths.splice(insertAt, 0, fromPath);
          onReorderNotes(newPaths);
        }
      } else {
        onMoveItem?.(fromPath, node.path);
        expanded[node.path] = true;
      }
    } finally {
      clearDragState();
    }
  }
  function handleReorderDragOver(e: DragEvent, targetNode: FileNode) {
    const fromPath = getDragSourcePath();
    if (!fromPath || !knownPaths.has(fromPath) || fromPath === targetNode.path) return;
    e.preventDefault();
    e.stopPropagation(); // prevent folder drop handlers from firing

    const targetParent = getDirname(targetNode.path);
    const sameSiblings = getDirname(fromPath) === targetParent;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - rect.top) / rect.height;

    // Root-edge: first/last node at depth=0 from a different parent → root move
    if (depth === 0 && getDirname(fromPath) !== '') {
      const isFirstNode = nodes.indexOf(targetNode) === 0;
      const isLastNode = nodes.indexOf(targetNode) === nodes.length - 1;
      const ROOT_EDGE = 0.20;
      if (isFirstNode && pct < ROOT_EDGE) {
        reorderDragOver = { path: targetNode.path, position: 'before' };
        return;
      }
      if (isLastNode && pct > 1 - ROOT_EDGE) {
        reorderDragOver = { path: targetNode.path, position: 'after' };
        return;
      }
    }

    const position = getFileDropReorderPosition(pct);
    if (sameSiblings && onReorderNotes) {
      reorderDragOver = { path: targetNode.path, position };
      return;
    }
    reorderDragOver = null;
  }

  function handleReorderDragLeave() {
    reorderDragOver = null;
  }

  function handleReorderDrop(e: DragEvent, targetNode: FileNode, siblings: FileNode[]) {
    if (!onReorderNotes) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      const fromPath = getDragSourcePathFromEvent(e);
      if (!fromPath || fromPath === targetNode.path) return;
      if (!knownPaths.has(fromPath)) return; // reject untrusted drag source

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const pct = (e.clientY - rect.top) / rect.height;
      const targetParent = getDirname(targetNode.path);
      const sameSiblings = getDirname(fromPath) === targetParent;

      // Root-edge: first/last node at depth=0 from a different parent → root move
      if (depth === 0 && getDirname(fromPath) !== '') {
        const isFirstNode = nodes.indexOf(targetNode) === 0;
        const isLastNode = nodes.indexOf(targetNode) === nodes.length - 1;
        const ROOT_EDGE = 0.20;
        if ((isFirstNode && pct < ROOT_EDGE) || (isLastNode && pct > 1 - ROOT_EDGE)) {
          reorderDragOver = null;
          onMoveItem?.(fromPath, '');
          return;
        }
      }

      if (!sameSiblings) {
        reorderDragOver = null;
        const fromType = pathTypeMap.get(fromPath);
        if (fromType === 'folder' && (targetParent === fromPath || targetParent.startsWith(fromPath + '/'))) return;
        onMoveItem?.(fromPath, targetParent);
        return;
      }

      const position = getFileDropReorderPosition(pct);
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
    } finally {
      clearDragState();
    }
  }

  // Edge drop zone handlers
  function handleEdgeDragOver(e: DragEvent, position: 'top' | 'bottom') {
    const fromPath = getDragSourcePath();
    if (!fromPath || !knownPaths.has(fromPath)) return;
    if (isInvalidFolderDropTarget(pathTypeMap, fromPath, nodes[0]?.path ?? '')) return;
    e.preventDefault();
    e.stopPropagation();
    edgeDropActive = position;
  }

  function handleEdgeDragLeave(e: DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      edgeDropActive = null;
    }
  }

  function handleEdgeDrop(e: DragEvent, position: 'top' | 'bottom') {
    e.preventDefault();
    e.stopPropagation();
    try {
      const fromPath = getDragSourcePathFromEvent(e);
      if (!fromPath || !knownPaths.has(fromPath)) return;
      if (nodes.length === 0) return;

      const parentPath = getDirname(nodes[0].path);
      const fromParentPath = getDirname(fromPath);

      if (fromParentPath === parentPath && onReorderNotes) {
        // Same-level reorder: place before first or after last
        const allPaths = nodes.map((n) => n.path);
        const newPaths = allPaths.filter((p) => p !== fromPath);
        if (position === 'top') {
          newPaths.unshift(fromPath);
        } else {
          newPaths.push(fromPath);
        }
        onReorderNotes(newPaths);
      } else {
        // Cross-parent: move into this list's parent folder
        onMoveItem?.(fromPath, parentPath);
      }
    } finally {
      clearDragState();
    }
  }

  let contextMenu = $state<{ x: number; y: number; node: FileNode } | null>(null);

  // Dialog state
  type DialogKind =
    | { type: 'rename'; node: FileNode }
    | { type: 'delete'; node: FileNode }
    | { type: 'newFile'; parent: FileNode }
    | { type: 'newFolder'; parent: FileNode }
    | { type: 'move'; node: FileNode };
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

  function handleMove(node: FileNode) {
    closeContextMenu();
    moveTo = getDirname(node.path);
    activeDialog = { type: 'move', node };
  }
</script>

<!-- Close context menu on outside click -->
<svelte:window
  onclick={closeContextMenu}
  ondragstart={() => {
    if (getDragSourcePath()) {
      document.body.classList.add(DRAG_BODY_CLASS);
    }
  }}
  ondragend={clearDragState}
  ondrop={clearDragState}
/>

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

{#if activeDialog?.type === 'move'}
  {@const d = activeDialog}
  {@const excludePath = d.node.type === 'folder' ? d.node.path : '__no_exclude__'}
  {@const folderOptions = getFolderOptions(dragValidationNodes, excludePath)}
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={(e) => { if (e.target === e.currentTarget) activeDialog = null; }}
    role="presentation"
  >
    <div
      transition:fly={{ y: 10, duration: 200, easing: cubicOut }}
      tabindex="-1"
      class="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-dialog-title"
      onkeydown={(e) => { if (e.key === 'Escape') activeDialog = null; }}
    >
      <h2 id="move-dialog-title" class="mb-1 text-sm font-semibold text-foreground">Move "{d.node.name}"</h2>
      <p class="mb-3 text-xs text-muted-foreground">Select a destination folder</p>
      <div class="max-h-60 overflow-y-auto rounded-md border border-border">
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent
                 {moveTo === '' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}"
          onclick={() => (moveTo = '')}
        >
          <Home size={13} class="shrink-0" />
          <span>/ (root)</span>
        </button>
        {#each folderOptions as opt (opt.path)}
          <button
            class="flex w-full items-center gap-2 py-1.5 pr-3 text-left text-sm hover:bg-accent
                   {moveTo === opt.path ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}"
            style="padding-left: {opt.depth * 12 + 12}px"
            onclick={() => (moveTo = opt.path)}
          >
            <Folder size={13} class="shrink-0 text-yellow-500 dark:text-yellow-400" />
            <span class="truncate">{opt.name}</span>
          </button>
        {/each}
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          class="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-accent"
          onclick={() => (activeDialog = null)}
        >
          Cancel
        </button>
        <button
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90
                 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={moveTo === getDirname(d.node.path)}
          onclick={() => {
            const fromPath = d.node.path;
            const dest = moveTo;
            activeDialog = null;
            onMoveItem?.(fromPath, dest);
          }}
        >
          Move Here
        </button>
      </div>
    </div>
  </div>
{/if}

<div
  class="filetree-list-root relative"
  data-testid={depth === 0 ? 'filetree-root-list' : undefined}
  role="presentation"
>
<!-- Top edge drop zone: drop here to place before the first item -->
{#if draggedPath !== null && nodes.length > 0}
  <div
    class="rounded transition-colors {edgeDropActive === 'top' ? 'h-2 bg-primary/40' : 'h-1'}"
    ondragover={(e) => handleEdgeDragOver(e, 'top')}
    ondragleave={handleEdgeDragLeave}
    ondrop={(e) => handleEdgeDrop(e, 'top')}
    role="presentation"
  ></div>
{/if}
{#each nodes as node (node.path)}
  <div>
    {#if node.type === 'folder'}
      <!-- Folder row with drop target and reorder support -->
      <div
        class="rounded {dropTargetPath === node.path ? 'ring-1 ring-primary/60 bg-primary/5' : ''}"
        data-filetree-row-path={node.path}
      >
      <button
        class="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'before' ? 'border-t-2 border-blue-500' : ''}
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'after' ? 'border-b-2 border-blue-500' : ''}"
        style="padding-left: {depth * INDENT_PX + 8}px"
        draggable={true}
        ondragstart={(e) => handleDragStart(e, node.path)}
        ondragover={(e) => handleFolderDragOver(e, node)}
        ondragleave={handleFolderDragLeave}
        ondrop={(e) => handleFolderDrop(e, node, nodes)}
        ondragend={clearDragState}
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
        <div>
          <FileTree
            nodes={node.children}
            allNodes={dragValidationNodes}
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
        </div>
      {/if}
      </div>
    {:else}
      <!-- File row -->
      <div
        class="flex w-full items-center gap-1 rounded py-0.5 hover:bg-accent
               {activeFile === node.path ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'before' ? 'border-t-2 border-blue-500' : ''}
               {reorderDragOver?.path === node.path && reorderDragOver.position === 'after' ? 'border-b-2 border-blue-500' : ''}"
        data-filetree-row-path={node.path}
        role="group"
        draggable={true}
        ondragstart={(e) => handleDragStart(e, node.path)}
        ondragover={(e) => handleReorderDragOver(e, node)}
        ondragleave={handleReorderDragLeave}
        ondrop={(e) => handleReorderDrop(e, node, nodes)}
        ondragend={clearDragState}
        oncontextmenu={(e) => handleContextMenu(e, node)}
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-0 text-left text-sm"
          style="padding-left: {depth * INDENT_PX + 26}px"
          onclick={() => onOpenFile(node.path)}
          oncontextmenu={(e) => handleContextMenu(e, node)}
        >
          <FileText size={14} class="shrink-0 text-muted-foreground" />
          <span class="truncate">{node.name}</span>
        </button>
      </div>
    {/if}
  </div>
{/each}
<!-- Bottom edge drop zone: drop here to place after the last item -->
{#if draggedPath !== null && nodes.length > 0}
  <div
    class="rounded transition-colors {edgeDropActive === 'bottom' ? 'h-2 bg-primary/40' : 'h-1'}"
    ondragover={(e) => handleEdgeDragOver(e, 'bottom')}
    ondragleave={handleEdgeDragLeave}
    ondrop={(e) => handleEdgeDrop(e, 'bottom')}
    role="presentation"
  ></div>
{/if}
</div>

<style>
  :global(body.leaflet-filetree-drag-active) .filetree-list-root {
    min-height: 2rem;
  }
</style>

{#if contextMenu}
  {@const menuNode = contextMenu.node}
  <FileTreeContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    node={menuNode}
    {pinned}
    onNewFile={() => handleNewFile(menuNode)}
    onNewFolder={() => handleNewFolder(menuNode)}
    onRename={() => handleRename(menuNode)}
    onTogglePin={() => { const path = menuNode.path; closeContextMenu(); onTogglePin?.(path); }}
    onMove={() => handleMove(menuNode)}
    onDelete={() => handleDelete(menuNode)}
    onClose={closeContextMenu}
  />
{/if}
