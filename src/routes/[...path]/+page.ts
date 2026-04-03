// Notes are loaded client-side from the file API. Disable SSR so SvelteKit
// does not attempt to render the page on the server (where the Docker FS
// API is available but the client-side fetch calls would target the wrong host).
export const ssr = false;
export const prerender = false;
