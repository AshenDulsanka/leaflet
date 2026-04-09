import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { getNotesDir, safePath } from '$lib/server/notes';

const TEST_DIR = join(tmpdir(), 'leaflet-notes-test');

describe('getNotesDir', () => {
  it('throws when NOTES_DIR is not set', () => {
    const prev = process.env.NOTES_DIR;
    delete process.env.NOTES_DIR;
    expect(() => getNotesDir()).toThrow('NOTES_DIR environment variable is not set');
    if (prev !== undefined) process.env.NOTES_DIR = prev;
  });

  it('returns the configured directory', () => {
    process.env.NOTES_DIR = TEST_DIR;
    expect(getNotesDir()).toBe(TEST_DIR);
    delete process.env.NOTES_DIR;
  });
});

describe('safePath', () => {
  beforeEach(() => {
    process.env.NOTES_DIR = TEST_DIR;
  });

  afterEach(() => {
    delete process.env.NOTES_DIR;
  });

  it('resolves a valid relative path within the notes dir', () => {
    const result = safePath('workspace/note.md');
    expect(result).toBe(join(TEST_DIR, 'workspace', 'note.md'));
  });

  it('throws on a path traversal attempt', () => {
    expect(() => safePath('../../etc/passwd')).toThrow('Path traversal attempt detected');
  });
});
