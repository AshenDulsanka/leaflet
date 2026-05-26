import type { Handle } from "@sveltejs/kit";
import { getDb } from "$lib/server/database";
import { getDrizzle } from "$lib/server/db/index";

export const handle: Handle = async ({ event, resolve }) => {
  const db = getDb();
  event.locals.db = db;
  event.locals.drizzle = getDrizzle();
  return resolve(event);
};
