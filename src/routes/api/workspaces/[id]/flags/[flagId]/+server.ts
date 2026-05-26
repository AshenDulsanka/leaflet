/**
 * PATCH  /api/workspaces/[id]/flags/[flagId] - Update flag (e.g., mark submitted)
 * DELETE /api/workspaces/[id]/flags/[flagId] - Delete flag
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as Record<string, unknown>;

  const allowed = [
    "value",
    "host_id",
    "flag_type",
    "capture_method",
    "screenshot_path",
    "submitted",
    "notes",
  ];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (updates.length === 0)
    return json({ error: "No valid fields" }, { status: 400 });

  values.push(params.flagId);
  db.prepare(`UPDATE flags SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values,
  );

  const flag = db
    .prepare(
      `
    SELECT f.*, h.ip AS host_ip, h.hostname AS host_hostname
    FROM flags f LEFT JOIN hosts h ON h.id = f.host_id
    WHERE f.id = ?
  `,
    )
    .get(params.flagId);
  return json(flag);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare("DELETE FROM flags WHERE id = ? AND workspace_id = ?")
    .run(params.flagId, params.id);
  if (result.changes === 0)
    return json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
};
