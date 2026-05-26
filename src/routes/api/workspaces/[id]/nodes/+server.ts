import { json, error } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ locals, params }) => {
  const db = locals.db;
  const nodes = db
    .prepare(
      `
    SELECT n.*, h.ip, h.hostname
    FROM attack_chain_nodes n
    LEFT JOIN hosts h ON h.id = n.host_id
    WHERE n.workspace_id = ?
    ORDER BY n.id
  `,
    )
    .all(params.id);

  const edges = db
    .prepare(
      `
    SELECT * FROM attack_chain_edges WHERE workspace_id = ?
    ORDER BY id
  `,
    )
    .all(params.id);

  return json({ nodes, edges });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const db = locals.db;
  const body = (await request.json()) as {
    label: string;
    node_type?: string;
    x?: number;
    y?: number;
    host_id?: string | null;
    metadata?: Record<string, unknown>;
  };

  if (!body.label?.trim()) {
    throw error(400, "label is required");
  }

  const id = randomUUID();
  db.prepare(
    `
    INSERT INTO attack_chain_nodes (id, workspace_id, label, node_type, x, y, host_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    params.id,
    body.label.trim(),
    body.node_type ?? "action",
    body.x ?? 0,
    body.y ?? 0,
    body.host_id ?? null,
    body.metadata ? JSON.stringify(body.metadata) : "{}",
  );

  const node = db
    .prepare("SELECT * FROM attack_chain_nodes WHERE id = ?")
    .get(id);
  return json(node, { status: 201 });
};
