import { json } from '@sveltejs/kit';
import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { getNotesDir } from '$lib/server/notes';
import type { RequestHandler } from './$types';

interface GraphNode {
  id: string;   // relative path e.g. "folder/note.md"
  name: string; // display name without .md
  folder: string; // top-level folder or "" for root
  linkCount: number;
}

interface GraphLink {
  source: string;
  target: string;
}

/** Recursively collect all .md files, returning { path, content } */
async function collectFiles(
  dir: string,
  root: string
): Promise<Array<{ path: string; name: string; folder: string; content: string }>> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: Array<{ path: string; name: string; folder: string; content: string }> = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const children = await collectFiles(fullPath, root);
      results.push(...children);
    } else if (entry.isFile() && extname(entry.name) === '.md') {
      const relativePath = fullPath.replace(root, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
      const topFolder = relativePath.includes('/') ? relativePath.split('/')[0] : '';
      const content = await fs.readFile(fullPath, 'utf-8');
      results.push({
        path: relativePath,
        name: basename(entry.name, '.md'),
        folder: topFolder,
        content
      });
    }
  }
  return results;
}

/** Extract [[wikilink]] targets from markdown content */
function extractWikilinks(content: string): string[] {
  const matches = [...content.matchAll(/\[\[([^\]|#]+?)(?:[|#][^\]]*?)?\]\]/g)];
  return matches.map((m) => m[1].trim());
}

export const GET: RequestHandler = async () => {
  const notesDir = getNotesDir();
  const files = await collectFiles(notesDir, notesDir);

  // Build a name→path lookup (case-insensitive, last-one-wins for duplicates)
  const nameToPath = new Map<string, string>();
  for (const f of files) {
    nameToPath.set(f.name.toLowerCase(), f.path);
  }

  // Build link counts and edges
  const linkCounts = new Map<string, number>();
  const links: GraphLink[] = [];

  for (const f of files) {
    const targets = extractWikilinks(f.content);
    for (const target of targets) {
      const targetPath = nameToPath.get(target.toLowerCase());
      if (targetPath && targetPath !== f.path) {
        links.push({ source: f.path, target: targetPath });
        linkCounts.set(f.path, (linkCounts.get(f.path) ?? 0) + 1);
        linkCounts.set(targetPath, (linkCounts.get(targetPath) ?? 0) + 1);
      }
    }
  }

  const nodes: GraphNode[] = files.map((f) => ({
    id: f.path,
    name: f.name,
    folder: f.folder,
    linkCount: linkCounts.get(f.path) ?? 0
  }));

  return json({ nodes, links });
};
