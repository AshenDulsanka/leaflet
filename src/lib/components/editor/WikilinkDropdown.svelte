<script lang="ts">
  interface Props {
    x: number;
    y: number;
    filtered: string[];
    selectedIndex: number;
    searchText: string;
    onSelect: (path: string) => void;
    onClose: () => void;
    onSelectedIndexChange: (index: number) => void;
    onSearchTextChange: (text: string) => void;
  }

  let {
    x,
    y,
    filtered,
    selectedIndex,
    searchText,
    onSelect,
    onClose,
    onSelectedIndexChange,
    onSearchTextChange,
  }: Props = $props();
</script>

<div
  class="fixed z-[100] min-w-64 max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-xl"
  style="left: {x}px; top: {y + 6}px;"
  onpointerdown={(e) => e.stopPropagation()}
  role="dialog"
  aria-label="Note search"
  tabindex="-1"
>
  <!-- Search input -->
  <div class="border-b border-border px-2 py-1.5">
    <input
      type="text"
      role="combobox"
      aria-expanded="true"
      aria-autocomplete="list"
      aria-controls="wikilink-listbox"
      aria-activedescendant={filtered.length > 0 ? `wikilink-opt-${selectedIndex}` : undefined}
      placeholder="Search notes..."
      value={searchText}
      oninput={(e) => onSearchTextChange(e.currentTarget.value)}
      class="w-full rounded bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      onkeydown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          onSelectedIndexChange(Math.min(selectedIndex + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          onSelectedIndexChange(Math.max(selectedIndex - 1, 0));
        } else if ((e.key === 'Enter' || e.key === 'Tab') && filtered[selectedIndex]) {
          e.preventDefault();
          onSelect(filtered[selectedIndex]);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    />
  </div>

  <!-- Results -->
  {#if filtered.length > 0}
    <div
      id="wikilink-listbox"
      class="max-h-64 overflow-y-auto py-1"
      role="listbox"
      aria-label="Note suggestions"
    >
      {#each filtered as suggestion, i}
        {@const name = suggestion.split('/').pop()!.replace(/\.md$/i, '')}
        {@const folder = suggestion.includes('/') ? suggestion.split('/').slice(0, -1).join('/') : ''}
        <button
          id="wikilink-opt-{i}"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {i === selectedIndex
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-accent/60'}"
          role="option"
          aria-selected={i === selectedIndex}
          onmousedown={(e) => {
            e.preventDefault();
            onSelect(suggestion);
          }}
        >
          <span class="truncate font-medium">{name}</span>
          {#if folder}
            <span class="ml-auto shrink-0 text-xs text-muted-foreground">{folder}</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="px-3 py-3 text-center text-xs text-muted-foreground">No notes found</div>
  {/if}
</div>
