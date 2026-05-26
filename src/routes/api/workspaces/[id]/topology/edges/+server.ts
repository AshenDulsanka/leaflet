/**
 * POST /api/workspaces/[id]/topology/edges
 * Create a directed connection between two hosts in the network topology.
 */

import { json, error } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    source_host_id?: unknown;
    target_host_id?: unknown;
    label?: unknown;
  };

  if (!body.source_host_id || !body.target_host_id) {
    throw error(400, "source_host_id and target_host_id are required");
  }

  const sourceId = String(body.source_host_id);
  const targetId = String(body.target_host_id);

  if (sourceId === targetId) {
    throw error(400, "Self-loops are not allowed");
  }

  // Verify both hosts belong to this workspace
  const srcHost = db
    .prepare("SELECT id FROM hosts WHERE id = ? AND workspace_id = ?")
    .get(sourceId, params.id);
  const tgtHost = db
    .prepare("SELECT id FROM hosts WHERE id = ? AND workspace_id = ?")
    .get(targetId, params.id);

  if (!srcHost || !tgtHost) {
    throw error(404, "One or both hosts not found in this workspace");
  }

  const id = randomUUID();
  const label = typeof body.label === "string" ? body.label : "";

  try {
    db.prepare(
      `INSERT INTO topology_edges (id, workspace_id, source_host_id, target_host_id, label)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, params.id, sourceId, targetId, label);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
      throw error(409, "Connection already exists");
    }
    throw e;
  }

  const edge = db.prepare("SELECT * FROM topology_edges WHERE id = ?").get(id);
  return json(edge, { status: 201 });
};
