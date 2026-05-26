/**
 * Tests for migration v10 (network topology) and topology_edges table behaviour.
 *
 * Uses an in-memory / temp SQLite DB — no real notes.db is touched.
 */

import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { randomUUID } from "crypto";

// Point to a temp directory before the module is imported.
process.env.NOTES_DATA_DIR = join(
  tmpdir(),
  `leaflet-topology-test-${process.pid}`,
);

const { getDb, reloadDb } = await import("$lib/server/database.js");

afterEach(() => {
  reloadDb();
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration v10 — schema existence
// ─────────────────────────────────────────────────────────────────────────────
describe("migration v10 – topology schema", () => {
  it("adds topo_x column to hosts", () => {
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(hosts)`).all() as {
      name: string;
    }[];
    expect(cols.some((c) => c.name === "topo_x")).toBe(true);
  });

  it("adds topo_y column to hosts", () => {
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(hosts)`).all() as {
      name: string;
    }[];
    expect(cols.some((c) => c.name === "topo_y")).toBe(true);
  });

  it("creates the topology_edges table", () => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='topology_edges'`,
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("topology_edges");
  });

  it("creates the workspace index on topology_edges", () => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_topo_edges_workspace'`,
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("idx_topo_edges_workspace");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// topology_edges CRUD
// ─────────────────────────────────────────────────────────────────────────────
describe("topology edges CRUD", () => {
  let db: Database.Database;
  let workspaceId: string;
  let hostAId: string;
  let hostBId: string;

  beforeEach(() => {
    db = getDb();
    workspaceId = "ws-topo-" + Date.now();
    hostAId = randomUUID();
    hostBId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
       VALUES (?, 'Topo WS', 'pentest', '#6366f1', 'topo-folder', ?, ?)`,
    ).run(workspaceId, now, now);

    db.prepare(
      `INSERT INTO hosts (id, workspace_id, ip, created_at, updated_at)
       VALUES (?, ?, '10.0.0.1', ?, ?)`,
    ).run(hostAId, workspaceId, now, now);

    db.prepare(
      `INSERT INTO hosts (id, workspace_id, ip, created_at, updated_at)
       VALUES (?, ?, '10.0.0.2', ?, ?)`,
    ).run(hostBId, workspaceId, now, now);
  });

  it("inserts and retrieves a topology edge", () => {
    const edgeId = randomUUID();
    db.prepare(
      `INSERT INTO topology_edges (id, workspace_id, source_host_id, target_host_id, label)
       VALUES (?, ?, ?, ?, 'reachable')`,
    ).run(edgeId, workspaceId, hostAId, hostBId);

    const row = db
      .prepare("SELECT * FROM topology_edges WHERE id = ?")
      .get(edgeId) as
      | { source_host_id: string; target_host_id: string; label: string }
      | undefined;

    expect(row).toBeDefined();
    expect(row?.source_host_id).toBe(hostAId);
    expect(row?.target_host_id).toBe(hostBId);
    expect(row?.label).toBe("reachable");
  });

  it("enforces UNIQUE constraint on duplicate edges", () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    db.prepare(
      `INSERT INTO topology_edges (id, workspace_id, source_host_id, target_host_id, label)
       VALUES (?, ?, ?, ?, '')`,
    ).run(id1, workspaceId, hostAId, hostBId);

    expect(() => {
      db.prepare(
        `INSERT INTO topology_edges (id, workspace_id, source_host_id, target_host_id, label)
         VALUES (?, ?, ?, ?, '')`,
      ).run(id2, workspaceId, hostAId, hostBId);
    }).toThrow(/UNIQUE constraint failed/);
  });

  it("cascades delete when source host is deleted", () => {
    const edgeId = randomUUID();
    db.prepare(
      `INSERT INTO topology_edges (id, workspace_id, source_host_id, target_host_id, label)
       VALUES (?, ?, ?, ?, '')`,
    ).run(edgeId, workspaceId, hostAId, hostBId);

    db.prepare("DELETE FROM hosts WHERE id = ?").run(hostAId);

    const row = db
      .prepare("SELECT id FROM topology_edges WHERE id = ?")
      .get(edgeId);
    expect(row).toBeUndefined();
  });

  it("updates host canvas position (topo_x, topo_y)", () => {
    db.prepare(`UPDATE hosts SET topo_x = ?, topo_y = ? WHERE id = ?`).run(
      123.5,
      456.0,
      hostAId,
    );

    const row = db
      .prepare("SELECT topo_x, topo_y FROM hosts WHERE id = ?")
      .get(hostAId) as { topo_x: number; topo_y: number } | undefined;

    expect(row?.topo_x).toBeCloseTo(123.5);
    expect(row?.topo_y).toBeCloseTo(456.0);
  });
});
