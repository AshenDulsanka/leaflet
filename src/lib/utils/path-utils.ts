/**
 * Pure path utility functions for note file paths and workspace URL resolution.
 * All functions are stateless and take explicit parameters.
 */
import type { Workspace } from '$lib/types';

export function encodePathForUrl(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function normalizeNotesFolder(folder: string | null | undefined): string {
  return folder?.replace(/^\/+|\/+$/g, '') ?? '';
}

export function resolveWorkspacePath(path: string, workspaceNotesFolder: string | null): string {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  const wsFolder = normalizeNotesFolder(workspaceNotesFolder);
  if (!wsFolder) return normalized;
  if (normalized === wsFolder || normalized.startsWith(`${wsFolder}/`)) {
    return normalized;
  }
  return `${wsFolder}/${normalized}`;
}

export function workspaceRootUrl(ws: Pick<Workspace, 'notes_folder'> | null): string {
  const folder = normalizeNotesFolder(ws?.notes_folder ?? null);
  if (!folder) return '/';
  return `/${encodePathForUrl(folder)}`;
}

export function isPathWithinWorkspace(
  path: string,
  workspaceNotesFolder: string | null,
  workspaces: Pick<Workspace, 'notes_folder'>[]
): boolean {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  const workspaceFolder = normalizeNotesFolder(workspaceNotesFolder);

  if (!normalizedPath) return false;
  if (!workspaceFolder) return true;
  if (normalizedPath === workspaceFolder || normalizedPath.startsWith(`${workspaceFolder}/`)) {
    return true;
  }

  return !workspaces.some((workspace) => {
    const folder = normalizeNotesFolder(workspace.notes_folder);
    return folder !== '' && (normalizedPath === folder || normalizedPath.startsWith(`${folder}/`));
  });
}

export function migrateWorkspacePath(
  path: string,
  oldWorkspaceNotesFolder: string | null,
  newWorkspaceNotesFolder: string | null
): string {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  const oldWorkspaceFolder = normalizeNotesFolder(oldWorkspaceNotesFolder);
  const newWorkspaceFolder = normalizeNotesFolder(newWorkspaceNotesFolder);

  if (!oldWorkspaceFolder || !newWorkspaceFolder) return normalizedPath;
  if (normalizedPath === oldWorkspaceFolder) return newWorkspaceFolder;
  if (normalizedPath.startsWith(`${oldWorkspaceFolder}/`)) {
    return `${newWorkspaceFolder}${normalizedPath.slice(oldWorkspaceFolder.length)}`;
  }
  return normalizedPath;
}
