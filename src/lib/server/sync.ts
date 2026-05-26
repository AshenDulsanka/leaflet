import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';

import { getRandomSyncMessage } from '$lib/data/sync-messages';
import { checkpoint, reloadDb } from '$lib/server/database';
import { invalidateDrizzle } from '$lib/server/db/index';

const VALID_ACTIONS = ['push', 'pull', 'status'] as const;

type SyncAction = (typeof VALID_ACTIONS)[number];

type SyncStatusOptions = {
  includeRemote?: boolean;
};

type SyncRecommendation = 'push' | 'pull' | 'both' | 'none';

type SyncResponseBody =
  | {
      initialized: boolean;
      branch: string;
      hasRemote: boolean;
      dirty: boolean;
      changes: string | null;
      ahead: number;
      behind: number;
      recommendation: SyncRecommendation;
    }
  | {
      message: string;
      commitMessage?: string;
      details?: string;
    }
  | {
      error: string;
      hint?: string;
    };

export type SyncApiResponse = {
  status: number;
  body: SyncResponseBody;
};

export function resolveStatusOptions(input: unknown): Required<SyncStatusOptions> {
  if (typeof input !== 'object' || input === null) {
    return { includeRemote: false };
  }

  const record = input as Record<string, unknown>;
  return { includeRemote: record.includeRemote === true };
}

class SyncHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getDataDir(): string {
  return process.env.NOTES_DATA_DIR ?? join(process.cwd(), 'data');
}

function getGitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const name = process.env.GIT_USER_NAME;
  const email = process.env.GIT_USER_EMAIL;

  if (name) {
    env.GIT_AUTHOR_NAME = name;
    env.GIT_COMMITTER_NAME = name;
  }

  if (email) {
    env.GIT_AUTHOR_EMAIL = email;
    env.GIT_COMMITTER_EMAIL = email;
  }

  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_DISCOVERY_ACROSS_FILESYSTEM = '1';

  return env;
}

function git(args: string[], cwd: string, timeout = 30_000): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout,
    env: getGitEnv(),
  }).trim();
}

function tryGit(args: string[], cwd: string, timeout = 30_000): string | null {
  try {
    return git(args, cwd, timeout);
  } catch {
    return null;
  }
}

export function buildGitAuthHeader(remoteUrl: string, token: string | undefined): string | null {
  if (!token || !remoteUrl.toLowerCase().startsWith('https://')) {
    return null;
  }

  const encoded = Buffer.from(`x-access-token:${token}`, 'utf-8').toString('base64');
  return `AUTHORIZATION: basic ${encoded}`;
}

export function buildGitArgs(args: readonly string[], authHeader: string | null): string[] {
  if (!authHeader) {
    return [...args];
  }

  return ['-c', `http.extraheader=${authHeader}`, ...args];
}

function gitWithOptionalAuth(args: readonly string[], cwd: string, timeout = 30_000): string {
  const remoteUrl = tryGit(['remote', 'get-url', 'origin'], cwd, 5_000) ?? '';
  const authHeader = buildGitAuthHeader(remoteUrl, process.env.GITHUB_TOKEN);
  return git(buildGitArgs(args, authHeader), cwd, timeout);
}

function getRepoRoot(fromDir: string): string | null {
  return tryGit(['rev-parse', '--show-toplevel'], fromDir, 5_000);
}

function assertRemoteConfigured(repoRoot: string): void {
  const remoteUrl = tryGit(['remote', 'get-url', 'origin'], repoRoot, 5_000);
  if (!remoteUrl) {
    throw new SyncHttpError('No remote configured. Run `git remote add origin <url>` first.', 400);
  }
}

function hasUpstream(repoRoot: string): boolean {
  return (
    tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], repoRoot, 5_000) !==
    null
  );
}

function fetchOrigin(repoRoot: string): void {
  assertRemoteConfigured(repoRoot);
  gitWithOptionalAuth(['fetch', 'origin', '--quiet'], repoRoot, 45_000);
}

export function parseAheadBehindCounts(countOutput: string): { ahead: number; behind: number } {
  const parts = countOutput.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { ahead: 0, behind: 0 };
  }

  const behind = Number(parts[0]);
  const ahead = Number(parts[1]);

  if (!Number.isFinite(behind) || !Number.isFinite(ahead)) {
    return { ahead: 0, behind: 0 };
  }

  return {
    ahead: Math.max(0, Math.trunc(ahead)),
    behind: Math.max(0, Math.trunc(behind)),
  };
}

export function getSyncRecommendation(input: {
  hasRemote: boolean;
  ahead: number;
  behind: number;
}): SyncRecommendation {
  if (!input.hasRemote) {
    return 'none';
  }
  if (input.ahead > 0 && input.behind > 0) {
    return 'both';
  }
  if (input.behind > 0) {
    return 'pull';
  }
  if (input.ahead > 0) {
    return 'push';
  }
  return 'none';
}

export function sanitizeGitError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message.toLowerCase() : '';

  if (rawMessage.includes('could not read username') || rawMessage.includes('authentication failed')) {
    return 'Git authentication failed. Check remote credentials.';
  }

  if (rawMessage.includes('permission denied') || rawMessage.includes('publickey')) {
    return 'Git authorization failed. Verify repository access.';
  }

  if (rawMessage.includes('non-fast-forward') || rawMessage.includes('[rejected]')) {
    return 'Remote contains newer commits. Pull before pushing.';
  }

  if (rawMessage.includes('could not resolve host') || rawMessage.includes('timed out')) {
    return 'Cannot reach git remote. Check network connectivity.';
  }

  if (rawMessage.includes('not a git repository')) {
    return 'No git repository found. Initialize git in project root first.';
  }

  if (rawMessage.includes('no such remote')) {
    return 'No remote configured. Run `git remote add origin <url>` first.';
  }

  return 'Git operation failed. Verify repository and remote configuration.';
}

function getGitErrorStatus(error: unknown): number {
  const safeMessage = sanitizeGitError(error);

  if (safeMessage.includes('Pull before pushing')) {
    return 409;
  }
  if (safeMessage.includes('No remote configured') || safeMessage.includes('No git repository found')) {
    return 400;
  }
  if (safeMessage.includes('authentication') || safeMessage.includes('authorization')) {
    return 401;
  }

  return 500;
}

function getAheadBehind(repoRoot: string): { ahead: number; behind: number } {
  if (!hasUpstream(repoRoot)) {
    return { ahead: 0, behind: 0 };
  }

  const raw = git(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], repoRoot, 5_000);
  return parseAheadBehindCounts(raw);
}

function getAction(action: unknown): SyncAction {
  if (typeof action !== 'string' || !VALID_ACTIONS.includes(action as SyncAction)) {
    throw new SyncHttpError('action must be push, pull, or status', 400);
  }

  return action as SyncAction;
}

export function resolveSyncAction(action: unknown): SyncAction {
  return getAction(action);
}

export async function runSyncAction(
  actionInput: unknown,
  statusOptions: SyncStatusOptions = {}
): Promise<SyncApiResponse> {
  let action: SyncAction;

  try {
    action = getAction(actionInput);
  } catch (error) {
    if (error instanceof SyncHttpError) {
      return { status: error.status, body: { error: error.message } };
    }

    return { status: 400, body: { error: 'action must be push, pull, or status' } };
  }

  const dataDir = getDataDir();

  if (!existsSync(dataDir)) {
    return { status: 404, body: { error: 'data directory does not exist' } };
  }

  const repoRoot = getRepoRoot(dataDir);
  if (!repoRoot) {
    return {
      status: 400,
      body: {
        error: 'No git repository found. Initialize one with `git init` in your project root.',
        hint: 'git init && git remote add origin <your-repo-url>',
      },
    };
  }

  try {
    if (action === 'status') {
      const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot, 5_000);
      const changes = git(['status', '--porcelain'], repoRoot, 5_000);
      const hasRemote = tryGit(['remote', 'get-url', 'origin'], repoRoot, 5_000) !== null;
      const dirty = changes.length > 0;

      return {
        status: 200,
        body: {
          initialized: true,
          branch,
          hasRemote,
          dirty,
          changes: changes || null,
          ahead: 0,
          behind: 0,
          recommendation: dirty ? 'push' : (hasRemote ? 'pull' : 'none'),
        },
      };
    }

    if (action === 'push') {
      assertRemoteConfigured(repoRoot);
      fetchOrigin(repoRoot);

      const aheadBehind = getAheadBehind(repoRoot);
      if (aheadBehind.behind > 0) {
        return {
          status: 409,
          body: { error: 'Remote contains newer commits. Pull before pushing.' },
        };
      }

      checkpoint();

      const relDataDir = relative(repoRoot, dataDir);
      git(['add', relDataDir], repoRoot, 10_000);

      const staged = git(['diff', '--cached', '--name-only'], repoRoot, 5_000);
      if (!staged) {
        return {
          status: 200,
          body: { message: 'Nothing to push - already up to date.' },
        };
      }

      const commitMessage = getRandomSyncMessage();
      git(['commit', '-m', commitMessage], repoRoot, 20_000);
      gitWithOptionalAuth(['push'], repoRoot, 60_000);

      return {
        status: 200,
        body: { message: `Pushed! "${commitMessage}"`, commitMessage },
      };
    }

    assertRemoteConfigured(repoRoot);

    const output = gitWithOptionalAuth(['pull'], repoRoot, 60_000);

    // Pull may overwrite notes.db; recycle both DB clients to avoid stale handles.
    reloadDb();
    invalidateDrizzle();

    const upToDate = output.toLowerCase().includes('already up to date');

    return {
      status: 200,
      body: {
        message: upToDate ? 'Already up to date.' : 'Pulled latest changes.',
        details: output,
      },
    };
  } catch (error) {
    return {
      status: getGitErrorStatus(error),
      body: { error: sanitizeGitError(error) },
    };
  }
}
