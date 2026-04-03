import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/database';

export const handle: Handle = async ({ event, resolve }) => {
  const db = getDb();
  event.locals.db = db;
  return resolve(event);
};
