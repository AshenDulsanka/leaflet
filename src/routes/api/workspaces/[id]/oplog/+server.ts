/**
 * GET  /api/workspaces/[id]/oplog  - List operation log entries (newest first by timestamp)
 * POST /api/workspaces/[id]/oplog  - Create a new operation log entry
 */

import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
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

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const entries = db
    .prepare(
      `
      SELECT ol.*, h.ip AS host_ip, h.hostname AS host_hostname
      FROM operation_log ol
      LEFT JOIN hosts h ON h.id = ol.host_id
      WHERE ol.workspace_id = ?
      ORDER BY ol.timestamp DESC
    `
    )
    .all(params.id);
  return json(entries);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    category?: string;
    description?: string;
    host_id?: string | null;
    timestamp?: string;
  };

  const description = (body.description ?? '').trim();
  if (!description) {
    return json({ error: 'description is required' }, { status: 400 });
  }

  const category = (body.category ?? 'other') as OpLogCategory;
  if (!VALID_CATEGORIES.has(category)) {
    return json({ error: `Invalid category: ${category}` }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const timestamp = body.timestamp ?? now;

  db.prepare(
    `
    INSERT INTO operation_log (id, workspace_id, category, description, host_id, timestamp, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, params.id, category, description, body.host_id ?? null, timestamp, now, now);

  const entry = db
    .prepare(
      `
    SELECT ol.*, h.ip AS host_ip, h.hostname AS host_hostname
    FROM operation_log ol
    LEFT JOIN hosts h ON h.id = ol.host_id
    WHERE ol.id = ?
  `
    )
    .get(id);

  return json(entry, { status: 201 });
};
