import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { runMigrations, seedDefaultWorkspace } from "./migrations.js";

let _db: Database.Database | null = null;

function getDbPath(): string {
  const dataDir = process.env.NOTES_DATA_DIR ?? join(process.cwd(), "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "notes.db");
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = getDbPath();
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("synchronous = NORMAL");
  runMigrations(_db);
  seedDefaultWorkspace(_db);
  return _db;
}

/**
 * Flush the WAL file into the main database.
 * Call this before git commit/push so the .db file contains all data.
 */
export function checkpoint(): void {
  const db = getDb();
  db.pragma("wal_checkpoint(TRUNCATE)");
}

/**
 * Close and discard the current DB connection so the next getDb() call
 * reopens from disk. Call this after a git pull overwrites the .db file.
 */
export function reloadDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
