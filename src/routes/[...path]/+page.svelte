<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { theme } from '$lib/theme.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Editor from '$lib/components/editor/Editor.svelte';
  import Toolbar from '$lib/components/layout/Toolbar.svelte';
  import StatusBar from '$lib/components/layout/StatusBar.svelte';
  import SearchPanel from '$lib/components/panels/SearchPanel.svelte';
  import WorkspaceCreateModal from '$lib/components/modals/WorkspaceCreateModal.svelte';
  import HostTrackerPanel from '$lib/components/engagement/HostTrackerPanel.svelte';
  import CredentialVaultPanel from '$lib/components/engagement/CredentialVaultPanel.svelte';
  import FlagTrackerPanel from '$lib/components/engagement/FlagTrackerPanel.svelte';
  import CommandSnippetsPanel from '$lib/components/panels/CommandSnippetsPanel.svelte';
  import AttackChainPanel from '$lib/components/engagement/AttackChainPanel.svelte';
  import OperationLogPanel from '$lib/components/engagement/OperationLogPanel.svelte';
  import CvssCalculatorPanel from '$lib/components/engagement/CvssCalculatorPanel.svelte';
  import FindingsTrackerPanel from '$lib/components/engagement/FindingsTrackerPanel.svelte';
  import NetworkTopologyPanel from '$lib/components/engagement/NetworkTopologyPanel.svelte';
  import CommandPalette from '$lib/components/modals/CommandPalette.svelte';
  import MethodologyPanel from '$lib/components/panels/MethodologyPanel.svelte';
  import AiChat from '$lib/components/panels/AiChat.svelte';
  import SummarizePanel from '$lib/components/panels/SummarizePanel.svelte';
  import HelpModal from '$lib/components/modals/HelpModal.svelte';
  import SettingsModal from '$lib/components/modals/SettingsModal.svelte';
  import FindPanel from '$lib/components/editor/FindPanel.svelte';
  import ImageLightbox from '$lib/components/editor/ImageLightbox.svelte';
  import BacklinksPanel from '$lib/components/panels/BacklinksPanel.svelte';
  import ScreenshotPanel from '$lib/components/panels/ScreenshotPanel.svelte';
  import ExportModal from '$lib/components/modals/ExportModal.svelte';
  import NoteGraphPanel from '$lib/components/panels/NoteGraphPanel.svelte';
  import type { FileNode, Workspace } from '$lib/types';

  interface FindOptions {
    caseSensitive: boolean;
    useRegex: boolean;
    wholeWord: boolean;
  }

  interface EditorApi {
    insertText: (text: string) => void;
    findOccurrenceCount: (query: string, opts: FindOptions) => number;
    scrollToOccurrence: (query: string, opts: FindOptions, index: number) => void;
    setFindHighlights: (query: string, opts: FindOptions, currentIndex: number) => void;
    clearFindHighlights: () => void;
    getHtml: () => string;
    resetContent: (content: string) => void;
  }

  // State
  let tree = $state<FileNode[]>([]);
  let activeFile = $state<string | null>(null);
  let activeContent = $state<string>('');
  let isSaving = $state(false);
  let isDirty = $state(false);
  let searchOpen = $state(false);
  let wordCount = $state(0);
  let editorMode = $state<'wysiwyg' | 'source'>('wysiwyg');
  let toastError = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout>;

  function showError(msg: string) {
    clearTimeout(toastTimer);
    toastError = msg;
    toastTimer = setTimeout(() => (toastError = null), 4000);
  }

  // New feature state
  let commandOpen = $state(false);
  let methodologyOpen = $state(false);
  let aiChatOpen = $state(false);
  let summarizeOpen = $state(false);
  let newNoteOpen = $state(false);
  let backlinksOpen = $state(false);
  let screenshotsOpen = $state(false);
  let exportOpen = $state(false);
  let hostTrackerOpen = $state(false);
  let credentialVaultOpen = $state(false);
  let flagTrackerOpen = $state(false);
  let snippetsOpen = $state(false);
  let attackChainOpen = $state(false);
  let graphOpen = $state(false);
  let operationLogOpen = $state(false);
  let cvssOpen = $state(false);
  let findingsTrackerOpen = $state(false);
  let topologyOpen = $state(false);
  let aiMessages = $state<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  let insertIntoEditor = $state<((text: string) => void) | null>(null);
  let helpOpen = $state(false);
  let settingsOpen = $state(false);
  let findOpen = $state(false);
  let editorApi = $state<EditorApi | null>(null);
  let sidebarCollapsed = $state(false);
  let lightboxImage = $state<{ src: string; alt: string } | null>(null);
  // Passed to Editor as a bindable prop. Set here so the Editor scrolls to the
  // target line once Crepe finishes (re-)initialising.
  let pendingScrollTarget = $state<{ line: number; lineText: string } | null>(null);

  // Workspace management
  const WS_STORAGE_KEY = 'notes-active-workspace-v1';
  let workspaces = $state<Workspace[]>([]);
  let activeWorkspace = $state<Workspace | null>(null);
  let createWorkspaceOpen = $state(false);

  async function loadWorkspaces() {
    try {
      const res = await fetch('/api/workspaces');
      workspaces = await res.json();
      // Restore last selected workspace from localStorage
      const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem(WS_STORAGE_KEY) : null;
      if (savedId) {
        const found = workspaces.find((w) => w.id === savedId);
        if (found) activeWorkspace = found;
      }
      if (!activeWorkspace && workspaces.length > 0) {
        activeWorkspace = workspaces[0];
      }
    } catch {
      console.error('Failed to load workspaces');
    }
  }

  function selectWorkspace(ws: Workspace) {
    activeWorkspace = ws;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WS_STORAGE_KEY, ws.id);
    }
    // Reload the file tree scoped to this workspace's notes folder,
    // and clear any open file since it belongs to the previous workspace context.
    loadTree(ws.notes_folder ?? '');
    activeFile = null;
    activeContent = '';
  }

  async function createWorkspace(data: { name: string; type: string; icon_color: string }) {
    if (!data.name.trim()) return;
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name.trim(), type: data.type, icon_color: data.icon_color })
      });
      if (!res.ok) return;
      const ws: Workspace = await res.json();
      workspaces = [...workspaces, ws];
      selectWorkspace(ws);
    } catch {
      console.error('Failed to create workspace');
    }
  }

  // Mutual exclusion: opening any panel closes all others.
  // Each effect only fires when its panel becomes true, setting the rest false.
  // No cascades: the others are already false so their effects don't re-trigger.
  $effect(() => { if (searchOpen)      { commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (commandOpen)     { searchOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (methodologyOpen) { searchOpen = false; commandOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (aiChatOpen)      { searchOpen = false; commandOpen = false; methodologyOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (summarizeOpen)   { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (helpOpen)        { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; settingsOpen = false; } });
  $effect(() => { if (settingsOpen)    { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; } });
  $effect(() => { if (backlinksOpen)   { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (screenshotsOpen) { backlinksOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (exportOpen)      { helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (hostTrackerOpen)     { backlinksOpen = false; screenshotsOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (credentialVaultOpen) { backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (flagTrackerOpen)     { backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; snippetsOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (snippetsOpen)        { backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; operationLogOpen = false; cvssOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (attackChainOpen)     { /* full-screen modal - no sidebar conflict */ } });
  $effect(() => { if (graphOpen)           { /* full-screen overlay - close other full-screen panels */ attackChainOpen = false; } });
  $effect(() => { if (operationLogOpen)    { backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; cvssOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (cvssOpen)            { backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; operationLogOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (findingsTrackerOpen) { backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; operationLogOpen = false; cvssOpen = false; } });
  $effect(() => { if (topologyOpen) { attackChainOpen = false; graphOpen = false; } });

  onMount(async () => {
    // Load workspaces first so we can scope the tree to the active workspace
    await loadWorkspaces();
    await loadTree(activeWorkspace?.notes_folder ?? '');
    // If URL already has a file path (e.g. hard refresh on /templates/cheatsheet),
    // open that file without pushing another history entry.
    const urlPath = $page.params.path;
    if (urlPath) {
      await openFile(urlPath, false);
    }
  });

  async function loadTree(base = '') {
    try {
      const query = base ? `?base=${encodeURIComponent(base)}` : '';
      const res = await fetch(`/api/notes/tree${query}`);
      const data = await res.json();
      tree = data.tree ?? [];
    } catch {
      console.error('Failed to load file tree');
    }
  }

  // updateUrl = false when we are already at the correct URL (e.g. on mount)
  async function openFile(path: string, updateUrl = true, scrollTo?: { line: number; lineText: string }) {
    try {
      const res = await fetch(`/api/notes/${path}`);
      const data = await res.json();
      activeFile = path;
      // Un-escape [[wikilinks]] that may have been over-escaped by a previous version of the serializer
      activeContent = (data.content ?? '').replace(/\\\[\\\[|\\\[(?=\[)/g, '[[');
      // Set scroll target in the same synchronous batch as activeContent so that
      // Svelte processes both together. Editor's filePath $effect fires first
      // (destroys + re-inits Crepe), then Editor's scroll $effect fires once
      // editorReady becomes true again.
      if (scrollTo) pendingScrollTarget = scrollTo;
      isDirty = false;
      if (updateUrl) {
        await goto('/' + path, { replaceState: true, noScroll: true, keepFocus: true });
      }
    } catch {
      console.error('Failed to open file:', path);
    }
  }

  let saveTimer: ReturnType<typeof setTimeout>;

  function handleContentChange(content: string) {
    activeContent = content;
    isDirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveFile(), 1500);
  }

  async function saveFile() {
    if (!activeFile || !isDirty) return;
    isSaving = true;
    try {
      await fetch(`/api/notes/${activeFile}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: activeContent })
      });
      isDirty = false;
    } catch {
      console.error('Failed to save file');
    } finally {
      isSaving = false;
    }
  }

  async function createFile(path: string, type: 'file' | 'folder', initialContent?: string) {
    const wsFolder = activeWorkspace?.notes_folder;
    const alreadyPrefixed = wsFolder && path.startsWith(`${wsFolder}/`);
    const fullPath = wsFolder && !alreadyPrefixed ? `${wsFolder}/${path}` : path;
    const res = await fetch(`/api/notes/${fullPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    if (!res.ok) {
      if (res.status === 409) {
        const name = path.split('/').pop() ?? path;
        showError(`"${name}" already exists. Choose a different name.`);
      } else {
        showError('Failed to create item.');
      }
      return;
    }
    if (type === 'file' && initialContent) {
      await fetch(`/api/notes/${fullPath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: initialContent })
      });
    }
    await loadTree(activeWorkspace?.notes_folder ?? '');
  }

  async function deleteFile(path: string) {
    await fetch(`/api/notes/${path}`, { method: 'DELETE' });
    if (activeFile === path) {
      activeFile = null;
      activeContent = '';
      await goto('/', { replaceState: true, noScroll: true });
    }
    await loadTree(activeWorkspace?.notes_folder ?? '');
  }

  async function renameFile(fromPath: string, toPath: string) {
    await fetch(`/api/notes/${fromPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPath: toPath })
    });
    if (activeFile === fromPath) {
      activeFile = toPath;
      await goto('/' + toPath, { replaceState: true, noScroll: true });
    }
    await loadTree(activeWorkspace?.notes_folder ?? '');
  }

  function handleSummarize() {
    if (!activeFile || !activeContent.trim()) return;
    summarizeOpen = true;
  }

  async function moveFile(fromPath: string, toFolderPath: string) {
    const filename = fromPath.split('/').pop()!;
    await renameFile(fromPath, `${toFolderPath}/${filename}`);
  }

  // Find a note in the file tree by name (without .md extension)
  function findNoteByName(nodes: FileNode[], name: string): string | null {
    const lower = name.toLowerCase();
    for (const node of nodes) {
      if (node.type === 'file') {
        const nodeName = node.name.replace(/\.md$/i, '').toLowerCase();
        if (nodeName === lower) return node.path;
      } else if (node.children) {
        const found = findNoteByName(node.children, name);
        if (found) return found;
      }
    }
    return null;
  }

  // Flat list of all note paths for wikilink autocomplete
  // readTree only emits type:'file' for .md files, so no extension check needed
  function flattenTree(nodes: FileNode[]): string[] {
    const paths: string[] = [];
    for (const node of nodes) {
      if (node.type === 'file') {
        paths.push(node.path);
      } else if (node.children) {
        paths.push(...flattenTree(node.children));
      }
    }
    return paths;
  }
  const noteSuggestions = $derived(flattenTree(tree));
  const noteTitle = $derived(
    activeFile ? (activeFile.split('/').pop()?.replace(/\.md$/i, '') ?? 'Leaflet') : 'Leaflet'
  );
</script>

<svelte:head>
  <title>{noteTitle}</title>
</svelte:head>

<svelte:window
  onkeydown={(e) => {
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      sidebarCollapsed = !sidebarCollapsed;
    }
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveFile();
    }
    // Ctrl+N opens a new browser window and cannot be intercepted by JS.
    // Use Ctrl+Shift+E instead.
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      newNoteOpen = true;
    }
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      searchOpen = !searchOpen;
    }
    if (e.ctrlKey && e.key === 'm') {
      e.preventDefault();
      editorMode = editorMode === 'wysiwyg' ? 'source' : 'wysiwyg';
    }
    // Ctrl+K is intercepted by Chrome/Edge (focuses address bar) before JS sees it.
    // Use Ctrl+Shift+K instead.
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      commandOpen = !commandOpen;
    }
    if (e.ctrlKey && e.key === '.') {
      e.preventDefault();
      methodologyOpen = !methodologyOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      aiChatOpen = !aiChatOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      if (activeFile) handleSummarize();
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      if (activeFile) findOpen = !findOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'B') {
      e.preventDefault();
      if (activeFile) backlinksOpen = !backlinksOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      screenshotsOpen = !screenshotsOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'X') {
      e.preventDefault();
      if (activeFile) exportOpen = !exportOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
      e.preventDefault();
      graphOpen = !graphOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      e.preventDefault();
      cvssOpen = !cvssOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      findingsTrackerOpen = !findingsTrackerOpen;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      topologyOpen = !topologyOpen;
    }
    if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        helpOpen = !helpOpen;
      }
    }
  }}
/>

<div class="flex h-screen flex-col overflow-hidden bg-background text-foreground">
  <!-- Error toast -->
  {#if toastError}
    <div
      class="fixed top-14 right-4 z-[200] flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg"
      role="alert"
    >
      <span>{toastError}</span>
      <button
        class="ml-1 text-destructive/70 hover:text-destructive"
        onclick={() => (toastError = null)}
        aria-label="Dismiss"
      >&#x2715;</button>
    </div>
  {/if}
  <Toolbar
    bind:searchOpen
    bind:editorMode
    bind:methodologyOpen
    bind:aiChatOpen
    bind:newNoteOpen
    onNewNote={(path, templateContent) => createFile(path, 'file', templateContent || undefined)}
    onNewFolder={(path) => createFile(path, 'folder')}
    onToggleTheme={() => theme.toggle()}
    isDark={theme.isDark}
    hasActiveFile={!!activeFile}
    onOpenCommandPalette={() => (commandOpen = true)}
    onSummarize={handleSummarize}
    onOpenBacklinks={() => { if (activeFile) backlinksOpen = !backlinksOpen; }}
    onOpenScreenshots={() => (screenshotsOpen = !screenshotsOpen)}
    onOpenExport={() => { if (activeFile) exportOpen = true; }}
    onOpenHelp={() => (helpOpen = true)}
    onOpenSettings={() => (settingsOpen = true)}
    onOpenGraph={() => (graphOpen = !graphOpen)}
    hasWorkspace={!!activeWorkspace}
    isPentest={activeWorkspace?.type === 'pentest'}
    onOpenHostTracker={() => (hostTrackerOpen = !hostTrackerOpen)}
    onOpenCredentialVault={() => (credentialVaultOpen = !credentialVaultOpen)}
    onOpenFlagTracker={() => (flagTrackerOpen = !flagTrackerOpen)}
    onOpenSnippets={() => (snippetsOpen = !snippetsOpen)}
    onOpenAttackChain={() => (attackChainOpen = !attackChainOpen)}
    onOpenOperationLog={() => (operationLogOpen = !operationLogOpen)}
    onOpenCvssCalculator={() => (cvssOpen = !cvssOpen)}
    onOpenFindingsTracker={() => (findingsTrackerOpen = !findingsTrackerOpen)}
    onOpenTopology={() => (topologyOpen = !topologyOpen)}
  />

  <div class="flex flex-1 overflow-hidden">
    <Sidebar
      {tree}
      {activeFile}
      bind:collapsed={sidebarCollapsed}
      {workspaces}
      {activeWorkspace}
      onOpenFile={openFile}
      onCreateFile={(path) => createFile(path, 'file')}
      onCreateFolder={(path) => createFile(path, 'folder')}
      onDeleteItem={deleteFile}
      onRenameItem={renameFile}
      onMoveItem={moveFile}
      onSelectWorkspace={selectWorkspace}
      onCreateWorkspace={() => (createWorkspaceOpen = true)}
      onPullSuccess={async () => {
        await loadWorkspaces();
        await loadTree(activeWorkspace?.notes_folder ?? '');
      }}
    />

    <main class="relative flex flex-1 flex-col overflow-hidden">
      {#if findOpen && activeFile}
        <FindPanel
          editorApi={editorApi}
          onClose={() => (findOpen = false)}
        />
      {/if}
      {#if activeFile}
        <Editor
          mode={editorMode}
          content={activeContent}
          filePath={activeFile}
          bind:scrollTarget={pendingScrollTarget}
          onContentChange={handleContentChange}
          onWordCountChange={(count: number) => (wordCount = count)}
          onReady={(api: EditorApi) => { insertIntoEditor = api.insertText; editorApi = api; }}
          onImageClick={(src: string, alt: string) => (lightboxImage = { src, alt })}
          onWikilinkClick={(name: string) => {
            const path = findNoteByName(tree, name);
            if (path) openFile(path);
          }}
          {noteSuggestions}
        />
      {:else}
        <div class="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="opacity-30"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p class="text-sm">Select a note from the sidebar to start editing</p>
          <p class="text-xs opacity-50">Ctrl+P to search &nbsp;·&nbsp; Ctrl+Shift+E for new note &nbsp;·&nbsp; Ctrl+M to toggle source mode &nbsp;·&nbsp; Ctrl+Shift+K commands &nbsp;·&nbsp; Ctrl+. methodology</p>
        </div>
      {/if}
    </main>
    {#if backlinksOpen}
      <BacklinksPanel
        {activeFile}
        onClose={() => (backlinksOpen = false)}
        onNavigate={(path, line, lineText) => {
          if (path === activeFile) {
            pendingScrollTarget = { line, lineText };
          } else {
            openFile(path, true, { line, lineText });
          }
          backlinksOpen = false;
        }}
      />
    {/if}

    {#if screenshotsOpen}
      <ScreenshotPanel
        workspaceId={activeWorkspace?.id ?? null}
        notesFolder={activeWorkspace?.notes_folder ?? ''}
        onClose={() => (screenshotsOpen = false)}
        onInsert={(md) => { insertIntoEditor?.(md); }}
      />
    {/if}

    {#if hostTrackerOpen}
      <HostTrackerPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (hostTrackerOpen = false)}
      />
    {/if}

    {#if credentialVaultOpen}
      <CredentialVaultPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (credentialVaultOpen = false)}
      />
    {/if}

    {#if flagTrackerOpen}
      <FlagTrackerPanel
        workspaceId={activeWorkspace?.id ?? null}
        totalFlags={activeWorkspace?.total_flags ?? 0}
        passingFlags={activeWorkspace?.passing_flags ?? 0}
        onClose={() => (flagTrackerOpen = false)}
      />
    {/if}

    {#if snippetsOpen}
      <CommandSnippetsPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (snippetsOpen = false)}
        onInsert={(text) => { insertIntoEditor?.(text); }}
      />
    {/if}

    {#if operationLogOpen}
      <OperationLogPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (operationLogOpen = false)}
      />
    {/if}

    {#if cvssOpen}
      <CvssCalculatorPanel
        onClose={() => (cvssOpen = false)}
        onInsert={(text) => { insertIntoEditor?.(text); }}
      />
    {/if}

    {#if findingsTrackerOpen}
      <FindingsTrackerPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (findingsTrackerOpen = false)}
      />
    {/if}

  </div>

  {#if attackChainOpen}
    <AttackChainPanel
      workspaceId={activeWorkspace?.id ?? null}
      onClose={() => (attackChainOpen = false)}
    />
  {/if}

  {#if topologyOpen}
    <NetworkTopologyPanel
      workspaceId={activeWorkspace?.id ?? null}
      onClose={() => (topologyOpen = false)}
    />
  {/if}

  {#if graphOpen}
    <NoteGraphPanel
      workspaceFolder={activeWorkspace?.notes_folder ?? ''}
      activePath={activeFile ?? ''}
      onClose={() => (graphOpen = false)}
      onNavigate={(path) => openFile(path)}
    />
  {/if}

  <StatusBar {activeFile} {isSaving} {isDirty} {wordCount} {editorMode} />

  {#if commandOpen}
    <CommandPalette
      onClose={() => (commandOpen = false)}
      onInsert={(text) => { insertIntoEditor?.(text); }}
      onOpenCvss={() => (cvssOpen = true)}
    />
  {/if}

  {#if methodologyOpen}
    <MethodologyPanel onClose={() => (methodologyOpen = false)} />
  {/if}

  {#if aiChatOpen}
    <AiChat
      noteContent={activeContent}
      onClose={() => (aiChatOpen = false)}
      bind:messages={aiMessages}
    />
  {/if}

  {#if summarizeOpen}
    <SummarizePanel
      noteContent={activeContent}
      onInsert={(text) => { insertIntoEditor?.(text); }}
      onClose={() => (summarizeOpen = false)}
    />
  {/if}

  {#if searchOpen}
    <SearchPanel
      onClose={() => (searchOpen = false)}
      onSelectResult={(path, line, lineText) => {
        if (path === activeFile) {
          // Same file - editor already ready, effect fires immediately.
          pendingScrollTarget = { line, lineText };
        } else {
          // Different file - pendingScrollTarget is set inside openFile() in the
          // same sync batch as activeContent so Editor defers scroll until re-init.
          openFile(path, true, { line, lineText });
        }
        searchOpen = false;
      }}
    />
  {/if}

  {#if helpOpen}
    <HelpModal onClose={() => (helpOpen = false)} />
  {/if}

  {#if settingsOpen}
    <SettingsModal
      onClose={() => (settingsOpen = false)}
      {editorMode}
      onEditorModeChange={(m) => (editorMode = m)}
    />
  {/if}

  {#if exportOpen && activeFile}
    <ExportModal
      {activeFile}
      content={activeContent}
      getEditorHtml={() => editorApi?.getHtml() ?? ''}
      onClose={() => (exportOpen = false)}
    />
  {/if}
</div>

{#if lightboxImage}
  <ImageLightbox
    src={lightboxImage.src}
    alt={lightboxImage.alt}
    onClose={() => (lightboxImage = null)}
  />
{/if}

{#if createWorkspaceOpen}
  <WorkspaceCreateModal
    onConfirm={(data) => { createWorkspaceOpen = false; createWorkspace(data); }}
    onCancel={() => (createWorkspaceOpen = false)}
  />
{/if}
