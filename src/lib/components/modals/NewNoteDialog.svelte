<script lang="ts">
  import { X, FileText, BookOpen, Server, ShieldAlert, List, NotebookPen } from '@lucide/svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { untrack } from 'svelte';

  interface Props {
    onConfirm: (name: string, templateContent: string) => void;
    onCancel: () => void;
  }

  let { onConfirm, onCancel }: Props = $props();

  const TEMPLATES = [
    {
      id: 'blank',
      label: 'Blank',
      icon: FileText,
      content: '',
    },
    {
      id: 'module-notes',
      label: 'Module Notes',
      icon: BookOpen,
      content: `# Module: [Module Name]

**HTB URL:** [URL]
**Started:** [Date]
**Completed:** [Date]
**Status:** In Progress

---

## Summary

Brief description of what this module covers.

## Key Concepts

- 

## Notes by Section

### [Section Name]

`,
    },
    {
      id: 'section-notes',
      label: 'Section Notes',
      icon: NotebookPen,
      content: `# [Section Name]

**Module:** [Module Name]
**Date:** [Date]
**Status:** In Progress

---

## Objective

## Notes

## Commands

\`\`\`bash

\`\`\`

## Key Takeaways

- 
`,
    },
    {
      id: 'machine-writeup',
      label: 'Machine Writeup',
      icon: Server,
      content: `# Machine Writeup: [Machine Name]

**OS:** Linux / Windows
**Difficulty:** Easy / Medium / Hard / Insane
**IP:** \`10.10.x.x\`
**Date:** [Date]
**Status:** Rooted / In Progress

---

## Recon

### Nmap

\`\`\`bash
nmap -sC -sV -oA nmap/initial 10.10.x.x
\`\`\`

## Foothold

## Privilege Escalation

## Flags

- User: \`\`
- Root: \`\`
`,
    },
    {
      id: 'finding-report',
      label: 'Finding Report',
      icon: ShieldAlert,
      content: `# Finding: [Finding Title]

**Severity:** Critical / High / Medium / Low / Informational
**CVSS Score:** [e.g. 9.8]
**CWE:** [e.g. CWE-89]
**Status:** Open / Remediated

---

## Description

## Impact

## Steps to Reproduce

1. 

## Proof of Concept

\`\`\`

\`\`\`

## Remediation

## References

- 
`,
    },
    {
      id: 'cheatsheet',
      label: 'Cheatsheet',
      icon: List,
      content: `# Cheatsheet: [Topic]

**Category:** [e.g. Web, AD, Linux, Windows, Network]
**Updated:** [Date]

---

## Quick Reference

| Command | Description |
| ------- | ----------- |
|         |             |

## Methodology

1. 

## Common Payloads

\`\`\`

\`\`\`

## One-liners

\`\`\`bash
# [description]

\`\`\`

## Notes

- 
`,
    },
  ] as const;

  let name = $state('');
  let selectedTemplate = $state<string>('blank');
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (inputEl) {
      untrack(() => inputEl!.focus());
    }
  });

  function submit() {
    if (!name.trim()) return;
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate);
    const fileName = name.trim().endsWith('.md') ? name.trim() : `${name.trim()}.md`;
    onConfirm(fileName, tpl?.content ?? '');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  onclick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
  role="presentation"
>
  <!-- Panel -->
  <div
    transition:fly={{ y: 10, duration: 200, easing: cubicOut }}
    tabindex="-1"
    class="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="new-note-title"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 id="new-note-title" class="text-sm font-semibold text-foreground">New Note</h2>
      <button
        onclick={onCancel}
        class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>

    <!-- Name input -->
    <input
      bind:this={inputEl}
      bind:value={name}
      type="text"
      placeholder="note-name"
      class="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    />

    <!-- Template picker -->
    <p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Template</p>
    <div class="mb-4 grid grid-cols-3 gap-2">
      {#each TEMPLATES as tpl (tpl.id)}
        <button
          onclick={() => (selectedTemplate = tpl.id)}
          class="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors
                 {selectedTemplate === tpl.id
                   ? 'border-primary bg-primary/10 text-primary'
                   : 'border-border text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground'}"
        >
          <tpl.icon size={18} />
          <span>{tpl.label}</span>
        </button>
      {/each}
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2">
      <button
        onclick={submit}
        disabled={!name.trim()}
        class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground
               hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Create
      </button>
      <button
        onclick={onCancel}
        class="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  </div>
</div>
