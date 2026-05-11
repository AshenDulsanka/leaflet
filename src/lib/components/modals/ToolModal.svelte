<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount, tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    ariaLabel: string;
    onClose: () => void;
    maxWidthClass?: string;
    dialogClass?: string;
    closeOnBackdrop?: boolean;
    children?: Snippet;
  }

  let {
    ariaLabel,
    onClose,
    maxWidthClass = 'max-w-sm',
    dialogClass = '',
    closeOnBackdrop = true,
    children,
  }: Props = $props();

  let dialogElement: HTMLDivElement | undefined;
  let previousFocusedElement: HTMLElement | null = null;

  const focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(',');

  function getFocusableElements(): HTMLElement[] {
    if (!dialogElement) return [];

    return Array.from(dialogElement.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
    );
  }

  async function focusModalContent(): Promise<void> {
    await tick();
    const focusable = getFocusableElements();
    const firstFocusable = focusable[0];

    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }

    dialogElement?.focus();
  }

  onMount(() => {
    previousFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    void focusModalContent();

    return () => {
      if (previousFocusedElement && document.contains(previousFocusedElement)) {
        previousFocusedElement.focus();
      }
    };
  });

  function handleBackdropClick(): void {
    if (!closeOnBackdrop) return;
    onClose();
  }

  function handleWindowKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;

    if (e.key === 'Tab') {
      const focusable = getFocusableElements();

      if (focusable.length === 0) {
        e.preventDefault();
        dialogElement?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!activeElement || activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onClose();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
  role="presentation"
  aria-hidden="true"
  onclick={handleBackdropClick}
></div>

<div
  transition:fly={{ y: 8, duration: 200, easing: cubicOut }}
  bind:this={dialogElement}
  class={`fixed left-1/2 top-1/2 z-50 w-full ${maxWidthClass} -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl ${dialogClass}`}
  role="dialog"
  aria-modal="true"
  aria-label={ariaLabel}
  tabindex="-1"
>
  {@render children?.()}
</div>
