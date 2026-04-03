<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X, Copy, Check, Sparkles, FileInput } from '@lucide/svelte';

  interface Props {
    noteContent: string;
    onInsert: (text: string) => void;
    onClose: () => void;
  }

  let { noteContent, onInsert, onClose }: Props = $props();

  let summary = $state('');
  let loading = $state(true);
  let copied = $state(false);
  let error = $state('');
  let bodyEl = $state<HTMLDivElement | null>(null);

  onMount(async () => {
    // Snapshot note content at mount time — the component only mounts once per
    // summarize action, so we take the content as-is and build the prompt here.
    const prompt =
      `You are creating a compressed quick-reference card from the following note. Your output MUST be shorter than the input — aim for 25% of the original length.

Rules:
- DO NOT reproduce sentences, paragraphs, or sections verbatim
- DO NOT echo back the note structure unchanged
- Distill and compress: one bullet per concept, not one section per section
- Keep exact values that matter: IPs, credentials, CVEs, tool flags, hashes, flags
- Drop all filler, context-setting prose, and repetition
- Use tight markdown: \`## headers\`, bullet lists, inline code for values

Produce the compressed card now. Do not preface it with "Here is a summary" or any intro sentence — start directly with the first header.

---

${noteContent.slice(0, 6000)}`;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok || !res.body) {
        error = 'Failed to reach AI endpoint';
        loading = false;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            loading = false;
            return;
          }
          try {
            const json = JSON.parse(data);
            if (json.error) {
              error = json.error;
              loading = false;
              return;
            }
            if (json.content) {
              if (loading) loading = false;
              summary += json.content;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Network error';
    } finally {
      loading = false;
    }
  });

  // Scroll to bottom as summary streams in
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    summary; // track streaming updates
    if (bodyEl) {
      requestAnimationFrame(() => {
        if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
      });
    }
  });

  async function copy() {
    await navigator.clipboard.writeText(summary);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function insertIntoNote() {
    onInsert(`## AI Summary\n\n${summary}`);
    onClose();
  }

  function renderMarkdown(text: string): string {
    return text
      .replace(
        /```(\w*)\n?([\s\S]*?)```/g,
        '<pre class="my-2 overflow-x-auto rounded bg-muted p-2 text-xs"><code>$2</code></pre>',
      )
      .replace(/`([^`\n]+)`/g, '<code class="rounded bg-muted px-1 text-xs">$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h3 class="mt-3 mb-1 text-xs font-bold">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="mt-3 mb-1 text-sm font-semibold">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="mt-3 mb-1 text-sm font-bold">$1</h1>')
      .replace(/^[*-] (.+)$/gm, '<li class="ml-3 list-disc text-xs">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-3 list-decimal text-xs">$1</li>')
      .replace(/\n/g, '<br />');
  }
</script>

<!-- Backdrop -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  aria-label="AI Note Summary"
  onkeydown={(e) => e.key === 'Escape' && onClose()}
  tabindex="-1"
>
  <!-- Panel -->
  <div
    transition:fly={{ y: -10, duration: 200, easing: cubicOut }}
    class="flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-2 border-b border-border bg-amber-500/10 px-4 py-3">
      <Sparkles size={16} class="shrink-0 text-amber-500" />
      <span class="flex-1 text-sm font-semibold text-foreground">Note Summary</span>
      {#if loading}
        <span class="text-xs text-muted-foreground">Generating...</span>
      {/if}
      <button
        class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        onclick={onClose}
        aria-label="Close summary"
      >
        <X size={14} />
      </button>
    </div>

    <!-- Body -->
    <div bind:this={bodyEl} class="flex-1 overflow-y-auto px-5 py-4 text-sm text-foreground">
      {#if loading && !summary}
        <div class="flex items-center gap-3 text-muted-foreground">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
          <span class="text-xs">Analyzing note...</span>
        </div>
      {:else if error}
        <p class="text-xs text-destructive">{error}</p>
      {:else}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html renderMarkdown(summary)}
        {#if loading}
          <span class="inline-block h-3 w-0.5 animate-pulse bg-amber-500 align-middle"></span>
        {/if}
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
      <button
        class="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
        onclick={copy}
        disabled={!summary || loading}
      >
        {#if copied}
          <Check size={12} />
          Copied
        {:else}
          <Copy size={12} />
          Copy
        {/if}
      </button>
      <button
        class="flex items-center gap-1.5 rounded bg-amber-500/15 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-500/25 dark:text-amber-400 disabled:opacity-40"
        onclick={insertIntoNote}
        disabled={!summary || loading}
      >
        <FileInput size={12} />
        Insert into note
      </button>
    </div>
  </div>
</div>
