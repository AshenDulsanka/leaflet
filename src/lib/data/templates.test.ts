import { describe, expect, it } from "vitest";
import { NOTE_TEMPLATES, searchTemplates } from "$lib/data/templates.js";

describe("NOTE_TEMPLATES", () => {
  it("contains exactly 5 templates", () => {
    expect(NOTE_TEMPLATES).toHaveLength(5);
  });

  it("every template has a unique id", () => {
    const ids = NOTE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template has non-empty title, description, and content", () => {
    for (const t of NOTE_TEMPLATES) {
      expect(t.title.trim()).toBeTruthy();
      expect(t.description.trim()).toBeTruthy();
      expect(t.content.trim()).toBeTruthy();
    }
  });
});

describe("searchTemplates", () => {
  it("returns all templates when query is empty", () => {
    expect(searchTemplates("")).toHaveLength(NOTE_TEMPLATES.length);
  });

  it("returns all templates when query is whitespace-only", () => {
    expect(searchTemplates("   ")).toHaveLength(NOTE_TEMPLATES.length);
  });

  it("matches on title (case-insensitive)", () => {
    const results = searchTemplates("recon");
    expect(results.some((t) => t.title === "Recon")).toBe(true);
  });

  it("matches on description (case-insensitive)", () => {
    // "Kerberoast" appears in the Active Directory template description
    const results = searchTemplates("kerberoast");
    expect(results.some((t) => t.title === "Active Directory")).toBe(true);
  });

  it("is case-insensitive for title match", () => {
    const lower = searchTemplates("active directory");
    const upper = searchTemplates("ACTIVE DIRECTORY");
    expect(lower).toEqual(upper);
  });

  it("returns empty array when nothing matches", () => {
    expect(searchTemplates("xyzzy_no_match_possible")).toHaveLength(0);
  });

  it("accepts a custom template list override", () => {
    const custom = [NOTE_TEMPLATES[0]];
    expect(searchTemplates("", custom)).toHaveLength(1);
  });
});
