<script lang="ts">
  import { Terminal, Plus, X, RefreshCw, Copy, ChevronDown, ChevronRight, Trash2 } from '@lucide/svelte';
  import ConfirmDialog from '$lib/components/modals/ConfirmDialog.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { extractSnippetVarNames } from '$lib/data/commands.js';
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
  }

  let { workspaceId, onInsert, onClose }: Props = $props();

  let snippets = $state<Snippet[]>([]);
  let variables = $state<SnippetVar[]>([]);
  let loading = $state(false);
  let activeTab = $state<'snippets' | 'variables'>('snippets');
  let expandedCategories = $state<Set<string>>(new Set(['general', 'recon']));
  let addingSnippet = $state(false);
  let searchQuery = $state('');
  let showClearVariablesConfirm = $state(false);

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

  async function deleteSnippet(id: string) {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/snippets/${id}`, { method: 'DELETE' });
    snippets = snippets.filter((s) => s.id !== id);
  }

  /** Substitute {VARIABLE_NAME} placeholders with current variable values */
  function resolveCommand(command: string): string {
    return command.replace(/\{([A-Z0-9_]+)\}/g, (_, name: string) => {
      const v = variables.find((vr) => vr.name.toUpperCase() === name.toUpperCase());
      return v?.value || `{${name}}`;
    });
  }

  async function copySnippet(snippet: Snippet) {
    const resolved = resolveCommand(snippet.command);
    try {
      await navigator.clipboard.writeText(resolved);
    } catch {
      // Silently ignore
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

  async function deleteVariable(id: string) {
    if (!workspaceId) return;
    const toDelete = variables.find((v) => v.id === id);
    await fetch(`/api/workspaces/${workspaceId}/variables/${id}`, { method: 'DELETE' });
    variables = variables.filter((v) => v.id !== id);
    if (toDelete) {
      editValues = Object.fromEntries(
        Object.entries(editValues).filter(([key]) => key !== toDelete.name)
      );
    }
  }

  async function clearAllVariables() {
    if (!workspaceId) return;
    await fetch(`/api/workspaces/${workspaceId}/variables`, { method: 'DELETE' });
    variables = [];
    editValues = {};
    showClearVariablesConfirm = false;
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

  const groupedSnippets = $derived(() => {
    const groups = new Map<string, Snippet[]>();
    for (const s of filteredSnippets) {
      const cat = s.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(s);
    }
    return groups;
  });

  /** Merge persisted variables with names auto-extracted from snippet commands. */
  const mergedVars = $derived(() => {
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
          {#each [...groupedSnippets()] as [category, items] (category)}
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
          {#if variables.length > 0}
            <button
              onclick={() => (showClearVariablesConfirm = true)}
              title="Clear all variables"
              class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={10} />
              Clear all
            </button>
          {/if}
        </div>

        <div class="p-3 space-y-1.5">
          {#each mergedVars() as v (v.name)}
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
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={10} />
                </button>
              {:else}
                <!-- Placeholder to keep row height consistent -->
                <span class="w-5 flex-shrink-0"></span>
              {/if}
            </div>
          {/each}

          {#if mergedVars().length === 0}
            <p class="py-4 text-center text-[10px] text-muted-foreground">
              No variables yet. Add snippets with &#123;VARIABLE&#125; placeholders or add one below.
            </p>
          {/if}

          <!-- Add new variable manually -->
          <div class="rounded border border-dashed border-border p-2 space-y-1 mt-2">
            <p class="text-[10px] font-medium text-muted-foreground">Add variable</p>
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
                onkeydown={(e) => { if (e.key === 'Enter' && newVarName.trim()) { void saveVariable(newVarName.trim().toUpperCase(), newVarValue); newVarName = ''; newVarValue = ''; } }}
              />
              <button
                onclick={() => { if (newVarName.trim()) { void saveVariable(newVarName.trim().toUpperCase(), newVarValue); newVarName = ''; newVarValue = ''; } }}
                class="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if showClearVariablesConfirm}
  <ConfirmDialog
    title="Clear All Variables"
    message="Clear all variables for this workspace? This action cannot be undone."
    confirmLabel="Clear all"
    onConfirm={() => { void clearAllVariables(); }}
    onCancel={() => (showClearVariablesConfirm = false)}
  />
{/if}
