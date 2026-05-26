import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// import type only — erased at runtime, safe alongside vi.resetModules()
import type { MitreTechnique } from "./+server.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MINIMAL_STIX_BUNDLE = {
  type: "bundle",
  objects: [
    {
      type: "attack-pattern",
      name: "PowerShell",
      description:
        "Adversaries may abuse PowerShell commands and scripts for execution.",
      external_references: [
        {
          source_name: "mitre-attack",
          external_id: "T1059.001",
          url: "https://attack.mitre.org/techniques/T1059/001",
        },
      ],
      kill_chain_phases: [
        { kill_chain_name: "mitre-attack", phase_name: "execution" },
      ],
    },
  ],
};

function mockOkFetch(
  bundle: object = MINIMAL_STIX_BUNDLE,
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(bundle),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-test module reset — clears the module-level cache variables
// (cachedTechniques, cacheTimestamp) so every test starts with a cold cache.
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/mitre", () => {
  it("returns 503 with an error message when upstream fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const { GET } = await import("./+server.js");

    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("returns 503 when upstream responds with a non-ok HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502 }),
    );
    const { GET } = await import("./+server.js");

    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(503);
  });

  it("returns 200 with an array of MitreTechnique objects on success", async () => {
    vi.stubGlobal("fetch", mockOkFetch());
    const { GET } = await import("./+server.js");

    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);
    const techniques = (await response.json()) as MitreTechnique[];
    expect(Array.isArray(techniques)).toBe(true);
    expect(techniques).toHaveLength(1);
  });

  it("extracts correct external_id, name, tactic, description, and url", async () => {
    vi.stubGlobal("fetch", mockOkFetch());
    const { GET } = await import("./+server.js");

    const response = await GET({} as Parameters<typeof GET>[0]);
    const [technique] = (await response.json()) as MitreTechnique[];

    expect(technique?.external_id).toBe("T1059.001");
    expect(technique?.name).toBe("PowerShell");
    expect(technique?.tactic).toBe("execution");
    expect(technique?.description).toBe(
      "Adversaries may abuse PowerShell commands and scripts for execution.",
    );
    expect(technique?.url).toBe(
      "https://attack.mitre.org/techniques/T1059/001",
    );
    expect(technique?.description.length).toBeLessThanOrEqual(300);
  });

  it("truncates description to at most 300 characters", async () => {
    const longBundle = {
      type: "bundle",
      objects: [
        {
          ...MINIMAL_STIX_BUNDLE.objects[0],
          description: "x".repeat(500),
        },
      ],
    };
    vi.stubGlobal("fetch", mockOkFetch(longBundle));
    const { GET } = await import("./+server.js");

    const response = await GET({} as Parameters<typeof GET>[0]);
    const [technique] = (await response.json()) as MitreTechnique[];

    expect(technique?.description).toHaveLength(300);
  });

  it("returns cached data on second call without re-fetching upstream", async () => {
    const mockFetch = mockOkFetch();
    vi.stubGlobal("fetch", mockFetch);
    const { GET } = await import("./+server.js");

    const r1 = await GET({} as Parameters<typeof GET>[0]);
    const r2 = await GET({} as Parameters<typeof GET>[0]);

    // fetch must have been called exactly once despite two GET invocations
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const t1 = (await r1.json()) as MitreTechnique[];
    const t2 = (await r2.json()) as MitreTechnique[];
    expect(t1).toEqual(t2);
  });
});
