/**
 * PATCH  /api/workspaces/[id]/oplog/[entryId] - Update an operation log entry
 * DELETE /api/workspaces/[id]/oplog/[entryId] - Delete an operation log entry
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { OpLogCategory } from '$lib/types';

const VALID_CATEGORIES = new Set<OpLogCategory>([
  'recon',
  'initial-access',
  'exploitation',
  'post-exploitation',
  'lateral-movement',
  'privilege-escalation',
  'exfiltration',
  'cleanup',
  'other',
]);

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as Record<string, unknown>;

  const allowed = ['category', 'description', 'host_id', 'timestamp'];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (!(key in body)) continue;

    if (key === 'category') {
      const cat = body[key] as string;
      if (!VALID_CATEGORIES.has(cat as OpLogCategory)) {
        return json({ error: `Invalid category: ${cat}` }, { status: 400 });
      }
    }

    if (key === 'description') {
      const desc = (body[key] as string).trim();
      if (!desc) return json({ error: 'description cannot be empty' }, { status: 400 });
      updates.push(`description = ?`);
      values.push(desc);
      continue;
    }

    updates.push(`${key} = ?`);
    values.push(body[key]);
  }

  if (updates.length === 0) return json({ error: 'No valid fields to update' }, { status: 400 });

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  values.push(now);

  // Scope delete to workspace to prevent cross-workspace mutation
  values.push(params.entryId, params.id);
  db.prepare(
    `UPDATE operation_log SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`
  ).run(...values);

  const entry = db
    .prepare(
      `
    SELECT ol.*, h.ip AS host_ip, h.hostname AS host_hostname
    FROM operation_log ol
    LEFT JOIN hosts h ON h.id = ol.host_id
    WHERE ol.id = ?
  `
    )
    .get(params.entryId);

  if (!entry) return json({ error: 'Not found' }, { status: 404 });
  return json(entry);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare('DELETE FROM operation_log WHERE id = ? AND workspace_id = ?')
    .run(params.entryId, params.id);
  if (result.changes === 0) return json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
};
