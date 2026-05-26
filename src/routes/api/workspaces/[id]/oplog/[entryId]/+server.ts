/**
 * PATCH  /api/workspaces/[id]/oplog/[entryId] - Update an operation log entry
 * DELETE /api/workspaces/[id]/oplog/[entryId] - Delete an operation log entry
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

import { parseOpLogPatchBody, parseRouteId } from '$lib/server/oplog-validation';

function selectEntryById(db: App.Locals['db'], workspaceId: string, entryId: string): unknown {
  return db
    .prepare(
      `
      SELECT ol.*, h.ip AS host_ip, h.hostname AS host_hostname
      FROM operation_log ol
      LEFT JOIN hosts h ON h.id = ol.host_id AND h.workspace_id = ol.workspace_id
      WHERE ol.id = ? AND ol.workspace_id = ?
    `
    )
    .get(entryId, workspaceId);
}

function hostExistsInWorkspace(db: App.Locals['db'], workspaceId: string, hostId: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM hosts WHERE id = ? AND workspace_id = ?')
    .get(hostId, workspaceId);

  return row !== undefined;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const workspaceId = parseRouteId(params.id, 'workspaceId');
  if (!workspaceId.ok) {
    return json({ error: workspaceId.error }, { status: 400 });
  }

  const entryId = parseRouteId(params.entryId, 'entryId');
  if (!entryId.ok) {
    return json({ error: entryId.error }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const body = parseOpLogPatchBody(rawBody);
  if (!body.ok) {
    return json({ error: body.error }, { status: 400 });
  }

  if (body.data.hostId !== undefined && body.data.hostId !== null) {
    if (!hostExistsInWorkspace(db, workspaceId.data, body.data.hostId)) {
      return json({ error: 'host_id must belong to the workspace' }, { status: 400 });
    }
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.data.category !== undefined) {
    updates.push('category = ?');
    values.push(body.data.category);
  }

  if (body.data.description !== undefined) {
    updates.push('description = ?');
    values.push(body.data.description);
  }

  if ('hostId' in body.data) {
    updates.push('host_id = ?');
    values.push(body.data.hostId);
  }

  if (body.data.timestamp !== undefined) {
    updates.push('timestamp = ?');
    values.push(body.data.timestamp);
  }

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  values.push(now);

  values.push(entryId.data, workspaceId.data);
  const result = db
    .prepare(`UPDATE operation_log SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`)
    .run(...values);

  if (result.changes === 0) return json({ error: 'Not found' }, { status: 404 });

  const entry = selectEntryById(db, workspaceId.data, entryId.data);
  return json(entry);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const workspaceId = parseRouteId(params.id, 'workspaceId');
  if (!workspaceId.ok) {
    return json({ error: workspaceId.error }, { status: 400 });
  }

  const entryId = parseRouteId(params.entryId, 'entryId');
  if (!entryId.ok) {
    return json({ error: entryId.error }, { status: 400 });
  }

  const result = db
    .prepare('DELETE FROM operation_log WHERE id = ? AND workspace_id = ?')
    .run(entryId.data, workspaceId.data);
  if (result.changes === 0) return json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
};
