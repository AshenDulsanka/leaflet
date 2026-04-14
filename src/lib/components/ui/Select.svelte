<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';

  interface Option { value: string; label: string; }
  interface Props {
    options: Option[];
    value: string;
    onchange: (value: string) => void;
    placeholder?: string;
    size?: 'xs' | 'sm';
    disabled?: boolean;
    class?: string;
    stopPropagation?: boolean;
  }
  const {
    options,
    value,
    onchange,
    placeholder = 'Select...',
    size = 'sm',
    disabled = false,
    class: className = '',
    stopPropagation = false
  }: Props = $props();

  let open = $state(false);
  let containerEl = $state<HTMLDivElement | null>(null);
  let focusedIndex = $state(-1);

  const selectedLabel = $derived(options.find(o => o.value === value)?.label ?? placeholder);
  const sizeClasses = $derived(size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs');
  const iconSize = $derived(size === 'xs' ? 12 : 14);

  function toggle() { 
    if (!disabled) { 
      open = !open; 
      if (open) focusedIndex = options.findIndex(o => o.value === value); 
    } 
  }
  function select(val: string) { 
    onchange(val); 
    open = false; 
    focusedIndex = -1; 
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) { 
      if (e.key === 'Enter' || e.key === ' ') { 
        e.preventDefault(); 
        toggle(); 
      } 
      return; 
    }
    if (e.key === 'Escape') { 
      open = false; 
      return; 
    }
    if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      focusedIndex = Math.min(focusedIndex + 1, options.length - 1); 
    }
    else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      focusedIndex = Math.max(focusedIndex - 1, 0); 
    }
    else if (e.key === 'Enter' && focusedIndex >= 0) { 
      e.preventDefault(); 
      select(options[focusedIndex].value); 
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onclick={handleOutsideClick} />

<div bind:this={containerEl} class="relative inline-block {className}">
  <button
    type="button"
    onclick={(e) => {
      if (stopPropagation) e.stopPropagation();
      toggle();
    }}
    onkeydown={handleKeydown}
    {disabled}
    class="flex w-full min-w-32 items-center justify-between gap-2 rounded border border-border bg-background {sizeClasses} text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="truncate {!value ? 'text-muted-foreground' : ''}">{selectedLabel}</span>
    <ChevronDown size={iconSize} class="shrink-0 text-muted-foreground transition-transform duration-150 {open ? 'rotate-180' : ''}" />
  </button>
  {#if open}
    <div class="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-md border border-border bg-popover shadow-md" role="listbox">
      {#each options as opt, i (opt.value)}
        <button
          type="button"
          role="option"
          aria-selected={opt.value === value}
          onclick={(e) => {
            if (stopPropagation) e.stopPropagation();
            select(opt.value);
          }}
          class="flex w-full items-center px-2 py-1.5 text-left {size === 'xs' ? 'text-[10px]' : 'text-xs'} hover:bg-accent {opt.value === value ? 'bg-accent/50 font-medium' : ''} {i === focusedIndex ? 'bg-accent' : ''}"
        >{opt.label}</button>
      {/each}
    </div>
  {/if}
</div>