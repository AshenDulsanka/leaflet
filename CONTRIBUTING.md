# Contributing to Leaflet

Thank you for your interest in contributing. This guide covers everything you need to know.

## Before You Start

Read these documents in order:

1. [`.github/skills/coding-standards.md`](.github/skills/coding-standards.md) - code conventions
2. [`.github/skills/commit-conventions.md`](.github/skills/commit-conventions.md) - commit message format
3. [`.github/skills/branch-conventions.md`](.github/skills/branch-conventions.md) - branch naming
4. [`.github/skills/pr-standards.md`](.github/skills/pr-standards.md) - pull request requirements
5. [`.github/skills/architecture.md`](.github/skills/architecture.md) - how the codebase is structured

## Development Setup

```bash
git clone <repo-url> leaflet
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
2. Cut a branch from `main` following `branch-conventions.md`.
3. Make changes following `coding-standards.md`.
4. Commit following `commit-conventions.md`.
5. Open a PR following `pr-standards.md`.
6. Address review feedback.
7. Squash merge to `main`.

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
