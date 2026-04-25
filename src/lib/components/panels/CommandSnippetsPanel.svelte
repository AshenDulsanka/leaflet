<script lang="ts">
  import { Terminal, Plus, X, RefreshCw, Copy, ChevronDown, ChevronRight, Trash2, Pencil } from '@lucide/svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { extractSnippetVarNames } from '$lib/data/commands';
  import { fly, fade } from 'svelte/transition';
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
  }

  let { workspaceId, onInsert, onClose }: Props = $props();

  let snippets = $state<Snippet[]>([]);
  let variables = $state<SnippetVar[]>([]);
  let loading = $state(false);
  let activeTab = $state<'snippets' | 'variables'>('snippets');
  let expandedCategories = $state<Set<string>>(new Set(['general', 'recon']));
  let addingSnippet = $state(false);
  let searchQuery = $state('');
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

  // Variable editing - inline with debounced autosave
  let newVarName = $state('');
  let newVarValue = $state('');
  // Local input state: name → current typed value (pre-save)
  let editValues = $state<Record<string, string>>({});
  // Non-reactive debounce timers
  const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

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
      // Seed local edit state from persisted values
      const vals: Record<string, string> = {};
      for (const v of data) vals[v.name] = v.value;
      editValues = vals;
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

  async function confirmDeleteSnippet() {
    if (!workspaceId || !snippetToDelete) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/snippets/${snippetToDelete}`, { method: 'DELETE' });
    if (!res.ok) {
      console.error('Failed to delete snippet:', { workspaceId, snippetId: snippetToDelete, status: res.status });
      snippetToDelete = null;
      return;
    }
    snippets = snippets.filter((s) => s.id !== snippetToDelete);
    snippetToDelete = null;
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
      editValues = { ...editValues, [name]: value };
    }
  }

  /** Trigger debounced autosave when a variable value is typed */
  function handleVarInput(name: string, value: string) {
    editValues = { ...editValues, [name]: value };
    const existing = debounceMap.get(name);
    if (existing !== undefined) clearTimeout(existing);
    debounceMap.set(name, setTimeout(() => {
      void saveVariable(name, editValues[name] ?? value);
      debounceMap.delete(name);
    }, 500));
  }

  function deleteVariable(id: string) {
    varToDelete = id;
  }

  async function confirmDeleteVariable() {
    if (!workspaceId || !varToDelete) return;
    const toDelete = variables.find((v) => v.id === varToDelete);
    await fetch(`/api/workspaces/${workspaceId}/variables/${varToDelete}`, { method: 'DELETE' });
    variables = variables.filter((v) => v.id !== varToDelete);
    if (toDelete) {
      editValues = Object.fromEntries(
        Object.entries(editValues).filter(([key]) => key !== toDelete.name)
      );
    }
    varToDelete = null;
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

  const CATEGORIES = [
    'general', 'recon', 'exploitation', 'privesc-linux', 'privesc-windows',
    'pivoting', 'ad-attacks', 'file-transfer', 'credential-attacks'
  ];

  const categoryOptions = CATEGORIES.map((category) => ({ value: category, label: category }));

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
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
        title="Refresh"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button
        onclick={() => (addingSnippet = !addingSnippet)}
        title="Add snippet"
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      <button
        onclick={onClose}
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
          placeholder="Filter snippets..."
          bind:value={searchQuery}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <!-- Add snippet form -->
      {#if addingSnippet}
        <div class="border-b border-border bg-muted/40 p-3 space-y-2">
          <input
            type="text"
            placeholder="Title *"
            bind:value={newTitle}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea
            placeholder="Command (use &#123;VARIABLE&#125; for substitution) *"
            bind:value={newCommand}
            rows={3}
            class="w-full resize-none rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          ></textarea>
          <div class="flex gap-2">
            <Select
              options={categoryOptions}
              value={newCategory}
              onchange={(value) => { newCategory = value; }}
              class="flex-1"
            />
            <label class="flex items-center gap-1 text-[10px] text-muted-foreground">
              <input type="checkbox" bind:checked={isGlobal} class="rounded" />
              Global
            </label>
          </div>
          <div class="flex gap-2">
            <button
              onclick={addSnippet}
              class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add
            </button>
            <button
              onclick={() => (addingSnippet = false)}
              class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}

      <!-- Snippet groups -->
      <div class="flex-1 overflow-y-auto">
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
                            title="Insert into editor"
                            class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Plus size={11} />
                          </button>
                        {/if}
                        <button
                          onclick={() => copySnippet(snippet)}
                          title="Copy (with variable substitution)"
                          class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          onclick={() => startEditSnippet(snippet)}
                          title="Edit"
                          class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onclick={() => deleteSnippet(snippet.id)}
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
        <div class="flex items-center justify-between border-b border-border px-3 py-1.5">
          <p class="text-[10px] text-muted-foreground">
            Use <code class="font-mono">&#123;NAME&#125;</code> in commands. Values auto-save.
          </p>
          <button
            onclick={() => (showAddVar = !showAddVar)}
            title="Add variable"
            class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus size={11} />
          </button>
        </div>

        <div class="p-3 space-y-1.5">
          {#each mergedVars as v (v.name)}
            <div class="flex items-center gap-1.5 rounded border border-border px-2 py-1 hover:bg-accent/20">
              <code class="w-28 flex-shrink-0 truncate text-[10px] font-mono text-primary" title={'{' + v.name + '}'}>{'{' + v.name + '}'}</code>
              <input
                type="text"
                value={editValues[v.name] ?? v.value}
                placeholder={v.persisted ? '' : 'unset'}
                oninput={(e) => handleVarInput(v.name, (e.currentTarget as HTMLInputElement).value)}
                class="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary {!v.persisted ? 'placeholder:text-muted-foreground/50 italic' : ''}"
              />
              {#if v.id}
                <button
                  onclick={() => deleteVariable(v.id!)}
                  title="Delete variable"
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={10} />
                </button>
              {:else}
                <!-- Placeholder to keep row height consistent -->
                <span class="w-5 flex-shrink-0"></span>
              {/if}
            </div>
          {/each}

          {#if mergedVars.length === 0}
            <p class="py-4 text-center text-[10px] text-muted-foreground">
              No variables yet. Add snippets with &#123;VARIABLE&#125; placeholders or add one below.
            </p>
          {/if}

          {#if showAddVar}
          <!-- Add new variable manually -->
          <div class="rounded border border-dashed border-border p-2 space-y-1 mt-2">
            <div class="flex gap-1">
              <input
                type="text"
                placeholder="NAME"
                bind:value={newVarName}
                class="w-24 rounded border border-border bg-background px-2 py-0.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="value"
                bind:value={newVarValue}
                class="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                onkeydown={(e) => { if (e.key === 'Enter' && newVarName.trim()) { if (!/^[A-Z0-9_-]+$/.test(newVarName.trim().toUpperCase())) return; void saveVariable(newVarName.trim().toUpperCase(), newVarValue); newVarName = ''; newVarValue = ''; showAddVar = false; } }}
              />
              <button
                onclick={() => { if (newVarName.trim()) { if (!/^[A-Z0-9_-]+$/.test(newVarName.trim().toUpperCase())) return; void saveVariable(newVarName.trim().toUpperCase(), newVarValue); newVarName = ''; newVarValue = ''; showAddVar = false; } }}
                class="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add
              </button>
              <button
                onclick={() => { newVarName = ''; newVarValue = ''; showAddVar = false; }}
                title="Cancel"
                class="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-accent"
              >
                <X size={10} />
              </button>
            </div>
          </div>
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

{#if editingSnippet}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={(e) => { if (e.target === e.currentTarget) { editingSnippet = null; } }}
    role="presentation"
    transition:fade={{ duration: 150 }}
  >
    <div
      class="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-snippet-title"
      transition:fly={{ y: 10, duration: 200, easing: cubicOut }}
    >
      <div class="mb-4 flex items-center justify-between">
        <h2 id="edit-snippet-title" class="text-sm font-semibold">Edit Snippet</h2>
        <button
          onclick={() => (editingSnippet = null)}
          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div class="space-y-2">
        <input
          type="text"
          placeholder="Title *"
          bind:value={editTitle}
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          placeholder="Command *"
          bind:value={editCommand}
          rows={4}
          class="w-full resize-none rounded border border-border bg-background px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
          class="w-full rounded border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          onclick={() => (editingSnippet = null)}
          class="rounded border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onclick={saveEditSnippet}
          class="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}
