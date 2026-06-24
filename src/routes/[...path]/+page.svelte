<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { LoaderCircle } from '@lucide/svelte';
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
  import RightPanelContainer from '$lib/components/layout/RightPanelContainer.svelte';
  import type { FileNode, Workspace } from '$lib/types';
  import type { FindOptions } from '$lib/components/editor/find-utils';
  import {
    encodePathForUrl,
    resolveWorkspacePath as _resolveWorkspacePath,
    workspaceRootUrl,
    isPathWithinWorkspace as _isPathWithinWorkspace,
    migrateWorkspacePath
  } from '$lib/utils/path-utils';
  import { applyMove, applyReorder, flattenTree, findNoteByName } from '$lib/utils/tree-utils';

  interface EditorApi {
    insertText: (text: string) => void;
    findOccurrenceCount: (query: string, opts: FindOptions) => number;
    scrollToOccurrence: (query: string, opts: FindOptions, index: number) => void;
    setFindHighlights: (query: string, opts: FindOptions, currentIndex: number) => void;
    clearFindHighlights: () => void;
    getHtml: () => string;
    resetContent: (content: string) => void;
  }

  interface SaveSnapshot {
    filePath: string;
    content: string;
    workspaceNotesFolder: string | null;
  }

  interface OpenFileError {
    status: number;
  }

  // State
  let tree = $state<FileNode[]>([]);
  let activeFile = $state<string | null>(null);
  let activeContent = $state<string>('');
  let isInitialLoading = $state(true);
  let isSaving = $state(false);
  let isDirty = $state(false);
  let searchOpen = $state(false);
  let wordCount = $state(0);
  let editorMode = $state<'wysiwyg' | 'source'>('wysiwyg');

  // Interaction mode — persisted in localStorage
  let uiMode = $state<'modal' | 'inline'>(
    (typeof localStorage !== 'undefined' ? (localStorage.getItem('leaflet-ui-mode') as 'modal' | 'inline' | null) : null) ?? 'modal'
  );

  function setUiMode(mode: 'modal' | 'inline'): void {
    uiMode = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('leaflet-ui-mode', mode);
    }
  }

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
  let newNoteParentPath = $state<string | null>(null);
  let backlinksOpen = $state(false);
  let screenshotsOpen = $state(false);
  let screenshotVersion = $state(0);
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
  
  let rightPanelWidth = $state(320); // 320px = 20rem default
  let isResizingRight = $state(false);

  function startRightResize(e: MouseEvent): void {
    isResizingRight = true;
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    function onMouseMove(ev: MouseEvent): void {
      // Moving LEFT increases the panel width (since it's on the right)
      rightPanelWidth = Math.min(600, Math.max(240, startWidth - (ev.clientX - startX)));
    }

    function onMouseUp(): void {
      isResizingRight = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  const rightPanelOpen = $derived(
    backlinksOpen || 
    screenshotsOpen || 
    hostTrackerOpen || 
    credentialVaultOpen || 
    flagTrackerOpen || 
    snippetsOpen || 
    operationLogOpen || 
    cvssOpen || 
    findingsTrackerOpen
  );

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
  const SMALL_SCREEN_WARNING_DISMISS_KEY = 'leaflet-small-screen-warning-dismissed-v1';
  const SMALL_SCREEN_MEDIA_QUERY = '(max-width: 900px)';
  let workspaces = $state<Workspace[]>([]);
  let activeWorkspace = $state<Workspace | null>(null);
  let createWorkspaceOpen = $state(false);
  let isSmallScreen = $state(false);
  let showSmallScreenWarning = $state(false);
  let treeLoadRequestId = $state(0);
  let treeWriteDepth = $state(0);

  function beginTreeWrite(): void {
    treeWriteDepth += 1;
  }

  function endTreeWrite(): void {
    treeWriteDepth = Math.max(0, treeWriteDepth - 1);
  }

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

  function dismissSmallScreenWarning(): void {
    showSmallScreenWarning = false;
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SMALL_SCREEN_WARNING_DISMISS_KEY, '1');
  }

  /** Thin wrapper — adds default workspace folder so callers don't have to repeat it. */
  function resolveWorkspacePath(path: string, workspaceNotesFolder: string | null = activeWorkspace?.notes_folder ?? null): string {
    return _resolveWorkspacePath(path, workspaceNotesFolder);
  }

  /** Thin wrapper — closes over the reactive `workspaces` list required by the pure util. */
  function isPathWithinWorkspace(path: string, workspaceNotesFolder: string | null): boolean {
    return _isPathWithinWorkspace(path, workspaceNotesFolder, workspaces);
  }

  function clearPendingAutosave(): void {
    clearTimeout(saveTimer);
  }

  function clearActiveEditorState(): void {
    activeFile = null;
    activeContent = '';
    isDirty = false;
  }

  function createSaveSnapshot(): SaveSnapshot | null {
    if (!activeFile || !isDirty) {
      return null;
    }

    return {
      filePath: activeFile,
      content: activeContent,
      workspaceNotesFolder: activeWorkspace?.notes_folder ?? null
    };
  }

  async function selectWorkspace(ws: Workspace): Promise<void> {
    clearPendingAutosave();
    clearActiveEditorState();
    activeWorkspace = ws;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WS_STORAGE_KEY, ws.id);
    }
    await loadTree(ws.notes_folder ?? '');
    await goto(workspaceRootUrl(ws), { replaceState: true, noScroll: true, keepFocus: true });
  }

  async function createWorkspace(data: { name: string; type: string; icon_color: string; preset: string | null }) {
    if (!data.name.trim()) return;
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name.trim(), type: data.type, icon_color: data.icon_color, preset: data.preset ?? null })
      });
      if (!res.ok) return;
      const ws: Workspace = await res.json();
      workspaces = [...workspaces, ws];
      selectWorkspace(ws);
    } catch {
      console.error('Failed to create workspace');
    }
  }

  async function deleteWorkspace(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('Failed to delete workspace:', res.status, res.statusText);
        showError('Failed to delete workspace. Please try again.');
        return;
      }
      if (activeWorkspace?.id === id) {
        const fallback = workspaces.find(w => w.id !== id);
        if (fallback) selectWorkspace(fallback);
      }
      await invalidateAll();
      await loadWorkspaces();
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      showError('Failed to delete workspace. Please try again.');
    }
  }

  async function renameWorkspace(id: string, newName: string): Promise<void> {
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const previousWorkspace = activeWorkspace?.id === id ? activeWorkspace : null;
    const previousActiveFile = previousWorkspace?.id === id ? activeFile : null;

    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({} as { error?: string }));
        showError(payload.error ?? 'Failed to rename workspace. Please try again.');
        return;
      }

      const updatedWorkspace = await res.json() as Workspace;
      workspaces = workspaces.map((w) => (w.id === id ? { ...w, ...updatedWorkspace } : w));

      if (previousWorkspace?.id === id) {
        const nextActiveFile = previousActiveFile && isPathWithinWorkspace(previousActiveFile, previousWorkspace.notes_folder ?? null)
          ? migrateWorkspacePath(previousActiveFile, previousWorkspace.notes_folder ?? null, updatedWorkspace.notes_folder ?? null)
          : null;

        clearPendingAutosave();
        activeWorkspace = updatedWorkspace;

        if (nextActiveFile) {
          activeFile = nextActiveFile;
        } else {
          clearActiveEditorState();
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(WS_STORAGE_KEY, updatedWorkspace.id);
        }

        await loadTree(updatedWorkspace.notes_folder ?? '');

        if (nextActiveFile) {
          await goto(`/${encodePathForUrl(resolveWorkspacePath(nextActiveFile, updatedWorkspace.notes_folder ?? null))}`, {
            replaceState: true,
            noScroll: true,
            keepFocus: true,
          });
          return;
        }

        await goto(workspaceRootUrl(updatedWorkspace), { replaceState: true, noScroll: true, keepFocus: true });
      }
    } catch (error) {
      console.error('Failed to rename workspace:', error);
      showError('Failed to rename workspace. Please try again.');
    }
  }

  // Mutual exclusion: opening any panel closes all others.
  // Each effect only fires when its panel becomes true, setting the rest false.
  // No cascades: the others are already false so their effects don't re-trigger.
  $effect(() => { if (searchOpen)      { commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (commandOpen)     { searchOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (methodologyOpen) { searchOpen = false; commandOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; operationLogOpen = false; cvssOpen = false; findingsTrackerOpen = false; topologyOpen = false; } });
  $effect(() => { if (aiChatOpen)      { searchOpen = false; commandOpen = false; methodologyOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; operationLogOpen = false; cvssOpen = false; findingsTrackerOpen = false; topologyOpen = false; } });
  $effect(() => { if (summarizeOpen)   { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (helpOpen)        { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; settingsOpen = false; } });
  $effect(() => { if (settingsOpen)    { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; } });
  $effect(() => { if (backlinksOpen)   { searchOpen = false; commandOpen = false; methodologyOpen = false; aiChatOpen = false; summarizeOpen = false; helpOpen = false; settingsOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (screenshotsOpen) { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (exportOpen)      { helpOpen = false; settingsOpen = false; } });
  $effect(() => { if (hostTrackerOpen)     { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; screenshotsOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (credentialVaultOpen) { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; flagTrackerOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (flagTrackerOpen)     { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; snippetsOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (snippetsOpen)        { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; operationLogOpen = false; cvssOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (attackChainOpen)     { /* full-screen modal - no sidebar conflict */ } });
  $effect(() => { if (graphOpen)           { /* full-screen overlay - close other full-screen panels */ attackChainOpen = false; } });
  $effect(() => { if (operationLogOpen)    { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; cvssOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (cvssOpen)            { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; operationLogOpen = false; findingsTrackerOpen = false; } });
  $effect(() => { if (findingsTrackerOpen) { methodologyOpen = false; aiChatOpen = false; backlinksOpen = false; screenshotsOpen = false; hostTrackerOpen = false; credentialVaultOpen = false; flagTrackerOpen = false; snippetsOpen = false; operationLogOpen = false; cvssOpen = false; } });
  $effect(() => { if (topologyOpen) { methodologyOpen = false; aiChatOpen = false; attackChainOpen = false; graphOpen = false; } });

  function toggleRightPanel(panel: 'screenshots' | 'hosttracker' | 'credvault' | 'flagtracker' | 'snippets' | 'oplog' | 'cvss' | 'findings' | 'backlinks'): void {
    const isCurrentlyOpen =
      (panel === 'screenshots' && screenshotsOpen) ||
      (panel === 'hosttracker' && hostTrackerOpen) ||
      (panel === 'credvault' && credentialVaultOpen) ||
      (panel === 'flagtracker' && flagTrackerOpen) ||
      (panel === 'snippets' && snippetsOpen) ||
      (panel === 'oplog' && operationLogOpen) ||
      (panel === 'cvss' && cvssOpen) ||
      (panel === 'findings' && findingsTrackerOpen) ||
      (panel === 'backlinks' && backlinksOpen);
    // Close all right panels
    screenshotsOpen = false;
    hostTrackerOpen = false;
    credentialVaultOpen = false;
    flagTrackerOpen = false;
    snippetsOpen = false;
    operationLogOpen = false;
    cvssOpen = false;
    findingsTrackerOpen = false;
    backlinksOpen = false;
    // Open the requested panel only if it wasn't already open (toggle)
    if (!isCurrentlyOpen) {
      if (panel === 'screenshots') screenshotsOpen = true;
      else if (panel === 'hosttracker') hostTrackerOpen = true;
      else if (panel === 'credvault') credentialVaultOpen = true;
      else if (panel === 'flagtracker') flagTrackerOpen = true;
      else if (panel === 'snippets') snippetsOpen = true;
      else if (panel === 'oplog') operationLogOpen = true;
      else if (panel === 'cvss') cvssOpen = true;
      else if (panel === 'findings') findingsTrackerOpen = true;
      else if (panel === 'backlinks') backlinksOpen = true;
    }
  }

  onMount(async () => {
    try {
      // Load workspaces first so we can scope the tree to the active workspace
      await loadWorkspaces();
      const urlPath = $page.params.path;
      if (!urlPath && activeWorkspace) {
        await loadTree(activeWorkspace.notes_folder ?? '');
        await goto(workspaceRootUrl(activeWorkspace), { replaceState: true, noScroll: true, keepFocus: true });
        return;
      }
      if (urlPath) {
        const matchedWorkspace = workspaces.find(
          (ws) => urlPath === ws.notes_folder || urlPath.startsWith(`${ws.notes_folder}/`)
        );
        if (matchedWorkspace) {
          activeWorkspace = matchedWorkspace;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(WS_STORAGE_KEY, matchedWorkspace.id);
          }
        }
      }
      await loadTree(activeWorkspace?.notes_folder ?? '');
      // If URL already has a note file path, open it without pushing another history entry.
      if (urlPath && urlPath.endsWith('.md')) {
        try {
          await openFile(urlPath, false, undefined, true);
        } catch (openErr: unknown) {
          const status = getOpenFileStatus(openErr);
          if (status === 400 || status === 404) {
            await goto(`/${encodePathForUrl(urlPath)}`, {
              replaceState: true,
              noScroll: true,
              keepFocus: true,
              invalidateAll: true
            });
            return;
          }

          console.error('Failed to open file:', urlPath);
        }
      }
    } finally {
      isInitialLoading = false;
    }
  });

  onMount(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(SMALL_SCREEN_MEDIA_QUERY);

    const updateWarningVisibility = (): void => {
      isSmallScreen = mediaQueryList.matches;
      if (!mediaQueryList.matches) {
        showSmallScreenWarning = false;
        return;
      }

      const dismissed = localStorage.getItem(SMALL_SCREEN_WARNING_DISMISS_KEY) === '1';
      showSmallScreenWarning = !dismissed;
    };

    updateWarningVisibility();
    mediaQueryList.addEventListener('change', updateWarningVisibility);

    return () => {
      mediaQueryList.removeEventListener('change', updateWarningVisibility);
    };
  });

  async function loadTree(base = '', options: { force?: boolean } = {}): Promise<void> {
    const requestId = treeLoadRequestId + 1;
    treeLoadRequestId = requestId;

    try {
      const query = base ? `?base=${encodeURIComponent(base)}` : '';
      const res = await fetch(`/api/notes/tree${query}`);
      const data = await res.json();

      if (requestId !== treeLoadRequestId) {
        return;
      }

      if (treeWriteDepth > 0 && !options.force) {
        return;
      }

      tree = data.tree ?? [];
    } catch {
      console.error('Failed to load file tree');
    }
  }

  function getOpenFileStatus(error: unknown): number | null {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as { status: unknown }).status === 'number'
    ) {
      return (error as OpenFileError).status;
    }

    return null;
  }

  // updateUrl = false when we are already at the correct URL (e.g. on mount)
  async function openFile(
    path: string,
    updateUrl = true,
    scrollTo?: { line: number; lineText: string },
    throwOnError = false
  ) {
    try {
      const resolvedPath = resolveWorkspacePath(path);
      const encodedPath = encodePathForUrl(resolvedPath);
      const res = await fetch(`/api/notes/${encodedPath}`);
      if (!res.ok) {
        throw { status: res.status } satisfies OpenFileError;
      }
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
        await goto('/' + encodedPath, { replaceState: true, noScroll: true, keepFocus: true });
      }
    } catch (error: unknown) {
      if (throwOnError) {
        throw error;
      }
      console.error('Failed to open file:', path);
    }
  }

  let saveTimer: ReturnType<typeof setTimeout>;

  function handleContentChange(content: string) {
    activeContent = content;
    isDirty = true;
    clearPendingAutosave();
    const snapshot = createSaveSnapshot();
    if (!snapshot) {
      return;
    }

    saveTimer = setTimeout(() => {
      void saveFile(snapshot);
    }, 1500);
  }

  async function saveFile(snapshot: SaveSnapshot | null = createSaveSnapshot()): Promise<void> {
    if (!snapshot) return;

    isSaving = true;
    try {
      const resolvedPath = resolveWorkspacePath(snapshot.filePath, snapshot.workspaceNotesFolder);
      await fetch(`/api/notes/${encodePathForUrl(resolvedPath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: snapshot.content })
      });

      const isCurrentFile = activeFile === snapshot.filePath;
      const isCurrentWorkspace = (activeWorkspace?.notes_folder ?? null) === snapshot.workspaceNotesFolder;
      const isCurrentContent = activeContent === snapshot.content;

      if (isCurrentFile && isCurrentWorkspace && isCurrentContent) {
        isDirty = false;
      }
    } catch {
      console.error('Failed to save file');
    } finally {
      isSaving = false;
    }
  }

  async function createFile(path: string, type: 'file' | 'folder', initialContent?: string) {
    const fullPath = resolveWorkspacePath(path);
    const encodedPath = encodePathForUrl(fullPath);
    beginTreeWrite();
    try {
      const res = await fetch(`/api/notes/${encodedPath}`, {
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
        await fetch(`/api/notes/${encodedPath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: initialContent })
        });
      }
    } finally {
      endTreeWrite();
    }

    await loadTree(activeWorkspace?.notes_folder ?? '', { force: true });
  }

  async function deleteFile(path: string) {
    const resolvedPath = resolveWorkspacePath(path);
    beginTreeWrite();
    try {
      await fetch(`/api/notes/${encodePathForUrl(resolvedPath)}`, { method: 'DELETE' });
    } finally {
      endTreeWrite();
    }

    if (activeFile === path) {
      activeFile = null;
      activeContent = '';
      await goto(workspaceRootUrl(activeWorkspace), { replaceState: true, noScroll: true, keepFocus: true });
    }
    await loadTree(activeWorkspace?.notes_folder ?? '', { force: true });
  }

  async function renameFile(fromPath: string, toPath: string) {
    const resolvedFromPath = resolveWorkspacePath(fromPath);
    const resolvedToPath = resolveWorkspacePath(toPath);
    beginTreeWrite();
    try {
      await fetch(`/api/notes/${encodePathForUrl(resolvedFromPath)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPath: resolvedToPath })
      });
    } finally {
      endTreeWrite();
    }

    if (activeFile === fromPath) {
      activeFile = toPath;
      await goto('/' + encodePathForUrl(resolvedToPath), { replaceState: true, noScroll: true, keepFocus: true });
    }
    await loadTree(activeWorkspace?.notes_folder ?? '', { force: true });
  }

  function handleSummarize() {
    if (!activeFile || !activeContent.trim()) return;
    summarizeOpen = true;
  }

  async function moveFile(fromPath: string, toFolderPath: string) {
    const filename = fromPath.split('/').pop()!;
    const targetPath = toFolderPath ? `${toFolderPath}/${filename}` : filename;
    if (targetPath === fromPath) {
      return;
    }

    tree = applyMove(tree, fromPath, toFolderPath);

    const resolvedFrom = resolveWorkspacePath(fromPath);
    const resolvedTo = resolveWorkspacePath(targetPath);
    beginTreeWrite();
    let moveSuccess = false;
    try {
      const res = await fetch(`/api/notes/${encodePathForUrl(resolvedFrom)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPath: resolvedTo })
      });
      if (res.ok) {
        moveSuccess = true;
      } else {
        await loadTree(activeWorkspace?.notes_folder ?? '', { force: true });
      }
    } catch {
      await loadTree(activeWorkspace?.notes_folder ?? '', { force: true });
    } finally {
      endTreeWrite();
    }

    if (moveSuccess && activeFile === fromPath) {
      activeFile = targetPath;
      await goto('/' + encodePathForUrl(resolvedTo), { replaceState: true, noScroll: true, keepFocus: true });
    }
  }

  const noteSuggestions = $derived(flattenTree(tree));

  async function reorderNotes(orderedPaths: string[]): Promise<void> {
    tree = applyReorder(tree, orderedPaths);
    const items = orderedPaths.map((path, i) => ({ path, sort_order: i }));
    beginTreeWrite();
    try {
      const res = await fetch('/api/notes/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error('Reorder failed');
    } catch (err) {
      console.error('Failed to persist note sort order:', err);
      showError('Failed to reorder notes. Please try again.');
      await loadTree(activeWorkspace?.notes_folder ?? '', { force: true });
    } finally {
      endTreeWrite();
    }
  }

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
      if (activeWorkspace?.preset === 'cpts') {
        methodologyOpen = !methodologyOpen;
      }
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
      if (activeFile) toggleRightPanel('backlinks');
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      toggleRightPanel('screenshots');
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
      toggleRightPanel('cvss');
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      toggleRightPanel('findings');
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

  {#if showSmallScreenWarning && isSmallScreen}
    <div
      class="fixed inset-0 z-[210] flex items-center justify-center bg-background/45 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-xl border border-amber-500/45 bg-card p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="small-screen-warning-title"
        aria-describedby="small-screen-warning-description"
      >
        <p id="small-screen-warning-title" class="text-sm font-semibold text-foreground">Desktop-focused app</p>
        <p id="small-screen-warning-description" class="mt-2 text-xs leading-relaxed text-muted-foreground">
          Leaflet is optimized for desktop workflows. On small screens, some features may be limited or behave unexpectedly.
        </p>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            onclick={dismissSmallScreenWarning}
            class="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/60"
            aria-label="Dismiss small screen warning"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  {/if}

  <Toolbar
    bind:searchOpen
    bind:editorMode
    bind:methodologyOpen
    bind:aiChatOpen
    bind:newNoteOpen
    onNewNote={(fileName, templateContent) => {
      const baseName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
      const fullPath = newNoteParentPath ? `${newNoteParentPath}/${baseName}` : baseName;
      newNoteParentPath = null;
      createFile(fullPath, 'file', templateContent || undefined);
    }}
    onNewFolder={(path) => createFile(path, 'folder')}
    onToggleTheme={() => theme.toggle()}
    isDark={theme.isDark}
    hasActiveFile={!!activeFile}
    onOpenCommandPalette={() => (commandOpen = true)}
    onSummarize={handleSummarize}
    onOpenBacklinks={() => { if (activeFile) toggleRightPanel('backlinks'); }}
    onOpenScreenshots={() => toggleRightPanel('screenshots')}
    onOpenExport={() => { if (activeFile) exportOpen = true; }}
    onOpenHelp={() => (helpOpen = true)}
    onOpenSettings={() => (settingsOpen = true)}
    onOpenGraph={() => (graphOpen = !graphOpen)}
    hasWorkspace={!!activeWorkspace}
    isPentest={activeWorkspace?.type === 'pentest'}
    isCpts={activeWorkspace?.preset === 'cpts'}
    onOpenHostTracker={() => toggleRightPanel('hosttracker')}
    onOpenCredentialVault={() => toggleRightPanel('credvault')}
    onOpenFlagTracker={() => toggleRightPanel('flagtracker')}
    onOpenSnippets={() => toggleRightPanel('snippets')}
    onOpenAttackChain={() => (attackChainOpen = !attackChainOpen)}
    onOpenOperationLog={() => toggleRightPanel('oplog')}
    onOpenCvssCalculator={() => toggleRightPanel('cvss')}
    onOpenFindingsTracker={() => toggleRightPanel('findings')}
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
      onDeleteWorkspace={deleteWorkspace}
      onRenameWorkspace={renameWorkspace}
      onReorderWorkspaces={(reordered) => (workspaces = reordered)}
      onNewNoteInFolder={(parentPath) => {
        newNoteParentPath = parentPath;
        newNoteOpen = true;
      }}
      onReorderNotes={reorderNotes}
      onPullSuccess={async () => {
        await invalidateAll();
        window.location.reload();
      }}
    />

    <main class="relative flex flex-1 flex-col overflow-hidden">
      {#if isInitialLoading}
        <div
          class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle size={24} class="animate-spin motion-reduce:animate-none" />
          <p class="text-sm">Loading notes...</p>
        </div>
      {:else if findOpen && activeFile}
        <FindPanel
          editorApi={editorApi}
          onClose={() => (findOpen = false)}
        />
      {/if}
      {#if !isInitialLoading && activeFile}
        <Editor
          mode={editorMode}
          content={activeContent}
          filePath={activeFile}
          bind:scrollTarget={pendingScrollTarget}
          onContentChange={handleContentChange}
          onWordCountChange={(count: number) => (wordCount = count)}
          onReady={(api: EditorApi) => { insertIntoEditor = api.insertText; editorApi = api; }}
          onImageUploaded={() => { screenshotVersion += 1; }}
          onImageClick={(src: string, alt: string) => (lightboxImage = { src, alt })}
          onWikilinkClick={(name: string) => {
            const path = findNoteByName(tree, name);
            if (path) openFile(path);
          }}
          {noteSuggestions}
          workspaceId={activeWorkspace?.id ?? null}
        />
      {:else if !isInitialLoading}
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

    <RightPanelContainer
      open={rightPanelOpen}
      width={rightPanelWidth}
      isResizing={isResizingRight}
      onStartResize={startRightResize}
    >

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
        onClose={() => (screenshotsOpen = false)}
        onInsert={(md) => { insertIntoEditor?.(md); }}
        refreshTrigger={screenshotVersion}
        {uiMode}
      />
    {/if}

    {#if hostTrackerOpen}
      <HostTrackerPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (hostTrackerOpen = false)}
        {uiMode}
      />
    {/if}

    {#if credentialVaultOpen}
      <CredentialVaultPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (credentialVaultOpen = false)}
        {uiMode}
      />
    {/if}

    {#if flagTrackerOpen}
      <FlagTrackerPanel
        workspaceId={activeWorkspace?.id ?? null}
        totalFlags={activeWorkspace?.total_flags ?? 0}
        passingFlags={activeWorkspace?.passing_flags ?? 0}
        onClose={() => (flagTrackerOpen = false)}
        {uiMode}
      />
    {/if}

    {#if snippetsOpen}
      <CommandSnippetsPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (snippetsOpen = false)}
        onInsert={(text) => { insertIntoEditor?.(text); }}
        {uiMode}
      />
    {/if}

    {#if operationLogOpen}
      <OperationLogPanel
        workspaceId={activeWorkspace?.id ?? null}
        onClose={() => (operationLogOpen = false)}
        {uiMode}
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
        {uiMode}
      />
    {/if}
    </RightPanelContainer>

  </div>

  {#if attackChainOpen}
    <AttackChainPanel
      workspaceId={activeWorkspace?.id ?? null}
      onClose={() => (attackChainOpen = false)}
      {uiMode}
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
      workspaceId={activeWorkspace?.id}
      currentContent={activeContent}
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
      {uiMode}
      onUiModeChange={setUiMode}
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


