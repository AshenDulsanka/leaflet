/**
 * ProseMirror decoration helpers for [[wikilink]] syntax highlighting.
 * Imported by the Milkdown plugin wired into the WYSIWYG editor.
 */
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';

/**
 * Regex for matching [[wikilink]] syntax.
 * Must have lastIndex reset before each use (module-level; reset manually).
 */
export const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Build a DecorationSet that renders [[brackets]] invisible and the link
 * name with the `wikilink-name` class for styling.
 */
export function buildWikilinkDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (!node.isText || !node.text) return;
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(node.text)) !== null) {
      const start = pos + m.index;
      const end = start + m[0].length;
      const nameStart = start + 2;
      const nameEnd = end - 2;
      decorations.push(
        Decoration.inline(start, nameStart, {
          class: 'wikilink-bracket',
          style: 'font-size:0;line-height:0;opacity:0;color:transparent'
        })
      );
      decorations.push(Decoration.inline(nameStart, nameEnd, { class: 'wikilink-name' }));
      decorations.push(
        Decoration.inline(nameEnd, end, {
          class: 'wikilink-bracket',
          style: 'font-size:0;line-height:0;opacity:0;color:transparent'
        })
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}
