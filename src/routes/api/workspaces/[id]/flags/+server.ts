/**
 * GET  /api/workspaces/[id]/flags  - List flags
 * POST /api/workspaces/[id]/flags  - Create flag
 */

import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const flags = db
    .prepare(
      `
    SELECT f.*, h.ip AS host_ip, h.hostname AS host_hostname
    FROM flags f
    LEFT JOIN hosts h ON h.id = f.host_id
    WHERE f.workspace_id = ?
    ORDER BY f.captured_at ASC
  `,
    )
    .all(params.id);
  return json(flags);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    value?: string;
    host_id?: string;
    flag_type?: string;
    capture_method?: string;
    screenshot_path?: string;
    notes?: string;
  };

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO flags (id, workspace_id, value, host_id, flag_type, capture_method, captured_at, screenshot_path, submitted, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `,
  ).run(
    id,
    params.id,
    body.value ?? "",
    body.host_id ?? null,
    body.flag_type ?? "user",
    body.capture_method ?? "",
    now,
    body.screenshot_path ?? "",
    body.notes ?? "",
  );

  const flag = db
    .prepare(
      `
    SELECT f.*, h.ip AS host_ip, h.hostname AS host_hostname
    FROM flags f LEFT JOIN hosts h ON h.id = f.host_id
    WHERE f.id = ?
  `,
    )
    .get(id);
  return json(flag, { status: 201 });
};
