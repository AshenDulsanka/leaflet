import { error } from '@sveltejs/kit';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getScreenshotsDir } from '$lib/server/screenshots';
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

export const DELETE: RequestHandler = async ({ params }) => {
  const { filename } = params;
  if (!SAFE_NAME.test(filename)) return error(400, 'Invalid filename');

  try {
    await fs.unlink(join(getScreenshotsDir(), filename));
    return new Response(null, { status: 204 });
  } catch {
    return error(404, 'Screenshot not found');
  }
};
