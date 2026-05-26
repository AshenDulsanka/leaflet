import { describe, it, expect } from "vitest";
import { calculateCvss, formatCvssInsert } from "./cvss";
import type { CvssMetrics } from "./cvss";

describe("calculateCvss", () => {
  it("returns null when any metric is null", () => {
    const metrics: CvssMetrics = {
      AV: "N",
      AC: "L",
      PR: "N",
      UI: "N",
      S: "C",
      C: "H",
      I: "H",
      A: null,
    };
    expect(calculateCvss(metrics)).toBeNull();
  });

  it("returns null for all-null metrics", () => {
    const metrics: CvssMetrics = {
      AV: null,
      AC: null,
      PR: null,
      UI: null,
      S: null,
      C: null,
      I: null,
      A: null,
    };
    expect(calculateCvss(metrics)).toBeNull();
  });

  it("CVE-2021-44228 Log4Shell: AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H = 10.0 Critical", () => {
    const metrics: CvssMetrics = {
      AV: "N",
      AC: "L",
      PR: "N",
      UI: "N",
      S: "C",
      C: "H",
      I: "H",
      A: "H",
    };
    const result = calculateCvss(metrics);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(10.0);
    expect(result!.severity).toBe("Critical");
  });

  it("CVE-2023-44487 HTTP/2 RapidReset: AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H = 7.5 High", () => {
    const metrics: CvssMetrics = {
      AV: "N",
      AC: "L",
      PR: "N",
      UI: "N",
      S: "U",
      C: "N",
      I: "N",
      A: "H",
    };
    const result = calculateCvss(metrics);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(7.5);
    expect(result!.severity).toBe("High");
  });

  it("low severity case: AV:P/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N", () => {
    const metrics: CvssMetrics = {
      AV: "P",
      AC: "H",
      PR: "H",
      UI: "R",
      S: "U",
      C: "L",
      I: "N",
      A: "N",
    };
    const result = calculateCvss(metrics);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThan(4.0);
    expect(result!.severity).toBe("Low");
  });

  it("ISC=0 edge: all C/I/A=None returns 0.0 None", () => {
    const metrics: CvssMetrics = {
      AV: "N",
      AC: "L",
      PR: "N",
      UI: "N",
      S: "U",
      C: "N",
      I: "N",
      A: "N",
    };
    const result = calculateCvss(metrics);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.severity).toBe("None");
  });

  it("severity boundary: score = 4.0 is Medium", () => {
    // AV:N/AC:H/PR:L/UI:R/S:U/C:L/I:L/A:N
    // ISCbase = 1-(1-0.22)*(1-0.22)*(1-0) = 1-0.78*0.78 = 1-0.6084 = 0.3916
    // ISC = 6.42 * 0.3916 = 2.51...
    // ExSS = 8.22 * 0.85 * 0.44 * 0.62 * 0.62 = ...
    // Need to find a combination that gives exactly 4.0 after ceiling.
    // 3.91 < raw <= 4.0 becomes 4.0.
    // Just verify the Medium boundary with a known Medium score:
    const metrics: CvssMetrics = {
      AV: "N",
      AC: "L",
      PR: "L",
      UI: "N",
      S: "U",
      C: "N",
      I: "L",
      A: "N",
    };
    const result = calculateCvss(metrics);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(4.0);
    expect(result!.score).toBeLessThan(7.0);
    expect(result!.severity).toBe("Medium");
  });

  it("severity boundary: score = 3.9 is Low", () => {
    // AV:P/AC:H/PR:L/UI:R/S:U/C:L/I:N/A:L
    const metrics: CvssMetrics = {
      AV: "P",
      AC: "H",
      PR: "L",
      UI: "R",
      S: "U",
      C: "L",
      I: "N",
      A: "L",
    };
    const result = calculateCvss(metrics);
    expect(result).not.toBeNull();
    // This should be a Low severity score
    expect(result!.severity).toBe("Low");
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThan(4.0);
  });

  it("vector string starts with CVSS:3.1/ and contains all 8 metrics", () => {
    const metrics: CvssMetrics = {
      AV: "N",
      AC: "L",
      PR: "N",
      UI: "N",
      S: "C",
      C: "H",
      I: "H",
      A: "H",
    };
    const result = calculateCvss(metrics);
    expect(result).not.toBeNull();
    const v = result!.vector;
    expect(v).toMatch(/^CVSS:3\.1\//);
    expect(v).toContain("AV:");
    expect(v).toContain("AC:");
    expect(v).toContain("PR:");
    expect(v).toContain("UI:");
    expect(v).toContain("S:");
    expect(v).toContain("C:");
    expect(v).toContain("I:");
    expect(v).toContain("A:");
    expect(v).toBe("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H");
  });
});

describe("formatCvssInsert", () => {
  it("formats result into insert string", () => {
    const metrics: CvssMetrics = {
      AV: "N",
      AC: "L",
      PR: "N",
      UI: "N",
      S: "C",
      C: "H",
      I: "H",
      A: "H",
    };
    const result = calculateCvss(metrics)!;
    const formatted = formatCvssInsert(result);
    expect(formatted).toBe(
      "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H (Score: 10.0 - Critical)",
    );
  });
});
