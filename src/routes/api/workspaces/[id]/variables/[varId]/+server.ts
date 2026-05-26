/**
 * DELETE /api/workspaces/[id]/variables/[varId] - Delete a single variable (workspace-scoped)
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;

  // Enforce workspace scoping before deleting
  const existing = db
    .prepare(
      "SELECT id FROM snippet_variables WHERE id = ? AND workspace_id = ?",
    )
    .get(params.varId, params.id) as { id: string } | undefined;

  if (!existing) return json({ error: "Not found" }, { status: 404 });

  db.prepare("DELETE FROM snippet_variables WHERE id = ?").run(params.varId);
  return new Response(null, { status: 204 });
};
