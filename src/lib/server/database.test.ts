import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

// Point to a temp directory before the module is imported so no real DB is created.
process.env.NOTES_DATA_DIR = join(tmpdir(), `leaflet-db-test-${process.pid}`);

const { getDb, checkpoint, reloadDb } = await import('$lib/server/database.js');

afterEach(() => {
  reloadDb();
});

describe('getDb', () => {
  it('returns a database instance', () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe('function');
  });

  it('returns the same instance on repeated calls', () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });
});

describe('checkpoint', () => {
  it('flushes WAL without throwing', () => {
    expect(() => checkpoint()).not.toThrow();
  });
});

describe('reloadDb', () => {
  it('creates a fresh connection after reload', () => {
    const before = getDb();
    reloadDb();
    const after = getDb();
    expect(after).not.toBe(before);
    expect(after).toBeDefined();
  });
});
