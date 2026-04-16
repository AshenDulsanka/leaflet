/**
 * GET    /api/workspaces/[id]  - Get a single workspace
 * PATCH  /api/workspaces/[id]  - Update workspace fields
 * DELETE /api/workspaces/[id]  - Delete workspace (cascades to all child data)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const workspace = db.prepare(`
    SELECT
      w.*,
      COUNT(DISTINCT h.id) AS host_count,
      COUNT(DISTINCT f.id) AS flag_count
    FROM workspaces w
    LEFT JOIN hosts h ON h.workspace_id = w.id
    LEFT JOIN flags f ON f.workspace_id = w.id
    WHERE w.id = ?
    GROUP BY w.id
  `).get(params.id);

  if (!workspace) return json({ error: 'Not found' }, { status: 404 });
  return json(workspace);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = await request.json() as Record<string, unknown>;

  const allowed = ['name', 'type', 'icon_color', 'exam_start_date', 'exam_duration_days', 'total_flags', 'passing_flags', 'sort_order'];
  const updates: string[] = [];
  const values: unknown[] = [];

  const TYPE_ALLOWLIST = new Set(['general', 'ctf', 'pentest']);
  if ('type' in body && typeof body.type === 'string' && !TYPE_ALLOWLIST.has(body.type)) {
    return json({ error: 'Invalid workspace type' }, { status: 400 });
  }

  const numericFields = new Set(['exam_duration_days', 'total_flags', 'passing_flags', 'sort_order']);
  for (const key of allowed) {
    if (key in body && numericFields.has(key) && !Number.isInteger(body[key as keyof typeof body])) {
      return json({ error: `${key} must be an integer` }, { status: 400 });
    }
  }

  // Column names are safe: allowed is a hardcoded Set; values are parameterised with ?
  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (updates.length === 0) return json({ error: 'No valid fields to update' }, { status: 400 });

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(params.id);

  db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(params.id);
  if (!workspace) return json({ error: 'Not found' }, { status: 404 });
  return json(workspace);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(params.id);
  if (result.changes === 0) return json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
};
