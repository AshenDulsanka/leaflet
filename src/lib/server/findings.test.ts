/**
 * Tests for the findings migration (v8) and findings table behaviour.
 *
 * Uses an in-memory / temp SQLite DB - no real `notes.db` is touched.
 */

import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";

// Point to a temp directory before the module is imported.
process.env.NOTES_DATA_DIR = join(
  tmpdir(),
  `leaflet-findings-test-${process.pid}`,
);

const { getDb, reloadDb } = await import("$lib/server/database.js");

afterEach(() => {
  reloadDb();
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration: table and index existence
// ─────────────────────────────────────────────────────────────────────────────
describe("migration v8 – findings table", () => {
  it("creates the findings table", () => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='findings'`,
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("findings");
  });

  it("creates the workspace index", () => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_findings_workspace'`,
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("idx_findings_workspace");
  });

  it("creates the status index", () => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_findings_status'`,
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("idx_findings_status");
  });

  it("creates the host index", () => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_findings_host'`,
      )
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("idx_findings_host");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRUD behaviour using the DB layer directly
// ─────────────────────────────────────────────────────────────────────────────
describe("findings CRUD", () => {
  let db: Database.Database;
  let workspaceId: string;

  beforeEach(() => {
    db = getDb();
    workspaceId = "ws-findings-" + Date.now();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
       VALUES (?, 'Test WS', 'pentest', '#6366f1', 'test-folder', ?, ?)`,
    ).run(workspaceId, now, now);
  });

  it("inserts and retrieves a finding", () => {
    const id = "finding-1";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, description, severity, cvss_score, cvss_vector,
          status, host_id, note_path, created_at, updated_at)
       VALUES (?, ?, 'SQL Injection', 'Found in login form', 'high', 8.1,
               'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
               'confirmed', NULL, 'notes/web-app.md', ?, ?)`,
    ).run(id, workspaceId, now, now);

    const row = db
      .prepare(`SELECT * FROM findings WHERE id = ?`)
      .get(id) as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row.title).toBe("SQL Injection");
    expect(row.severity).toBe("high");
    expect(row.cvss_score).toBe(8.1);
    expect(row.status).toBe("confirmed");
    expect(row.host_id).toBeNull();
  });

  it("rejects an invalid severity via CHECK constraint", () => {
    const now = new Date().toISOString();
    expect(() =>
      db
        .prepare(
          `INSERT INTO findings
             (id, workspace_id, title, severity, cvss_score, status, created_at, updated_at)
           VALUES (?, ?, 'test', 'critical-plus', 9.9, 'open', ?, ?)`,
        )
        .run("finding-bad-sev", workspaceId, now, now),
    ).toThrow();
  });

  it("rejects an invalid status via CHECK constraint", () => {
    const now = new Date().toISOString();
    expect(() =>
      db
        .prepare(
          `INSERT INTO findings
             (id, workspace_id, title, severity, cvss_score, status, created_at, updated_at)
           VALUES (?, ?, 'test', 'info', 0, 'wontfix', ?, ?)`,
        )
        .run("finding-bad-status", workspaceId, now, now),
    ).toThrow();
  });

  it("PATCH updates without cross-workspace bleed", () => {
    const id = "finding-patch";
    const otherWsId = "ws-other-" + Date.now();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
       VALUES (?, 'Other WS', 'pentest', '#000000', 'other-folder', ?, ?)`,
    ).run(otherWsId, now, now);

    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, severity, cvss_score, status, created_at, updated_at)
       VALUES (?, ?, 'XSS Stored', 'high', 7.2, 'open', ?, ?)`,
    ).run(id, workspaceId, now, now);

    // Attempt to update from a different workspace — should affect 0 rows
    const result = db
      .prepare(
        `UPDATE findings SET title = 'Hacked', updated_at = ? WHERE id = ? AND workspace_id = ?`,
      )
      .run(now, id, otherWsId);

    expect(result.changes).toBe(0);

    // Original row is unchanged
    const row = db
      .prepare(`SELECT title FROM findings WHERE id = ?`)
      .get(id) as { title: string };
    expect(row.title).toBe("XSS Stored");
  });

  it("DELETE removes the finding; returns 0 changes for wrong workspace", () => {
    const id = "finding-del";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, severity, cvss_score, status, created_at, updated_at)
       VALUES (?, ?, 'RCE', 'critical', 9.8, 'open', ?, ?)`,
    ).run(id, workspaceId, now, now);

    // Wrong workspace deletes nothing
    const missResult = db
      .prepare(`DELETE FROM findings WHERE id = ? AND workspace_id = ?`)
      .run(id, "ws-wrong");
    expect(missResult.changes).toBe(0);

    // Correct workspace deletes the row
    const hitResult = db
      .prepare(`DELETE FROM findings WHERE id = ? AND workspace_id = ?`)
      .run(id, workspaceId);
    expect(hitResult.changes).toBe(1);

    const row = db.prepare(`SELECT * FROM findings WHERE id = ?`).get(id);
    expect(row).toBeUndefined();
  });

  it("cascades delete when workspace is removed", () => {
    const id = "finding-cascade";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, severity, cvss_score, status, created_at, updated_at)
       VALUES (?, ?, 'Cascade test', 'info', 0, 'open', ?, ?)`,
    ).run(id, workspaceId, now, now);

    db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(workspaceId);

    const row = db.prepare(`SELECT * FROM findings WHERE id = ?`).get(id);
    expect(row).toBeUndefined();
  });

  it("returns findings ordered by created_at DESC", () => {
    const base = new Date("2025-06-01T10:00:00Z");
    for (let i = 0; i < 3; i++) {
      const ts = new Date(base.getTime() + i * 60_000).toISOString();
      db.prepare(
        `INSERT INTO findings
           (id, workspace_id, title, severity, cvss_score, status, created_at, updated_at)
         VALUES (?, ?, ?, 'info', 0, 'open', ?, ?)`,
      ).run(`finding-ord-${i}`, workspaceId, `finding ${i}`, ts, ts);
    }

    const rows = db
      .prepare(
        `SELECT title FROM findings WHERE workspace_id = ? ORDER BY created_at DESC`,
      )
      .all(workspaceId) as Array<{ title: string }>;

    expect(rows[0].title).toBe("finding 2");
    expect(rows[2].title).toBe("finding 0");
  });

  it("host_id is set to NULL via ON DELETE SET NULL when host is deleted", () => {
    const hostId = "host-for-finding";
    const id = "finding-host-null";
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO hosts (id, workspace_id, ip, created_at, updated_at)
       VALUES (?, ?, '10.10.10.1', ?, ?)`,
    ).run(hostId, workspaceId, now, now);

    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, severity, cvss_score, status, host_id, created_at, updated_at)
       VALUES (?, ?, 'Auth Bypass', 'critical', 9.1, 'open', ?, ?, ?)`,
    ).run(id, workspaceId, hostId, now, now);

    db.prepare(`DELETE FROM hosts WHERE id = ?`).run(hostId);

    const row = db
      .prepare(`SELECT host_id FROM findings WHERE id = ?`)
      .get(id) as { host_id: string | null };
    expect(row.host_id).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Migration v9 – MITRE ATT&CK columns
// ─────────────────────────────────────────────────────────────────────────────
describe("migration v9 – mitre columns", () => {
  let db: Database.Database;
  let workspaceId: string;

  beforeEach(() => {
    db = getDb();
    workspaceId = "ws-mitre-" + Date.now();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
       VALUES (?, 'MITRE WS', 'pentest', '#6366f1', 'mitre-folder', ?, ?)`,
    ).run(workspaceId, now, now);
  });

  it("mitre_technique_id has empty string default", () => {
    const id = "finding-mitre-default";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, severity, cvss_score, status, created_at, updated_at)
       VALUES (?, ?, 'No MITRE', 'info', 0, 'open', ?, ?)`,
    ).run(id, workspaceId, now, now);

    const row = db
      .prepare(
        `SELECT mitre_technique_id, mitre_technique_name FROM findings WHERE id = ?`,
      )
      .get(id) as { mitre_technique_id: string; mitre_technique_name: string };

    expect(row.mitre_technique_id).toBe("");
    expect(row.mitre_technique_name).toBe("");
  });

  it("stores and retrieves mitre technique tag", () => {
    const id = "finding-mitre-stored";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, severity, cvss_score, status,
          mitre_technique_id, mitre_technique_name, created_at, updated_at)
       VALUES (?, ?, 'RCE via Shell', 'critical', 9.8, 'open', ?, ?, ?, ?)`,
    ).run(
      id,
      workspaceId,
      "T1059",
      "Command and Scripting Interpreter",
      now,
      now,
    );

    const row = db
      .prepare(
        `SELECT mitre_technique_id, mitre_technique_name FROM findings WHERE id = ?`,
      )
      .get(id) as { mitre_technique_id: string; mitre_technique_name: string };

    expect(row.mitre_technique_id).toBe("T1059");
    expect(row.mitre_technique_name).toBe("Command and Scripting Interpreter");
  });

  it("clears mitre fields to empty string via UPDATE", () => {
    const id = "finding-mitre-clear";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO findings
         (id, workspace_id, title, severity, cvss_score, status,
          mitre_technique_id, mitre_technique_name, created_at, updated_at)
       VALUES (?, ?, 'SQLi', 'high', 7.5, 'open', ?, ?, ?, ?)`,
    ).run(
      id,
      workspaceId,
      "T1190",
      "Exploit Public-Facing Application",
      now,
      now,
    );

    db.prepare(
      `UPDATE findings SET mitre_technique_id = '', mitre_technique_name = '', updated_at = ? WHERE id = ?`,
    ).run(now, id);

    const row = db
      .prepare(
        `SELECT mitre_technique_id, mitre_technique_name FROM findings WHERE id = ?`,
      )
      .get(id) as { mitre_technique_id: string; mitre_technique_name: string };

    expect(row.mitre_technique_id).toBe("");
    expect(row.mitre_technique_name).toBe("");
  });
});
