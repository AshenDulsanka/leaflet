/**
 * POST /api/sync - Push or pull data via git
 *
 * Body: { action: 'push' | 'pull' | 'status' }
 *
 * Push: checkpoint DB → git add → git commit → git push
 * Pull: git pull
 * Status: git status --porcelain + check if inside a repo
 */

import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import type { RequestHandler } from '@sveltejs/kit';
import { checkpoint } from '$lib/server/database';
import { getRandomSyncMessage } from '$lib/data/sync-messages';

function getDataDir(): string {
  return process.env.NOTES_DATA_DIR ?? join(process.cwd(), 'data');
}

function getGitEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  const name = process.env.GIT_USER_NAME;
  const email = process.env.GIT_USER_EMAIL;
  if (name) { env.GIT_AUTHOR_NAME = name; env.GIT_COMMITTER_NAME = name; }
  if (email) { env.GIT_AUTHOR_EMAIL = email; env.GIT_COMMITTER_EMAIL = email; }
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_DISCOVERY_ACROSS_FILESYSTEM = '1';
  return env;
}

function getRepoRoot(fromDir: string): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: fromDir,
      encoding: 'utf-8',
      timeout: 5_000,
      env: getGitEnv(),
    }).trim();
  } catch {
    return null;
  }
}

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
    env: getGitEnv(),
  }).trim();
}

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json() as { action?: string };
  const action = body.action;

  if (!action || !['push', 'pull', 'status'].includes(action)) {
    return json({ error: 'action must be push, pull, or status' }, { status: 400 });
  }

  const dataDir = getDataDir();

  if (!existsSync(dataDir)) {
    return json({ error: 'data directory does not exist' }, { status: 404 });
  }

  const repoRoot = getRepoRoot(dataDir);
  if (!repoRoot) {
    return json(
      {
        error: 'No git repository found. Initialize one with `git init` in your project root.',
        hint: 'git init && git remote add origin <your-repo-url>',
      },
      { status: 400 }
    );
  }

  try {
    if (action === 'status') {
      const status = git('status --porcelain', repoRoot);
      const branch = git('rev-parse --abbrev-ref HEAD', repoRoot);
      let hasRemote = false;
      try {
        git('remote get-url origin', repoRoot);
        hasRemote = true;
      } catch {
        hasRemote = false;
      }
      return json({
        initialized: true,
        branch,
        hasRemote,
        dirty: status.length > 0,
        changes: status || null,
      });
    }

    if (action === 'push') {
      // 0. Verify remote exists
      try {
        git('remote get-url origin', repoRoot);
      } catch {
        return json(
          { error: 'No remote configured. Run `git remote add origin <url>` first.' },
          { status: 400 }
        );
      }

      // 1. Flush WAL to main DB file
      checkpoint();

      // 2. Stage only the data directory (not source files)
      const relDataDir = relative(repoRoot, dataDir);
      git(`add "${relDataDir}"`, repoRoot);

      // 3. Check if there are staged changes
      const diff = git('diff --cached --name-only', repoRoot);
      if (!diff) {
        return json({ message: 'Nothing to push - already up to date.' });
      }

      // 4. Commit with a fun message
      const msg = getRandomSyncMessage();
      git(`commit -m "${msg}"`, repoRoot);

      // 5. Push (inject token into remote URL if configured)
      const origUrl = git('remote get-url origin', repoRoot);
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        const authUrl = origUrl.replace(/^https:\/\//, `https://oauth2:${token}@`);
        git(`remote set-url origin "${authUrl}"`, repoRoot);
      }
      try {
        git('push', repoRoot);
      } finally {
        if (token) git(`remote set-url origin "${origUrl}"`, repoRoot);
      }

      return json({ message: `Pushed! "${msg}"`, commitMessage: msg });
    }

    if (action === 'pull') {
      const origUrl = git('remote get-url origin', repoRoot);
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        const authUrl = origUrl.replace(/^https:\/\//, `https://oauth2:${token}@`);
        git(`remote set-url origin "${authUrl}"`, repoRoot);
      }
      let output = '';
      try {
        output = git('pull', repoRoot);
      } finally {
        if (token) git(`remote set-url origin "${origUrl}"`, repoRoot);
      }
      const upToDate = output.includes('Already up to date');
      return json({
        message: upToDate ? 'Already up to date.' : 'Pulled latest changes.',
        details: output,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown git error';
    return json({ error: message }, { status: 500 });
  }

  return json({ error: 'Unexpected error' }, { status: 500 });
};
