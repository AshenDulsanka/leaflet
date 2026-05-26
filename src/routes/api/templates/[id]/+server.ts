/**
 * DELETE /api/templates/[id] - Remove a user template by id
 */

import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare("DELETE FROM user_templates WHERE id = ?")
    .run(params.id);
  if (result.changes === 0) throw error(404, "Template not found");
  return new Response(null, { status: 204 });
};
