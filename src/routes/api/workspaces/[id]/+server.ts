/**
 * GET    /api/workspaces/[id]  - Get a single workspace
 * PATCH  /api/workspaces/[id]  - Update workspace fields
 * DELETE /api/workspaces/[id]  - Delete workspace (cascades to all child data)
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { existsSync, mkdirSync, renameSync } from "fs";

import { safePath } from "$lib/server/notes";

const WORKSPACE_NAME_MAX_LENGTH = 255;
const SAFE_NOTES_FOLDER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toSafeNotesFolder(name: string, fallback: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || fallback;
}

function isValidNotesFolder(value: string): boolean {
  if (!value || value.length > 255) return false;
  if (
    value.includes("..") ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0")
  )
    return false;
  return SAFE_NOTES_FOLDER_PATTERN.test(value);
}

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const workspace = db
    .prepare(
      `
    SELECT
      w.*,
      COUNT(DISTINCT h.id) AS host_count,
      COUNT(DISTINCT f.id) AS flag_count
    FROM workspaces w
    LEFT JOIN hosts h ON h.workspace_id = w.id
    LEFT JOIN flags f ON f.workspace_id = w.id
    WHERE w.id = ?
    GROUP BY w.id
  `,
    )
    .get(params.id);

  if (!workspace) return json({ error: "Not found" }, { status: 404 });
  return json(workspace);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  const workspace = db
    .prepare("SELECT * FROM workspaces WHERE id = ?")
    .get(params.id) as
    | { id: string; name: string; notes_folder: string }
    | undefined;
  if (!workspace) return json({ error: "Not found" }, { status: 404 });

  const allowed = [
    "name",
    "type",
    "icon_color",
    "exam_start_date",
    "exam_duration_days",
    "total_flags",
    "passing_flags",
    "sort_order",
  ];
  const updates: string[] = [];
  const values: unknown[] = [];

  const TYPE_ALLOWLIST = new Set(["general", "ctf", "pentest"]);
  if (
    "type" in payload &&
    typeof payload.type === "string" &&
    !TYPE_ALLOWLIST.has(payload.type)
  ) {
    return json({ error: "Invalid workspace type" }, { status: 400 });
  }

  if ("name" in payload) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      return json({ error: "name is required" }, { status: 400 });
    }
    if (payload.name.trim().length > WORKSPACE_NAME_MAX_LENGTH) {
      return json({ error: "name too long" }, { status: 400 });
    }
  }

  const numericFields = new Set([
    "exam_duration_days",
    "total_flags",
    "passing_flags",
    "sort_order",
  ]);
  for (const key of allowed) {
    if (
      key in payload &&
      numericFields.has(key) &&
      !Number.isInteger(payload[key as keyof typeof payload])
    ) {
      return json({ error: `${key} must be an integer` }, { status: 400 });
    }
  }

  const nameChanged =
    typeof payload.name === "string" && payload.name.trim() !== workspace.name;

  const oldNotesFolder = workspace.notes_folder;
  let newNotesFolder = workspace.notes_folder;
  let oldNotesPrefix = `${workspace.notes_folder}/`;
  let sqliteReplaceFromIndex = workspace.notes_folder.length + 1;

  if (nameChanged) {
    const candidate = toSafeNotesFolder(payload.name as string, workspace.id);
    if (!isValidNotesFolder(candidate)) {
      return json({ error: "Invalid workspace slug" }, { status: 400 });
    }

    const conflict = db
      .prepare(
        "SELECT id FROM workspaces WHERE notes_folder = ? AND id != ? LIMIT 1",
      )
      .get(candidate, params.id) as { id: string } | undefined;
    if (conflict) {
      return json({ error: "Workspace slug already exists" }, { status: 409 });
    }

    newNotesFolder = candidate;
    oldNotesPrefix = `${oldNotesFolder}/`;
    sqliteReplaceFromIndex = oldNotesFolder.length + 1;

    if (newNotesFolder !== oldNotesFolder) {
      try {
        safePath(oldNotesFolder);
        safePath(newNotesFolder);
      } catch {
        return json(
          { error: "Invalid workspace folder path" },
          { status: 400 },
        );
      }
    }
  }

  // Column names are safe: allowed is a hardcoded Set; values are parameterised with ?
  for (const key of allowed) {
    if (key in payload) {
      updates.push(`${key} = ?`);
      if (key === "name") {
        values.push((payload.name as string).trim());
      } else {
        values.push(payload[key]);
      }
    }
  }

  if (nameChanged && newNotesFolder !== oldNotesFolder) {
    updates.push("notes_folder = ?");
    values.push(newNotesFolder);
  }

  if (updates.length === 0)
    return json({ error: "No valid fields to update" }, { status: 400 });

  updates.push("updated_at = ?");
  const now = new Date().toISOString();
  values.push(now);
  values.push(params.id);

  const shouldMoveFolder = nameChanged && newNotesFolder !== oldNotesFolder;
  const oldNotesDir = shouldMoveFolder ? safePath(oldNotesFolder) : null;
  const newNotesDir = shouldMoveFolder ? safePath(newNotesFolder) : null;
  let movedOnDisk = false;

  if (shouldMoveFolder && oldNotesDir && newNotesDir) {
    if (existsSync(newNotesDir)) {
      return json(
        { error: "Workspace folder already exists on disk" },
        { status: 409 },
      );
    }

    if (existsSync(oldNotesDir)) {
      renameSync(oldNotesDir, newNotesDir);
      movedOnDisk = true;
    } else {
      mkdirSync(newNotesDir, { recursive: true });
    }
  }

  const updateWorkspace = db.prepare(
    `UPDATE workspaces SET ${updates.join(", ")} WHERE id = ?`,
  );
  const updateSortOrderExact = db.prepare(
    "UPDATE note_sort_order SET note_path = ? WHERE note_path = ?",
  );
  const updateSortOrderNested = db.prepare(
    "UPDATE note_sort_order SET note_path = ? || substr(note_path, ?) WHERE note_path LIKE ?",
  );
  const updateScreenshotLinks = db.prepare(`
    UPDATE screenshot_metadata
    SET linked_note_path = CASE
      WHEN linked_note_path = ? THEN ?
      WHEN linked_note_path LIKE ? THEN ? || substr(linked_note_path, ?)
      ELSE linked_note_path
    END
    WHERE workspace_id = ?
      AND (linked_note_path = ? OR linked_note_path LIKE ?)
  `);
  const updateFindingPaths = db.prepare(`
    UPDATE findings
    SET note_path = CASE
      WHEN note_path = ? THEN ?
      WHEN note_path LIKE ? THEN ? || substr(note_path, ?)
      ELSE note_path
    END
    WHERE workspace_id = ?
      AND (note_path = ? OR note_path LIKE ?)
  `);

  const applyUpdate = db.transaction(() => {
    updateWorkspace.run(...values);

    if (shouldMoveFolder) {
      updateSortOrderExact.run(newNotesFolder, oldNotesFolder);
      updateSortOrderNested.run(
        newNotesFolder,
        sqliteReplaceFromIndex,
        `${oldNotesPrefix}%`,
      );

      updateScreenshotLinks.run(
        oldNotesFolder,
        newNotesFolder,
        `${oldNotesPrefix}%`,
        newNotesFolder,
        sqliteReplaceFromIndex,
        params.id,
        oldNotesFolder,
        `${oldNotesPrefix}%`,
      );

      updateFindingPaths.run(
        oldNotesFolder,
        newNotesFolder,
        `${oldNotesPrefix}%`,
        newNotesFolder,
        sqliteReplaceFromIndex,
        params.id,
        oldNotesFolder,
        `${oldNotesPrefix}%`,
      );
    }
  });

  try {
    applyUpdate();
  } catch (error) {
    if (movedOnDisk && oldNotesDir && newNotesDir) {
      try {
        if (!existsSync(oldNotesDir) && existsSync(newNotesDir)) {
          renameSync(newNotesDir, oldNotesDir);
        }
      } catch (rollbackError) {
        console.error(
          "Failed to rollback workspace folder rename:",
          rollbackError,
        );
      }
    }
    console.error("Failed to update workspace:", error);
    return json({ error: "Failed to update workspace" }, { status: 500 });
  }

  const updatedWorkspace = db
    .prepare("SELECT * FROM workspaces WHERE id = ?")
    .get(params.id);
  if (!updatedWorkspace) return json({ error: "Not found" }, { status: 404 });
  return json(updatedWorkspace);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const result = db
    .prepare("DELETE FROM workspaces WHERE id = ?")
    .run(params.id);
  if (result.changes === 0)
    return json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
};
