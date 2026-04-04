<script lang="ts">
  import { Keyboard, Search, FilePlus, FolderPlus, Settings, FileCode, Eye, Terminal, ListChecks, Bot, Sparkles, Link2, Camera, Download, Monitor, KeyRound, Flag, Network, FileText, GitGraph } from '@lucide/svelte';
  import Dialog from '$lib/components/modals/Dialog.svelte';
  import NewNoteDialog from '$lib/components/modals/NewNoteDialog.svelte';
  import AnimatedThemeToggler from './AnimatedThemeToggler.svelte';

  interface Props {
    searchOpen: boolean;
    editorMode: 'wysiwyg' | 'source';
    methodologyOpen: boolean;
    aiChatOpen: boolean;
    newNoteOpen: boolean;
    isDark: boolean;
    hasActiveFile: boolean;
    onNewNote: (path: string, templateContent: string) => void;
    onNewFolder: (path: string) => void;
    onToggleTheme: () => void;
    onOpenCommandPalette: () => void;
    onSummarize: () => void;
    onOpenBacklinks: () => void;
    onOpenScreenshots: () => void;
    onOpenExport: () => void;
    onOpenHelp: () => void;
    onOpenSettings: () => void;
    onOpenGraph?: () => void;
    onOpenHostTracker?: () => void;
    onOpenCredentialVault?: () => void;
    onOpenFlagTracker?: () => void;
    onOpenSnippets?: () => void;
    onOpenAttackChain?: () => void;
    onOpenReport?: () => void;
    hasWorkspace?: boolean;
  }

  let { searchOpen = $bindable(), editorMode = $bindable(), methodologyOpen = $bindable(), aiChatOpen = $bindable(), newNoteOpen = $bindable(), isDark, hasActiveFile, onNewNote, onNewFolder, onToggleTheme, onOpenCommandPalette, onSummarize, onOpenBacklinks, onOpenScreenshots, onOpenExport, onOpenHelp, onOpenSettings, onOpenGraph, onOpenHostTracker, onOpenCredentialVault, onOpenFlagTracker, onOpenSnippets, onOpenAttackChain, onOpenReport, hasWorkspace = false }: Props =
    $props();

  let activeDialog: 'note' | 'folder' | null = $state(null);

  // Allow parent to trigger the new-note dialog via the newNoteOpen bindable.
  $effect(() => {
    if (newNoteOpen) {
      activeDialog = 'note';
      newNoteOpen = false;
    }
  });
</script>

<header class="flex h-10 items-center gap-1 border-b border-border bg-card px-2">
  <!-- App name -->
  <span class="mr-2 select-none text-sm font-semibold tracking-wide text-foreground">Notes</span>

  <div class="flex flex-1 items-center gap-0.5">
    <!-- New Note -->
    <button
      title="New note (Ctrl+Shift+E)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={() => (activeDialog = 'note')}
    >
      <FilePlus size={15} />
    </button>

    <!-- New Folder -->
    <button
      title="New folder"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={() => (activeDialog = 'folder')}
    >
      <FolderPlus size={15} />
    </button>

    <!-- Search -->
    <button
      title="Search (Ctrl+P)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {searchOpen
        ? 'bg-accent text-accent-foreground'
        : ''}"
      onclick={() => (searchOpen = !searchOpen)}
    >
      <Search size={15} />
    </button>

    <!-- Command Palette -->
    <button
      title="Command palette (Ctrl+Shift+K)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={onOpenCommandPalette}
    >
      <Terminal size={15} />
    </button>
  </div>

  <div class="flex items-center gap-0.5">
    <!-- Methodology checklist -->
    <button
      title="Methodology checklist (Ctrl+.)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {methodologyOpen
        ? 'bg-accent text-accent-foreground'
        : ''}"
      onclick={() => (methodologyOpen = !methodologyOpen)}
    >
      <ListChecks size={15} />
    </button>

    <!-- AI Chat -->
    <button
      title="AI assistant (Ctrl+Shift+A)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {aiChatOpen
        ? 'bg-accent text-accent-foreground'
        : ''}"
      onclick={() => (aiChatOpen = !aiChatOpen)}
    >
      <Bot size={15} />
    </button>

    <!-- AI Summarize -->
    <button
      title="AI summarize note (Ctrl+Shift+S)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasActiveFile ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onSummarize}
      disabled={!hasActiveFile}
    >
      <Sparkles size={15} />
    </button>

    <!-- Backlinks -->
    <button
      title="Backlinks (Ctrl+Shift+B)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasActiveFile ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenBacklinks}
      disabled={!hasActiveFile}
    >
      <Link2 size={15} />
    </button>

    <!-- Note Graph -->
    <button
      title="Note graph (Ctrl+Shift+Q)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={onOpenGraph}
    >
      <GitGraph size={15} />
    </button>

    <!-- Screenshot manager -->
    <button
      title="Screenshot manager (Ctrl+Shift+G)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={onOpenScreenshots}
    >
      <Camera size={15} />
    </button>

    <!-- Export -->
    <button
      title="Export note (Ctrl+Shift+X)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasActiveFile ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenExport}
      disabled={!hasActiveFile}
    >
      <Download size={15} />
    </button>

    <!-- Divider -->
    <span class="mx-1 h-4 w-px bg-border"></span>

    <!-- Engagement: Host Tracker -->
    <button
      title="Host tracker"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenHostTracker}
      disabled={!hasWorkspace}
    >
      <Monitor size={15} />
    </button>

    <!-- Engagement: Credential Vault -->
    <button
      title="Credential vault"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenCredentialVault}
      disabled={!hasWorkspace}
    >
      <KeyRound size={15} />
    </button>

    <!-- Engagement: Flag Tracker -->
    <button
      title="Flag tracker"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenFlagTracker}
      disabled={!hasWorkspace}
    >
      <Flag size={15} />
    </button>

    <!-- Engagement: Command Snippets -->
    <button
      title="Command snippets"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenSnippets}
      disabled={!hasWorkspace}
    >
      <Terminal size={15} />
    </button>

    <!-- Engagement: Attack Chain -->
    <button
      title="Attack chain"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenAttackChain}
      disabled={!hasWorkspace}
    >
      <Network size={15} />
    </button>

    <!-- Engagement: Report Generator -->
    <button
      title="Report generator"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenReport}
      disabled={!hasWorkspace}
    >
      <FileText size={15} />
    </button>

    <!-- Divider -->
    <span class="mx-1 h-4 w-px bg-border"></span>

    <!-- Editor mode toggle -->
    <button
      title="Toggle editor mode (Ctrl+M)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={() => (editorMode = editorMode === 'wysiwyg' ? 'source' : 'wysiwyg')}
    >
      {#if editorMode === 'wysiwyg'}
        <Eye size={15} />
      {:else}
        <FileCode size={15} />
      {/if}
    </button>

    <!-- Help / Keyboard shortcuts -->
    <button
      title="Keyboard shortcuts (?)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={onOpenHelp}
    >
      <Keyboard size={15} />
    </button>

    <!-- Settings -->
    <button
      title="Settings"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      onclick={onOpenSettings}
    >
      <Settings size={15} />
    </button>

    <!-- Theme toggle -->
    <AnimatedThemeToggler {isDark} onToggle={onToggleTheme} />
  </div>
</header>

{#if activeDialog === 'note'}
  <NewNoteDialog
    onConfirm={(name, content) => {
      activeDialog = null;
      if (name) onNewNote(name, content);
    }}
    onCancel={() => (activeDialog = null)}
  />
{:else if activeDialog === 'folder'}
  <Dialog
    title="New Folder"
    placeholder="folder-name"
    confirmLabel="Create"
    onConfirm={(name) => {
      activeDialog = null;
      if (name) onNewFolder(name);
    }}
    onCancel={() => (activeDialog = null)}
  />
{/if}
