/**
 * Shared types and pure utility functions for the editor's find/replace feature.
 */

export interface FindOptions {
  caseSensitive: boolean;
  useRegex: boolean;
  wholeWord: boolean;
}

/**
 * Compute all match positions for `query` in `text` given the options.
 * Returns an empty array when query is empty or when the regex is invalid.
 */
export function computeMatches(
  text: string,
  query: string,
  opts: FindOptions,
): Array<{ start: number; end: number }> {
  if (!query) return [];
  try {
    let pattern = opts.useRegex
      ? query
      : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
    // 'gid' is not universally supported — fall back gracefully
    const safeFlags = opts.caseSensitive ? "g" : "gi";
    const regex = new RegExp(pattern, safeFlags);
    const matches: Array<{ start: number; end: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) regex.lastIndex++; // prevent infinite loop on zero-width match
    }
    return matches;
  } catch {
    return []; // invalid regex
  }
}
