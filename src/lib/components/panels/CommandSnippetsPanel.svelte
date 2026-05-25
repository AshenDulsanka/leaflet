<script lang="ts">
  import { Terminal, Plus, X, RefreshCw, Copy, ChevronDown, ChevronRight, Trash2, Pencil } from '@lucide/svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { extractSnippetVarNames } from '$lib/data/commands';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Snippet {
    id: string;
    workspace_id: string | null;
    category: string;
    title: string;
    command: string;
    description: string;
    tags: string[];
  }

  interface SnippetVar {
    id: string;
    name: string;
    value: string;
  }

  interface MergedVar {
    id: string | null;
    name: string;
    value: string;
    persisted: boolean;
  }

  interface Props {
    workspaceId: string | null;
    onInsert?: (text: string) => void;
    onClose: () => void;
    uiMode?: 'modal' | 'inline';
  }

  let { workspaceId, onInsert, onClose, uiMode = 'modal' }: Props = $props();

  let snippets = $state<Snippet[]>([]);
  let variables = $state<SnippetVar[]>([]);
  let loading = $state(false);
  let activeTab = $state<'snippets' | 'variables'>('snippets');
  let expandedCategories = $state<Set<string>>(new Set(['general', 'recon']));
  let addingSnippet = $state(false);
  let searchQuery = $state('');
  let varSearchQuery = $state('');
  let editingSnippet = $state<Snippet | null>(null);
  let editTitle = $state('');
  let editCommand = $state('');
  let editCategory = $state('general');
  let editDescription = $state('');
  let snippetToDelete = $state<string | null>(null);
  let varToDelete = $state<string | null>(null);
  let showAddVar = $state(false);

  // Add snippet form
  let newTitle = $state('');
  let newCommand = $state('');
  let newCategory = $state('general');
  let newDescription = $state('');
  let isGlobal = $state(false);

  // Variable modals
  let newVarName = $state('');
  let newVarValue = $state('');
  let addVarError = $state('');
  let editingVar = $state<SnippetVar | null>(null);
  let editVarValue = $state('');
  let editVarName = $state('');

  $effect(() => {
    if (workspaceId) {
      loadSnippets();
      loadVariables();
    }
  });

  async function loadSnippets() {
    if (!workspaceId) return;
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets`);
      if (!res.ok) {
        console.error('Failed to load snippets:', res.status);
        return;
      }
      const raw = await res.json() as Array<Snippet & { tags: string | string[] }>;
      snippets = raw.map((s) => ({
        ...s,
        tags: typeof s.tags === 'string' ? JSON.parse(s.tags) : (s.tags ?? [])
      }));
    } catch {
      console.error('Failed to load snippets');
    } finally {
      loading = false;
    }
  }

  async function loadVariables() {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/variables`);
      const data: SnippetVar[] = await res.json();
      variables = data;
    } catch {
      console.error('Failed to load variables');
    }
  }

  async function addSnippet() {
    if (!workspaceId || !newTitle.trim() || !newCommand.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          command: newCommand.trim(),
          category: newCategory,
          description: newDescription.trim(),
          global: isGlobal
        })
      });
      if (!res.ok) return;
      const snippet: Snippet = await res.json();
      snippets = [...snippets, snippet];
      expandedCategories = new Set([...expandedCategories, snippet.category]);
      newTitle = '';
      newCommand = '';
      newCategory = 'general';
      newDescription = '';
      isGlobal = false;
      addingSnippet = false;
    } catch {
      console.error('Failed to add snippet');
    }
  }

  function deleteSnippet(id: string) {
    snippetToDelete = id;
  }

  async function confirmDeleteSnippet(): Promise<void> {
    if (!workspaceId || !snippetToDelete) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets/${snippetToDelete}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('Failed to delete snippet:', res.status);
        return;
      }
      snippets = snippets.filter((s) => s.id !== snippetToDelete);
    } catch (err) {
      console.error('Failed to delete snippet:', err);
    } finally {
      snippetToDelete = null;
    }
  }

  function startEditSnippet(snippet: Snippet) {
    editingSnippet = snippet;
    editTitle = snippet.title;
    editCommand = snippet.command;
    editCategory = snippet.category;
    editDescription = snippet.description;
  }

  async function saveEditSnippet() {
    if (!editingSnippet || !workspaceId) return;
    if (!editTitle.trim() || !editCommand.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets/${editingSnippet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          command: editCommand.trim(),
          category: editCategory,
          description: editDescription.trim()
        })
      });
      if (!res.ok) return;
      const raw = await res.json() as Snippet & { tags: string | string[] };
      const updated: Snippet = { ...raw, tags: typeof raw.tags === 'string' ? JSON.parse(raw.tags) : (raw.tags ?? []) };
      snippets = snippets.map((s) => s.id === updated.id ? updated : s);
      editingSnippet = null;
    } catch {
      console.error('Failed to update snippet');
    }
  }

  /** Substitute {VARIABLE_NAME} placeholders with current variable values */
  function resolveCommand(command: string): string {
    return command.replace(/\{([A-Z0-9_-]+)\}/g, (_, name: string) => {
      const v = variables.find((vr) => vr.name.toUpperCase() === name.toUpperCase());
      return v?.value || `{${name}}`;
    });
  }

  async function copySnippet(snippet: Snippet) {
    const resolved = resolveCommand(snippet.command);
    try {
      await navigator.clipboard.writeText(resolved);
    } catch (err) {
      console.error('Failed to copy snippet to clipboard:', err);
    }
  }

  async function saveVariable(name: string, value: string) {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value })
      });
      if (res.ok) {
        const updated: SnippetVar = await res.json();
        const exists = variables.find((v) => v.id === updated.id || v.name === updated.name);
        if (exists) {
          variables = variables.map((v) => v.id === updated.id ? updated : v);
        } else {
          variables = [...variables, updated];
        }
      }
    } catch (err) {
      console.error('Failed to save variable:', err);
    }
  }

  function deleteVariable(id: string) {
    varToDelete = id;
  }

  async function confirmDeleteVariable(): Promise<void> {
    if (!workspaceId || !varToDelete) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/variables/${varToDelete}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('Failed to delete variable:', res.status);
        return;
      }
      variables = variables.filter((v) => v.id !== varToDelete);
    } catch (err) {
      console.error('Failed to delete variable:', err);
    } finally {
      varToDelete = null;
    }
  }

  function openEditVar(v: MergedVar) {
    if (!v.id) return;
    const persisted = variables.find((sv) => sv.id === v.id);
    if (!persisted) return;
    editingVar = persisted;
    editVarName = persisted.name;
    editVarValue = persisted.value;
  }

  async function saveEditVar() {
    if (!editingVar || !workspaceId) return;
    const newName = editVarName.trim().toUpperCase();
    if (!newName || !/^[A-Z][A-Z0-9_-]*$/.test(newName)) return;
    if (newName !== editingVar.name) {
      await fetch(`/api/workspaces/${workspaceId}/variables/${editingVar.id}`, { method: 'DELETE' });
      variables = variables.filter((v) => v.id !== editingVar!.id);
    }
    await saveVariable(newName, editVarValue.trim());
    editingVar = null;
  }

  function toggleCategory(cat: string) {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    expandedCategories = next;
  }

  // Group filtered snippets by category
  const filteredSnippets = $derived(
    searchQuery.trim()
      ? snippets.filter((s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : snippets
  );

  const groupedSnippets = $derived.by(() => {
    const groups = new Map<string, Snippet[]>();
    for (const s of filteredSnippets) {
      const cat = s.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(s);
    }
    return groups;
  });

  /** Merge persisted variables with names auto-extracted from snippet commands. */
  const mergedVars = $derived.by(() => {
    const extractedNames = extractSnippetVarNames(snippets.map((s) => s.command));
    const persistedMap = new Map(variables.map((v) => [v.name, v]));
    const result: MergedVar[] = variables.map((v) => ({
      id: v.id, name: v.name, value: v.value, persisted: true
    }));
    for (const name of extractedNames) {
      if (!persistedMap.has(name)) {
        result.push({ id: null, name, value: '', persisted: false });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  });

  const filteredVars = $derived(
    varSearchQuery.trim()
      ? mergedVars.filter(
          (v) =>
            v.name.toLowerCase().includes(varSearchQuery.toLowerCase()) ||
            v.value.toLowerCase().includes(varSearchQuery.toLowerCase())
        )
      : mergedVars
  );

  const CATEGORIES = [
    'general', 'recon', 'exploitation', 'privesc-linux', 'privesc-windows',
    'pivoting', 'ad-attacks', 'file-transfer', 'credential-attacks'
  ];

  const categoryOptions = CATEGORIES.map((category) => ({ value: category, label: category }));

  function closeAddVarModal(): void {
    showAddVar = false;
    newVarName = '';
    newVarValue = '';
    addVarError = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.key !== 'Escape') return;

    if (editingSnippet) {
      editingSnippet = null;
      return;
    }

    if (addingSnippet) {
      addingSnippet = false;
      return;
    }

    if (editingVar) {
      editingVar = null;
      return;
    }

    if (showAddVar) {
      closeAddVarModal();
      return;
    }

    if (snippetToDelete) {
      snippetToDelete = null;
      return;
    }

    if (varToDelete) {
      varToDelete = null;
      return;
    }

    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="absolute right-0 top-0 flex h-full w-80 flex-shrink-0 flex-col border-l border-border bg-card"
  transition:fly={{ x: 320, duration: 200, easing: cubicOut }}
>
  <!-- Header -->
  <div class="flex h-9 items-center justify-between border-b border-border px-3">
    <div class="flex items-center gap-2">
      <Terminal size={14} class="text-muted-foreground" />
      <span class="text-xs font-semibold">Command Snippets</span>
    </div>
    <div class="flex items-center gap-1">
      <button
        onclick={loadSnippets}
        aria-label="Refresh snippets"
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => (addingSnippet = true)}
        aria-label="Add snippet"
        title="Add snippet"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      <button
        onclick={onClose}
        aria-label="Close command snippets panel"
        title="Close"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={13} />
      </button>
    </div>
  </div>

  {#if !workspaceId}
    <div class="flex flex-1 items-center justify-center p-4">
      <p class="text-center text-xs text-muted-foreground">Select a workspace to use snippets</p>
    </div>
  {:else}
    <!-- Tabs -->
    <div class="flex border-b border-border">
      <button
        onclick={() => (activeTab = 'snippets')}
        class="flex-1 py-1.5 text-xs font-medium transition-colors {activeTab === 'snippets' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}"
      >
        Snippets
      </button>
      <button
        onclick={() => (activeTab = 'variables')}
        class="flex-1 py-1.5 text-xs font-medium transition-colors {activeTab === 'variables' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}"
      >
        Variables ({variables.length})
      </button>
    </div>

    {#if activeTab === 'snippets'}
      <!-- Search bar -->
      <div class="border-b border-border px-3 py-2">
        <input
          type="text"
          aria-label="Filter snippets"
          placeholder="Filter snippets..."
          bind:value={searchQuery}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <!-- Snippet groups -->
      <div class="flex-1 overflow-y-auto">
        {#if addingSnippet && uiMode === 'inline'}
          <div class="border-b border-border bg-muted/40 p-3 space-y-2">
            <label class="block space-y-0.5">
              <span class="text-[10px] text-muted-foreground">Title <span class="text-destructive">*</span></span>
              <input
                type="text"
                placeholder="Title"
                bind:value={newTitle}
                class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label class="block space-y-0.5">
              <span class="text-[10px] text-muted-foreground">Command <span class="text-destructive">*</span></span>
              <textarea
                placeholder="Command (use &#123;VARIABLE&#125; for substitution)"
                bind:value={newCommand}
                rows={3}
                class="w-full resize-none rounded border border-border bg-background px-2 py-1 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
              ></textarea>
            </label>
            <div class="space-y-0.5">
              <span class="block text-[10px] text-muted-foreground">Category</span>
              <Select size="sm" options={categoryOptions} value={newCategory} onchange={(v) => { newCategory = v; }} />
            </div>
            <label class="block space-y-0.5">
              <span class="text-[10px] text-muted-foreground">Description</span>
              <input
                type="text"
                placeholder="Description"
                bind:value={newDescription}
                class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label class="flex items-center gap-2 text-[10px] text-muted-foreground">
              <input type="checkbox" bind:checked={isGlobal} class="rounded" />
              Global (all workspaces)
            </label>
            <div class="flex gap-2">
              <button
                onclick={addSnippet}
                class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >Add</button>
              <button
                onclick={() => (addingSnippet = false)}
                class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
              >Cancel</button>
            </div>
          </div>
        {/if}
        {#if loading}
          <div class="flex items-center justify-center py-8">
            <RefreshCw size={16} class="animate-spin text-muted-foreground" />
          </div>
        {:else if filteredSnippets.length === 0}
          <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Terminal size={24} class="text-muted-foreground/40" />
            <p class="text-xs text-muted-foreground">No snippets. Click + to add one.</p>
          </div>
        {:else}
          {#each [...groupedSnippets] as [category, items] (category)}
            <div class="border-b border-border last:border-b-0">
              <!-- Category header -->
              <button
                onclick={() => toggleCategory(category)}
                class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50"
              >
                {#if expandedCategories.has(category)}
                  <ChevronDown size={11} class="flex-shrink-0 text-muted-foreground" />
                {:else}
                  <ChevronRight size={11} class="flex-shrink-0 text-muted-foreground" />
                {/if}
                <span class="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{category}</span>
                <span class="text-[10px] text-muted-foreground/60">{items.length}</span>
              </button>

              {#if expandedCategories.has(category)}
                {#each items as snippet (snippet.id)}
                  <div class="group border-t border-border/50 px-3 py-2 hover:bg-accent/30">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-medium">{snippet.title}</p>
                        {#if snippet.description}
                          <p class="text-[10px] text-muted-foreground">{snippet.description}</p>
                        {/if}
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        {#if onInsert}
                          <button
                            onclick={() => onInsert(resolveCommand(snippet.command))}
                            aria-label="Insert snippet into editor"
                            title="Insert into editor"
                            class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Plus size={11} />
                          </button>
                        {/if}
                        <button
                          onclick={() => copySnippet(snippet)}
                          aria-label="Copy snippet"
                          title="Copy (with variable substitution)"
                          class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          onclick={() => startEditSnippet(snippet)}
                          aria-label="Edit snippet"
                          title="Edit"
                          class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onclick={() => deleteSnippet(snippet.id)}
                          aria-label="Delete snippet"
                          title="Delete"
                          class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <code class="mt-1 block rounded bg-muted px-2 py-1 text-[10px] font-mono leading-relaxed text-foreground">
                      {resolveCommand(snippet.command)}
                    </code>
                    {#if snippet.workspace_id === null}
                      <span class="text-[9px] text-muted-foreground/60">global</span>
                    {/if}
                  </div>
                  {#if editingSnippet?.id === snippet.id && uiMode === 'inline'}
                    <div class="border-t border-border bg-muted/40 px-3 pb-3 pt-2 space-y-2">
                      <label class="block space-y-0.5">
                        <span class="text-[10px] text-muted-foreground">Title <span class="text-destructive">*</span></span>
                        <input
                          type="text"
                          bind:value={editTitle}
                          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </label>
                      <label class="block space-y-0.5">
                        <span class="text-[10px] text-muted-foreground">Command <span class="text-destructive">*</span></span>
                        <textarea
                          bind:value={editCommand}
                          rows={3}
                          class="w-full resize-none rounded border border-border bg-background px-2 py-1 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                        ></textarea>
                      </label>
                      <div class="space-y-0.5">
                        <span class="block text-[10px] text-muted-foreground">Category</span>
                        <Select size="sm" options={categoryOptions} value={editCategory} onchange={(v) => { editCategory = v; }} />
                      </div>
                      <label class="block space-y-0.5">
                        <span class="text-[10px] text-muted-foreground">Description</span>
                        <input
                          type="text"
                          bind:value={editDescription}
                          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </label>
                      <div class="flex gap-2">
                        <button
                          onclick={saveEditSnippet}
                          class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >Save</button>
                        <button
                          onclick={() => (editingSnippet = null)}
                          class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                        >Cancel</button>
                      </div>
                    </div>
                  {/if}
                {/each}
              {/if}
            </div>
          {/each}
        {/if}
      </div>

    {:else}
      <!-- Variables tab -->
      <div class="flex-1 overflow-y-auto">
        <!-- Toolbar row -->
        <div class="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <p class="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            Use <code class="font-mono">&#123;NAME&#125;</code> in commands. Values auto-save.
          </p>
          <button
            onclick={() => (showAddVar = true)}
            aria-label="Add variable"
            title="Add variable"
            class="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus size={11} />
          </button>
        </div>

        {#if showAddVar && uiMode === 'inline'}
          <div class="border-b border-border bg-muted/40 p-3 space-y-2">
            <label class="block space-y-0.5">
              <span class="text-[10px] text-muted-foreground">Name <span class="text-destructive">*</span></span>
              <input
                type="text"
                placeholder="NAME (e.g. TARGET_IP)"
                bind:value={newVarName}
                class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {#if addVarError}<p class="mt-0.5 text-[10px] text-destructive">{addVarError}</p>{/if}
            </label>
            <label class="block space-y-0.5">
              <span class="text-[10px] text-muted-foreground">Value</span>
              <input
                type="text"
                placeholder="Value (optional)"
                bind:value={newVarValue}
                class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <div class="flex gap-2">
              <button
                onclick={() => {
                  const name = newVarName.trim().toUpperCase();
                  if (!name) { addVarError = 'Name is required.'; return; }
                  if (!/^[A-Z][A-Z0-9_-]*$/.test(name)) { addVarError = 'Must start with a letter; only A-Z, 0-9, _ or - allowed.'; return; }
                  addVarError = '';
                  void saveVariable(name, newVarValue.trim());
                  newVarName = '';
                  newVarValue = '';
                  closeAddVarModal();
                }}
                class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >Add</button>
              <button
                onclick={closeAddVarModal}
                class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
              >Cancel</button>
            </div>
          </div>
        {/if}

        <div class="border-b border-border px-3 py-2">
          <input
            type="text"
            aria-label="Filter variables"
            placeholder="Filter variables..."
            bind:value={varSearchQuery}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div class="p-3 space-y-1.5">
          {#each filteredVars as v (v.name)}
            <div class="flex items-center gap-1.5 rounded border border-border px-2 py-1 hover:bg-accent/20">
              <code class="w-28 flex-shrink-0 truncate text-[10px] font-mono text-primary" title={'{' + v.name + '}'}>{'{' + v.name + '}'}</code>
              <span class="min-w-0 flex-1 truncate text-xs {!v.value ? 'italic text-muted-foreground/50' : ''}">{v.value || 'unset'}</span>
              {#if v.id}
                <button
                  onclick={() => openEditVar(v)}
                  aria-label="Edit variable"
                  title="Edit variable"
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil size={10} />
                </button>
                <button
                  onclick={() => deleteVariable(v.id!)}
                  aria-label="Delete variable"
                  title="Delete variable"
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={10} />
                </button>
              {:else}
                <!-- Placeholder to keep row height consistent -->
                <span class="w-10 flex-shrink-0"></span>
              {/if}
            </div>
            {#if editingVar?.id === v.id && uiMode === 'inline'}
              <div class="rounded border border-border bg-muted/40 px-2 pb-2 pt-1.5 -mt-1 space-y-1.5">
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Name <span class="text-destructive">*</span></span>
                  <input
                    type="text"
                    bind:value={editVarName}
                    class="w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                {#if editVarName.trim().toUpperCase() !== editingVar.name}
                  <p class="text-[10px] text-amber-500">Renaming won't update snippets using <code class="font-mono">{'{' + editingVar.name + '}'}</code> - update them manually.</p>
                {/if}
                <label class="block space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Value</span>
                  <input
                    type="text"
                    placeholder="Enter value"
                    bind:value={editVarValue}
                    class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <div class="flex gap-1.5">
                  <button
                    onclick={saveEditVar}
                    class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >Save</button>
                  <button
                    onclick={() => (editingVar = null)}
                    class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                  >Cancel</button>
                </div>
              </div>
            {/if}
          {/each}

          {#if filteredVars.length === 0}
            <p class="py-4 text-center text-[10px] text-muted-foreground">
              {varSearchQuery.trim() ? 'No variables match your filter.' : 'No variables defined yet. Add snippets with &#123;VARIABLE&#125; placeholders or add one via the + button.'}
            </p>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if snippetToDelete}
  <ConfirmDialog
    title="Delete Snippet"
    message="Delete this snippet? This action cannot be undone."
    confirmLabel="Delete"
    onConfirm={() => { void confirmDeleteSnippet(); }}
    onCancel={() => (snippetToDelete = null)}
  />
{/if}

{#if varToDelete}
  <ConfirmDialog
    title="Delete Variable"
    message="Delete this variable? This action cannot be undone."
    confirmLabel="Delete"
    onConfirm={() => { void confirmDeleteVariable(); }}
    onCancel={() => (varToDelete = null)}
  />
{/if}

{#if editingSnippet && uiMode !== 'inline'}
  <ToolModal
    ariaLabel="Edit snippet"
    onClose={() => (editingSnippet = null)}
    maxWidthClass="max-w-sm"
  >
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 id="edit-snippet-title" class="text-sm font-semibold">Edit Snippet</h2>
        <button
          onclick={() => (editingSnippet = null)}
          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close edit snippet modal"
        >
          <X size={14} />
        </button>
      </div>
      <div class="space-y-2">
        <input
          type="text"
          placeholder="Title *"
          bind:value={editTitle}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          placeholder="Command *"
          bind:value={editCommand}
          rows={4}
          class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        ></textarea>
        <Select
          options={categoryOptions}
          value={editCategory}
          onchange={(value) => { editCategory = value; }}
        />
        <input
          type="text"
          placeholder="Description"
          bind:value={editDescription}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          onclick={() => (editingSnippet = null)}
          class="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onclick={saveEditSnippet}
          class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  </ToolModal>
{/if}

{#if addingSnippet && uiMode !== 'inline'}
  <ToolModal
    ariaLabel="Add snippet"
    onClose={() => (addingSnippet = false)}
    maxWidthClass="max-w-sm"
  >
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 id="create-snippet-title" class="text-sm font-semibold">Add Snippet</h2>
        <button
          onclick={() => (addingSnippet = false)}
          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close add snippet modal"
        >
          <X size={14} />
        </button>
      </div>
      <div class="space-y-2">
        <input
          type="text"
          placeholder="Title *"
          bind:value={newTitle}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          placeholder="Command (use &#123;VARIABLE&#125; for substitution) *"
          bind:value={newCommand}
          rows={4}
          class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        ></textarea>
        <Select
          options={categoryOptions}
          value={newCategory}
          onchange={(value) => { newCategory = value; }}
        />
        <input
          type="text"
          placeholder="Description"
          bind:value={newDescription}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" bind:checked={isGlobal} class="rounded" />
          Global (available in all workspaces)
        </label>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          onclick={() => (addingSnippet = false)}
          class="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onclick={addSnippet}
          class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Snippet
        </button>
      </div>
    </div>
  </ToolModal>
{/if}

{#if showAddVar && uiMode !== 'inline'}
  <ToolModal
    ariaLabel="Add variable"
    onClose={closeAddVarModal}
    maxWidthClass="max-w-xs"
  >
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 id="add-var-title" class="text-sm font-semibold">Add Variable</h2>
        <button
          onclick={closeAddVarModal}
          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close add variable modal"
        >
          <X size={14} />
        </button>
      </div>
      <div class="space-y-2">
        <div>
          <input
            type="text"
            placeholder="NAME (uppercase, e.g. TARGET_IP)"
            bind:value={newVarName}
            class="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {#if addVarError}
            <p class="mt-1 text-[10px] text-destructive">{addVarError}</p>
          {/if}
        </div>
        <input
          type="text"
          placeholder="Value (optional)"
          bind:value={newVarValue}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          onclick={closeAddVarModal}
          class="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onclick={() => {
            const name = newVarName.trim().toUpperCase();
            if (!name) { addVarError = 'Name is required.'; return; }
            if (!/^[A-Z][A-Z0-9_-]*$/.test(name)) { addVarError = 'Must start with a letter and contain only A-Z, 0-9, _ or -.'; return; }
            addVarError = '';
            void saveVariable(name, newVarValue.trim());
            newVarName = '';
            newVarValue = '';
            closeAddVarModal();
          }}
          class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Variable
        </button>
      </div>
    </div>
  </ToolModal>
{/if}

{#if editingVar && uiMode !== 'inline'}
  <ToolModal
    ariaLabel="Edit variable"
    onClose={() => (editingVar = null)}
    maxWidthClass="max-w-xs"
  >
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 id="edit-var-title" class="text-sm font-semibold">Edit Variable</h2>
        <button
          onclick={() => (editingVar = null)}
          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close edit variable modal"
        >
          <X size={14} />
        </button>
      </div>
      <div class="space-y-2">
        <div>
          <label class="text-sm text-muted-foreground" for="edit-var-name">Name</label>
          <input
            id="edit-var-name"
            type="text"
            bind:value={editVarName}
            class="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {#if editVarName.trim().toUpperCase() !== editingVar.name}
            <p class="mt-1 text-[10px] text-amber-500">Renaming won't update snippets using <code class="font-mono">{'{' + editingVar.name + '}'}</code> - update them manually.</p>
          {/if}
        </div>
        <div>
          <label class="text-sm text-muted-foreground" for="edit-var-value">Value</label>
          <input
            id="edit-var-value"
            type="text"
            placeholder="Enter value"
            bind:value={editVarValue}
            class="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          onclick={() => (editingVar = null)}
          class="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onclick={saveEditVar}
          class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  </ToolModal>
{/if}
