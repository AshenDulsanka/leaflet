/**
 * Theme management using Svelte 5 runes.
 * Theme is persisted in localStorage and applied as a class on <html>.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'notes-theme';

function createTheme() {
  let current = $state<Theme>('dark');

  function init() {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      current = stored;
    } else {
      // Default to system preference
      current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(current);
  }

  function applyTheme(theme: Theme) {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }

  function toggle() {
    current = current === 'dark' ? 'light' : 'dark';
    applyTheme(current);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, current);
    }
  }

  function set(theme: Theme) {
    current = theme;
    applyTheme(current);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, current);
    }
  }

  return {
    get current() {
      return current;
    },
    get isDark() {
      return current === 'dark';
    },
    init,
    toggle,
    set
  };
}

export const theme = createTheme();
