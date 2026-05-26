import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const tempRoot = join(
  tmpdir(),
  `leaflet-screenshots-route-test-${randomUUID()}`,
);
const dataDir = join(tempRoot, "data");
const screenshotsDir = join(tempRoot, "screenshots");
process.env.NOTES_DATA_DIR = dataDir;
process.env.SCREENSHOTS_DIR = screenshotsDir;

const { getDb, reloadDb } = await import("$lib/server/database");
const { GET, POST } = await import("./+server.js");
const { insertScreenshotMetadata } = await import("$lib/server/screenshots");

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

async function expectHttpStatus(
  action: () => unknown | Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await action();
    throw new Error("Expected request to fail");
  } catch (error) {
    expect(error).toMatchObject({ status });
  }
}

describe("screenshots GET workspace scoping", () => {
  it("returns only the requested workspace metadata-linked SAFE_NAME filenames", async () => {
    const workspaceId = randomUUID();
    const otherWorkspaceId = randomUUID();
    seedWorkspace(workspaceId);
    seedWorkspace(otherWorkspaceId);

    await writeScreenshotFile("1111111111.png", "a");
    await writeScreenshotFile("2222222222.jpg", "bb");
    await writeScreenshotFile("3333333333.gif", "ccc");

    insertScreenshotMetadata(workspaceId, "1111111111.png");
    insertScreenshotMetadata(workspaceId, "not-safe.png");
    insertScreenshotMetadata(otherWorkspaceId, "2222222222.jpg");

    const response = await GET({
      url: new URL(
        `http://localhost/api/screenshots?workspaceId=${workspaceId}`,
      ),
    } as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);

    const screenshots = (await response.json()) as Array<{ filename: string }>;
    expect(screenshots).toHaveLength(1);
    expect(screenshots[0]?.filename).toBe("1111111111.png");
  });

  it("returns 400 when workspaceId is empty", async () => {
    await expectHttpStatus(
      () =>
        GET({
          url: new URL("http://localhost/api/screenshots?workspaceId="),
        } as Parameters<typeof GET>[0]),
      400,
    );
  });

  it("scans the full directory when workspaceId is omitted", async () => {
    await writeScreenshotFile("4444444444.png", "dddd");
    await writeScreenshotFile("5555555555.webp", "eeeee");
    await writeScreenshotFile("skip.me", "ignored");

    const response = await GET({
      url: new URL("http://localhost/api/screenshots"),
    } as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);

    const screenshots = (await response.json()) as Array<{
      filename: string;
      sizeBytes: number;
    }>;
    expect(screenshots.map((shot) => shot.filename)).toEqual([
      "5555555555.webp",
      "4444444444.png",
    ]);
    expect(screenshots.map((shot) => shot.sizeBytes)).toEqual([5, 4]);
  });
});

describe("screenshots POST upload", () => {
  it("stores metadata when workspace_id is provided", async () => {
    const workspaceId = randomUUID();
    seedWorkspace(workspaceId);

    const form = new FormData();
    form.append(
      "image",
      new File([Buffer.from("png-data")], "shot.png", { type: "image/png" }),
    );
    form.append("workspace_id", workspaceId);

    const response = await POST({
      request: new Request("http://localhost/api/screenshots", {
        method: "POST",
        body: form,
      }),
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    const filename = body.url.split("/").pop();

    expect(filename).toMatch(/^[0-9]+\.(png|jpg|jpeg|gif|webp)$/);
    await fs.access(join(screenshotsDir, filename!));

    const db = getDb();
    const row = db
      .prepare(
        "SELECT workspace_id, filename FROM screenshot_metadata WHERE workspace_id = ? AND filename = ?",
      )
      .get(workspaceId, filename) as
      | { workspace_id: string; filename: string }
      | undefined;

    expect(row?.workspace_id).toBe(workspaceId);
    expect(row?.filename).toBe(filename);
  });

  it("does not create metadata when workspace_id is omitted", async () => {
    const form = new FormData();
    form.append(
      "image",
      new File([Buffer.from("image")], "shot.png", { type: "image/png" }),
    );

    const response = await POST({
      request: new Request("http://localhost/api/screenshots", {
        method: "POST",
        body: form,
      }),
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    const filename = body.url.split("/").pop();

    const db = getDb();
    const countRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM screenshot_metadata WHERE filename = ?",
      )
      .get(filename) as { count: number };

    expect(countRow.count).toBe(0);
  });

  it("rejects unsupported image types with 400", async () => {
    const form = new FormData();
    form.append(
      "image",
      new File([Buffer.from("gif")], "not-image.txt", { type: "text/plain" }),
    );

    await expectHttpStatus(
      () =>
        POST({
          request: new Request("http://localhost/api/screenshots", {
            method: "POST",
            body: form,
          }),
        } as Parameters<typeof POST>[0]),
      400,
    );
  });
});
