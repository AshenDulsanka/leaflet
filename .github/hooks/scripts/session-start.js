#!/usr/bin/env node
// Runs at session start. Injects project conventions into the system prompt.
process.stdout.write(JSON.stringify({
  systemMessage:
    'Leaflet project reminders: ' +
    '(1) Update CHANGELOG.md under [Unreleased] for every source change. ' +
    '(2) All file system operations in notes.ts must go through safePath() - never use raw user input in path.join. ' +
    '(3) Use Svelte 5 runes ($state, $derived, $effect) - no Svelte 4 syntax. ' +
    '(4) All SQL queries must use prepared statements with ? placeholders. ' +
    'Read .github/skills/ for full coding standards, commit conventions, and branch rules before making changes.'
}));
