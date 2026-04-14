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
  let body: unknown;

  try {
    body = await request.json();
  } catch (err) {
    console.error("[templates] POST invalid JSON payload:", err);
    throw error(400, "Invalid JSON payload");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw error(400, "Invalid request body");
  }

  const bodyRecord = body as Record<string, unknown>;

  const title = bodyRecord.title;
  const description = bodyRecord.description;
  const content = bodyRecord.content;
  const workspaceId = bodyRecord.workspaceId;

  if (typeof title !== "string" || !title.trim()) throw error(400, "title is required");
  if (typeof content !== "string" || !content.trim()) throw error(400, "content is required");
  if (description !== undefined && description !== null && typeof description !== "string") {
    throw error(400, "description must be a string");
  }
  if (workspaceId !== undefined && workspaceId !== null && typeof workspaceId !== "string") {
    throw error(400, "workspaceId must be a string or null");
  }

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const trimmedDescription = typeof description === "string" ? description.trim() : "";
  const trimmedWorkspaceId = typeof workspaceId === "string" ? workspaceId.trim() : workspaceId;

  if (trimmedTitle.length > 255)
    throw error(400, "title too long (max 255)");
  if (trimmedDescription.length > 1000)
    throw error(400, "description too long (max 1000)");
  if (trimmedContent.length > 500_000)
    throw error(400, "content too large (max 500,000 chars)");

  if (trimmedWorkspaceId != null) {
    const wsExists = db
      .prepare("SELECT 1 FROM workspaces WHERE id = ?")
      .get(trimmedWorkspaceId);
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
      trimmedWorkspaceId ?? null,
      trimmedTitle,
      trimmedDescription,
      trimmedContent,
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
