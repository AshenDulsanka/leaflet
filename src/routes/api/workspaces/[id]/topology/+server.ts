/**
 * GET /api/workspaces/[id]/topology
 * Returns all hosts (with port counts and canvas positions) and topology edges
 * for the given workspace. Used by the Network Topology Diagram panel.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ params, locals }) => {
  const { db } = locals;

  const hosts = db
    .prepare(
      `SELECT h.id, h.workspace_id, h.ip, h.hostname, h.os, h.status,
              h.topo_x, h.topo_y,
              COUNT(p.id) AS port_count
       FROM hosts h
       LEFT JOIN ports p ON p.host_id = h.id
       WHERE h.workspace_id = ?
       GROUP BY h.id
       ORDER BY h.created_at ASC`
    )
    .all(params.id);

  const edges = db
    .prepare(
      `SELECT * FROM topology_edges WHERE workspace_id = ? ORDER BY created_at ASC`
    )
    .all(params.id);

  return json({ hosts, edges });
};
