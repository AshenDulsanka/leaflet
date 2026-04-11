/**
 * Tests for the operation_log migration (v7) and operation log data helpers.
 *
 * Uses an in-memory / temp SQLite DB — no real `notes.db` is touched.
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';

// Point to a temp directory before the module is imported.
process.env.NOTES_DATA_DIR = join(tmpdir(), `leaflet-oplog-test-${process.pid}`);

const { getDb, reloadDb } = await import('$lib/server/database.js');

afterEach(() => {
  reloadDb();
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration: table and index existence
// ─────────────────────────────────────────────────────────────────────────────
describe('migration v7 – operation_log table', () => {
  it('creates the operation_log table', () => {
    const db = getDb();
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='operation_log'`)
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('operation_log');
  });

  it('creates the workspace index', () => {
    const db = getDb();
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_oplog_workspace'`)
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('idx_oplog_workspace');
  });

  it('creates the timestamp index', () => {
    const db = getDb();
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_oplog_timestamp'`)
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('idx_oplog_timestamp');
  });

  it('creates the host index', () => {
    const db = getDb();
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_oplog_host'`)
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('idx_oplog_host');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRUD behaviour using the DB layer directly
// ─────────────────────────────────────────────────────────────────────────────
describe('operation_log CRUD', () => {
  let db: Database.Database;
  let workspaceId: string;

  beforeEach(() => {
    db = getDb();
    workspaceId = 'ws-test-oplog-' + Date.now();
    const now = new Date().toISOString();
    // Insert a minimal workspace so FK constraints pass.
    db.prepare(
      `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
       VALUES (?, 'Test WS', 'pentest', '#6366f1', 'test-folder', ?, ?)`
    ).run(workspaceId, now, now);
  });

  it('inserts and retrieves an operation log entry', () => {
    const id = 'entry-1';
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO operation_log (id, workspace_id, category, description, host_id, timestamp, created_at, updated_at)
       VALUES (?, ?, 'recon', 'Ran nmap scan', NULL, ?, ?, ?)`
    ).run(id, workspaceId, now, now, now);

    const row = db
      .prepare(`SELECT * FROM operation_log WHERE id = ?`)
      .get(id) as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.category).toBe('recon');
    expect(row.description).toBe('Ran nmap scan');
    expect(row.host_id).toBeNull();
  });

  it('rejects an invalid category via CHECK constraint', () => {
    const now = new Date().toISOString();
    expect(() =>
      db
        .prepare(
          `INSERT INTO operation_log (id, workspace_id, category, description, timestamp, created_at, updated_at)
           VALUES (?, ?, 'invalid-cat', 'test', ?, ?, ?)`
        )
        .run('entry-bad', workspaceId, now, now, now)
    ).toThrow();
  });

  it('cascades delete when workspace is removed', () => {
    const id = 'entry-cascade';
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO operation_log (id, workspace_id, category, description, timestamp, created_at, updated_at)
       VALUES (?, ?, 'other', 'cascade test', ?, ?, ?)`
    ).run(id, workspaceId, now, now, now);

    db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(workspaceId);

    const row = db.prepare(`SELECT * FROM operation_log WHERE id = ?`).get(id);
    expect(row).toBeUndefined();
  });

  it('returns entries ordered by timestamp DESC', () => {
    const base = new Date('2025-06-01T10:00:00Z');
    for (let i = 0; i < 3; i++) {
      const ts = new Date(base.getTime() + i * 60_000).toISOString();
      db.prepare(
        `INSERT INTO operation_log (id, workspace_id, category, description, timestamp, created_at, updated_at)
         VALUES (?, ?, 'other', ?, ?, ?, ?)`
      ).run(`entry-ord-${i}`, workspaceId, `entry ${i}`, ts, ts, ts);
    }

    const rows = db
      .prepare(
        `SELECT description FROM operation_log WHERE workspace_id = ? ORDER BY timestamp DESC`
      )
      .all(workspaceId) as Array<{ description: string }>;

    expect(rows[0].description).toBe('entry 2');
    expect(rows[2].description).toBe('entry 0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category validation helper (mirrors API layer logic)
// ─────────────────────────────────────────────────────────────────────────────
describe('OpLogCategory valid values', () => {
  const VALID_CATEGORIES = [
    'recon',
    'initial-access',
    'exploitation',
    'post-exploitation',
    'lateral-movement',
    'privilege-escalation',
    'exfiltration',
    'cleanup',
    'other',
  ];

  it('contains exactly 9 valid categories', () => {
    expect(VALID_CATEGORIES).toHaveLength(9);
  });

  it('every category is a non-empty string', () => {
    for (const cat of VALID_CATEGORIES) {
      expect(typeof cat).toBe('string');
      expect(cat.length).toBeGreaterThan(0);
    }
  });
});
