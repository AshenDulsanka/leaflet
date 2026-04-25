/**
 * GET /api/notes/tree
 * Returns the full directory tree of the notes directory as JSON.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

import { join, resolve } from 'path';

import { getDb } from '$lib/server/database';
import { getNotesDir, readTree, sortTreeNodes } from '$lib/server/notes';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const notesDir = getNotesDir();
    const base = url.searchParams.get('base') ?? '';

    let startDir = notesDir;
    if (base) {
      // Security: resolve and verify the path stays within notesDir
      const resolved = resolve(join(notesDir, base));
      if (!resolved.startsWith(resolve(notesDir))) {
        return json({ error: 'Invalid base path' }, { status: 400 });
      }
      startDir = resolved;
    }

    const tree = await readTree(startDir, notesDir);

    let sortedTree = tree;
    try {
      const db = getDb();
      const rows = db
        .prepare('SELECT note_path, sort_order FROM note_sort_order')
        .all() as { note_path: string; sort_order: number }[];
      const sortMap = new Map<string, number>(rows.map((r) => [r.note_path, r.sort_order]));
      sortedTree = sortTreeNodes(tree, sortMap);
    } catch (sortErr) {
      console.error('Failed to load sort orders; returning unsorted tree:', sortErr);
    }

    return json({ tree: sortedTree });
  } catch (error) {
    console.error('Failed to read notes tree:', error);
    return json({ error: 'Failed to read notes directory' }, { status: 500 });
  }
};
