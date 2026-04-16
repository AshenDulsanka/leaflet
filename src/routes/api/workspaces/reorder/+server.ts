/**
 * PATCH /api/workspaces/reorder
 * Accepts { order: string[] } — an array of workspace IDs in the desired display order.
 * Sets each workspace's sort_order to its index position (0-based) in a single transaction.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const { db } = locals;
  const body = await request.json() as { order?: unknown };

  if (!Array.isArray(body.order)) {
    return json({ error: 'order must be an array of workspace IDs' }, { status: 400 });
  }

  const MAX_WORKSPACE_COUNT = 200;
  if (body.order.length > MAX_WORKSPACE_COUNT) {
    return json({ error: `order exceeds maximum of ${MAX_WORKSPACE_COUNT} items` }, { status: 400 });
  }

  const order = body.order as unknown[];

  // Validate every entry is a non-empty string
  for (const item of order) {
    if (typeof item !== 'string' || !item.trim()) {
      return json({ error: 'Each item in order must be a non-empty string workspace ID' }, { status: 400 });
    }
  }

  const ids = [...new Set(order as string[])];

  // Verify all provided IDs exist in the database before committing changes
  const stmt = db.prepare('SELECT id FROM workspaces WHERE id = ?');
  for (const id of ids) {
    const row = stmt.get(id) as { id: string } | undefined;
    if (!row) {
      return json({ error: 'One or more workspace IDs not found' }, { status: 404 });
    }
  }

  const updateStmt = db.prepare('UPDATE workspaces SET sort_order = ?, updated_at = ? WHERE id = ?');
  const now = new Date().toISOString();

  const reorder = db.transaction(() => {
    for (let i = 0; i < ids.length; i++) {
      updateStmt.run(i, now, ids[i]);
    }
  });
  reorder();

  return json({ updated: ids.length });
};
