import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { getDb } from './database.js';

export function getScreenshotsDir(): string {
  const dir = process.env.SCREENSHOTS_DIR;
  if (!dir) throw new Error('SCREENSHOTS_DIR environment variable is not set');
  return resolve(dir);
}

export async function saveScreenshot(buffer: Buffer, extension: string): Promise<string> {
  const dir = getScreenshotsDir();
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}.${extension}`;
  await fs.writeFile(join(dir, filename), buffer);
  return filename;
}

/** Insert a metadata row for a newly uploaded screenshot. */
export function insertScreenshotMetadata(workspaceId: string, filename: string): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO screenshot_metadata (id, workspace_id, filename, caption, linked_note_path)
     VALUES (lower(hex(randomblob(16))), ?, ?, '', '')`
  ).run(workspaceId, filename);
}

/** Return a map of filename → metadata for all screenshots in a workspace. */
export function getScreenshotMetadataForWorkspace(
  workspaceId: string
): Map<string, { id: string; caption: string; linked_note_path: string }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, filename, caption, linked_note_path
         FROM screenshot_metadata
        WHERE workspace_id = ?`
    )
    .all(workspaceId) as {
    id: string;
    filename: string;
    caption: string;
    linked_note_path: string;
  }[];

  const map = new Map<string, { id: string; caption: string; linked_note_path: string }>();
  for (const row of rows) {
    map.set(row.filename, { id: row.id, caption: row.caption, linked_note_path: row.linked_note_path });
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
  patch: { caption?: string; linked_note_path?: string }
): void {
  const db = getDb();

  // Build the SET clause dynamically from the supplied patch keys.
  const sets: string[] = [];
  const values: unknown[] = [];

  if (patch.caption !== undefined) {
    sets.push('caption = ?');
    values.push(patch.caption);
  }
  if (patch.linked_note_path !== undefined) {
    sets.push('linked_note_path = ?');
    values.push(patch.linked_note_path);
  }

  if (sets.length === 0) return;

  values.push(filename, workspaceId);
  db.prepare(
    `UPDATE screenshot_metadata SET ${sets.join(', ')} WHERE filename = ? AND workspace_id = ?`
  ).run(...(values as Parameters<ReturnType<typeof db.prepare>['run']>));
}

/** Delete all metadata rows for a given filename (across all workspaces). */
export function deleteScreenshotMetadata(filename: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM screenshot_metadata WHERE filename = ?`).run(filename);
}
