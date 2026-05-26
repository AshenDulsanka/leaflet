<script lang="ts">
  import { FileInput, X } from '@lucide/svelte';
  import ToolModal from '$lib/components/modals/ToolModal.svelte';
  import { onDestroy } from 'svelte';

  interface Props {
    workspaceId: string;
    uiMode?: 'modal' | 'inline';
    onImportComplete: () => void;
    onCancel: () => void;
  }

  let { workspaceId, uiMode = 'modal', onImportComplete, onCancel }: Props = $props();

  let nmapRaw = $state('');
  let nmapImportStatus = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  let nmapErrors = $state<Array<{ line: number; message: string }>>([]);
  let nmapSummary = $state('');
  let _autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  // Client-side format detection (mirrors the server parser)
  function detectNmapFormat(raw: string): 'grepable' | 'xml' | 'unknown' {
    const t = raw.trimStart();
    if (t.startsWith('<?xml') || t.startsWith('<nmaprun')) return 'xml';
    if (/# Nmap|^Host:/m.test(raw)) return 'grepable';
    return 'unknown';
  }

  const detectedFormat = $derived(detectNmapFormat(nmapRaw));

  async function importNmap(): Promise<void> {
    if (!nmapRaw.trim()) return;
    nmapImportStatus = 'loading';
    nmapErrors = [];
    nmapSummary = '';
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/hosts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: nmapRaw })
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        nmapImportStatus = 'error';
        nmapErrors = [{ line: 0, message: data.error ?? 'Import failed' }];
        return;
      }
      const data = (await res.json()) as {
        imported?: number;
        updated?: number;
        portCount?: number;
        errors?: Array<{ line: number; message: string }>;
      };
      nmapErrors = data.errors ?? [];
      nmapSummary = `Imported ${data.imported ?? 0} new host(s), updated ${data.updated ?? 0}, ${data.portCount ?? 0} port(s).`;
      nmapImportStatus = 'done';
      onImportComplete();
      if (nmapErrors.length === 0) {
        if (_autoCloseTimer !== null) clearTimeout(_autoCloseTimer);
        _autoCloseTimer = setTimeout(() => {
          _autoCloseTimer = null;
          onCancel();
        }, 2500);
      }
    } catch {
      nmapImportStatus = 'error';
      nmapErrors = [{ line: 0, message: 'Network error — import failed.' }];
    }
  }

  onDestroy(() => {
    if (_autoCloseTimer !== null) clearTimeout(_autoCloseTimer);
  });
</script>

{#if uiMode === 'inline'}
  <div class="border-b border-border bg-muted/40 p-3 space-y-2">
    <!-- Format badge -->
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-muted-foreground">Format:</span>
      {#if detectedFormat === 'grepable'}
        <span class="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">Grepable (-oG)</span>
      {:else if detectedFormat === 'xml'}
        <span class="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">XML (-oX)</span>
      {:else}
        <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Unknown</span>
      {/if}
    </div>
    <textarea
      rows={8}
      bind:value={nmapRaw}
      placeholder="Paste Nmap -oG or -oX output here…"
      class="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
    ></textarea>
    {#if nmapErrors.length > 0}
      <ul class="space-y-0.5">
        {#each nmapErrors as err}
          <li class="text-[10px] text-destructive">{err.line > 0 ? `Line ${err.line}: ` : ''}{err.message}</li>
        {/each}
      </ul>
    {/if}
    {#if nmapSummary}
      <p class="text-[10px] text-green-600 dark:text-green-400">{nmapSummary}</p>
    {/if}
    <div class="flex gap-2">
      <button
        onclick={importNmap}
        disabled={nmapRaw.trim() === '' || nmapImportStatus === 'loading'}
        class="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {nmapImportStatus === 'loading' ? 'Importing…' : 'Import'}
      </button>
      <button
        onclick={onCancel}
        class="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  </div>
{:else}
  <ToolModal ariaLabel="Import from Nmap" onClose={onCancel} maxWidthClass="max-w-lg" dialogClass="overflow-hidden">
    <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
      <FileInput size={16} class="shrink-0 text-muted-foreground" />
      <h2 class="flex-1 text-sm font-semibold">Import from Nmap</h2>
      <button
        onclick={onCancel}
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Close"
      ><X size={14} /></button>
    </div>
    <div class="space-y-3 px-5 py-4">
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">Detected format:</span>
        {#if detectedFormat === 'grepable'}
          <span class="rounded bg-green-500/15 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">Grepable (-oG)</span>
        {:else if detectedFormat === 'xml'}
          <span class="rounded bg-blue-500/15 px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">XML (-oX)</span>
        {:else}
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Unknown</span>
        {/if}
      </div>
      <textarea
        rows={10}
        bind:value={nmapRaw}
        placeholder="Paste Nmap -oG or -oX output here…"
        class="w-full rounded border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      ></textarea>
      {#if nmapErrors.length > 0}
        <ul class="space-y-0.5">
          {#each nmapErrors as err}
            <li class="text-xs text-destructive">{err.line > 0 ? `Line ${err.line}: ` : ''}{err.message}</li>
          {/each}
        </ul>
      {/if}
      {#if nmapSummary}
        <p class="text-xs text-green-600 dark:text-green-400">{nmapSummary}</p>
      {/if}
    </div>
    <div class="flex gap-2 border-t border-border px-5 py-3 bg-muted/30">
      <button
        onclick={importNmap}
        disabled={nmapRaw.trim() === '' || nmapImportStatus === 'loading'}
        class="flex-1 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {nmapImportStatus === 'loading' ? 'Importing…' : 'Import'}
      </button>
      <button onclick={onCancel} class="flex-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">
        Cancel
      </button>
    </div>
  </ToolModal>
{/if}
