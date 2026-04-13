/**
 * GET  /api/templates        - List user templates (global + workspace-scoped)
 * POST /api/templates        - Create a new user template
 */

import { json, error } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "./$types";
import type { UserTemplate } from "$lib/types";

export const GET: RequestHandler = ({ url, locals }) => {
  const { db } = locals;
  const workspaceId = url.searchParams.get("workspaceId");

  let rows: UserTemplate[];
  if (workspaceId) {
    rows = db
      .prepare(
        `SELECT * FROM user_templates
         WHERE workspace_id IS NULL OR workspace_id = ?
         ORDER BY created_at DESC`,
      )
      .all(workspaceId) as UserTemplate[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM user_templates WHERE workspace_id IS NULL ORDER BY created_at DESC`,
      )
      .all() as UserTemplate[];
  }
  return json(rows);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    title: string;
    description?: string;
    content: string;
    workspaceId?: string | null;
  };

  if (!body.title?.trim()) throw error(400, "title is required");
  if (!body.content?.trim()) throw error(400, "content is required");
  if (body.title.trim().length > 255)
    throw error(400, "title too long (max 255)");
  if ((body.description ?? "").length > 1000)
    throw error(400, "description too long (max 1000)");
  if (body.content.trim().length > 500_000)
    throw error(400, "content too large (max 500,000 chars)");

  if (body.workspaceId != null) {
    const wsExists = db
      .prepare("SELECT 1 FROM workspaces WHERE id = ?")
      .get(body.workspaceId);
    if (!wsExists) {
      throw error(400, "workspaceId does not reference a known workspace");
    }
  }

  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO user_templates (id, workspace_id, title, description, content)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.workspaceId ?? null,
      body.title.trim(),
      body.description?.trim() ?? "",
      body.content.trim(),
    );
  } catch (err) {
    console.error("[templates] POST failed:", err);
    throw error(500, "Failed to create template");
  }

  const created = db
    .prepare("SELECT * FROM user_templates WHERE id = ?")
    .get(id) as UserTemplate;
  return json(created, { status: 201 });
};
