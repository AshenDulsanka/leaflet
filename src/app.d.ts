// SvelteKit app type declarations
// See https://kit.svelte.dev/docs/types#app

import type { getDrizzle } from '$lib/server/db/index';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      db: import('better-sqlite3').Database;
      drizzle: ReturnType<typeof getDrizzle>;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
