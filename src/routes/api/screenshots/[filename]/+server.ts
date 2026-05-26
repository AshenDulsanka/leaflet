import { json, error } from "@sveltejs/kit";
import { promises as fs } from "fs";
import { join } from "path";
import {
  getScreenshotsDir,
  updateScreenshotMetadata,
  deleteScreenshotMetadata,
  renameScreenshotFile,
} from "$lib/server/screenshots";
import type { RequestHandler } from "./$types";

// Allow timestamp filenames (uploads) and normalized slug filenames (renames) - prevents path traversal
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*\.(png|jpg|jpeg|gif|webp)$/;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const MAX_CAPTION_LENGTH = 500;

export const GET: RequestHandler = async ({ params }) => {
  const { filename } = params;
  if (!SAFE_NAME.test(filename)) return error(400, "Invalid filename");

  try {
    const buf = await fs.readFile(join(getScreenshotsDir(), filename));
    const ext = filename.split(".").pop()!;
    return new Response(buf, {
      headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
    });
  } catch {
    return error(404, "Screenshot not found");
  }
};

const SAFE_NEW_BASENAME = /^[a-zA-Z0-9][a-zA-Z0-9\-_ ]*$/;

export const PATCH: RequestHandler = async ({ params, request }) => {
  const { filename } = params;
  if (!SAFE_NAME.test(filename)) return error(400, "Invalid filename");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "Invalid JSON body");
  }

  if (typeof body !== "object" || body === null)
    return error(400, "Body must be an object");

  const { workspaceId, caption, linked_note_path, newFilename } =
    body as Record<string, unknown>;

  if (
    workspaceId === undefined ||
    workspaceId === null ||
    typeof workspaceId !== "string" ||
    workspaceId.trim() === ""
  ) {
    return error(400, "workspaceId is required");
  }

  const patch: { caption?: string; linked_note_path?: string } = {};

  if (caption !== undefined) {
    if (typeof caption !== "string")
      return error(400, "caption must be a string");
    if (caption.length > MAX_CAPTION_LENGTH)
      return error(400, `caption must be ≤ ${MAX_CAPTION_LENGTH} characters`);
    patch.caption = caption;
  }

  if (linked_note_path !== undefined) {
    if (typeof linked_note_path !== "string")
      return error(400, "linked_note_path must be a string");
    // Prevent path traversal in the stored value
    if (linked_note_path.includes(".."))
      return error(400, 'linked_note_path must not contain ".."');
    patch.linked_note_path = linked_note_path;
  }

  let resultFilename = filename;

  if (newFilename !== undefined) {
    if (typeof newFilename !== "string")
      return error(400, "newFilename must be a string");
    const trimmed = newFilename.trim().replace(/\.[a-z0-9]+$/i, ""); // strip trailing extension defensively
    if (!trimmed || trimmed.length > 100)
      return error(400, "newFilename must be 1–100 characters");
    if (!SAFE_NEW_BASENAME.test(trimmed))
      return error(400, "newFilename contains invalid characters");
    const normalized = trimmed.replace(/ /g, "-").toLowerCase();
    // Determine what the resulting filename would be
    const extMatch = filename.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : "";
    const wouldBe = ext ? `${normalized}.${ext}` : normalized;
    if (wouldBe !== filename) {
      try {
        resultFilename = await renameScreenshotFile(
          filename,
          normalized,
          workspaceId.trim(),
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") {
          return error(409, "A screenshot with that name already exists");
        }
        console.error("Failed to rename screenshot:", {
          filename,
          newFilenameNormalized: normalized,
          workspaceId,
          error: e,
        });
        return error(500, "Failed to rename screenshot");
      }
    }
  }

  if (Object.keys(patch).length === 0 && resultFilename === filename) {
    return error(400, "No fields to update");
  }

  try {
    if (Object.keys(patch).length > 0) {
      updateScreenshotMetadata(resultFilename, workspaceId.trim(), patch);
    }
    return json({
      filename: resultFilename,
      url: `/api/screenshots/${resultFilename}`,
      ...patch,
    });
  } catch (err) {
    console.error("Failed to update screenshot metadata:", {
      filename,
      workspaceId,
      error: err,
    });
    return error(500, "Failed to update metadata");
  }
};

export const DELETE: RequestHandler = async ({ params, url }) => {
  const { filename } = params;
  if (!SAFE_NAME.test(filename)) return error(400, "Invalid filename");

  const workspaceId = url.searchParams.get("workspaceId") ?? undefined;

  try {
    // Clean up metadata first so no orphan rows remain
    deleteScreenshotMetadata(filename, workspaceId);
    await fs.unlink(join(getScreenshotsDir(), filename));
    return new Response(null, { status: 204 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return error(404, "Screenshot not found");
    console.error("Failed to delete screenshot:", { filename, error: e });
    return error(500, "Failed to delete screenshot");
  }
};
