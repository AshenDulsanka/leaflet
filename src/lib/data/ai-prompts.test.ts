import { describe, expect, it } from "vitest";
import { AI_PROMPT_TEMPLATES, searchAiPrompts } from "$lib/data/ai-prompts.js";
import type { AiPromptCategory } from "$lib/types";

const VALID_CATEGORIES: AiPromptCategory[] = [
  "recon",
  "exploitation",
  "privesc",
  "post-exploitation",
  "reporting",
  "ad-attacks",
  "general",
];

describe("AI_PROMPT_TEMPLATES", () => {
  it("contains at least 6 templates", () => {
    expect(AI_PROMPT_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it("every template has a unique id", () => {
    const ids = AI_PROMPT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template has a unique title", () => {
    const titles = AI_PROMPT_TEMPLATES.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("every template has a valid category", () => {
    for (const t of AI_PROMPT_TEMPLATES) {
      expect(VALID_CATEGORIES).toContain(t.category);
    }
  });

  it("every template has non-empty title, description, and prompt", () => {
    for (const t of AI_PROMPT_TEMPLATES) {
      expect(t.title.trim()).toBeTruthy();
      expect(t.description.trim()).toBeTruthy();
      expect(t.prompt.trim()).toBeTruthy();
    }
  });

  it("covers at least 4 distinct categories", () => {
    const categories = new Set(AI_PROMPT_TEMPLATES.map((t) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });
});

describe("searchAiPrompts", () => {
  it("returns all templates when query is empty", () => {
    expect(searchAiPrompts("")).toHaveLength(AI_PROMPT_TEMPLATES.length);
  });

  it("returns all templates when query is whitespace-only", () => {
    expect(searchAiPrompts("   ")).toHaveLength(AI_PROMPT_TEMPLATES.length);
  });

  it("matches on title (case-insensitive)", () => {
    const results = searchAiPrompts("kerberoast");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.category === "ad-attacks")).toBe(true);
  });

  it("matches on description (case-insensitive)", () => {
    const results = searchAiPrompts("CVSS");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.category === "reporting")).toBe(true);
  });

  it("is case-insensitive", () => {
    const lower = searchAiPrompts("recon");
    const upper = searchAiPrompts("RECON");
    expect(lower).toEqual(upper);
  });

  it("returns empty array when nothing matches", () => {
    expect(searchAiPrompts("xyzzy_no_match_possible")).toHaveLength(0);
  });

  it("accepts a custom template list override", () => {
    const custom = [AI_PROMPT_TEMPLATES[0]];
    expect(searchAiPrompts("", custom)).toHaveLength(1);
  });
});
