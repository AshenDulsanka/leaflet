/**
 * GET  /api/templates        - List user templates (global + workspace-scoped)
 * POST /api/templates        - Create a new user template
 */

import { json, error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import type { RequestHandler } from './$types';
import type { UserTemplate } from '$lib/types';

export const GET: RequestHandler = ({ url, locals }) => {
  const { db } = locals;
  const workspaceId = url.searchParams.get('workspaceId');

  let rows: UserTemplate[];
  if (workspaceId) {
    rows = db
      .prepare(
        `SELECT * FROM user_templates
         WHERE workspace_id IS NULL OR workspace_id = ?
         ORDER BY created_at DESC`
      )
      .all(workspaceId) as UserTemplate[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM user_templates WHERE workspace_id IS NULL ORDER BY created_at DESC`
      )
      .all() as UserTemplate[];
  }
  return json(rows);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    title: string;
    description?: string;
    content: string;
    workspaceId?: string | null;
  };

  if (!body.title?.trim()) throw error(400, 'title is required');
  if (!body.content?.trim()) throw error(400, 'content is required');

  const id = randomUUID();
  db.prepare(
    `INSERT INTO user_templates (id, workspace_id, title, description, content)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    id,
    body.workspaceId ?? null,
    body.title.trim(),
    body.description?.trim() ?? '',
    body.content.trim()
  );

  const created = db
    .prepare('SELECT * FROM user_templates WHERE id = ?')
    .get(id) as UserTemplate;
  return json(created, { status: 201 });
};
