/**
 * GET  /api/workspaces        - List all workspaces with host/flag counts
 * POST /api/workspaces        - Create a new workspace
 */

import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
  const { db } = locals;
  const workspaces = db.prepare(`
    SELECT
      w.*,
      COUNT(DISTINCT h.id) AS host_count,
      COUNT(DISTINCT f.id) AS flag_count
    FROM workspaces w
    LEFT JOIN hosts h ON h.workspace_id = w.id
    LEFT JOIN flags f ON f.workspace_id = w.id
    GROUP BY w.id
    ORDER BY w.created_at DESC
  `).all();
  return json(workspaces);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const { db } = locals;
  const body = await request.json() as {
    name: string;
    type?: string;
    icon_color?: string;
    exam_start_date?: string;
    exam_duration_days?: number;
    total_flags?: number;
    passing_flags?: number;
  };

  if (!body.name?.trim()) {
    return json({ error: 'name is required' }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const notes_folder = body.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || id;

  db.prepare(`
    INSERT INTO workspaces (id, name, type, icon_color, exam_start_date, exam_duration_days, total_flags, passing_flags, notes_folder, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name.trim(),
    body.type ?? 'exam',
    body.icon_color ?? '#6366f1',
    body.exam_start_date ?? null,
    body.exam_duration_days ?? 10,
    body.total_flags ?? 0,
    body.passing_flags ?? 0,
    notes_folder,
    now,
    now
  );

  // Create the notes subfolder on disk
  const notesDir = process.env.NOTES_DIR;
  if (notesDir) {
    const dir = join(notesDir, notes_folder);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  return json(workspace, { status: 201 });
};
