/**
 * Server-side utilities for reading and writing notes (.md files).
 * All path operations go through safePath() to prevent directory traversal.
 *
 * SECURITY: See SECURITY.md for the full requirements.
 */

import { promises as fs } from "fs";
import { resolve, join, extname, basename, dirname, relative } from "path";
import type { FileNode } from "$lib/types";

/** Get the notes root directory from the environment variable */
export function getNotesDir(): string {
  const dir = process.env.NOTES_DIR;
  if (!dir) {
    throw new Error("NOTES_DIR environment variable is not set");
  }
  return resolve(dir);
}

/**
 * Resolves a user-provided path within the notes directory.
 * Throws if the resolved path escapes the notes directory root.
 */
export function safePath(userPath: string): string {
  const notesDir = getNotesDir();
  const resolvedBase = resolve(notesDir);
  const resolved = resolve(join(notesDir, userPath));
  const rel = relative(resolvedBase, resolved);
  if (rel.startsWith("..") || rel.startsWith("/") || rel.startsWith("\\")) {
    throw new Error("Path traversal attempt detected");
  }
  return resolved;
}

/** Recursively read a directory and return a FileNode tree */
export async function readTree(
  dirPath: string,
  relativeTo: string,
): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = fullPath
      .replace(relativeTo + "/", "")
      .replace(relativeTo + "\\", "");

    if (entry.isDirectory()) {
      const children = await readTree(fullPath, relativeTo);
      nodes.push({
        name: entry.name,
        path: relativePath.replace(/\\/g, "/"),
        type: "folder",
        children,
      });
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      nodes.push({
        name: basename(entry.name, ".md"),
        path: relativePath.replace(/\\/g, "/"),
        type: "file",
        extension: ".md",
      });
    }
  }

  // Sort: folders before files, then alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Apply custom sort order from the DB to a FileNode tree.
 * Nodes without a sort_order entry fall to the end (Infinity), then
 * tie-break: folders before files, then alphabetical.
 */
export function sortTreeNodes(
  nodes: FileNode[],
  sortMap: Map<string, number>,
): FileNode[] {
  return nodes
    .map((node) => ({
      ...node,
      sort_order: sortMap.get(node.path),
      children: node.children
        ? sortTreeNodes(node.children, sortMap)
        : undefined,
    }))
    .sort((a, b) => {
      const aOrder = a.sort_order ?? Infinity;
      const bOrder = b.sort_order ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // tie-break: folders before files, then alphabetical
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Read a note's content from disk */
export async function readNote(relativePath: string): Promise<string> {
  const filePath = safePath(relativePath);
  return fs.readFile(filePath, "utf-8");
}

/** Write a note's content to disk (creates the file if it does not exist) */
export async function writeNote(
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = safePath(relativePath);
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

/** Create a new .md file or directory */
export async function createNote(
  relativePath: string,
  isDirectory = false,
): Promise<void> {
  const filePath = safePath(relativePath);
  if (isDirectory) {
    await fs.mkdir(filePath, { recursive: true });
    // Mark the empty directory so git tracks it
    await fs.writeFile(join(filePath, ".gitkeep"), "");
  } else {
    await fs.mkdir(dirname(filePath), { recursive: true });
    // Create with empty content if it doesn't exist
    await fs.writeFile(filePath, "", { flag: "wx" });
    // Now that the directory has a real note, remove the placeholder
    const gitkeep = join(dirname(filePath), ".gitkeep");
    try {
      await fs.unlink(gitkeep);
    } catch {
      // .gitkeep may not exist - that's fine
    }
  }
}

/** Delete a note or directory */
export async function deleteNote(relativePath: string): Promise<void> {
  const filePath = safePath(relativePath);
  await fs.rm(filePath, { recursive: true, force: true });
}

function assertValidMovePath(path: string, label: string): void {
  const normalized = path.trim();
  if (!normalized) {
    throw new Error(`Invalid ${label} path`);
  }
  if (normalized.length > 512) {
    throw new Error(`Invalid ${label} path`);
  }
  if (normalized.includes("\0")) {
    throw new Error(`Invalid ${label} path`);
  }
  if (normalized.includes("..")) {
    throw new Error(`Invalid ${label} path`);
  }
  if (normalized.startsWith("/") || normalized.startsWith("\\")) {
    throw new Error(`Invalid ${label} path`);
  }
  const segments = normalized.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid ${label} path`);
  }
}

/** Rename or move a note */
export async function moveNote(
  fromPath: string,
  toPath: string,
): Promise<void> {
  assertValidMovePath(fromPath, "source");
  assertValidMovePath(toPath, "destination");

  const from = safePath(fromPath);
  const to = safePath(toPath);

  if (from === to) {
    return;
  }

  await fs.mkdir(dirname(to), { recursive: true });
  await fs.rename(from, to);
}

/**
 * Full-text search across all .md files in the notes directory.
 * Returns matching lines with file path and line number.
 */
export async function searchNotes(query: string): Promise<
  Array<{
    path: string;
    fileName: string;
    line: number;
    lineText: string;
    context: string;
  }>
> {
  const notesDir = getNotesDir();
  const results: Array<{
    path: string;
    fileName: string;
    line: number;
    lineText: string;
    context: string;
  }> = [];
  const queryLower = query.toLowerCase();

  async function searchDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await searchDir(fullPath);
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        const content = await fs.readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        const relativePath = fullPath
          .replace(notesDir + "/", "")
          .replace(notesDir + "\\", "")
          .replace(/\\/g, "/");

        lines.forEach((line: string, index: number) => {
          if (line.toLowerCase().includes(queryLower)) {
            const contextStart = Math.max(0, index - 1);
            const contextEnd = Math.min(lines.length - 1, index + 1);
            results.push({
              path: relativePath,
              fileName: basename(entry.name, ".md"),
              line: index + 1,
              lineText: line.trim(),
              context: lines.slice(contextStart, contextEnd + 1).join("\n"),
            });
          }
        });
      }
    }
  }

  await searchDir(notesDir);

  // Group by file and limit to 15 matches per file, 100 total.
  // The UI groups results by file so every match is displayed.
  const perFile = new Map<string, typeof results>();
  for (const r of results) {
    if (!perFile.has(r.path)) perFile.set(r.path, []);
    const arr = perFile.get(r.path)!;
    if (arr.length < 15) arr.push(r);
  }

  const final: typeof results = [];
  for (const arr of perFile.values()) {
    final.push(...arr);
    if (final.length >= 100) break;
  }
  return final;
}
