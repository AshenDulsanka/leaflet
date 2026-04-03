<script lang="ts">
  import { X, Download, FileText, Code2, Printer, Check } from '@lucide/svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    activeFile: string | null;
    content: string;
    getEditorHtml: () => string;
    onClose: () => void;
  }

  let { activeFile, content, getEditorHtml, onClose }: Props = $props();

  let lastExported = $state<'md' | 'html' | 'print' | null>(null);

  const fileName = $derived(
    activeFile ? (activeFile.split('/').pop()?.replace(/\.md$/i, '') ?? 'note') : 'note'
  );

  function downloadBlob(data: string, filename: string, mime: string) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    downloadBlob(content, `${fileName}.md`, 'text/markdown');
    lastExported = 'md';
  }

  function buildHtmlPage(bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${fileName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.7; color: #1a1a1a; }
    h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.3; margin-top: 1.8em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.4em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
    pre { background: #f8f8f8; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1em 1.2em; overflow-x: auto; }
    code { background: #f0f0f0; border-radius: 3px; padding: 0.15em 0.4em; font-size: 0.88em; font-family: 'JetBrains Mono', 'Fira Code', monospace; }
    pre code { background: transparent; padding: 0; font-size: 0.85em; }
    blockquote { border-left: 4px solid #6366f1; margin: 0; padding: 0.5em 1em; color: #555; background: #f8f8ff; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e5e7eb; padding: 0.5em 0.8em; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    img { max-width: 100%; border-radius: 4px; }
    a { color: #6366f1; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
    ul, ol { padding-left: 1.5em; }
    li { margin: 0.25em 0; }
    @media print { body { max-width: 100%; margin: 0; padding: 1cm; } }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
  }

  function exportHtml() {
    const html = getEditorHtml();
    if (!html) return;
    downloadBlob(buildHtmlPage(html), `${fileName}.html`, 'text/html');
    lastExported = 'html';
  }

  function printNote() {
    const html = getEditorHtml();
    if (!html) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(buildHtmlPage(html));
    win.document.close();
    win.focus();
    // Slight delay so the browser finishes rendering before showing print dialog
    setTimeout(() => win.print(), 450);
    lastExported = 'print';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
  role="button"
  tabindex="-1"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
  aria-label="Close export"
></div>

<!-- Modal -->
<div
  transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
  class="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
  role="dialog"
  aria-modal="true"
  aria-label="Export note"
>
  <!-- Header -->
  <div class="flex items-center gap-2 border-b border-border px-5 py-3.5">
    <Download size={16} class="shrink-0 text-muted-foreground" />
    <h2 class="flex-1 text-sm font-semibold text-foreground">Export note</h2>
    <button
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
    >
      <X size={14} />
    </button>
  </div>

  <div class="space-y-2.5 px-5 py-4">
    <p class="mb-3 text-xs text-muted-foreground">
      Exporting: <span class="font-mono text-foreground">{fileName}.md</span>
    </p>

    <!-- Markdown download -->
    <button
      class="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
      onclick={exportMarkdown}
    >
      <FileText size={18} class="shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-foreground">Download Markdown</p>
        <p class="text-xs text-muted-foreground">Raw .md source file</p>
      </div>
      {#if lastExported === 'md'}
        <Check size={14} class="shrink-0 text-green-500" />
      {/if}
    </button>

    <!-- HTML export -->
    <button
      class="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
      onclick={exportHtml}
    >
      <Code2 size={18} class="shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-foreground">Export as HTML</p>
        <p class="text-xs text-muted-foreground">Rendered content with inline styles</p>
      </div>
      {#if lastExported === 'html'}
        <Check size={14} class="shrink-0 text-green-500" />
      {/if}
    </button>

    <!-- Print / PDF -->
    <button
      class="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
      onclick={printNote}
    >
      <Printer size={18} class="shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-foreground">Print / Save as PDF</p>
        <p class="text-xs text-muted-foreground">Opens browser print dialog</p>
      </div>
      {#if lastExported === 'print'}
        <Check size={14} class="shrink-0 text-green-500" />
      {/if}
    </button>
  </div>

  <div class="border-t border-border px-5 py-3">
    <p class="text-[11px] text-muted-foreground">
      HTML and Print export the rendered WYSIWYG view. Switch to WYSIWYG mode first for best results.
    </p>
  </div>
</div>
