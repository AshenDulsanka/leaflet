<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X, Send, Bot, FileText } from '@lucide/svelte';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
  }

  interface Props {
    noteContent: string;
    onClose: () => void;
    messages: ChatMessage[];
  }

  let { noteContent, onClose, messages = $bindable([]) }: Props = $props();

  let input = $state('');
  let loading = $state(false);
  let includeNote = $state(true);
  let messagesEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLTextAreaElement | null>(null);

  const STARTERS = [
    'Summarize the key findings in this note',
    'What privilege escalation vectors should I try?',
    'Help me write a professional finding for this vulnerability',
    'What Active Directory attacks should I try next?',
  ];

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    input = '';

    messages.push({ role: 'user', content });
    const assistantIdx = messages.length;
    messages.push({ role: 'assistant', content: '' });
    loading = true;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(0, assistantIdx).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          noteContext: includeNote && noteContent ? noteContent : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        messages[assistantIdx].content = 'Error: could not reach AI endpoint.';
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
              messages[assistantIdx].content = `Error: ${json.error}`;
              return;
            }
            if (json.content) {
              messages[assistantIdx].content += json.content;
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      messages[assistantIdx].content =
        'Error: ' + (err instanceof Error ? err.message : 'unknown error');
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    messages = [];
    input = '';
  }

  /** Minimal markdown → HTML renderer for AI responses */
  function renderMarkdown(text: string): string {
    return (
      text
        // fenced code blocks
        .replace(
          /```(\w*)\n?([\s\S]*?)```/g,
          '<pre class="my-2 overflow-x-auto rounded bg-muted p-2 text-xs"><code>$2</code></pre>',
        )
        // inline code
        .replace(/`([^`\n]+)`/g, '<code class="rounded bg-muted px-1 text-xs">$1</code>')
        // bold
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        // italic
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        // h3
        .replace(/^### (.+)$/gm, '<h3 class="mt-3 mb-1 text-xs font-bold">$1</h3>')
        // h2
        .replace(/^## (.+)$/gm, '<h2 class="mt-3 mb-1 text-xs font-semibold">$1</h2>')
        // h1
        .replace(/^# (.+)$/gm, '<h1 class="mt-3 mb-1 text-sm font-bold">$1</h1>')
        // unordered list items
        .replace(/^[*-] (.+)$/gm, '<li class="ml-3 list-disc text-xs">$1</li>')
        // ordered list items
        .replace(/^\d+\. (.+)$/gm, '<li class="ml-3 list-decimal text-xs">$1</li>')
        // newlines → <br> (but not inside pre blocks -- close enough for now)
        .replace(/\n/g, '<br />')
    );
  }

  // Scroll to bottom whenever messages or their content changes
  $effect(() => {
    // reading content of each message makes this effect track streaming updates
    messages.forEach((m) => m.content);
    if (messagesEl) {
      requestAnimationFrame(() => {
        if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  });

  onMount(() => {
    inputEl?.focus();
  });
</script>

<aside
  transition:fly={{ x: 384, duration: 220, easing: cubicOut }}
  class="fixed bottom-6 right-0 top-10 z-40 flex w-96 flex-col border-l border-border bg-card shadow-xl"
>
  <!-- Header -->
  <div class="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
    <Bot size={16} class="shrink-0 text-primary" />
    <span class="flex-1 text-sm font-semibold text-foreground">AI Assistant</span>
    <button
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={clearChat}
      title="Clear conversation"
    >
      <span class="text-[10px] font-medium">CLR</span>
    </button>
    <button
      class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onclick={onClose}
      title="Close"
    >
      <X size={14} />
    </button>
  </div>

  <!-- Context toggle -->
  <div class="shrink-0 border-b border-border/50 px-4 py-1.5">
    <label class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        class="accent-primary"
        bind:checked={includeNote}
      />
      <FileText size={11} />
      Include current note as context
    </label>
  </div>

  <!-- Messages -->
  <div bind:this={messagesEl} class="flex-1 overflow-y-auto px-3 py-3">
    {#if messages.length === 0}
      <!-- Empty state — quick starters -->
      <div class="flex flex-col gap-2">
        <p class="mb-2 text-center text-xs text-muted-foreground">Ask me anything about your engagement</p>
        {#each STARTERS as starter}
          <button
            class="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
            onclick={() => send(starter)}
          >
            {starter}
          </button>
        {/each}
      </div>
    {:else}
      {#each messages as msg, i (i)}
        <div
          class="mb-3 {msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}"
        >
          {#if msg.role === 'user'}
            <div
              class="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-xs text-primary-foreground"
            >
              {msg.content}
            </div>
          {:else}
            <div
              class="max-w-[95%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs text-foreground {!msg.content && loading ? 'animate-pulse' : ''}"
            >
              {#if msg.content}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html renderMarkdown(msg.content)}
              {:else}
                <span class="text-muted-foreground">Thinking…</span>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Input -->
  <div class="shrink-0 border-t border-border p-3">
    <div class="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-primary/50">
      <textarea
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleKeydown}
        class="max-h-28 min-h-[2rem] flex-1 resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
        rows="1"
        disabled={loading}
        oninput={(e) => {
          const el = e.currentTarget;
          el.style.height = 'auto';
          el.style.height = Math.min(el.scrollHeight, 112) + 'px';
        }}
      ></textarea>
      <button
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
        onclick={() => send()}
        disabled={loading || !input.trim()}
        title="Send (Enter)"
      >
        <Send size={13} />
      </button>
    </div>
    <p class="mt-1 text-center text-[10px] text-muted-foreground">
      Powered by {#if typeof window !== 'undefined'}&zwj;{/if}MiniMax M2.5
    </p>
  </div>
</aside>
