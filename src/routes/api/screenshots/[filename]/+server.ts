import { json, error } from '@sveltejs/kit';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  getScreenshotsDir,
  updateScreenshotMetadata,
  deleteScreenshotMetadata,
} from '$lib/server/screenshots';
import type { RequestHandler } from './$types';

// Only allow timestamp-based filenames - prevents path traversal
const SAFE_NAME = /^[0-9]+\.(png|jpg|jpeg|gif|webp)$/;

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const MAX_CAPTION_LENGTH = 500;

export const GET: RequestHandler = async ({ params }) => {
  const { filename } = params;
  if (!SAFE_NAME.test(filename)) return error(400, 'Invalid filename');

  try {
    const buf = await fs.readFile(join(getScreenshotsDir(), filename));
    const ext = filename.split('.').pop()!;
    return new Response(buf, {
      headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' },
    });
  } catch {
    return error(404, 'Screenshot not found');
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const { filename } = params;
  if (!SAFE_NAME.test(filename)) return error(400, 'Invalid filename');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid JSON body');
  }

  if (typeof body !== 'object' || body === null) return error(400, 'Body must be an object');

  const { workspaceId, caption, linked_note_path } = body as Record<string, unknown>;

  if (workspaceId === undefined || workspaceId === null || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    return error(400, 'workspaceId is required');
  }

  const patch: { caption?: string; linked_note_path?: string } = {};

  if (caption !== undefined) {
    if (typeof caption !== 'string') return error(400, 'caption must be a string');
    if (caption.length > MAX_CAPTION_LENGTH) return error(400, `caption must be ≤ ${MAX_CAPTION_LENGTH} characters`);
    patch.caption = caption;
  }

  if (linked_note_path !== undefined) {
    if (typeof linked_note_path !== 'string') return error(400, 'linked_note_path must be a string');
    // Prevent path traversal in the stored value
    if (linked_note_path.includes('..')) return error(400, 'linked_note_path must not contain ".."');
    patch.linked_note_path = linked_note_path;
  }

  if (Object.keys(patch).length === 0) return error(400, 'No fields to update');

  try {
    updateScreenshotMetadata(filename, workspaceId.trim(), patch);
    return json({ filename, ...patch });
  } catch {
    return error(500, 'Failed to update metadata');
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const { filename } = params;
  if (!SAFE_NAME.test(filename)) return error(400, 'Invalid filename');

  try {
    // Clean up metadata first so no orphan rows remain
    deleteScreenshotMetadata(filename);
    await fs.unlink(join(getScreenshotsDir(), filename));
    return new Response(null, { status: 204 });
  } catch {
    return error(404, 'Screenshot not found');
  }
};
