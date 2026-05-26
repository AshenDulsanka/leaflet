import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MITRE_ID_RE = /^T\d{4}(\.\d{3})?$/i;

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const db = locals.db;
  const body = (await request.json()) as {
    label?: string;
    node_type?: string;
    x?: number;
    y?: number;
    host_id?: string | null;
    metadata?: Record<string, unknown>;
    timestamp?: string | null;
    mitre_technique_id?: string;
    mitre_technique_name?: string;
  };

  const node = db
    .prepare(
      "SELECT id FROM attack_chain_nodes WHERE id = ? AND workspace_id = ?",
    )
    .get(params.nodeId, params.id);
  if (!node) throw error(404, "Node not found");

  // Validate MITRE technique ID format when provided and non-empty
  if (body.mitre_technique_id !== undefined && body.mitre_technique_id !== "") {
    if (!MITRE_ID_RE.test(body.mitre_technique_id)) {
      throw error(400, "Invalid MITRE technique ID format");
    }
  }

  const allowed = [
    "label",
    "node_type",
    "x",
    "y",
    "host_id",
    "metadata",
    "timestamp",
    "mitre_technique_id",
    "mitre_technique_name",
  ] as const;
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      updates.push(`${key} = ?`);
      values.push(
        key === "metadata" && body.metadata
          ? JSON.stringify(body.metadata)
          : body[key],
      );
    }
  }

  if (updates.length === 0) throw error(400, "No fields to update");

  values.push(params.nodeId);
  db.prepare(
    `UPDATE attack_chain_nodes SET ${updates.join(", ")} WHERE id = ?`,
  ).run(...values);

  const updated = db
    .prepare("SELECT * FROM attack_chain_nodes WHERE id = ?")
    .get(params.nodeId);
  return json(updated);
};

export const DELETE: RequestHandler = ({ locals, params }) => {
  const db = locals.db;
  db.prepare(
    "DELETE FROM attack_chain_nodes WHERE id = ? AND workspace_id = ?",
  ).run(params.nodeId, params.id);
  return new Response(null, { status: 204 });
};
