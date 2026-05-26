import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

// Isolate each test with a fresh temp DB directory
const tempRoot = join(tmpdir(), `leaflet-screenshots-test-${randomUUID()}`);
process.env.NOTES_DATA_DIR = join(tempRoot, 'data');
process.env.SCREENSHOTS_DIR = join(tempRoot, 'screenshots');

const { getDb, reloadDb } = await import('$lib/server/database.js');
const {
  getScreenshotsDir,
  saveScreenshot,
  insertScreenshotMetadata,
  getScreenshotMetadataForWorkspace,
  updateScreenshotMetadata,
  deleteScreenshotMetadata,
} = await import('$lib/server/screenshots.js');

/** Insert a minimal workspace row so FK constraints pass. */
function seedWorkspace(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
     VALUES (?, ?, 'general', '#6366f1', ?, ?, ?)`
  ).run(id, `ws-${id}`, `folder-${id}`, now, now);
}

afterEach(() => {
  reloadDb();
  return fs.rm(tempRoot, { recursive: true, force: true });
});

afterAll(async () => {
  reloadDb();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe('getScreenshotsDir', () => {
  it('returns the configured screenshots directory as an absolute path', () => {
    expect(getScreenshotsDir()).toBe(join(tempRoot, 'screenshots'));
  });
});

describe('saveScreenshot', () => {
  it('writes a screenshot file and normalizes the extension', async () => {
    const filename = await saveScreenshot(Buffer.from('hello'), ' JPEG ');

    expect(filename.endsWith('.jpeg')).toBe(true);

    const contents = await fs.readFile(join(getScreenshotsDir(), filename), 'utf-8');
    expect(contents).toBe('hello');
  });

  it('rejects invalid or path-like extensions', async () => {
    for (const extension of ['..', '../png', 'png/evil', 'png\\evil', 'bmp']) {
      await expect(saveScreenshot(Buffer.from('x'), extension)).rejects.toThrow(
        'Invalid screenshot extension'
      );
    }
  });
});

describe('insertScreenshotMetadata', () => {
  it('creates a metadata row for a new screenshot', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, '1234567890.png');

    const db = getDb();
    const row = db
      .prepare(`SELECT filename, caption, linked_note_path FROM screenshot_metadata WHERE workspace_id = ?`)
      .get(wsId) as { filename: string; caption: string; linked_note_path: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.filename).toBe('1234567890.png');
    expect(row?.caption).toBe('');
    expect(row?.linked_note_path).toBe('');
  });

  it('is idempotent (INSERT OR IGNORE) for the same workspace+filename', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, 'dupe.png');
    insertScreenshotMetadata(wsId, 'dupe.png'); // should not throw

    const db = getDb();
    const rows = db
      .prepare(`SELECT id FROM screenshot_metadata WHERE workspace_id = ? AND filename = ?`)
      .all(wsId, 'dupe.png') as { id: string }[];

    expect(rows.length).toBe(1);
  });
});

describe('getScreenshotMetadataForWorkspace', () => {
  beforeEach(() => {
    reloadDb();
  });

  it('returns an empty map when no metadata exists', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    const result = getScreenshotMetadataForWorkspace(wsId);
    expect(result.size).toBe(0);
  });

  it('returns a map keyed by filename', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, 'a.png');
    insertScreenshotMetadata(wsId, 'b.png');

    const result = getScreenshotMetadataForWorkspace(wsId);
    expect(result.size).toBe(2);
    expect(result.has('a.png')).toBe(true);
    expect(result.has('b.png')).toBe(true);
  });

  it('does not return rows from other workspaces', () => {
    const wsA = randomUUID();
    const wsB = randomUUID();
    seedWorkspace(wsA);
    seedWorkspace(wsB);
    insertScreenshotMetadata(wsA, 'only-in-a.png');

    const result = getScreenshotMetadataForWorkspace(wsB);
    expect(result.size).toBe(0);
  });
});

describe('updateScreenshotMetadata', () => {
  beforeEach(() => {
    reloadDb();
  });

  it('updates caption', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, 'cap.png');

    updateScreenshotMetadata('cap.png', wsId, { caption: 'My caption' });

    const db = getDb();
    const row = db
      .prepare(`SELECT caption FROM screenshot_metadata WHERE workspace_id = ? AND filename = ?`)
      .get(wsId, 'cap.png') as { caption: string } | undefined;

    expect(row?.caption).toBe('My caption');
  });

  it('updates linked_note_path', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, 'link.png');

    updateScreenshotMetadata('link.png', wsId, { linked_note_path: 'folder/my-note.md' });

    const db = getDb();
    const row = db
      .prepare(`SELECT linked_note_path FROM screenshot_metadata WHERE workspace_id = ? AND filename = ?`)
      .get(wsId, 'link.png') as { linked_note_path: string } | undefined;

    expect(row?.linked_note_path).toBe('folder/my-note.md');
  });

  it('updates both fields in one call', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, 'both.png');

    updateScreenshotMetadata('both.png', wsId, {
      caption: 'Hello',
      linked_note_path: 'notes/test.md',
    });

    const db = getDb();
    const row = db
      .prepare(`SELECT caption, linked_note_path FROM screenshot_metadata WHERE workspace_id = ? AND filename = ?`)
      .get(wsId, 'both.png') as { caption: string; linked_note_path: string } | undefined;

    expect(row?.caption).toBe('Hello');
    expect(row?.linked_note_path).toBe('notes/test.md');
  });

  it('is a no-op when patch is empty', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, 'noop.png');

    // Should not throw
    expect(() => updateScreenshotMetadata('noop.png', wsId, {})).not.toThrow();
  });
});

describe('deleteScreenshotMetadata', () => {
  beforeEach(() => {
    reloadDb();
  });

  it('removes the metadata row', () => {
    const wsId = randomUUID();
    seedWorkspace(wsId);
    insertScreenshotMetadata(wsId, 'del.png');

    deleteScreenshotMetadata('del.png');

    const db = getDb();
    const row = db
      .prepare(`SELECT id FROM screenshot_metadata WHERE filename = ?`)
      .get('del.png');

    expect(row).toBeUndefined();
  });

  it('is safe to call when no row exists', () => {
    expect(() => deleteScreenshotMetadata('nonexistent.png')).not.toThrow();
  });

  it('removes rows across all workspaces for that filename', () => {
    const wsA = randomUUID();
    const wsB = randomUUID();
    seedWorkspace(wsA);
    seedWorkspace(wsB);
    insertScreenshotMetadata(wsA, 'multi.png');
    insertScreenshotMetadata(wsB, 'multi.png');

    deleteScreenshotMetadata('multi.png');

    const db = getDb();
    const rows = db
      .prepare(`SELECT id FROM screenshot_metadata WHERE filename = ?`)
      .all('multi.png') as { id: string }[];

    expect(rows.length).toBe(0);
  });
});
