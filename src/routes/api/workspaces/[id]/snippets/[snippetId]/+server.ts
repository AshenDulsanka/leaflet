/**
 * DELETE /api/workspaces/[id]/snippets/[snippetId]
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db.prepare('DELETE FROM command_snippets WHERE id = ?').run(params.snippetId);
  if (result.changes === 0) return json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
};
