/**
 * GET    /api/workspaces/[id]/variables  - List snippet variables for a workspace
 * POST   /api/workspaces/[id]/variables  - Create/upsert a variable
 * DELETE /api/workspaces/[id]/variables  - Bulk-delete all variables for a workspace
 */

import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const vars = db.prepare('SELECT * FROM snippet_variables WHERE workspace_id = ? ORDER BY name').all(params.id);
  return json(vars);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = await request.json() as { name: string; value?: string };

  if (!body.name?.trim()) return json({ error: 'name is required' }, { status: 400 });

  // Upsert by name
  const existing = db.prepare('SELECT id FROM snippet_variables WHERE workspace_id = ? AND name = ?').get(params.id, body.name.trim()) as { id: string } | undefined;

  if (existing) {
    db.prepare('UPDATE snippet_variables SET value = ? WHERE id = ?').run(body.value ?? '', existing.id);
    const v = db.prepare('SELECT * FROM snippet_variables WHERE id = ?').get(existing.id);
    return json(v);
  }

  const id = randomUUID();
  db.prepare('INSERT INTO snippet_variables (id, workspace_id, name, value) VALUES (?, ?, ?, ?)').run(id, params.id, body.name.trim(), body.value ?? '');
  const v = db.prepare('SELECT * FROM snippet_variables WHERE id = ?').get(id);
  return json(v, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  db.prepare('DELETE FROM snippet_variables WHERE workspace_id = ?').run(params.id);
  return new Response(null, { status: 204 });
};
