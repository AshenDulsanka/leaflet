import type { FileNode } from '$lib/types';

/** Returns the parent directory path, or '' for root-level items. */
export function getDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx >= 0 ? filePath.substring(0, idx) : '';
}

/** Build a map of path → node type from the full tree (including nested children). */
export function flattenPathTypeMap(ns: FileNode[]): Map<string, FileNode['type']> {
  const pathTypes = new Map<string, FileNode['type']>();
  const collect = (items: FileNode[]) => {
    for (const n of items) {
      pathTypes.set(n.path, n.type);
      if (n.children) collect(n.children);
    }
  };
  collect(ns);
  return pathTypes;
}

/**
 * Returns true when dropping `fromPath` onto `targetPath` would create an
 * invalid move — i.e. moving a folder into itself or one of its descendants.
 */
export function isInvalidFolderDropTarget(
  pathTypeMap: Map<string, FileNode['type']>,
  fromPath: string,
  targetPath: string,
): boolean {
  if (pathTypeMap.get(fromPath) !== 'folder') return false;
  return targetPath === fromPath || targetPath.startsWith(`${fromPath}/`);
}

/** Maps a vertical percentage within a drag target to a reorder position. */
export function getFileDropReorderPosition(pct: number): 'before' | 'after' {
  return pct < 0.5 ? 'before' : 'after';
}

/**
 * Returns a flat list of all folder paths (excluding `excludePath` subtree)
 * suitable for a "Move to…" destination picker.
 */
export function getFolderOptions(
  ns: FileNode[],
  excludePath: string,
): Array<{ path: string; name: string; depth: number }> {
  const result: Array<{ path: string; name: string; depth: number }> = [];
  function traverse(items: FileNode[], d: number) {
    for (const n of items) {
      if (n.type === 'folder') {
        if (n.path === excludePath || n.path.startsWith(excludePath + '/')) continue;
        result.push({ path: n.path, name: n.name, depth: d });
        if (n.children) traverse(n.children, d + 1);
      }
    }
  }
  traverse(ns, 0);
  return result;
}
