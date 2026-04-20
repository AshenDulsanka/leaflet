#!/usr/bin/env node
// Runs at session start. Injects universal (non-project-specific) AI safety rules.
// Project-specific rules live in .github/copilot-instructions.md.
// Framework/language rules auto-load from .github/instructions/ based on file type.
process.stdout.write(JSON.stringify({
  systemMessage:
    'Universal rules (always enforce): ' +
    '(1) Never hardcode secrets, API keys, or tokens — use environment variables. ' +
    '(2) Validate all input at system boundaries before use — never pass raw input to SQL, file paths, shell commands, or HTML. ' +
    '(3) Read the relevant skill files in .github/skills/ before starting work in their domain. ' +
    '(4) Take small, reversible actions. Before any destructive operation (delete files, drop data, force-push), confirm with the user. ' +
    '(5) Commit atomically — one logical change per commit with a conventional commit message.' +
    '(7) Update CHANGELOG.md under [Unreleased] for every source change. ' +
    '(8) All file system operations in notes.ts must go through safePath() - never use raw user input in path.join. ' +
    '(9) Use Svelte 5 runes ($state, $derived, $effect) - no Svelte 4 syntax. ' +
}));
