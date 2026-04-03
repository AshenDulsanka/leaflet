import { json, error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const db = locals.db;
  const body = await request.json() as {
    source_node_id: string;
    target_node_id: string;
    label?: string;
    technique?: string;
  };

  if (!body.source_node_id || !body.target_node_id) {
    throw error(400, 'source_node_id and target_node_id are required');
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO attack_chain_edges (id, workspace_id, source_node_id, target_node_id, label, technique)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.id,
    body.source_node_id,
    body.target_node_id,
    body.label ?? '',
    body.technique ?? ''
  );

  const edge = db.prepare('SELECT * FROM attack_chain_edges WHERE id = ?').get(id);
  return json(edge, { status: 201 });
};

export const DELETE: RequestHandler = ({ locals, params, url }) => {
  const db = locals.db;
  const edgeId = url.searchParams.get('edgeId');
  if (!edgeId) throw error(400, 'edgeId query param required');
  db.prepare('DELETE FROM attack_chain_edges WHERE id = ? AND workspace_id = ?')
    .run(edgeId, params.id);
  return new Response(null, { status: 204 });
};
