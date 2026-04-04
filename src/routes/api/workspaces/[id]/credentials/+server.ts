/**
 * GET  /api/workspaces/[id]/credentials  - List credentials
 * POST /api/workspaces/[id]/credentials  - Create credential
 */

import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const credentials = db.prepare(`
    SELECT c.*,
      json_group_array(
        CASE WHEN cvh.host_id IS NOT NULL THEN cvh.host_id END
      ) AS valid_host_ids_json
    FROM credentials c
    LEFT JOIN credential_valid_hosts cvh ON cvh.credential_id = c.id
    WHERE c.workspace_id = ?
    GROUP BY c.id
    ORDER BY c.created_at ASC
  `).all(params.id) as Array<Record<string, unknown>>;

  const result = credentials.map((c) => {
    const raw = JSON.parse(c.valid_host_ids_json as string) as (string | null)[];
    return { ...c, valid_host_ids: raw.filter(Boolean), valid_host_ids_json: undefined };
  });

  return json(result);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = await request.json() as {
    username?: string;
    secret?: string;
    credential_type?: string;
    domain?: string;
    source?: string;
    source_host_id?: string;
    status?: string;
    notes?: string;
  };

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO credentials (id, workspace_id, username, secret, credential_type, domain, source, source_host_id, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.id,
    body.username ?? '',
    body.secret ?? '',
    body.credential_type ?? 'password',
    body.domain ?? '',
    body.source ?? '',
    body.source_host_id ?? null,
    body.status ?? 'unknown',
    body.notes ?? '',
    now,
    now
  );

  const cred = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id) as Record<string, unknown>;
  return json({ ...cred, valid_host_ids: [] }, { status: 201 });
};
