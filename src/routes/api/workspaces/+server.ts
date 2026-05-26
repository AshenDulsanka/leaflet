/**
 * GET  /api/workspaces        - List all workspaces with host/flag counts
 * POST /api/workspaces        - Create a new workspace
 */

import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { safePath } from "$lib/server/notes.js";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ locals }) => {
  const { db } = locals;
  const workspaces = db
    .prepare(
      `
    SELECT
      w.*,
      COUNT(DISTINCT h.id) AS host_count,
      COUNT(DISTINCT f.id) AS flag_count
    FROM workspaces w
    LEFT JOIN hosts h ON h.workspace_id = w.id
    LEFT JOIN flags f ON f.workspace_id = w.id
    GROUP BY w.id
    ORDER BY w.sort_order ASC, w.created_at ASC
  `,
    )
    .all();
  return json(workspaces);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    name: string;
    type?: string;
    icon_color?: string;
    exam_start_date?: string;
    exam_duration_days?: number;
    total_flags?: number;
    passing_flags?: number;
    preset?: string | null;
  };

  if (!body.name?.trim()) {
    return json({ error: "name is required" }, { status: 400 });
  }

  // Only 'cpts' is a valid preset; anything else (including undefined/null) is treated as no preset.
  const VALID_PRESETS = ["cpts"] as const;
  if (
    body.preset !== undefined &&
    body.preset !== null &&
    !(VALID_PRESETS as readonly string[]).includes(body.preset)
  ) {
    return json(
      { error: `Invalid preset. Allowed values: ${VALID_PRESETS.join(", ")}` },
      { status: 400 },
    );
  }
  const preset: string | null = body.preset ?? null;

  const id = randomUUID();
  const now = new Date().toISOString();
  const notes_folder =
    body.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || id;

  db.prepare(
    `
    INSERT INTO workspaces (id, name, type, icon_color, exam_start_date, exam_duration_days, total_flags, passing_flags, notes_folder, preset, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    body.name.trim(),
    body.type ?? "general",
    body.icon_color ?? "#6366f1",
    body.exam_start_date ?? null,
    body.exam_duration_days ?? 10,
    body.total_flags ?? 0,
    body.passing_flags ?? 0,
    notes_folder,
    preset,
    0,
    now,
    now,
  );

  // Create the notes subfolder on disk
  try {
    const dir = safePath(notes_folder);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      // Mark the empty workspace folder so git tracks it
      writeFileSync(join(dir, ".gitkeep"), "");
    }
  } catch (err) {
    console.error("[workspaces POST] Failed to create notes folder:", err);
    // Non-fatal: workspace is created in DB, folder will be created on first use
  }

  const workspace = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id);
  return json(workspace, { status: 201 });
};
