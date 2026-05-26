/**
 * POST /api/screenshots - upload a screenshot blob and return its URL
 * GET  /api/screenshots  - list all screenshots in SCREENSHOTS_DIR
 */

import { json, error } from "@sveltejs/kit";
import { promises as fs } from "fs";
import { join } from "path";
import {
  saveScreenshot,
  getScreenshotsDir,
  insertScreenshotMetadata,
  getScreenshotMetadataForWorkspace,
  getScreenshotFilenamesForWorkspace,
} from "$lib/server/screenshots";
import type { ScreenshotMeta } from "$lib/types";
import type { RequestHandler } from "./$types";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*\.(png|jpg|jpeg|gif|webp)$/;

export const GET: RequestHandler = async ({ url }) => {
  const workspaceIdParam = url.searchParams.get("workspaceId");

  if (workspaceIdParam !== null) {
    if (workspaceIdParam.trim() === "") {
      return error(400, "workspaceId must not be empty");
    }
    // Workspace-scoped: only return screenshots that belong to this workspace
    try {
      const filenames = getScreenshotFilenamesForWorkspace(workspaceIdParam);
      const metaMap = getScreenshotMetadataForWorkspace(workspaceIdParam);
      const dir = getScreenshotsDir();
      await fs.mkdir(dir, { recursive: true });
      const screenshots: ScreenshotMeta[] = [];
      for (const f of filenames) {
        // Re-validate every filename retrieved from the DB before any file access
        if (!SAFE_NAME.test(f)) continue;
        try {
          const stat = await fs.stat(join(dir, f));
          const meta = metaMap.get(f);
          screenshots.push({
            filename: f,
            url: `/api/screenshots/${f}`,
            sizeBytes: stat.size,
            caption: meta?.caption ?? "",
            linked_note_path: meta?.linked_note_path ?? "",
          });
        } catch {
          // File may not exist on disk yet; skip silently
        }
      }
      screenshots.sort((a, b) => b.filename.localeCompare(a.filename));
      return json(screenshots);
    } catch (err) {
      console.error("[screenshots] GET failed:", err);
      return json([]);
    }
  }

  // No workspaceId supplied: full-dir scan (kept for backward compat / paste uploads)
  try {
    const dir = getScreenshotsDir();
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    const screenshots: ScreenshotMeta[] = [];
    for (const f of files) {
      if (!SAFE_NAME.test(f)) continue;
      const stat = await fs.stat(join(dir, f));
      screenshots.push({
        filename: f,
        url: `/api/screenshots/${f}`,
        sizeBytes: stat.size,
        caption: "",
        linked_note_path: "",
      });
    }
    screenshots.sort((a, b) => b.filename.localeCompare(a.filename));
    return json(screenshots);
  } catch (err) {
    console.error("[screenshots] GET failed:", err);
    return json([]);
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get("image");
  const workspaceIdRaw = formData.get("workspace_id");

  if (!file || !(file instanceof File)) return error(400, "No image provided");
  if (!ALLOWED_TYPES.has(file.type))
    return error(400, "Unsupported image type");
  if (file.size > MAX_BYTES) return error(400, "Image too large (max 10 MB)");

  const rawExt = file.type.split("/")[1];
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = await saveScreenshot(buffer, ext);

  // If a workspace_id is supplied, create the metadata row
  if (
    workspaceIdRaw !== null &&
    typeof workspaceIdRaw === "string" &&
    workspaceIdRaw.trim() !== ""
  ) {
    try {
      insertScreenshotMetadata(workspaceIdRaw.trim(), filename);
    } catch {
      // Non-fatal: metadata is supplemental; the file was already saved
    }
  }

  return json({ url: `/api/screenshots/${filename}` });
};
