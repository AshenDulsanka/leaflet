/**
 * POST /api/sync — Push or pull data via git
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
import { join } from 'path';
import type { RequestHandler } from '@sveltejs/kit';
import { checkpoint } from '$lib/server/database';
import { getRandomSyncMessage } from '$lib/data/sync-messages';

function getDataDir(): string {
  return process.env.NOTES_DATA_DIR ?? join(process.cwd(), 'data');
}

function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, '.git'));
}

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
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

  if (!isGitRepo(dataDir)) {
    return json(
      {
        error: 'data directory is not a git repository. Run `git init` in your data directory first.',
        hint: `cd ${dataDir} && git init && git remote add origin <your-repo-url>`,
      },
      { status: 400 }
    );
  }

  try {
    if (action === 'status') {
      const status = git('status --porcelain', dataDir);
      const branch = git('rev-parse --abbrev-ref HEAD', dataDir);
      let hasRemote = false;
      try {
        git('remote get-url origin', dataDir);
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
        git('remote get-url origin', dataDir);
      } catch {
        return json(
          { error: 'No remote configured. Run `git remote add origin <url>` first.' },
          { status: 400 }
        );
      }

      // 1. Flush WAL to main DB file
      checkpoint();

      // 2. Stage everything in data dir
      git('add -A', dataDir);

      // 3. Check if there are staged changes
      const diff = git('diff --cached --name-only', dataDir);
      if (!diff) {
        return json({ message: 'Nothing to push — already up to date.' });
      }

      // 4. Commit with a fun message
      const msg = getRandomSyncMessage();
      git(`commit -m "${msg}"`, dataDir);

      // 5. Push
      git('push', dataDir);

      return json({ message: `Pushed! "${msg}"`, commitMessage: msg });
    }

    if (action === 'pull') {
      const output = git('pull', dataDir);
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
