/**
 * DELETE /api/workspaces/[id]/snippets/[snippetId]
 * PATCH  /api/workspaces/[id]/snippets/[snippetId]
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAX_TITLE_LEN = 200;
const MAX_COMMAND_LEN = 10000;
const MAX_CATEGORY_LEN = 50;
const MAX_DESC_LEN = 2000;

const VALID_CATEGORIES = new Set([
  "general",
  "recon",
  "exploitation",
  "privesc-linux",
  "privesc-windows",
  "pivoting",
  "ad-attacks",
  "file-transfer",
  "credential-attacks",
]);

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  // Include workspace_id check to prevent IDOR; allow deletion of global (NULL) snippets
  const result = db
    .prepare(
      "DELETE FROM command_snippets WHERE id = ? AND (workspace_id = ? OR workspace_id IS NULL)",
    )
    .run(params.snippetId, params.id);
  if (result.changes === 0)
    return json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, command, category, description } = body as Record<
    string,
    unknown
  >;

  if (
    title === undefined &&
    command === undefined &&
    category === undefined &&
    description === undefined
  ) {
    return json({ error: "At least one field is required" }, { status: 400 });
  }

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    return json({ error: "title must be a non-empty string" }, { status: 400 });
  }
  if (title !== undefined && (title as string).trim().length > MAX_TITLE_LEN) {
    return json(
      { error: `title must not exceed ${MAX_TITLE_LEN} characters` },
      { status: 400 },
    );
  }
  if (
    command !== undefined &&
    (typeof command !== "string" || !command.trim())
  ) {
    return json(
      { error: "command must be a non-empty string" },
      { status: 400 },
    );
  }
  if (
    command !== undefined &&
    (command as string).trim().length > MAX_COMMAND_LEN
  ) {
    return json(
      { error: `command must not exceed ${MAX_COMMAND_LEN} characters` },
      { status: 400 },
    );
  }
  if (category !== undefined && typeof category !== "string") {
    return json({ error: "category must be a string" }, { status: 400 });
  }
  if (
    category !== undefined &&
    (category as string).length > MAX_CATEGORY_LEN
  ) {
    return json(
      { error: `category must not exceed ${MAX_CATEGORY_LEN} characters` },
      { status: 400 },
    );
  }
  if (category !== undefined && !VALID_CATEGORIES.has(category as string)) {
    return json({ error: "Invalid category" }, { status: 400 });
  }
  if (description !== undefined && typeof description !== "string") {
    return json({ error: "description must be a string" }, { status: 400 });
  }
  if (
    description !== undefined &&
    (description as string).length > MAX_DESC_LEN
  ) {
    return json(
      { error: `description must not exceed ${MAX_DESC_LEN} characters` },
      { status: 400 },
    );
  }

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (title !== undefined) {
    fields.push("title = ?");
    values.push((title as string).trim());
  }
  if (command !== undefined) {
    fields.push("command = ?");
    values.push((command as string).trim());
  }
  if (category !== undefined) {
    fields.push("category = ?");
    values.push(category as string);
  }
  if (description !== undefined) {
    fields.push("description = ?");
    values.push(description as string);
  }

  // Bind snippetId first, then workspace_id to prevent IDOR
  values.push(params.snippetId ?? null);
  values.push(params.id ?? null);

  const result = db
    .prepare(
      `UPDATE command_snippets SET ${fields.join(", ")} WHERE id = ? AND workspace_id = ?`,
    )
    .run(...values);

  if (result.changes === 0)
    return json({ error: "Not found" }, { status: 404 });

  const snippet = db
    .prepare("SELECT * FROM command_snippets WHERE id = ?")
    .get(params.snippetId) as Record<string, unknown>;

  return json({ ...snippet, tags: JSON.parse(snippet.tags as string) });
};
