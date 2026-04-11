import { describe, expect, it } from 'vitest';
import { MITRE_TECHNIQUES, getMitreTechnique, searchMitreTechniques } from '$lib/data/mitre-attack.js';

describe('MITRE_TECHNIQUES', () => {
  it('contains at least 120 techniques', () => {
    expect(MITRE_TECHNIQUES.length).toBeGreaterThanOrEqual(120);
  });

  it('every entry has a unique id', () => {
    const ids = MITRE_TECHNIQUES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has non-empty id, name, and tactic', () => {
    for (const t of MITRE_TECHNIQUES) {
      expect(t.id.trim()).toBeTruthy();
      expect(t.name.trim()).toBeTruthy();
      expect(t.tactic.trim()).toBeTruthy();
    }
  });
});

describe('getMitreTechnique', () => {
  it('returns a known technique by exact ID', () => {
    const t = getMitreTechnique('T1059');
    expect(t).toBeDefined();
    expect(t?.name).toBe('Command and Scripting Interpreter');
  });

  it('returns a known sub-technique by exact ID', () => {
    const t = getMitreTechnique('T1059.001');
    expect(t).toBeDefined();
    expect(t?.tactic).toBe('Execution');
  });

  it('is case-insensitive', () => {
    expect(getMitreTechnique('t1059')).toEqual(getMitreTechnique('T1059'));
  });

  it('returns undefined for an unknown ID', () => {
    expect(getMitreTechnique('T9999')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getMitreTechnique('')).toBeUndefined();
  });
});

describe('searchMitreTechniques', () => {
  it('returns results for a partial name match', () => {
    const results = searchMitreTechniques('powershell');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.id === 'T1059.001')).toBe(true);
  });

  it('returns results for a partial ID match', () => {
    const results = searchMitreTechniques('T1059');
    expect(results.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const lower = searchMitreTechniques('lsass');
    const upper = searchMitreTechniques('LSASS');
    expect(lower).toEqual(upper);
  });

  it('returns empty array for a nonsense query', () => {
    expect(searchMitreTechniques('xyzzy_no_match_possible_abc123')).toHaveLength(0);
  });

  it('returns at most 8 results', () => {
    // 'T1' matches almost everything — there should still be a cap of 8
    const results = searchMitreTechniques('T1');
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('returns empty array for empty query', () => {
    expect(searchMitreTechniques('')).toHaveLength(0);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(searchMitreTechniques('   ')).toHaveLength(0);
  });
});
