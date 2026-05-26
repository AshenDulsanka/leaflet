/**
 * PATCH  /api/workspaces/[id]/credentials/[credId] - Update credential
 * DELETE /api/workspaces/[id]/credentials/[credId] - Delete credential
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as Record<string, unknown>;

  const allowed = [
    "username",
    "secret",
    "credential_type",
    "domain",
    "source",
    "source_host_id",
    "status",
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

  updates.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(params.credId);

  db.prepare(`UPDATE credentials SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values,
  );

  const cred = db
    .prepare("SELECT * FROM credentials WHERE id = ?")
    .get(params.credId) as Record<string, unknown>;
  const validHostIds = (
    db
      .prepare(
        "SELECT host_id FROM credential_valid_hosts WHERE credential_id = ?",
      )
      .all(params.credId) as { host_id: string }[]
  ).map((r) => r.host_id);
  return json({ ...cred, valid_host_ids: validHostIds });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare("DELETE FROM credentials WHERE id = ? AND workspace_id = ?")
    .run(params.credId, params.id);
  if (result.changes === 0)
    return json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
};
