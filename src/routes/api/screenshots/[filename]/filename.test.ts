import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const tempRoot = join(
  tmpdir(),
  `leaflet-screenshot-file-route-test-${randomUUID()}`,
);
const dataDir = join(tempRoot, "data");
const screenshotsDir = join(tempRoot, "screenshots");
process.env.NOTES_DATA_DIR = dataDir;
process.env.SCREENSHOTS_DIR = screenshotsDir;

const { getDb, reloadDb } = await import("$lib/server/database.js");
const { insertScreenshotMetadata } = await import("$lib/server/screenshots.js");
const { GET, PATCH, DELETE } = await import("./+server.js");

afterEach(() => {
  reloadDb();
  return fs.rm(tempRoot, { recursive: true, force: true });
});

afterAll(async () => {
  reloadDb();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function seedWorkspace(id: string): void {
  const db = getDb();
  const now = "2026-04-14T00:00:00.000Z";
  db.prepare(
    `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
     VALUES (?, ?, 'general', '#6366f1', ?, ?, ?)`,
  ).run(id, `ws-${id}`, `folder-${id}`, now, now);
}

async function writeScreenshotFile(
  filename: string,
  contents: string,
): Promise<void> {
  await fs.mkdir(screenshotsDir, { recursive: true });
  await fs.writeFile(join(screenshotsDir, filename), contents);
}

function jsonPatchRequest(body: unknown): Request {
  return new Request("http://localhost/api/screenshots/1111111111.png", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectHttpStatus(
  action: () => unknown | Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await action();
    throw new Error("Expected request to fail");
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("status" in error) ||
      typeof error.status !== "number"
    ) {
      throw error;
    }

    expect(error.status).toBe(status);
  }
}

describe("screenshots [filename] GET", () => {
  it("serves a screenshot file with the expected mime type", async () => {
    const filename = "1111111111.png";
    await writeScreenshotFile(filename, "image-bytes");

    const response = await GET({ params: { filename } } as Parameters<
      typeof GET
    >[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const body = Buffer.from(await response.arrayBuffer()).toString("utf-8");
    expect(body).toBe("image-bytes");
  });

  it("rejects invalid filenames with 400", async () => {
    await expectHttpStatus(
      () =>
        GET({ params: { filename: "../evil.png" } } as Parameters<
          typeof GET
        >[0]),
      400,
    );
  });
});

describe("screenshots [filename] PATCH", () => {
  it("requires workspaceId", async () => {
    await expectHttpStatus(
      () =>
        PATCH({
          params: { filename: "1111111111.png" },
          request: jsonPatchRequest({ caption: "Proof" }),
        } as Parameters<typeof PATCH>[0]),
      400,
    );
  });

  it("rejects linked_note_path traversal attempts", async () => {
    const workspaceId = randomUUID();
    seedWorkspace(workspaceId);

    await expectHttpStatus(
      () =>
        PATCH({
          params: { filename: "1111111111.png" },
          request: jsonPatchRequest({
            workspaceId,
            linked_note_path: "../secrets.md",
          }),
        } as Parameters<typeof PATCH>[0]),
      400,
    );
  });

  it("updates caption and linked_note_path metadata", async () => {
    const workspaceId = randomUUID();
    const filename = "1111111111.png";
    seedWorkspace(workspaceId);
    insertScreenshotMetadata(workspaceId, filename);

    const response = await PATCH({
      params: { filename },
      request: jsonPatchRequest({
        workspaceId,
        caption: "Proof of exploit",
        linked_note_path: "notes/recon.md",
      }),
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      filename: string;
      caption: string;
      linked_note_path: string;
    };
    expect(body.filename).toBe(filename);
    expect(body.caption).toBe("Proof of exploit");
    expect(body.linked_note_path).toBe("notes/recon.md");

    const db = getDb();
    const row = db
      .prepare(
        "SELECT caption, linked_note_path FROM screenshot_metadata WHERE workspace_id = ? AND filename = ?",
      )
      .get(workspaceId, filename) as
      | { caption: string; linked_note_path: string }
      | undefined;
    expect(row?.caption).toBe("Proof of exploit");
    expect(row?.linked_note_path).toBe("notes/recon.md");
  });
});

describe("screenshots [filename] DELETE", () => {
  it("deletes file and metadata row", async () => {
    const workspaceId = randomUUID();
    const filename = "1111111111.png";
    seedWorkspace(workspaceId);
    await writeScreenshotFile(filename, "delete-me");
    insertScreenshotMetadata(workspaceId, filename);

    const response = await DELETE({
      params: { filename },
      url: new URL(`http://localhost/api/screenshots/${filename}`),
    } as Parameters<typeof DELETE>[0]);
    expect(response.status).toBe(204);

    await expect(fs.access(join(screenshotsDir, filename))).rejects.toThrow();

    const db = getDb();
    const row = db
      .prepare("SELECT id FROM screenshot_metadata WHERE filename = ?")
      .get(filename) as { id: string } | undefined;
    expect(row).toBeUndefined();
  });
});
