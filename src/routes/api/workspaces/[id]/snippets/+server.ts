/**
 * GET  /api/workspaces/[id]/snippets  - List snippets (workspace + global)
 * POST /api/workspaces/[id]/snippets  - Create snippet (scoped to workspace)
 *
 * GET  /api/workspaces/global/snippets - List global (unscoped) snippets
 */

import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  // Return workspace-scoped snippets + global snippets (workspace_id IS NULL)
  const snippets = db.prepare(`
    SELECT * FROM command_snippets
    WHERE workspace_id = ? OR workspace_id IS NULL
    ORDER BY category, title
  `).all(params.id);
  return json(snippets);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = await request.json() as {
    category?: string;
    title: string;
    command: string;
    description?: string;
    tags?: string[];
    global?: boolean;
  };

  if (!body.title?.trim() || !body.command?.trim()) {
    return json({ error: 'title and command are required' }, { status: 400 });
  }

  const id = randomUUID();
  const workspaceId = body.global ? null : params.id;

  db.prepare(`
    INSERT INTO command_snippets (id, workspace_id, category, title, command, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    body.category ?? 'general',
    body.title.trim(),
    body.command.trim(),
    body.description ?? '',
    JSON.stringify(body.tags ?? [])
  );

  const snippet = db.prepare('SELECT * FROM command_snippets WHERE id = ?').get(id) as Record<string, unknown>;
  return json({ ...snippet, tags: JSON.parse(snippet.tags as string) }, { status: 201 });
};
