/**
 * Notes CRUD API
 *
 * GET    /api/notes/[...path] - Read a note's content
 * PUT    /api/notes/[...path] - Write/update a note's content
 * POST   /api/notes/[...path] - Create a new note or folder
 * DELETE /api/notes/[...path] - Delete a note or folder
 * PATCH  /api/notes/[...path] - Rename/move a note or folder
 *
 * SECURITY: All paths go through safePath() -- see SECURITY.md
 */

import { json, error } from '@sveltejs/kit';
import { readNote, writeNote, createNote, deleteNote, moveNote } from '$lib/server/notes';
import type { RequestHandler } from './$types';

/** Type guard for filesystem errors that carry a `code` property. */
function isErrnoError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && 'code' in err;
}

function isValidRelativePath(input: unknown): input is string {
  if (typeof input !== 'string') return false;
  const path = input.trim();
  if (!path || path.length > 512) return false;
  if (path.includes('\0')) return false;
  if (path.includes('..')) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;

  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return false;
  }

  return true;
}

export const GET: RequestHandler = async ({ params }) => {
  const path = params.path;
  if (!path) return error(400, 'Path is required');

  try {
    const content = await readNote(path);
    return json({ content });
  } catch (err) {
    if (isErrnoError(err) && err.code === 'ENOENT') {
      return error(404, 'Note not found');
    }
    console.error('Failed to read note:', err);
    return error(500, 'Failed to read note');
  }
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const path = params.path;
  if (!path) return error(400, 'Path is required');

  // Only allow writing .md files
  if (!path.endsWith('.md')) return error(400, 'Only .md files can be written');

  try {
    const { content } = await request.json();
    if (typeof content !== 'string') return error(400, 'Content must be a string');
    await writeNote(path, content);
    return json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('traversal')) {
      return error(403, 'Access denied');
    }
    console.error('Failed to write note:', err);
    return error(500, 'Failed to write note');
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  const path = params.path;
  if (!path) return error(400, 'Path is required');

  try {
    const body = await request.json();
    const isDirectory = body.type === 'folder';
    await createNote(path, isDirectory);
    return json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('traversal')) {
      return error(403, 'Access denied');
    }
    if (isErrnoError(err) && err.code === 'EEXIST') {
      return error(409, 'File or folder already exists');
    }
    console.error('Failed to create note:', err);
    return error(500, 'Failed to create note');
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const path = params.path;
  if (!path) return error(400, 'Path is required');

  try {
    await deleteNote(path);
    return json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('traversal')) {
      return error(403, 'Access denied');
    }
    console.error('Failed to delete note:', err);
    return error(500, 'Failed to delete note');
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const path = params.path;
  if (!isValidRelativePath(path)) return error(400, 'Invalid source path');

  try {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) return error(400, 'Invalid request body');

    const { newPath } = body as { newPath?: unknown };
    if (!isValidRelativePath(newPath)) return error(400, 'Invalid destination path');
    if (newPath === path) return json({ success: true });

    await moveNote(path, newPath);
    return json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('traversal')) {
      return error(403, 'Access denied');
    }
    if (isErrnoError(err) && err.code === 'ENOENT') {
      return error(404, 'Source note or folder not found');
    }
    if (isErrnoError(err) && err.code === 'EEXIST') {
      return error(409, 'Destination already exists');
    }
    console.error('Failed to move note:', err);
    return error(500, 'Failed to move note');
  }
};
