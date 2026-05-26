import { describe, expect, it } from "vitest";

import {
  buildGitArgs,
  buildGitAuthHeader,
  parseAheadBehindCounts,
  getSyncRecommendation,
  resolveStatusOptions,
  sanitizeGitError,
} from "$lib/server/sync.js";

describe("parseAheadBehindCounts", () => {
  it("parses behind/ahead counts from rev-list output", () => {
    expect(parseAheadBehindCounts("3\t2")).toEqual({ behind: 3, ahead: 2 });
  });

  it("returns zero counts for malformed output", () => {
    expect(parseAheadBehindCounts("nonsense")).toEqual({ behind: 0, ahead: 0 });
  });
});

describe("getSyncRecommendation", () => {
  it("returns pull when remote is ahead only", () => {
    expect(
      getSyncRecommendation({ hasRemote: true, ahead: 0, behind: 2 }),
    ).toBe("pull");
  });

  it("returns push when local is ahead only", () => {
    expect(
      getSyncRecommendation({ hasRemote: true, ahead: 4, behind: 0 }),
    ).toBe("push");
  });

  it("returns both when local and remote diverged", () => {
    expect(
      getSyncRecommendation({ hasRemote: true, ahead: 1, behind: 1 }),
    ).toBe("both");
  });

  it("returns none when no remote exists", () => {
    expect(
      getSyncRecommendation({ hasRemote: false, ahead: 5, behind: 5 }),
    ).toBe("none");
  });
});

describe("sanitizeGitError", () => {
  it("maps authentication failures to a safe generic error", () => {
    const error = new Error(
      "fatal: could not read Username for https://github.com/org/repo.git: terminal prompts disabled",
    );

    expect(sanitizeGitError(error)).toBe(
      "Git authentication failed. Check remote credentials.",
    );
  });

  it("maps non-fast-forward push failures to pull-first guidance", () => {
    const error = new Error("! [rejected] main -> main (non-fast-forward)");

    expect(sanitizeGitError(error)).toBe(
      "Remote contains newer commits. Pull before pushing.",
    );
  });

  it("does not leak arbitrary git internals to the client", () => {
    const error = new Error(
      "fatal: internal path C:/secret/repo/.git/config exploded",
    );

    const sanitized = sanitizeGitError(error);
    expect(sanitized).toBe(
      "Git operation failed. Verify repository and remote configuration.",
    );
    expect(sanitized).not.toContain("C:/secret/repo");
    expect(sanitized).not.toContain("exploded");
  });
});

describe("buildGitAuthHeader", () => {
  it("builds basic auth header for https remotes only", () => {
    const header = buildGitAuthHeader(
      "https://github.com/org/repo.git",
      "secret-token",
    );

    expect(header).toBe(
      "AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46c2VjcmV0LXRva2Vu",
    );
  });

  it("returns null when token is missing", () => {
    expect(
      buildGitAuthHeader("https://github.com/org/repo.git", undefined),
    ).toBeNull();
  });

  it("returns null for non-https remotes", () => {
    expect(
      buildGitAuthHeader("git@github.com:org/repo.git", "secret-token"),
    ).toBeNull();
  });
});

describe("buildGitArgs", () => {
  it("injects auth header via git -c when provided", () => {
    const args = buildGitArgs(["push"], "AUTHORIZATION: basic token");

    expect(args).toEqual([
      "-c",
      "http.extraheader=AUTHORIZATION: basic token",
      "push",
    ]);
  });

  it("returns original argv when auth header is not provided", () => {
    const args = buildGitArgs(["fetch", "origin", "--quiet"], null);

    expect(args).toEqual(["fetch", "origin", "--quiet"]);
  });
});

describe("resolveStatusOptions", () => {
  it("enables remote fetch only when includeRemote is explicitly true", () => {
    expect(resolveStatusOptions({ includeRemote: true })).toEqual({
      includeRemote: true,
    });
  });

  it("defaults includeRemote to false for missing or invalid payloads", () => {
    expect(resolveStatusOptions(undefined)).toEqual({ includeRemote: false });
    expect(resolveStatusOptions({})).toEqual({ includeRemote: false });
    expect(resolveStatusOptions({ includeRemote: "yes" })).toEqual({
      includeRemote: false,
    });
  });
});
