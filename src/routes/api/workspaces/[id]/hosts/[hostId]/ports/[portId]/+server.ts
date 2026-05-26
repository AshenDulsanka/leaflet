/**
 * DELETE /api/workspaces/[id]/hosts/[hostId]/ports/[portId]
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare("DELETE FROM ports WHERE id = ?")
    .run(params.portId);
  if (result.changes === 0)
    return json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
};
