import { promises as fs } from "fs";
import { resolve, join, dirname } from "path";
import { getDb } from "./database.js";

const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const SAFE_EXTENSION = /^[a-z0-9]+$/;

export function getScreenshotsDir(): string {
  const dir = process.env.SCREENSHOTS_DIR;
  if (!dir) throw new Error("SCREENSHOTS_DIR environment variable is not set");
  return resolve(dir);
}

export async function saveScreenshot(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  const dir = getScreenshotsDir();
  await fs.mkdir(dir, { recursive: true });
  const normalizedExtension = extension.trim().toLowerCase();
  if (
    normalizedExtension.length === 0 ||
    normalizedExtension.includes("/") ||
    normalizedExtension.includes("\\") ||
    normalizedExtension.includes("..") ||
    !SAFE_EXTENSION.test(normalizedExtension) ||
    !ALLOWED_EXTENSIONS.has(normalizedExtension)
  ) {
    throw new Error("Invalid screenshot extension");
  }

  const filename = `${Date.now()}.${normalizedExtension}`;
  await fs.writeFile(join(dir, filename), buffer);
  return filename;
}

/** Insert a metadata row for a newly uploaded screenshot. */
export function insertScreenshotMetadata(
  workspaceId: string,
  filename: string,
): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO screenshot_metadata (id, workspace_id, filename, caption, linked_note_path)
     VALUES (lower(hex(randomblob(16))), ?, ?, '', '')`,
  ).run(workspaceId, filename);
}

/** Return a map of filename → metadata for all screenshots in a workspace. */
export function getScreenshotMetadataForWorkspace(
  workspaceId: string,
): Map<string, { id: string; caption: string; linked_note_path: string }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, filename, caption, linked_note_path
         FROM screenshot_metadata
        WHERE workspace_id = ?`,
    )
    .all(workspaceId) as {
    id: string;
    filename: string;
    caption: string;
    linked_note_path: string;
  }[];

  const map = new Map<
    string,
    { id: string; caption: string; linked_note_path: string }
  >();
  for (const row of rows) {
    map.set(row.filename, {
      id: row.id,
      caption: row.caption,
      linked_note_path: row.linked_note_path,
    });
  }
  return map;
}

/**
 * Upsert caption / linked_note_path for a screenshot.
 * Only the supplied fields in `patch` are updated.
 */
export function updateScreenshotMetadata(
  filename: string,
  workspaceId: string,
  patch: { caption?: string; linked_note_path?: string },
): void {
  const db = getDb();

  // Build the SET clause dynamically from the supplied patch keys.
  const sets: string[] = [];
  const values: unknown[] = [];

  if (patch.caption !== undefined) {
    sets.push("caption = ?");
    values.push(patch.caption);
  }
  if (patch.linked_note_path !== undefined) {
    sets.push("linked_note_path = ?");
    values.push(patch.linked_note_path);
  }

  if (sets.length === 0) return;

  values.push(filename, workspaceId);
  db.prepare(
    `UPDATE screenshot_metadata SET ${sets.join(", ")} WHERE filename = ? AND workspace_id = ?`,
  ).run(...(values as Parameters<ReturnType<typeof db.prepare>["run"]>));
}

/** Delete metadata rows for a given filename, optionally scoped to a workspace. */
export function deleteScreenshotMetadata(
  filename: string,
  workspaceId?: string,
): void {
  const db = getDb();
  if (workspaceId) {
    db.prepare(
      `DELETE FROM screenshot_metadata WHERE filename = ? AND workspace_id = ?`,
    ).run(filename, workspaceId);
  } else {
    db.prepare(`DELETE FROM screenshot_metadata WHERE filename = ?`).run(
      filename,
    );
  }
}

/**
 * Rename a screenshot file on disk and update its filename in the DB.
 * newBaseName must be a safe slug (validated by caller).
 */
export async function renameScreenshotFile(
  oldFilename: string,
  newBaseName: string,
  workspaceId: string,
): Promise<string> {
  const dir = getScreenshotsDir();
  const extMatch = oldFilename.match(/\.([a-z0-9]+)$/i);
  if (!extMatch)
    throw new Error("Cannot determine extension from old filename");
  const ext = extMatch[1].toLowerCase();
  const newFilename = `${newBaseName}.${ext}`;
  const newPath = resolve(dir, newFilename);
  // Traversal check on new path
  if (dirname(newPath) !== dir) {
    throw new Error("Invalid new filename: path traversal detected");
  }
  const oldPath = resolve(dir, oldFilename);
  // Traversal check on old path
  if (dirname(oldPath) !== dir)
    throw new Error("Invalid old filename: path traversal detected");

  // Ownership check: screenshot must belong to this workspace
  const db = getDb();
  const row = db
    .prepare(
      `SELECT filename FROM screenshot_metadata WHERE filename = ? AND workspace_id = ?`,
    )
    .get(oldFilename, workspaceId) as { filename: string } | undefined;
  if (!row) throw new Error("Screenshot not found or access denied");

  // Check for collision before rename
  try {
    await fs.access(newPath);
    // File exists → throw EEXIST so caller can return 409
    const err = Object.assign(new Error("File already exists"), {
      code: "EEXIST",
    });
    throw err;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    // ENOENT → safe to proceed
  }

  // Atomic rename: DB first (easy to revert), then FS
  db.prepare(
    `UPDATE screenshot_metadata SET filename = ? WHERE filename = ? AND workspace_id = ?`,
  ).run(newFilename, oldFilename, workspaceId);
  try {
    await fs.rename(oldPath, newPath);
  } catch (e) {
    // Revert DB on FS failure
    db.prepare(
      `UPDATE screenshot_metadata SET filename = ? WHERE filename = ? AND workspace_id = ?`,
    ).run(oldFilename, newFilename, workspaceId);
    throw e;
  }
  return newFilename;
}

/** Return the list of filenames recorded for a given workspace. */
export function getScreenshotFilenamesForWorkspace(
  workspaceId: string,
): string[] {
  const db = getDb();
  return (
    db
      .prepare(
        "SELECT filename FROM screenshot_metadata WHERE workspace_id = ?",
      )
      .all(workspaceId) as { filename: string }[]
  ).map((r) => r.filename);
}
