// SvelteKit app type declarations
// See https://kit.svelte.dev/docs/types#app

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      db: import('better-sqlite3').Database;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
