import { describe, expect, it } from "vitest";

import {
  parseOpLogCreateBody,
  parseOpLogPatchBody,
  parseRouteId,
} from "$lib/server/oplog-validation";

describe("parseRouteId", () => {
  it("returns safe text ids unchanged", () => {
    expect(parseRouteId("ws-123", "workspaceId")).toEqual({
      ok: true,
      data: "ws-123",
    });
  });

  it("rejects blank ids", () => {
    expect(parseRouteId("   ", "workspaceId")).toEqual({
      ok: false,
      error: "Invalid workspaceId",
    });
  });

  it("rejects ids with unsafe characters", () => {
    expect(parseRouteId("../bad", "entryId")).toEqual({
      ok: false,
      error: "Invalid entryId",
    });
  });
});

describe("parseOpLogCreateBody", () => {
  it("accepts valid create payload and normalizes timestamp", () => {
    const result = parseOpLogCreateBody({
      category: "recon",
      description: "Ran scan",
      host_id: "host-1",
      timestamp: "2026-04-29T12:34:56.000Z",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        category: "recon",
        description: "Ran scan",
        hostId: "host-1",
        timestamp: "2026-04-29T12:34:56.000Z",
      },
    });
  });

  it("rejects unknown fields", () => {
    expect(
      parseOpLogCreateBody({
        category: "recon",
        description: "Ran scan",
        timestamp: "2026-04-29T12:34:56.000Z",
        extra: true,
      }),
    ).toEqual({
      ok: false,
      error: "Unknown field: extra",
    });
  });

  it("rejects non-iso timestamps", () => {
    expect(
      parseOpLogCreateBody({
        description: "Ran scan",
        timestamp: "2026-04-29T12:34",
      }),
    ).toEqual({
      ok: false,
      error: "timestamp must be a valid ISO datetime",
    });
  });
});

describe("parseOpLogPatchBody", () => {
  it("rejects empty patch bodies", () => {
    expect(parseOpLogPatchBody({})).toEqual({
      ok: false,
      error: "At least one field is required",
    });
  });

  it("rejects unknown patch fields", () => {
    expect(
      parseOpLogPatchBody({
        description: "Updated",
        created_at: "2026-04-29T12:34:56.000Z",
      }),
    ).toEqual({
      ok: false,
      error: "Unknown field: created_at",
    });
  });

  it("accepts null host_id to clear host link", () => {
    expect(
      parseOpLogPatchBody({
        host_id: null,
      }),
    ).toEqual({
      ok: true,
      data: {
        hostId: null,
      },
    });
  });
});
