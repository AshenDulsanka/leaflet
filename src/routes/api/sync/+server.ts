import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { resolveStatusOptions, runSyncAction } from '$lib/server/sync';

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payload = typeof body === 'object' && body !== null ? (body as { action?: unknown; includeRemote?: unknown }) : {};
  const action = payload.action;
  const statusOptions = resolveStatusOptions({ includeRemote: payload.includeRemote });
  const result = await runSyncAction(action, statusOptions);
  return json(result.body, { status: result.status });
};
