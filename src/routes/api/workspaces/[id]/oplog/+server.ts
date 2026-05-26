/**
 * GET  /api/workspaces/[id]/oplog  - List operation log entries (newest first by timestamp)
 * POST /api/workspaces/[id]/oplog  - Create a new operation log entry
 */

import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "@sveltejs/kit";

import {
  parseOpLogCreateBody,
  parseRouteId,
} from "$lib/server/oplog-validation";

function selectEntryById(
  db: App.Locals["db"],
  workspaceId: string,
  entryId: string,
): unknown {
  return db
    .prepare(
      `
      SELECT ol.*, h.ip AS host_ip, h.hostname AS host_hostname
      FROM operation_log ol
      LEFT JOIN hosts h ON h.id = ol.host_id AND h.workspace_id = ol.workspace_id
      WHERE ol.id = ? AND ol.workspace_id = ?
    `,
    )
    .get(entryId, workspaceId);
}

function hostExistsInWorkspace(
  db: App.Locals["db"],
  workspaceId: string,
  hostId: string,
): boolean {
  const row = db
    .prepare("SELECT 1 FROM hosts WHERE id = ? AND workspace_id = ?")
    .get(hostId, workspaceId);

  return row !== undefined;
}

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const workspaceId = parseRouteId(params.id, "workspaceId");
  if (!workspaceId.ok) {
    return json({ error: workspaceId.error }, { status: 400 });
  }

  const entries = db
    .prepare(
      `
      SELECT ol.*, h.ip AS host_ip, h.hostname AS host_hostname
      FROM operation_log ol
      LEFT JOIN hosts h ON h.id = ol.host_id AND h.workspace_id = ol.workspace_id
      WHERE ol.workspace_id = ?
      ORDER BY ol.timestamp DESC
    `,
    )
    .all(workspaceId.data);
  return json(entries);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const workspaceId = parseRouteId(params.id, "workspaceId");
  if (!workspaceId.ok) {
    return json({ error: workspaceId.error }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = parseOpLogCreateBody(rawBody);
  if (!body.ok) {
    return json({ error: body.error }, { status: 400 });
  }

  if (
    body.data.hostId !== null &&
    !hostExistsInWorkspace(db, workspaceId.data, body.data.hostId)
  ) {
    return json(
      { error: "host_id must belong to the workspace" },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO operation_log (id, workspace_id, category, description, host_id, timestamp, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    workspaceId.data,
    body.data.category,
    body.data.description,
    body.data.hostId,
    body.data.timestamp,
    now,
    now,
  );

  const entry = selectEntryById(db, workspaceId.data, id);

  return json(entry, { status: 201 });
};
