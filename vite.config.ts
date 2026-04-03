import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  define: {
    // @milkdown/crepe bundles Vue internally. Without these compile-time flags,
    // Vue's esm-bundler build emits warnings on every editor init.
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  server: {
    // Required for Docker: Vite must bind to 0.0.0.0, not localhost
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      // HMR WebSocket must match the exposed port so the browser can connect
      clientPort: 5173,
    },
  },
});
