<script lang="ts">
  import { Moon, Sun } from '@lucide/svelte';
  import { flushSync } from 'svelte';

  interface Props {
    isDark: boolean;
    onToggle: () => void;
    class?: string;
  }

  let { isDark, onToggle, class: className = '' }: Props = $props();

  let buttonEl: HTMLButtonElement | undefined = $state();

  function handleClick() {
    if (!buttonEl) {
      onToggle();
      return;
    }

    const { top, left, width, height } = buttonEl.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));

    if (typeof document.startViewTransition !== 'function') {
      onToggle();
      return;
    }

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        onToggle();
      });
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  }
</script>

<button
  type="button"
  bind:this={buttonEl}
  onclick={handleClick}
  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  class="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground {className}"
>
  {#if isDark}
    <Sun size={15} />
  {:else}
    <Moon size={15} />
  {/if}
  <span class="sr-only">Toggle theme</span>
</button>
