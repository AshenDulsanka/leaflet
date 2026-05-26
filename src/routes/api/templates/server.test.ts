import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const tempRoot = join(tmpdir(), `leaflet-templates-test-${randomUUID()}`);
process.env.NOTES_DATA_DIR = join(tempRoot, "data");

const { getDb, reloadDb } = await import("$lib/server/database.js");
const { GET, POST } = await import("./+server.js");
const { DELETE } = await import("./[id]/+server.js");

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

function seedTemplate(options: {
  id: string;
  workspaceId: string | null;
  title: string;
  description: string;
  content: string;
  createdAt: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO user_templates (id, workspace_id, title, description, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    options.id,
    options.workspaceId,
    options.title,
    options.description,
    options.content,
    options.createdAt,
    options.createdAt,
  );
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawJsonRequest(body: string): Request {
  return new Request("http://localhost/api/templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
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
    expect(error).toMatchObject({ status });
  }
}

describe("templates POST validation", () => {
  it("rejects invalid JSON body with 400", async () => {
    const db = getDb();

    await expectHttpStatus(
      () =>
        POST({ request: rawJsonRequest("{"), locals: { db } } as Parameters<
          typeof POST
        >[0]),
      400,
    );
  });

  it("rejects non-object JSON bodies with 400", async () => {
    const db = getDb();

    await expectHttpStatus(
      () =>
        POST({
          request: jsonRequest(["not-an-object"]),
          locals: { db },
        } as Parameters<typeof POST>[0]),
      400,
    );
  });

  it.each([
    ["title", { content: "content" }],
    ["title", { title: "   ", content: "content" }],
    ["content", { title: "title" }],
    ["content", { title: "title", content: "   " }],
  ])("rejects missing or empty %s with 400", async (_field, body) => {
    const db = getDb();

    await expectHttpStatus(
      () =>
        POST({ request: jsonRequest(body), locals: { db } } as Parameters<
          typeof POST
        >[0]),
      400,
    );
  });

  it.each([
    ["title", { title: "a".repeat(256), content: "content" }],
    [
      "description",
      { title: "title", description: "d".repeat(1001), content: "content" },
    ],
    ["content", { title: "title", content: "c".repeat(500_001) }],
  ])("rejects oversize %s with 400", async (_field, body) => {
    const db = getDb();

    await expectHttpStatus(
      () =>
        POST({ request: jsonRequest(body), locals: { db } } as Parameters<
          typeof POST
        >[0]),
      400,
    );
  });

  it("rejects a workspaceId that does not exist", async () => {
    const db = getDb();

    await expectHttpStatus(
      () =>
        POST({
          request: jsonRequest({
            title: "Title",
            description: "Description",
            content: "Content",
            workspaceId: randomUUID(),
          }),
          locals: { db },
        } as Parameters<typeof POST>[0]),
      400,
    );
  });

  it("rejects a whitespace-only workspaceId with 400", async () => {
    const db = getDb();

    await expectHttpStatus(
      () =>
        POST({
          request: jsonRequest({
            title: "Title",
            description: "Description",
            content: "Content",
            workspaceId: "   ",
          }),
          locals: { db },
        } as Parameters<typeof POST>[0]),
      400,
    );
  });

  it("accepts a valid payload and returns the created row", async () => {
    const workspaceId = randomUUID();
    seedWorkspace(workspaceId);

    const db = getDb();
    const response = await POST({
      request: jsonRequest({
        title: "  Incident response checklist  ",
        description: "  Pre-filled template for triage  ",
        content: "  # Checklist\n- isolate\n- collect evidence  ",
        workspaceId,
      }),
      locals: { db },
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(201);

    const created = (await response.json()) as {
      id: string;
      workspace_id: string | null;
      title: string;
      description: string;
      content: string;
    };

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.workspace_id).toBe(workspaceId);
    expect(created.title).toBe("Incident response checklist");
    expect(created.description).toBe("Pre-filled template for triage");
    expect(created.content).toBe("# Checklist\n- isolate\n- collect evidence");
  });

  it("accepts a payload without workspaceId and creates a global template", async () => {
    const db = getDb();
    const response = await POST({
      request: jsonRequest({
        title: "Global template",
        description: "Used when no workspace is selected",
        content: "# Global\n- item",
      }),
      locals: { db },
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(201);

    const created = (await response.json()) as {
      workspace_id: string | null;
      title: string;
      content: string;
    };

    expect(created.workspace_id).toBeNull();
    expect(created.title).toBe("Global template");
    expect(created.content).toBe("# Global\n- item");
  });
});

describe("templates GET", () => {
  it("returns global templates only when no workspaceId is provided", async () => {
    const workspaceId = randomUUID();
    seedWorkspace(workspaceId);
    seedTemplate({
      id: randomUUID(),
      workspaceId: null,
      title: "Global template",
      description: "Visible everywhere",
      content: "Global content",
      createdAt: "2026-04-14T00:00:00.000Z",
    });
    seedTemplate({
      id: randomUUID(),
      workspaceId,
      title: "Workspace template",
      description: "Visible only in workspace",
      content: "Workspace content",
      createdAt: "2026-04-14T00:00:01.000Z",
    });

    const response = await GET({
      url: new URL("http://localhost/api/templates"),
      locals: { db: getDb() },
    } as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);

    const rows = (await response.json()) as Array<{
      id: string;
      workspace_id: string | null;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.workspace_id).toBeNull();
  });

  it("returns global and workspace-scoped templates when workspaceId is provided", async () => {
    const workspaceId = randomUUID();
    const otherWorkspaceId = randomUUID();
    seedWorkspace(workspaceId);
    seedWorkspace(otherWorkspaceId);
    const globalTemplateId = randomUUID();
    const workspaceTemplateId = randomUUID();
    seedTemplate({
      id: globalTemplateId,
      workspaceId: null,
      title: "Global template",
      description: "Visible everywhere",
      content: "Global content",
      createdAt: "2026-04-14T00:00:00.000Z",
    });
    seedTemplate({
      id: workspaceTemplateId,
      workspaceId,
      title: "Workspace template",
      description: "Visible only in workspace",
      content: "Workspace content",
      createdAt: "2026-04-14T00:00:01.000Z",
    });
    seedTemplate({
      id: randomUUID(),
      workspaceId: otherWorkspaceId,
      title: "Other workspace template",
      description: "Should not be returned",
      content: "Other content",
      createdAt: "2026-04-14T00:00:02.000Z",
    });

    const response = await GET({
      url: new URL(`http://localhost/api/templates?workspaceId=${workspaceId}`),
      locals: { db: getDb() },
    } as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);

    const rows = (await response.json()) as Array<{
      id: string;
      workspace_id: string | null;
    }>;
    expect(rows.map((row) => row.id)).toEqual([
      workspaceTemplateId,
      globalTemplateId,
    ]);
  });
});

describe("templates DELETE by id", () => {
  it("returns 404 when the id does not exist", async () => {
    const db = getDb();

    await expectHttpStatus(
      () =>
        DELETE({ params: { id: randomUUID() }, locals: { db } } as Parameters<
          typeof DELETE
        >[0]),
      404,
    );
  });

  it("removes the template row on success", async () => {
    const db = getDb();
    const id = randomUUID();
    seedTemplate({
      id,
      workspaceId: null,
      title: "Delete me",
      description: "Temporary template",
      content: "Temporary content",
      createdAt: "2026-04-14T00:00:00.000Z",
    });

    const response = await DELETE({
      params: { id },
      locals: { db },
    } as Parameters<typeof DELETE>[0]);

    expect(response.status).toBe(204);

    const row = db
      .prepare("SELECT id FROM user_templates WHERE id = ?")
      .get(id) as { id: string } | undefined;

    expect(row).toBeUndefined();
  });
});
