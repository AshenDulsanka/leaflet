import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [['src/lib/components/**/*.test.ts', 'jsdom']],
    setupFiles: ['src/test/setup-vitest.ts'],
  },
});
