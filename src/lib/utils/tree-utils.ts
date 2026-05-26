/**
 * Pure recursive utility functions for operating on the FileNode tree.
 * All functions are stateless and return new structures instead of mutating.
 */
import type { FileNode } from "$lib/types";

/**
 * Move a node from `fromPath` into the folder at `toFolderPath` (top-level if empty).
 * Returns a new tree with the node relocated and all descendant paths rewritten.
 */
export function applyMove(
  nodes: FileNode[],
  fromPath: string,
  toFolderPath: string,
): FileNode[] {
  const filename = fromPath.split("/").pop()!;

  function removeNode(items: FileNode[]): {
    found: FileNode | null;
    remaining: FileNode[];
  } {
    const remaining: FileNode[] = [];
    let found: FileNode | null = null;
    for (const n of items) {
      if (n.path === fromPath) {
        found = n;
      } else if (n.children) {
        const result = removeNode(n.children);
        remaining.push({ ...n, children: result.remaining });
        if (result.found) found = result.found;
      } else {
        remaining.push(n);
      }
    }
    return { found, remaining };
  }

  function rewritePaths(
    node: FileNode,
    oldPrefix: string,
    newPrefix: string,
  ): FileNode {
    const newPath = node.path.startsWith(oldPrefix + "/")
      ? newPrefix + node.path.slice(oldPrefix.length)
      : node.path;
    return {
      ...node,
      path: newPath,
      children: node.children?.map((c) =>
        rewritePaths(c, oldPrefix, newPrefix),
      ),
    };
  }

  function insertNode(items: FileNode[], movedNode: FileNode): FileNode[] {
    if (!toFolderPath) {
      const newPath = filename;
      return [...items, rewritePaths(movedNode, fromPath, newPath)];
    }
    return items.map((n) => {
      if (n.path === toFolderPath && n.type === "folder") {
        const newPath = `${toFolderPath}/${filename}`;
        return {
          ...n,
          children: [
            ...(n.children ?? []),
            rewritePaths(movedNode, fromPath, newPath),
          ],
        };
      }
      if (n.children) {
        return { ...n, children: insertNode(n.children, movedNode) };
      }
      return n;
    });
  }

  const { found, remaining } = removeNode(nodes);
  if (!found) return nodes;
  return insertNode(remaining, found);
}

/**
 * Reorder nodes at whichever tree level contains the given paths.
 * Returns a new tree with the affected level reordered.
 */
export function applyReorder(
  nodes: FileNode[],
  orderedPaths: string[],
): FileNode[] {
  if (nodes.some((n) => orderedPaths.includes(n.path))) {
    return orderedPaths
      .map((p) => nodes.find((n) => n.path === p)!)
      .filter(Boolean);
  }
  return nodes.map((n) => ({
    ...n,
    children: n.children ? applyReorder(n.children, orderedPaths) : undefined,
  }));
}

/**
 * Flatten all file paths in the tree (folders excluded).
 * Used for wikilink autocomplete suggestions.
 */
export function flattenTree(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      paths.push(node.path);
    } else if (node.children) {
      paths.push(...flattenTree(node.children));
    }
  }
  return paths;
}

/**
 * Find the first file path in the tree whose name (without .md) matches `name`
 * (case-insensitive). Returns `null` if not found.
 */
export function findNoteByName(nodes: FileNode[], name: string): string | null {
  const lower = name.toLowerCase();
  for (const node of nodes) {
    if (node.type === "file") {
      const nodeName = node.name.replace(/\.md$/i, "").toLowerCase();
      if (nodeName === lower) return node.path;
    } else if (node.children) {
      const found = findNoteByName(node.children, name);
      if (found) return found;
    }
  }
  return null;
}
