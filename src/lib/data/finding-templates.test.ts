import { describe, expect, it } from 'vitest';
import { FINDING_TEMPLATES, searchFindingTemplates } from '$lib/data/finding-templates.js';
import type { FindingTemplateCategory, FindingSeverity } from '$lib/types';

const VALID_CATEGORIES: FindingTemplateCategory[] = [
  'injection',
  'auth',
  'crypto',
  'exposure',
  'misc',
];

const VALID_SEVERITIES: FindingSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
  'none',
];

describe('FINDING_TEMPLATES', () => {
  it('contains at least 12 templates', () => {
    expect(FINDING_TEMPLATES.length).toBeGreaterThanOrEqual(12);
  });

  it('every template has a unique id', () => {
    const ids = FINDING_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has a unique title', () => {
    const titles = FINDING_TEMPLATES.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('every template has a valid category', () => {
    for (const t of FINDING_TEMPLATES) {
      expect(VALID_CATEGORIES).toContain(t.category);
    }
  });

  it('every template has a valid severity', () => {
    for (const t of FINDING_TEMPLATES) {
      expect(VALID_SEVERITIES).toContain(t.severity);
    }
  });

  it('every template has non-empty title and description', () => {
    for (const t of FINDING_TEMPLATES) {
      expect(t.title.trim()).toBeTruthy();
      expect(t.description.trim()).toBeTruthy();
    }
  });

  it('covers all 5 required categories', () => {
    const categories = new Set(FINDING_TEMPLATES.map((t) => t.category));
    for (const cat of VALID_CATEGORIES) {
      expect(categories).toContain(cat);
    }
  });

  it('every template with mitre_technique_id also has mitre_technique_name', () => {
    for (const t of FINDING_TEMPLATES) {
      if (t.mitre_technique_id) {
        expect(t.mitre_technique_name.trim()).toBeTruthy();
      }
    }
  });

  it('every template with empty mitre_technique_id also has empty mitre_technique_name', () => {
    for (const t of FINDING_TEMPLATES) {
      if (!t.mitre_technique_id) {
        expect(t.mitre_technique_name).toBe('');
      }
    }
  });
});

describe('searchFindingTemplates', () => {
  it('returns all templates when query is empty', () => {
    expect(searchFindingTemplates('')).toHaveLength(FINDING_TEMPLATES.length);
  });

  it('matches on title case-insensitively', () => {
    const lower = searchFindingTemplates('sql injection');
    const upper = searchFindingTemplates('SQL INJECTION');
    expect(lower.length).toBeGreaterThan(0);
    expect(lower).toEqual(upper);
  });

  it('matches on description', () => {
    const results = searchFindingTemplates('cipher suites');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.title === 'Weak TLS Configuration')).toBe(true);
  });

  it('returns empty array when nothing matches', () => {
    expect(searchFindingTemplates('xyzzy_no_match_possible')).toHaveLength(0);
  });

  it('accepts custom template list override', () => {
    const custom = [FINDING_TEMPLATES[0]];
    expect(searchFindingTemplates('', custom)).toHaveLength(1);
  });
});
