<script lang="ts">
  import { Terminal, Plus, X, RefreshCw, Copy, ChevronDown, ChevronRight, Trash2, Pencil } from '@lucide/svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import SnippetForm from '$lib/components/panels/SnippetForm.svelte';
  import type { SnippetFormData } from '$lib/components/panels/SnippetForm.svelte';
  import VariableForm from '$lib/components/panels/VariableForm.svelte';
  import type { VariableFormData } from '$lib/components/panels/VariableForm.svelte';
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
  let snippetToDelete = $state<string | null>(null);
  let varToDelete = $state<string | null>(null);
  let showAddVar = $state(false);
  let editingVar = $state<SnippetVar | null>(null);

  $effect(() => {
    if (workspaceId) { loadSnippets(); loadVariables(); }
  });

  async function loadSnippets(): Promise<void> {
    if (!workspaceId) return;
    loading = true;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets`);
      if (!res.ok) { console.error('Failed to load snippets:', res.status); return; }
      const raw = await res.json() as Array<Snippet & { tags: string | string[] }>;
      snippets = raw.map((s) => ({ ...s, tags: typeof s.tags === 'string' ? JSON.parse(s.tags) : (s.tags ?? []) }));
    } catch { console.error('Failed to load snippets'); }
    finally { loading = false; }
  }

  async function loadVariables(): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/variables`);
      const data: SnippetVar[] = await res.json();
      variables = data;
    } catch { console.error('Failed to load variables'); }
  }

  async function addSnippet(data: SnippetFormData): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title.trim(), command: data.command.trim(), category: data.category, description: data.description.trim(), global: data.global ?? false }),
      });
      if (!res.ok) return;
      const snippet: Snippet = await res.json();
      snippets = [...snippets, snippet];
      expandedCategories = new Set([...expandedCategories, snippet.category]);
      addingSnippet = false;
    } catch { console.error('Failed to add snippet'); }
  }

  async function saveEditSnippet(data: SnippetFormData): Promise<void> {
    if (!editingSnippet || !workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets/${editingSnippet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title.trim(), command: data.command.trim(), category: data.category, description: data.description.trim() }),
      });
      if (!res.ok) return;
      const raw = await res.json() as Snippet & { tags: string | string[] };
      const updated: Snippet = { ...raw, tags: typeof raw.tags === 'string' ? JSON.parse(raw.tags) : (raw.tags ?? []) };
      snippets = snippets.map((s) => s.id === updated.id ? updated : s);
      editingSnippet = null;
    } catch { console.error('Failed to update snippet'); }
  }

  async function confirmDeleteSnippet(): Promise<void> {
    if (!workspaceId || !snippetToDelete) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/snippets/${snippetToDelete}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete snippet:', res.status); return; }
      snippets = snippets.filter((s) => s.id !== snippetToDelete);
    } catch (err) { console.error('Failed to delete snippet:', err); }
    finally { snippetToDelete = null; }
  }

  function resolveCommand(command: string): string {
    return command.replace(/\{([A-Z0-9_-]+)\}/g, (_, name: string) => {
      const v = variables.find((vr) => vr.name.toUpperCase() === name.toUpperCase());
      return v?.value || `{${name}}`;
    });
  }

  async function copySnippet(snippet: Snippet): Promise<void> {
    try { await navigator.clipboard.writeText(resolveCommand(snippet.command)); }
    catch (err) { console.error('Failed to copy snippet to clipboard:', err); }
  }

  async function saveVariable(name: string, value: string): Promise<void> {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value }),
      });
      if (res.ok) {
        const updated: SnippetVar = await res.json();
        const exists = variables.find((v) => v.id === updated.id || v.name === updated.name);
        variables = exists ? variables.map((v) => v.id === updated.id ? updated : v) : [...variables, updated];
      }
    } catch (err) { console.error('Failed to save variable:', err); }
  }

  async function addVariable(data: VariableFormData): Promise<void> {
    await saveVariable(data.name, data.value);
    showAddVar = false;
  }

  async function saveEditVar(data: VariableFormData): Promise<void> {
    if (!editingVar || !workspaceId) return;
    if (data.name !== editingVar.name) {
      await fetch(`/api/workspaces/${workspaceId}/variables/${editingVar.id}`, { method: 'DELETE' });
      variables = variables.filter((v) => v.id !== editingVar!.id);
    }
    await saveVariable(data.name, data.value);
    editingVar = null;
  }

  async function confirmDeleteVariable(): Promise<void> {
    if (!workspaceId || !varToDelete) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/variables/${varToDelete}`, { method: 'DELETE' });
      if (!res.ok) { console.error('Failed to delete variable:', res.status); return; }
      variables = variables.filter((v) => v.id !== varToDelete);
    } catch (err) { console.error('Failed to delete variable:', err); }
    finally { varToDelete = null; }
  }

  function toggleCategory(cat: string): void {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    expandedCategories = next;
  }

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

  const mergedVars = $derived.by(() => {
    const extractedNames = extractSnippetVarNames(snippets.map((s) => s.command));
    const persistedMap = new Map(variables.map((v) => [v.name, v]));
    const result: MergedVar[] = variables.map((v) => ({ id: v.id, name: v.name, value: v.value, persisted: true }));
    for (const name of extractedNames) {
      if (!persistedMap.has(name)) result.push({ id: null, name, value: '', persisted: false });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  });

  const filteredVars = $derived(
    varSearchQuery.trim()
      ? mergedVars.filter((v) =>
          v.name.toLowerCase().includes(varSearchQuery.toLowerCase()) ||
          v.value.toLowerCase().includes(varSearchQuery.toLowerCase())
        )
      : mergedVars
  );

  function handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.key !== 'Escape') return;
    if (editingSnippet) { editingSnippet = null; return; }
    if (addingSnippet) { addingSnippet = false; return; }
    if (editingVar) { editingVar = null; return; }
    if (showAddVar) { showAddVar = false; return; }
    if (snippetToDelete) { snippetToDelete = null; return; }
    if (varToDelete) { varToDelete = null; return; }
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
      <button onclick={loadSnippets} aria-label="Refresh snippets" title="Refresh" class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
        <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
      </button>
      <button onclick={() => (addingSnippet = true)} aria-label="Add snippet" title="Add snippet" class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
        <Plus size={13} />
      </button>
      <button onclick={onClose} aria-label="Close command snippets panel" title="Close" class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
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
      <button onclick={() => (activeTab = 'snippets')} class="flex-1 py-1.5 text-xs font-medium transition-colors {activeTab === 'snippets' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}">
        Snippets
      </button>
      <button onclick={() => (activeTab = 'variables')} class="flex-1 py-1.5 text-xs font-medium transition-colors {activeTab === 'variables' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}">
        Variables ({variables.length})
      </button>
    </div>

    {#if activeTab === 'snippets'}
      <!-- Search bar -->
      <div class="border-b border-border px-3 py-2">
        <input type="text" aria-label="Filter snippets" placeholder="Filter snippets..." bind:value={searchQuery}
          class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      <!-- Snippet groups -->
      <div class="flex-1 overflow-y-auto">
        {#if addingSnippet && uiMode === 'inline'}
          <SnippetForm mode="add" uiMode="inline" showGlobal={true} onSubmit={(data) => addSnippet(data)} onCancel={() => (addingSnippet = false)} />
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
              <button onclick={() => toggleCategory(category)} class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/50">
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
                          <button onclick={() => onInsert(resolveCommand(snippet.command))} aria-label="Insert snippet into editor" title="Insert into editor" class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                            <Plus size={11} />
                          </button>
                        {/if}
                        <button onclick={() => copySnippet(snippet)} aria-label="Copy snippet" title="Copy (with variable substitution)" class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Copy size={11} />
                        </button>
                        <button onclick={() => (editingSnippet = snippet)} aria-label="Edit snippet" title="Edit" class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil size={11} />
                        </button>
                        <button onclick={() => (snippetToDelete = snippet.id)} aria-label="Delete snippet" title="Delete" class="flex h-5 w-5 items-center justify-center rounded text-destructive hover:bg-destructive/10">
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
                    <SnippetForm
                      mode="edit"
                      uiMode="inline"
                      initialTitle={snippet.title}
                      initialCommand={snippet.command}
                      initialCategory={snippet.category}
                      initialDescription={snippet.description}
                      onSubmit={(data) => saveEditSnippet(data)}
                      onCancel={() => (editingSnippet = null)}
                    />
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
        <div class="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <p class="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
            Use <code class="font-mono">&#123;NAME&#125;</code> in commands. Values auto-save.
          </p>
          <button onclick={() => (showAddVar = true)} aria-label="Add variable" title="Add variable" class="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
            <Plus size={11} />
          </button>
        </div>

        {#if showAddVar && uiMode === 'inline'}
          <VariableForm mode="add" uiMode="inline" onSubmit={(data) => addVariable(data)} onCancel={() => (showAddVar = false)} />
        {/if}

        <div class="border-b border-border px-3 py-2">
          <input type="text" aria-label="Filter variables" placeholder="Filter variables..." bind:value={varSearchQuery}
            class="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div class="p-3 space-y-1.5">
          {#each filteredVars as v (v.name)}
            <div class="flex items-center gap-1.5 rounded border border-border px-2 py-1 hover:bg-accent/20">
              <code class="w-28 flex-shrink-0 truncate text-[10px] font-mono text-primary" title={'{' + v.name + '}'}>{'{' + v.name + '}'}</code>
              <span class="min-w-0 flex-1 truncate text-xs {!v.value ? 'italic text-muted-foreground/50' : ''}">{v.value || 'unset'}</span>
              {#if v.id}
                <button onclick={() => { const sv = variables.find((sv) => sv.id === v.id); if (sv) editingVar = sv; }} aria-label="Edit variable" title="Edit variable" class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Pencil size={10} />
                </button>
                <button onclick={() => (varToDelete = v.id!)} aria-label="Delete variable" title="Delete variable" class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10">
                  <Trash2 size={10} />
                </button>
              {:else}
                <span class="w-10 flex-shrink-0"></span>
              {/if}
            </div>
            {#if editingVar?.id === v.id && uiMode === 'inline'}
              <VariableForm
                mode="edit"
                uiMode="inline"
                initialName={editingVar.name}
                initialValue={editingVar.value}
                onSubmit={(data) => saveEditVar(data)}
                onCancel={() => (editingVar = null)}
              />
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
  <ConfirmDialog title="Delete Snippet" message="Delete this snippet? This action cannot be undone." confirmLabel="Delete"
    onConfirm={() => { void confirmDeleteSnippet(); }} onCancel={() => (snippetToDelete = null)} />
{/if}

{#if varToDelete}
  <ConfirmDialog title="Delete Variable" message="Delete this variable? This action cannot be undone." confirmLabel="Delete"
    onConfirm={() => { void confirmDeleteVariable(); }} onCancel={() => (varToDelete = null)} />
{/if}

{#if addingSnippet && uiMode !== 'inline'}
  <SnippetForm mode="add" uiMode="modal" showGlobal={true} onSubmit={(data) => addSnippet(data)} onCancel={() => (addingSnippet = false)} />
{/if}

{#if editingSnippet && uiMode !== 'inline'}
  <SnippetForm
    mode="edit"
    uiMode="modal"
    initialTitle={editingSnippet.title}
    initialCommand={editingSnippet.command}
    initialCategory={editingSnippet.category}
    initialDescription={editingSnippet.description}
    onSubmit={(data) => saveEditSnippet(data)}
    onCancel={() => (editingSnippet = null)}
  />
{/if}

{#if showAddVar && uiMode !== 'inline'}
  <VariableForm mode="add" uiMode="modal" onSubmit={(data) => addVariable(data)} onCancel={() => (showAddVar = false)} />
{/if}

{#if editingVar && uiMode !== 'inline'}
  <VariableForm
    mode="edit"
    uiMode="modal"
    initialName={editingVar.name}
    initialValue={editingVar.value}
    onSubmit={(data) => saveEditVar(data)}
    onCancel={() => (editingVar = null)}
  />
{/if}