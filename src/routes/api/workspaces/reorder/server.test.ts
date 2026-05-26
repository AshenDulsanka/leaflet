import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";

// Set NOTES_DATA_DIR before importing anything that reads env vars at module load time.
const tempRoot = join(tmpdir(), `leaflet-reorder-test-${randomUUID()}`);
process.env.NOTES_DATA_DIR = join(tempRoot, "data");

const { getDb, reloadDb } = await import("$lib/server/database.js");
const { PATCH } = await import("./+server.js");

afterEach(() => {
  reloadDb();
});

afterAll(async () => {
  reloadDb();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function jsonPatch(body: unknown): Request {
  return new Request("http://localhost/api/workspaces/reorder", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function seedWorkspace(db: Database.Database, id: string): void {
  const now = "2026-04-14T00:00:00.000Z";
  db.prepare(
    `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
     VALUES (?, ?, 'general', '#6366f1', ?, ?, ?)`,
  ).run(id, `ws-${id}`, `folder-${id}`, now, now);
}

// ─────────────────────────────────────────────────────────────────────────────
// Request validation
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/workspaces/reorder – request validation", () => {
  it("returns 400 when body.order is not an array", async () => {
    const response = await PATCH({
      request: jsonPatch({ order: "not-an-array" }),
      locals: { db: getDb() },
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/array/i);
  });

  it("returns 400 when body.order is absent", async () => {
    const response = await PATCH({
      request: jsonPatch({}),
      locals: { db: getDb() },
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(400);
  });

  it("returns 400 when body.order length exceeds 200", async () => {
    const order = Array.from({ length: 201 }, () => randomUUID());
    const response = await PATCH({
      request: jsonPatch({ order }),
      locals: { db: getDb() },
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/200/);
  });

  it("returns 404 when one or more IDs are not found in workspaces", async () => {
    const db = getDb();
    const existing = randomUUID();
    seedWorkspace(db, existing);

    const response = await PATCH({
      request: jsonPatch({ order: [existing, randomUUID()] }),
      locals: { db },
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/workspaces/reorder – happy path", () => {
  let db: Database.Database;
  let id1: string;
  let id2: string;
  let id3: string;

  beforeEach(() => {
    db = getDb();
    id1 = randomUUID();
    id2 = randomUUID();
    id3 = randomUUID();
    seedWorkspace(db, id1);
    seedWorkspace(db, id2);
    seedWorkspace(db, id3);
  });

  it("writes correct sort_order values for every workspace in the given order", async () => {
    const response = await PATCH({
      request: jsonPatch({ order: [id3, id1, id2] }),
      locals: { db },
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { updated: number };
    expect(body.updated).toBe(3);

    const row3 = db
      .prepare("SELECT sort_order FROM workspaces WHERE id = ?")
      .get(id3) as { sort_order: number };
    const row1 = db
      .prepare("SELECT sort_order FROM workspaces WHERE id = ?")
      .get(id1) as { sort_order: number };
    const row2 = db
      .prepare("SELECT sort_order FROM workspaces WHERE id = ?")
      .get(id2) as { sort_order: number };

    expect(row3.sort_order).toBe(0);
    expect(row1.sort_order).toBe(1);
    expect(row2.sort_order).toBe(2);
  });

  it("deduplicates IDs before computing sort_order", async () => {
    // [id1, id2, id1, id2] → Set dedup → [id1, id2]; updated count should be 2
    const response = await PATCH({
      request: jsonPatch({ order: [id1, id2, id1, id2] }),
      locals: { db },
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { updated: number };
    expect(body.updated).toBe(2);

    const rows = db
      .prepare(
        "SELECT id, sort_order FROM workspaces WHERE id IN (?, ?) ORDER BY sort_order",
      )
      .all(id1, id2) as { id: string; sort_order: number }[];

    expect(rows[0]).toMatchObject({ id: id1, sort_order: 0 });
    expect(rows[1]).toMatchObject({ id: id2, sort_order: 1 });
  });

  it("accepts an empty array and returns updated: 0 without modifying sort_order", async () => {
    const response = await PATCH({
      request: jsonPatch({ order: [] }),
      locals: { db },
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { updated: number };
    expect(body.updated).toBe(0);

    const rows = db
      .prepare("SELECT sort_order FROM workspaces WHERE id IN (?, ?, ?)")
      .all(id1, id2, id3) as { sort_order: number }[];
    expect(rows.every((r) => r.sort_order === 0)).toBe(true);
  });
});
