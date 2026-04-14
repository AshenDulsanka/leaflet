<script lang="ts">
  import { Keyboard, Search, FilePlus, FolderPlus, Settings, FileCode, Eye, Terminal, ListChecks, Bot, Sparkles, Link2, Camera, Download, Monitor, KeyRound, Flag, Network, GitGraph, ScrollText, ShieldAlert, Bug, Workflow } from '@lucide/svelte';
  import Dialog from '$lib/components/modals/Dialog.svelte';
  import NewNoteDialog from '$lib/components/modals/NewNoteDialog.svelte';
  import AnimatedThemeToggler from './AnimatedThemeToggler.svelte';
  import logoRaw from '$lib/assets/logo.svg?raw';
  import typoRaw from '$lib/assets/typo.svg?raw';

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
    onOpenOperationLog?: () => void;
    onOpenCvssCalculator?: () => void;
    onOpenFindingsTracker?: () => void;
    onOpenTopology?: () => void;
    hasWorkspace?: boolean;
    isPentest?: boolean;
  }

  let { searchOpen = $bindable(), editorMode = $bindable(), methodologyOpen = $bindable(), aiChatOpen = $bindable(), newNoteOpen = $bindable(), isDark, hasActiveFile, onNewNote, onNewFolder, onToggleTheme, onOpenCommandPalette, onSummarize, onOpenBacklinks, onOpenScreenshots, onOpenExport, onOpenHelp, onOpenSettings, onOpenGraph, onOpenHostTracker, onOpenCredentialVault, onOpenFlagTracker, onOpenSnippets, onOpenAttackChain, onOpenOperationLog, onOpenCvssCalculator, onOpenFindingsTracker, onOpenTopology, hasWorkspace = false, isPentest = false }: Props =
    $props();

  let activeDialog: 'note' | 'folder' | null = $state(null);

  // Allow parent to trigger the new-note dialog via the newNoteOpen bindable.
  $effect(() => {
    if (newNoteOpen) {
      activeDialog = 'note';
      newNoteOpen = false;
    }
  });

  // Strip fixed width/height so CSS controls sizing of the inline SVGs.
  // SECURITY: ?raw imports are bundled at build time from static assets only.
  // NEVER use {@html} with runtime user content - use DOMPurify instead.
  const logoSvg = logoRaw.replace(/\s(?:width|height)="[^"]*"/g, '');
  const typoSvg = typoRaw.replace(/\s(?:width|height)="[^"]*"/g, '');
</script>

<header class="flex h-10 items-center gap-1 border-b border-border bg-card px-2">
  <!-- App logo -->
  <a href="/" class="mr-3 flex shrink-0 select-none items-center gap-1.5 text-foreground" aria-label="Leaflet">
    <span class="flex h-6 w-[22px] items-center invert dark:invert-0 [&>svg]:h-full [&>svg]:w-full">{@html logoSvg}</span>
    <span class="flex h-[13px] items-center invert dark:invert-0 [&>svg]:h-full [&>svg]:w-auto">{@html typoSvg}</span>
  </a>

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
    {#if isPentest}
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
    {/if}

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

    {#if isPentest}
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

    <!-- Engagement: Operation Log -->
    <button
      title="Operation log"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenOperationLog}
      disabled={!hasWorkspace}
    >
      <ScrollText size={15} />
    </button>

    <!-- Engagement: CVSS Calculator -->
    <button
      title="CVSS Calculator (Ctrl+Shift+V)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenCvssCalculator}
      disabled={!hasWorkspace}
    >
      <ShieldAlert size={15} />
    </button>

    <!-- Engagement: Findings Tracker -->
    <button
      title="Findings Tracker (Ctrl+Shift+F)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenFindingsTracker}
      disabled={!hasWorkspace}
    >
      <Bug size={15} />
    </button>

    <!-- Engagement: Network Topology -->
    <button
      title="Network Topology (Ctrl+Shift+T)"
      class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {!hasWorkspace ? 'opacity-40 cursor-not-allowed' : ''}"
      onclick={onOpenTopology}
      disabled={!hasWorkspace}
    >
      <Workflow size={15} />
    </button>
    {/if}

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
