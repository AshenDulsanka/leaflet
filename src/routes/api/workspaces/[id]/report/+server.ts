import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params }) => {
  const db = locals.db;

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(params.id) as Record<string, unknown> | undefined;
  if (!workspace) return json({ error: 'Workspace not found' }, { status: 404 });

  const hosts = db.prepare(`
    SELECT h.*, json_group_array(
      CASE WHEN p.id IS NOT NULL THEN json_object('number', p.number, 'protocol', p.protocol, 'service', p.service, 'state', p.state) END
    ) as ports_json
    FROM hosts h
    LEFT JOIN ports p ON p.host_id = h.id
    WHERE h.workspace_id = ?
    GROUP BY h.id
    ORDER BY h.ip
  `).all(params.id) as Array<Record<string, unknown>>;

  const credentials = db.prepare(`
    SELECT * FROM credentials WHERE workspace_id = ? ORDER BY username
  `).all(params.id) as Array<Record<string, unknown>>;

  const flags = db.prepare(`
    SELECT f.*, h.ip, h.hostname FROM flags f
    LEFT JOIN hosts h ON h.id = f.host_id
    WHERE f.workspace_id = ?
    ORDER BY f.flag_type, f.captured_at
  `).all(params.id) as Array<Record<string, unknown>>;

  return json({ workspace, hosts, credentials, flags });
};
