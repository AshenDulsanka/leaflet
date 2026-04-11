/**
 * DELETE /api/workspaces/[id]/topology/edges/[edgeId]
 * Remove a topology connection between two hosts.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare('DELETE FROM topology_edges WHERE id = ? AND workspace_id = ?')
    .run(params.edgeId, params.id);

  if (result.changes === 0) throw error(404, 'Connection not found');
  return new Response(null, { status: 204 });
};
