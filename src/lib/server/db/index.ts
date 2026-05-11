import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getDb } from '../database.js';
import * as schema from './schema.js';

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

let _drizzle: DrizzleDB | null = null;

export function getDrizzle(): DrizzleDB {
  if (_drizzle) return _drizzle;
  _drizzle = drizzle(getDb(), { schema });
  return _drizzle;
}

/**
 * Reset the Drizzle client singleton.
 * Call this after reloadDb() so the next getDrizzle() picks up the new connection.
 */
export function invalidateDrizzle(): void {
  _drizzle = null;
}
