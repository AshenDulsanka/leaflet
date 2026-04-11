/**
 * PATCH  /api/workspaces/[id]/findings/[findingId] - Update a finding
 * DELETE /api/workspaces/[id]/findings/[findingId] - Delete a finding
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { FindingSeverity, FindingStatus } from '$lib/types';

const VALID_SEVERITIES = new Set<FindingSeverity>([
  'critical',
  'high',
  'medium',
  'low',
  'info',
  'none',
]);

const VALID_STATUSES = new Set<FindingStatus>([
  'open',
  'confirmed',
  'remediated',
  'false-positive',
]);

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as Record<string, unknown>;

  const allowed = [
    'title',
    'description',
    'severity',
    'status',
    'cvss_score',
    'cvss_vector',
    'host_id',
    'note_path',
  ];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (!(key in body)) continue;

    if (key === 'title') {
      const val = (body[key] as string).trim();
      if (!val) return json({ error: 'title cannot be empty' }, { status: 400 });
      updates.push(`title = ?`);
      values.push(val);
      continue;
    }

    if (key === 'description') {
      updates.push(`description = ?`);
      values.push((body[key] as string).trim());
      continue;
    }

    if (key === 'severity') {
      const val = body[key] as string;
      if (!VALID_SEVERITIES.has(val as FindingSeverity)) {
        return json({ error: `Invalid severity: ${val}` }, { status: 400 });
      }
    }

    if (key === 'status') {
      const val = body[key] as string;
      if (!VALID_STATUSES.has(val as FindingStatus)) {
        return json({ error: `Invalid status: ${val}` }, { status: 400 });
      }
    }

    if (key === 'cvss_score') {
      const val = body[key] as number;
      if (typeof val !== 'number' || val < 0 || val > 10) {
        return json({ error: 'cvss_score must be a number between 0 and 10' }, { status: 400 });
      }
    }

    if (key === 'note_path' || key === 'cvss_vector') {
      updates.push(`${key} = ?`);
      values.push((body[key] as string).trim());
      continue;
    }

    updates.push(`${key} = ?`);
    values.push(body[key]);
  }

  if (updates.length === 0) return json({ error: 'No valid fields to update' }, { status: 400 });

  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  values.push(now);

  // Scope update to workspace to prevent cross-workspace mutation
  values.push(params.findingId, params.id);
  db.prepare(
    `UPDATE findings SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`
  ).run(...values);

  const finding = db
    .prepare(
      `
    SELECT f.*, h.ip AS host_ip, h.hostname AS host_hostname
    FROM findings f
    LEFT JOIN hosts h ON h.id = f.host_id
    WHERE f.id = ?
  `
    )
    .get(params.findingId);

  if (!finding) return json({ error: 'Not found' }, { status: 404 });
  return json(finding);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare('DELETE FROM findings WHERE id = ? AND workspace_id = ?')
    .run(params.findingId, params.id);
  if (result.changes === 0) return json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
};
