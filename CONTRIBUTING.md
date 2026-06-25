# Contributing to Leaflet

Thank you for your interest in contributing. This guide covers everything you need to know.

## Before You Start

Read these documents in order:

1. [`.agents/skills/coding-standards/SKILL.md`](.agents/skills/coding-standards/SKILL.md) - code conventions
2. [`.agents/skills/git/SKILL.md`](.agents/skills/git/SKILL.md) - Git workflow routing
3. [`.agents/skills/git/steps/commit-conventions.md`](.agents/skills/git/steps/commit-conventions.md) - commit message format
4. [`.agents/skills/git/steps/branch-conventions.md`](.agents/skills/git/steps/branch-conventions.md) - branch naming
5. [`.agents/skills/git/steps/pr-standards.md`](.agents/skills/git/steps/pr-standards.md) - pull request requirements
6. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - how the codebase is structured

## Development Setup

```bash
git clone https://github.com/AshenDulsanka/leaflet.git
cd leaflet
cp .env.example .env
pnpm install
pnpm dev
```

Or with Docker:

```bash
docker compose -f docker-compose.dev.yaml up --watch
```

## Workflow

1. Create a GitHub issue for the work you intend to do.
2. Cut a branch from `development` following `.agents/skills/git/steps/branch-conventions.md`.
3. Make changes following `.agents/skills/coding-standards/SKILL.md`.
4. Commit following `.agents/skills/git/steps/commit-conventions.md`.
5. Open a PR targeting `development` following `.agents/skills/git/steps/pr-standards.md`.
6. Address review feedback.
7. Squash merge into `development`.

> **Stacked PRs:** For larger features, you may use stacked PRs — create a chain of branches where each depends on the previous one. Each PR targets the branch below it. The final PR in the stack targets `development`.

> **Release flow:** `main` only receives merges from `development` when a release is ready. Never push directly to `main`.

## Type Checking and Linting

Before opening a PR, verify your changes pass all checks:

```bash
pnpm check   # svelte-check (TypeScript + Svelte)
pnpm lint    # ESLint
```

Both must pass with zero errors.

## Security

See the security guidelines in [`docs/SECURITY.md`](docs/SECURITY.md) before touching any file system, database, or user input code.

Never commit `.env` files, database files, or screenshot data.

## Questions

Open a GitHub Discussion or a draft PR if you want feedback on an approach before implementing.
