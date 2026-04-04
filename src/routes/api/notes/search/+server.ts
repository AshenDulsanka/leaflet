/**
 * GET /api/notes/search?q=<query>
 * Full-text search across all .md files in the notes directory.
 */

import { json } from '@sveltejs/kit';
import { searchNotes } from '$lib/server/notes';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');
  if (!query || query.trim().length < 2) {
    return json([]);
  }

  try {
    const results = await searchNotes(query.trim());
    return json(results);
  } catch (error) {
    console.error('Search failed:', error);
    return json([], { status: 500 });
  }
};
