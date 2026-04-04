/**
 * GET /api/notes/tree
 * Returns the full directory tree of the notes directory as JSON.
 */

import { json } from '@sveltejs/kit';
import { getNotesDir, readTree } from '$lib/server/notes';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const notesDir = getNotesDir();
    const base = url.searchParams.get('base') ?? '';

    let startDir = notesDir;
    if (base) {
      // Security: resolve and verify the path stays within notesDir
      const { join, resolve } = await import('path');
      const resolved = resolve(join(notesDir, base));
      if (!resolved.startsWith(resolve(notesDir))) {
        return json({ error: 'Invalid base path' }, { status: 400 });
      }
      startDir = resolved;
    }

    const tree = await readTree(startDir, notesDir);
    return json({ tree });
  } catch (error) {
    console.error('Failed to read notes tree:', error);
    return json({ error: 'Failed to read notes directory' }, { status: 500 });
  }
};
