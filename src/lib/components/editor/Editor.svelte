<script lang="ts">
  import '@milkdown/crepe/theme/common/style.css';
  import '@milkdown/crepe/theme/frame.css';
  import { onMount, onDestroy, untrack } from 'svelte';
  import { Crepe } from '@milkdown/crepe';
  import { editorViewCtx, parserCtx } from '@milkdown/core';
  import ImageToolbar from '$lib/components/editor/ImageToolbar.svelte';
  // Builds a DecorationSet that highlights all [[note]] spans in the document.
  // Receives ProseMirror classes as parameters (dynamic import - bypasses pnpm isolation).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildWikilinkDecorations(doc: any, Decoration: any, DecorationSet: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decorations: any[] = [];
    const WIKI_RE = /\[\[([^\]]+)\]\]/g;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      WIKI_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WIKI_RE.exec(node.text)) !== null) {
        decorations.push(
          Decoration.inline(pos + m.index, pos + m.index + m[0].length, {
            class: 'wikilink-highlight',
            nodeName: 'span'
          })
        );
      }
    });
    return DecorationSet.create(doc, decorations);
  }

  interface FindOptions {
    caseSensitive: boolean;
    useRegex: boolean;
    wholeWord: boolean;
  }

  interface EditorApi {
    insertText: (text: string) => void;
    findOccurrenceCount: (query: string, opts: FindOptions) => number;
    scrollToOccurrence: (query: string, opts: FindOptions, index: number) => void;
    setFindHighlights: (query: string, opts: FindOptions, currentIndex: number) => void;
    clearFindHighlights: () => void;
    getHtml: () => string;
    resetContent: (content: string) => void;
  }

  interface Props {
    mode: 'wysiwyg' | 'source';
    content: string;
    filePath: string;
    scrollTarget?: { line: number; lineText: string } | null;
    onContentChange: (content: string) => void;
    onWordCountChange: (count: number) => void;
    onReady?: (api: EditorApi) => void;
    onImageClick?: (src: string, alt: string) => void;
    onWikilinkClick?: (noteName: string) => void;
    noteSuggestions?: string[];
  }

  let { mode, content, filePath, scrollTarget = $bindable(null), onContentChange, onWordCountChange, onReady, onImageClick, onWikilinkClick, noteSuggestions = [] }: Props = $props();

  // Editor container ref
  let milkdownContainer = $state<HTMLDivElement | null>(null);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let lineNumberGutterEl = $state<HTMLDivElement | null>(null);

  // Image toolbar state - set when user clicks an image in WYSIWYG mode
  interface ImageToolbarState { rect: DOMRect; src: string; alt: string; pmPos: number }
  let imageToolbarState = $state<ImageToolbarState | null>(null);

  // Wikilink autocomplete dropdown state
  interface WikilinkDropdownState {
    query: string;
    fromPos: number;
    x: number;
    y: number;
    selectedIndex: number;
  }
  let wikilinkDropdown = $state<WikilinkDropdownState | null>(null);
  let dropdownSearchText = $state('');
  const wikilinkFiltered = $derived.by(() => {
    if (!wikilinkDropdown) return [] as string[];
    // Use explicit search box text if provided; otherwise use query from typed [[...text
    const q = (dropdownSearchText.trim() || wikilinkDropdown.query).toLowerCase();
    return noteSuggestions
      .filter((p) => {
        const name = p.split('/').pop()!.replace(/\.md$/i, '').toLowerCase();
        return name.includes(q) || p.toLowerCase().includes(q);
      })
      .slice(0, 50);
  });

  // Cleanup refs for ProseMirror view DOM event listeners
  let viewListenerDom: HTMLElement | null = null;
  let viewKeyupRef: (() => void) | null = null;
  let viewInputRef: (() => void) | null = null;
  let viewKeydownRef: ((e: KeyboardEvent) => void) | null = null;

  // Close image toolbar when clicking outside the toolbar (the toolbar uses
  // onpointerdown|stopPropagation to absorb events directed at itself).
  $effect(() => {
    if (!imageToolbarState) return;
    function close() { imageToolbarState = null; }
    const tid = setTimeout(() => window.addEventListener('pointerdown', close), 10);
    return () => { clearTimeout(tid); window.removeEventListener('pointerdown', close); };
  });

  // Internal content state - syncs between modes
  let internalContent = $state(untrack(() => content));

  // Derived line numbers for source mode gutter (one entry per line)
  const sourceLineNumbers = $derived(internalContent.split('\n').map((_, i) => i + 1));

  // Keep line number gutter scroll in sync with the textarea
  function syncGutterScroll() {
    if (lineNumberGutterEl && textareaEl) lineNumberGutterEl.scrollTop = textareaEl.scrollTop;
  }

  let crepeEditor: InstanceType<typeof Crepe> | null = null;
  let mounted = $state(false);

  // Lifted to component scope so destroyEditor() can set it false BEFORE calling
  // crepeEditor.destroy(). Crepe (ProseMirror) can fire a final markdownUpdated
  // event during teardown - if editorReady is still true at that point,
  // internalContent would be overwritten with an empty string, causing a blank
  // editor when switching back to WYSIWYG mode.
  // $state so the scroll $effect below re-runs when it transitions to true.
  let editorReady = $state(false);

  // Consume scrollTarget whenever the editor is ready AND a target is pending.
  // Works for both cases:
  //   same file - editorReady already true; effect fires immediately on target change.
  //   different file - target set before re-init; effect fires when editorReady goes true.
  $effect(() => {
    const t = scrollTarget;
    if (editorReady && t) {
      scrollTarget = null;
      requestAnimationFrame(() => performScroll(t.line, t.lineText));
    }
  });

  // Recount words from raw markdown
  function countWords(md: string): number {
    return md
      .replace(/```[\s\S]*?```/g, '')  // strip code blocks
      .replace(/`[^`]*`/g, '')          // strip inline code
      .replace(/#+\s/g, '')             // strip headings
      .replace(/[*_~[\]()#>`\-+]/g, '') // strip md syntax
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  // Update word count whenever content changes
  $effect(() => {
    onWordCountChange(countWords(internalContent));
  });

  // When the active FILE changes, load its content into the editor.
  // Deliberately does NOT track `content` as a dependency - only `filePath`.
  // Tracking content would cause the editor to re-create on every keystroke
  // because internalContent updates synchronously (from Milkdown) while the
  // parent's `content` prop updates asynchronously, making them momentarily
  // unequal and triggering an unwanted recreate.
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    filePath; // only reactive dependency
    const newContent = untrack(() => content);
    internalContent = newContent;
    // If already mounted and in WYSIWYG mode, reload the editor with new content
    if (untrack(() => mounted) && crepeEditor) {
      recreateEditor();
    }
  });

  async function initEditor() {
    if (!milkdownContainer) return;
    milkdownContainer.innerHTML = '';

    editorReady = false;

    crepeEditor = new Crepe({
      root: milkdownContainer,
      defaultValue: internalContent,
      featureConfigs: {
        'block-edit': {
          // Add a custom "Navigation" group to the slash (/) menu with a Wiki Link item.
          // buildMenu receives the internal GroupBuilder before it is finalised.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          buildMenu: (groupBuilder: any) => {
            groupBuilder
              .addGroup('wiki', 'Navigation')
              .addItem('wikilink', {
                label: 'Wiki Link',
                // Lucide Link2 icon as inline SVG
                icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>`,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onRun: () => {
                  // Double-rAF: yields two browser frames so block-edit's cleanup
                  // transaction has been dispatched AND committed before we read the
                  // cursor position. setTimeout(50) was unreliable depending on CPU speed.
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      if (!crepeEditor || !editorReady) return;
                      try {
                        const v = crepeEditor.editor.ctx.get(editorViewCtx);
                        const { from } = v.state.selection;
                        const resolvedPos = v.state.doc.resolve(from);
                        const textBefore = resolvedPos.parent.textContent.slice(0, resolvedPos.parentOffset);
                        // If block-edit left a slash command remnant (e.g. "/w"), remove it ourselves
                        const slashRemnant = textBefore.match(/\/\w+$/);
                        const deleteFrom = slashRemnant ? from - slashRemnant[0].length : from;
                        v.dispatch(v.state.tr.insertText('[[', deleteFrom, from));
                        v.focus();
                        checkAndUpdateWikilinkDropdown();
                      } catch { /* ignore */ }
                    });
                  });
                }
              });
          }
        }
      }
    });

    // Listen for content changes before create()
    crepeEditor.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        // Ignore events fired during Crepe initialization - they can carry
        // empty string before the default value is parsed, which would wipe
        // the editor content on every mode switch.
        if (!editorReady) return;
        // CommonMark serializer escapes both [ in [[wikilinks]] as \[\[.
        // Replace \[\[ (both escaped) or \[[ (one escaped) back to [[.
        const fixed = markdown.replace(/\\\[\\\[|\\\[(?=\[)/g, '[[');
        internalContent = fixed;
        onContentChange(fixed);
      });
    });

    await crepeEditor.create();
    editorReady = true;

    // Wire wikilink autocomplete trigger onto the ProseMirror view DOM
    try {
      const pview = crepeEditor.editor.ctx.get(editorViewCtx);
      viewListenerDom = pview.dom as HTMLElement;
      viewKeyupRef = () => checkAndUpdateWikilinkDropdown();
      viewInputRef = () => checkAndUpdateWikilinkDropdown();
      viewKeydownRef = (e: KeyboardEvent) => handleWikilinkDropdownKey(e);
      viewListenerDom.addEventListener('keyup', viewKeyupRef);
      viewListenerDom.addEventListener('input', viewInputRef);
      viewListenerDom.addEventListener('keydown', viewKeydownRef, { capture: true });
    } catch { /* ignore */ }

    // Inject wikilink decoration plugin via ProseMirror state.reconfigure().
    // Dynamic import bypasses pnpm module isolation for transitive dependencies.
    // 'as string' prevents TypeScript from statically resolving the module path,
    // yielding Promise<any> so strict mode does not error on inaccessible types.
    try {
      const pmv = crepeEditor.editor.ctx.get(editorViewCtx);
      const pmStateMod = 'prosemirror-state' as string;
      const pmViewMod = 'prosemirror-view' as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [pmState, pmView]: [any, any] = await Promise.all([
        import(/* @vite-ignore */ pmStateMod),
        import(/* @vite-ignore */ pmViewMod)
      ]);
      const { Plugin, PluginKey } = pmState;
      const { Decoration, DecorationSet } = pmView;
      const wikilinkKey = new PluginKey('wikilink-highlight');
      const wikilinkPlugin = new Plugin({
        key: wikilinkKey,
        state: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          init(_: unknown, state: any) {
            return buildWikilinkDecorations(state.doc, Decoration, DecorationSet);
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          apply(tr: any, old: any) {
            if (!tr.docChanged) return old;
            return buildWikilinkDecorations(tr.doc, Decoration, DecorationSet);
          },
        },
        props: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          decorations(state: any) {
            return wikilinkKey.getState(state);
          },
        },
      });
      const newState = pmv.state.reconfigure({ plugins: [...pmv.state.plugins, wikilinkPlugin] });
      pmv.updateState(newState);
    } catch { /* prosemirror packages not accessible - wikilink highlighting disabled, click nav still works */ }
  }

  async function recreateEditor() {
    if (crepeEditor) {
      await crepeEditor.destroy();
      crepeEditor = null;
    }
    await initEditor();
  }

  function destroyEditor() {
    clearFindHighlights(); // remove stale ranges before DOM is torn down
    wikilinkDropdown = null;
    if (viewListenerDom) {
      if (viewKeyupRef) viewListenerDom.removeEventListener('keyup', viewKeyupRef);
      if (viewInputRef) viewListenerDom.removeEventListener('input', viewInputRef);
      if (viewKeydownRef) viewListenerDom.removeEventListener('keydown', viewKeydownRef, { capture: true });
      viewListenerDom = null;
      viewKeyupRef = null;
      viewInputRef = null;
      viewKeydownRef = null;
    }
    if (crepeEditor) {
      // Set false BEFORE destroy so any markdownUpdated events fired during
      // Crepe/ProseMirror teardown are ignored and don't wipe internalContent.
      editorReady = false;
      crepeEditor.destroy().catch(() => {});
      crepeEditor = null;
    }
  }

  // Switch modes. mounted is read with untrack so this effect's only reactive
  // dependency is `mode`. Without untrack, setting mounted=true in onMount
  // would re-run this effect at the same time onMount is awaiting initEditor,
  // causing two Crepe instances to race on the same container DOM node.
  //
  // Both DOM elements (milkdownContainer div and textarea) are always kept in
  // the DOM and shown/hidden via style:display. This avoids all bind:this
  // timing issues - milkdownContainer is never null, so initEditor() can run
  // immediately without needing tick() or any DOM-ready hacks.
  $effect(() => {
    if (untrack(() => !mounted)) return;
    if (mode === 'wysiwyg') {
      initEditor();
    } else {
      destroyEditor();
    }
  });

  // ─── Wiki-link click navigation ────────────────────────────────────────────
  // Tracks [[note-name]] spans for click navigation. Visual highlighting is
  // handled by the wikilinkHighlightPlugin ProseMirror Decoration plugin.
  interface WikiRange { start: number; end: number; name: string }
  let wikilinkPositions: WikiRange[] = [];

  function updateWikilinkClickPositions() {
    if (!crepeEditor || !editorReady) {
      wikilinkPositions = [];
      return;
    }
    const newPositions: WikiRange[] = [];
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      const WIKI_RE = /\[\[([^\]]+)\]\]/g;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      view.state.doc.descendants((node: any, pos: number) => {
        if (!node.isText || !node.text) return;
        WIKI_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = WIKI_RE.exec(node.text)) !== null) {
          const start = pos + m.index;
          const end = start + m[0].length;
          newPositions.push({ start, end, name: m[1].trim() });
        }
      });
    } catch { /* ignore */ }
    wikilinkPositions = newPositions;
  }

  // Update click positions whenever content changes (editorReady ensures Crepe has rendered)
  $effect(() => {
    if (editorReady && mode === 'wysiwyg') {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      internalContent; // track
      requestAnimationFrame(() => updateWikilinkClickPositions());
    }
  });

  // ── Image operations ─────────────────────────────────────────────────────
  function deleteImageAtPos(pmPos: number) {
    if (!crepeEditor || !editorReady) return;
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(pmPos);
      if (node) view.dispatch(view.state.tr.delete(pmPos, pmPos + node.nodeSize));
    } catch { /* ignore stale state */ }
  }

  // Align an image by setting its ProseMirror node title attr to align-left/center/right.
  // The style block maps those title values to CSS margin rules for visual alignment.
  function alignImage(pmPos: number, direction: 'left' | 'center' | 'right') {
    if (!crepeEditor || !editorReady || pmPos < 0) return;
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      const node = view.state.doc.nodeAt(pmPos);
      if (!node) return;
      const tr = view.state.tr.setNodeMarkup(pmPos, undefined, {
        ...node.attrs,
        title: `align-${direction}`,
      });
      view.dispatch(tr);
    } catch { /* ignore */ }
  }

  function getHtml(): string {
    if (mode === 'wysiwyg' && milkdownContainer) {
      return milkdownContainer.querySelector('.milkdown')?.innerHTML ?? '';
    }
    return '';
  }

  // ── Wikilink autocomplete ───────────────────────────────────────────────────────────────────

  function checkAndUpdateWikilinkDropdown() {
    if (!crepeEditor || !editorReady) { wikilinkDropdown = null; return; }
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      const { from } = view.state.selection;
      const resolvedPos = view.state.doc.resolve(from);
      const textBefore = resolvedPos.parent.textContent.slice(0, resolvedPos.parentOffset);
      // Match an open [[ with optional partial note name before the cursor
      const match = textBefore.match(/\[\[([^\][\n]*)$/);
      if (!match) { wikilinkDropdown = null; return; }
      const query = match[1];
      const coords = view.coordsAtPos(from);
      const prev = wikilinkDropdown;
      const sameQuery = prev !== null && prev.query === query;
      wikilinkDropdown = {
        query,
        fromPos: from - match[0].length,
        x: coords.left,
        y: coords.bottom,
        selectedIndex: sameQuery ? prev!.selectedIndex : 0,
      };
    } catch { wikilinkDropdown = null; }
  }

  function selectWikilinkSuggestion(notePath: string) {
    if (!crepeEditor || !editorReady || !wikilinkDropdown) return;
    const noteName = notePath.split('/').pop()!.replace(/\.md$/i, '');
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      const { from } = view.state.selection;
      const { fromPos } = wikilinkDropdown;
      const tr = view.state.tr.insertText(`[[${noteName}]]`, fromPos, from);
      view.dispatch(tr);
      view.focus();
    } catch { /* ignore */ }
    wikilinkDropdown = null;
  }

  function handleWikilinkDropdownKey(e: KeyboardEvent) {
    if (!wikilinkDropdown || wikilinkFiltered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      wikilinkDropdown = { ...wikilinkDropdown, selectedIndex: Math.min(wikilinkDropdown.selectedIndex + 1, wikilinkFiltered.length - 1) };
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      wikilinkDropdown = { ...wikilinkDropdown, selectedIndex: Math.max(wikilinkDropdown.selectedIndex - 1, 0) };
    } else if ((e.key === 'Enter' || e.key === 'Tab') && wikilinkFiltered[wikilinkDropdown.selectedIndex]) {
      e.preventDefault(); e.stopPropagation();
      selectWikilinkSuggestion(wikilinkFiltered[wikilinkDropdown.selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      wikilinkDropdown = null;
    }
  }

  // Close dropdown when clicking outside the popup
  $effect(() => {
    if (!wikilinkDropdown) return;
    function closeDropdown() { wikilinkDropdown = null; }
    const tid = setTimeout(() => window.addEventListener('pointerdown', closeDropdown), 10);
    return () => { clearTimeout(tid); window.removeEventListener('pointerdown', closeDropdown); };
  });
  // Reset the search input whenever the dropdown closes
  $effect(() => {
    if (!wikilinkDropdown) {
      dropdownSearchText = '';
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  function handleEditorClick(e: MouseEvent) {
    // ── Wiki-link navigation ──────────────────────────────────────────────────
    if (onWikilinkClick && wikilinkPositions.length > 0 && crepeEditor && editorReady) {
      try {
        const view = crepeEditor.editor.ctx.get(editorViewCtx);
        const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (coords) {
          const hit = wikilinkPositions.find((r) => coords.pos >= r.start && coords.pos < r.end);
          if (hit) {
            e.preventDefault();
            onWikilinkClick(hit.name);
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Show the image toolbar when the cursor hovers over an image in WYSIWYG mode.
  // The toolbar stays visible until the user clicks elsewhere (handled by the
  // pointerdown $effect above). This avoids needing a click to reveal the toolbar.
  function handleEditorMouseOver(e: MouseEvent) {
    if (mode !== 'wysiwyg') return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    const img = target as HTMLImageElement;
    const r = img.getBoundingClientRect();
    // Guard: already showing toolbar for this exact image position - skip
    if (imageToolbarState && Math.abs(imageToolbarState.rect.top - r.top) < 1 && imageToolbarState.src === img.src) return;
    let pmPos = -1;
    if (crepeEditor && editorReady) {
      try {
        const view = crepeEditor.editor.ctx.get(editorViewCtx);
        const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (coords) pmPos = coords.pos;
      } catch { /* ignore */ }
    }
    imageToolbarState = { rect: r, src: img.src, alt: img.alt, pmPos };
  }
  // ─────────────────────────────────────────────────────────────────────────────
  // Supported in Chrome 105+, Firefox 117+, Safari 17.2+. Gracefully skipped
  // on older browsers. Using `any` here because the API is not yet in all
  // TypeScript DOM lib versions and we want zero-dependency type safety.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cssHL = (CSS as any)?.highlights as { set(k: string, v: unknown): void; delete(k: string): void } | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const HighlightCtor = (globalThis as any).Highlight as (new (...r: Range[]) => unknown) | undefined;

  function setFindHighlights(query: string, opts: FindOptions, currentIndex: number) {
    clearFindHighlights();
    if (!query || mode !== 'wysiwyg' || !crepeEditor || !editorReady) return;
    if (!cssHL || !HighlightCtor) return;
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      const allRanges: Range[] = [];
      let seen = 0;
      let curRange: Range | null = null;
      view.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const matches = computeMatches(node.text, query, opts);
        for (const m of matches) {
          try {
            const s = view.domAtPos(pos + m.start);
            const e = view.domAtPos(pos + m.end);
            const range = new Range();
            range.setStart(s.node, s.offset);
            range.setEnd(e.node, e.offset);
            allRanges.push(range);
            if (seen === currentIndex) curRange = range;
            seen++;
          } catch { /* stale DOM - skip */ }
        }
      });
      if (allRanges.length === 0) return;
      cssHL.set('fd-all', new HighlightCtor(...allRanges));
      if (curRange) cssHL.set('fd-cur', new HighlightCtor(curRange));
    } catch { /* ignore */ }
  }

  function clearFindHighlights() {
    if (!cssHL) return;
    try {
      cssHL.delete('fd-all');
      cssHL.delete('fd-cur');
      cssHL.delete('fd-flash');
    } catch { /* ignore */ }
  }

  /** Briefly highlight `lineText` in WYSIWYG mode after a search-panel navigation. */
  function flashWYSIWYG(lineText: string) {
    if (!cssHL || !HighlightCtor || !crepeEditor || !editorReady) return;
    const trimmed = lineText.trim();
    if (!trimmed) return;
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      let done = false;
      view.state.doc.descendants((node, pos) => {
        if (done || !node.isText || !node.text) return;
        const idx = node.text.indexOf(trimmed);
        if (idx === -1) return;
        try {
          const s = view.domAtPos(pos + idx);
          const e = view.domAtPos(pos + idx + trimmed.length);
          const range = new Range();
          range.setStart(s.node, s.offset);
          range.setEnd(e.node, e.offset);
          cssHL.set('fd-flash', new HighlightCtor(range));
          done = true;
          return false; // stop descendant walk
        } catch { /* skip */ }
      });
      if (!done) return;
      setTimeout(() => { try { cssHL!.delete('fd-flash'); } catch { /* ignore */ } }, 1800);
    } catch { /* ignore */ }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  /** Compute all regex matches in a text string. Returns empty array on bad regex. */
  function computeMatches(
    text: string,
    query: string,
    opts: FindOptions,
  ): Array<{ start: number; end: number }> {
    if (!query) return [];
    try {
      let pattern = opts.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
      // 'gid' is not universally supported - fall back gracefully
      const safeFlags = opts.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(pattern, safeFlags);
      const matches: Array<{ start: number; end: number }> = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length });
        if (m[0].length === 0) regex.lastIndex++; // prevent infinite loop on zero-width
      }
      return matches;
    } catch {
      return []; // invalid regex
    }
  }

  function findOccurrenceCount(query: string, opts: FindOptions): number {
    if (!query) return 0;
    if (mode === 'source') {
      return computeMatches(internalContent, query, opts).length;
    }
    // WYSIWYG: count across all ProseMirror text nodes
    if (!crepeEditor || !editorReady) return 0;
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      let count = 0;
      view.state.doc.descendants((node) => {
        if (node.isText && node.text) count += computeMatches(node.text, query, opts).length;
      });
      return count;
    } catch {
      return 0;
    }
  }

  function scrollToOccurrence(query: string, opts: FindOptions, index: number) {
    if (mode === 'source') {
      const matches = computeMatches(internalContent, query, opts);
      const m = matches[index];
      if (!m || !textareaEl) return;
      textareaEl.focus();
      textareaEl.setSelectionRange(m.start, m.end);
      const linesBeforeMatch = internalContent.slice(0, m.start).split('\n').length;
      const lh = parseFloat(getComputedStyle(textareaEl).lineHeight) || 21;
      textareaEl.scrollTop = Math.max(0, linesBeforeMatch - 4) * lh;
      return;
    }
    // WYSIWYG: find the index-th match across all text nodes
    if (!crepeEditor || !editorReady) return;
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      let seen = 0;
      let found = false;
      view.state.doc.descendants((node, pos) => {
        if (found || !node.isText || !node.text) return;
        const segMatches = computeMatches(node.text, query, opts);
        if (seen + segMatches.length > index) {
          const local = index - seen;
          const pmPos = pos + segMatches[local].start;
          try {
            const domInfo = view.domAtPos(pmPos);
            const el =
              domInfo.node instanceof Element ? domInfo.node : domInfo.node.parentElement;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch { /* ignore */ }
          found = true;
          return false; // stop traversal
        }
        seen += segMatches.length;
      });
    } catch { /* ignore */ }
    // Update highlights so current match is visually distinct
    setFindHighlights(query, opts, index);
  }

  /** Scroll to a specific line (source mode) or matching text (WYSIWYG). */
  function performScroll(line: number, lineText: string) {
    if (mode === 'wysiwyg') {
      scrollWYSIWYG(lineText);
      flashWYSIWYG(lineText); // brief highlight so user can spot the result
    } else {
      scrollSource(line); // setSelectionRange already visually selects the match
    }
  }

  function scrollWYSIWYG(lineText: string) {
    if (!crepeEditor || !editorReady) return;
    const trimmed = lineText.trim();
    if (!trimmed) return;
    try {
      const view = crepeEditor.editor.ctx.get(editorViewCtx);
      let scrolled = false;
      view.state.doc.descendants((node, pos) => {
        if (scrolled) return false;
        if (node.isText && node.text?.includes(trimmed)) {
          try {
            const domInfo = view.domAtPos(pos);
            const el =
              domInfo.node instanceof Element
                ? domInfo.node
                : domInfo.node.parentElement;
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {
            // ignore DOM errors
          }
          scrolled = true;
          return false;
        }
      });
    } catch {
      // ignore
    }
  }

  function scrollSource(line: number) {
    if (!textareaEl) return;
    const lines = internalContent.split('\n');
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for the \n
    }
    const end = offset + (lines[line - 1]?.length ?? 0);
    textareaEl.focus();
    textareaEl.setSelectionRange(offset, end);
    const lh = parseFloat(getComputedStyle(textareaEl).lineHeight) || 21;
    textareaEl.scrollTop = Math.max(0, (line - 4)) * lh;
  }

  /** Insert text at the current cursor position in either editor mode. */
  function insertText(text: string) {
    if (mode === 'wysiwyg' && crepeEditor) {
      try {
        const view = crepeEditor.editor.ctx.get(editorViewCtx);
        const parser = crepeEditor.editor.ctx.get(parserCtx);
        // Append the snippet to the current markdown and replace the whole
        // document so Milkdown parses blocks correctly (e.g. fenced code blocks).
        const newMarkdown = internalContent + '\n\n' + text;
        const newDoc = parser(newMarkdown);
        if (newDoc) {
          const { state } = view;
          view.dispatch(state.tr.replaceWith(0, state.doc.content.size, newDoc.content));
        }
        return;
      } catch {
        // fall through to textarea fallback
      }
    }
    if (textareaEl) {
      const start = textareaEl.selectionStart ?? internalContent.length;
      const end = textareaEl.selectionEnd ?? internalContent.length;
      const newContent = internalContent.slice(0, start) + text + internalContent.slice(end);
      internalContent = newContent;
      onContentChange(newContent);
      requestAnimationFrame(() => {
        if (!textareaEl) return;
        textareaEl.setSelectionRange(start + text.length, start + text.length);
        textareaEl.focus();
      });
    }
  }

  /** Force the editor to reload with new content (e.g. after Note Properties saves frontmatter). */
  function resetContent(newContent: string) {
    internalContent = newContent;
    if (mode === 'wysiwyg' && crepeEditor && editorReady) {
      recreateEditor();
    }
  }

  async function uploadAndInsert(file: File) {
    const rawExt = file.type.split('/')[1] ?? 'png';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const formData = new FormData();
    formData.append('image', file, `screenshot.${ext}`);
    try {
      const res = await fetch('/api/screenshots', { method: 'POST', body: formData });
      if (!res.ok) return;
      const { url } = (await res.json()) as { url: string };
      insertText(`![screenshot](${url})`);
    } catch {
      console.error('Failed to upload screenshot');
    }
  }

  async function handlePaste(e: ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (blob) await uploadAndInsert(blob);
  }

  function handleDragover(e: DragEvent) {
    if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) {
      e.preventDefault();
    }
  }

  async function handleDrop(e: DragEvent) {
    const files = Array.from(e.dataTransfer?.files ?? []);
    const imageFile = files.find((f) => f.type.startsWith('image/'));
    if (!imageFile) return;
    e.preventDefault();
    await uploadAndInsert(imageFile);
  }

  onMount(async () => {
    mounted = true;
    if (mode === 'wysiwyg') {
      await initEditor();
    }
    onReady?.({ insertText, findOccurrenceCount, scrollToOccurrence, setFindHighlights, clearFindHighlights, getHtml, resetContent });
  });

  onDestroy(() => {
    destroyEditor();
  });
</script>

<div
  class="relative flex h-full w-full flex-col"
  onpaste={handlePaste}
  ondragover={handleDragover}
  ondrop={handleDrop}
  role="none"
>
  <!-- Milkdown WYSIWYG - always in DOM so milkdownContainer is never null.
       Shown/hidden via display so initEditor() can run without DOM-ready timing hacks. -->
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <div
    bind:this={milkdownContainer}
    style:display={mode === 'wysiwyg' ? '' : 'none'}
    class="milkdown-editor prose prose-sm dark:prose-invert max-w-none h-full w-full overflow-y-auto px-8 py-6
           text-foreground selection:bg-primary/20"
    onclick={handleEditorClick}
    onmouseover={handleEditorMouseOver}
    role="none"
  ></div>
  <!-- Image toolbar overlay - shown when user clicks an image in WYSIWYG mode -->
  {#if imageToolbarState && mode === 'wysiwyg'}
    <ImageToolbar
      rect={imageToolbarState.rect}
      onOpenLightbox={() => {
        const src = imageToolbarState!.src; const alt = imageToolbarState!.alt;
        imageToolbarState = null;
        onImageClick?.(src, alt);
      }}
      onDelete={() => {
        const pmPos = imageToolbarState!.pmPos;
        imageToolbarState = null;
        deleteImageAtPos(pmPos);
      }}
      onAlignLeft={() => { const pmPos = imageToolbarState!.pmPos; imageToolbarState = null; alignImage(pmPos, 'left'); }}
      onAlignCenter={() => { const pmPos = imageToolbarState!.pmPos; imageToolbarState = null; alignImage(pmPos, 'center'); }}
      onAlignRight={() => { const pmPos = imageToolbarState!.pmPos; imageToolbarState = null; alignImage(pmPos, 'right'); }}
      onClose={() => (imageToolbarState = null)}
    />
  {/if}

  <!-- Source mode: line-number gutter + editable textarea -->
  <div
    style:display={mode === 'source' ? 'flex' : 'none'}
    class="h-full w-full overflow-hidden font-mono text-sm leading-relaxed"
  >
    <!-- Gutter: line numbers, scrolled in sync with the textarea -->
    <div
      bind:this={lineNumberGutterEl}
      class="select-none overflow-hidden border-r border-border bg-muted/20 py-6 pr-3 pl-4 text-right text-muted-foreground"
      style="min-width: 3rem;"
      aria-hidden="true"
    >
      {#each sourceLineNumbers as n}
        <div>{n}</div>
      {/each}
    </div>
    <!-- Editor area -->
    <textarea
      bind:this={textareaEl}
      class="flex-1 resize-none bg-transparent py-6 pr-8 pl-4 text-foreground outline-none"
      value={internalContent}
      oninput={(e) => {
        internalContent = e.currentTarget.value;
        onContentChange(e.currentTarget.value);
      }}
      onscroll={syncGutterScroll}
      spellcheck={false}
    ></textarea>
  </div>

  <!-- Wikilink autocomplete dropdown -->
  {#if wikilinkDropdown && mode === 'wysiwyg'}
    <div
      class="fixed z-[100] min-w-64 max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-xl"
      style="left: {wikilinkDropdown.x}px; top: {wikilinkDropdown.y + 6}px;"
      onpointerdown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Note search"
      tabindex="-1"
    >
      <!-- Search input at top -->
      <div class="border-b border-border px-2 py-1.5">
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls="wikilink-listbox"
          aria-activedescendant={wikilinkDropdown && wikilinkFiltered.length > 0
            ? `wikilink-opt-${wikilinkDropdown.selectedIndex}`
            : undefined}
          placeholder="Search notes..."
          bind:value={dropdownSearchText}
          class="w-full rounded bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onkeydown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (wikilinkDropdown) wikilinkDropdown = { ...wikilinkDropdown, selectedIndex: Math.min(wikilinkDropdown.selectedIndex + 1, wikilinkFiltered.length - 1) };
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (wikilinkDropdown) wikilinkDropdown = { ...wikilinkDropdown, selectedIndex: Math.max(wikilinkDropdown.selectedIndex - 1, 0) };
            } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              if (wikilinkDropdown && wikilinkFiltered[wikilinkDropdown.selectedIndex]) selectWikilinkSuggestion(wikilinkFiltered[wikilinkDropdown.selectedIndex]);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              wikilinkDropdown = null;
            }
          }}
        />
      </div>
      <!-- Results -->
      {#if wikilinkFiltered.length > 0}
        <div id="wikilink-listbox" class="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Note suggestions">
          {#each wikilinkFiltered as suggestion, i}
            {@const name = suggestion.split('/').pop()!.replace(/\.md$/i, '')}
            {@const folder = suggestion.includes('/') ? suggestion.split('/').slice(0, -1).join('/') : ''}
            <button
              id="wikilink-opt-{i}"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {i === wikilinkDropdown.selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60'}"
              role="option"
              aria-selected={i === wikilinkDropdown.selectedIndex}
              onmousedown={(e) => { e.preventDefault(); selectWikilinkSuggestion(suggestion); }}
            >
              <span class="truncate font-medium">{name}</span>
              {#if folder}
                <span class="ml-auto shrink-0 text-xs text-muted-foreground">{folder}</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="px-3 py-3 text-center text-xs text-muted-foreground">No notes found</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Override Milkdown/Crepe frame.css: it sets an explicit white background
     and dark text that makes the editor invisible against our theme. */
  :global(.milkdown-editor .crepe),
  :global(.milkdown-editor .crepe-editor) {
    background: transparent !important;
    box-shadow: none !important;
  }

  :global(.milkdown-editor .milkdown) {
    outline: none;
    min-height: 100%;
    padding: 0;
    background: transparent !important;
    color: hsl(var(--foreground)) !important;
  }

  :global(.milkdown-editor .milkdown .ProseMirror) {
    outline: none;
    min-height: calc(100vh - 120px);
    padding: 0;
    background: transparent !important;
    color: hsl(var(--foreground)) !important;
    caret-color: hsl(var(--foreground));
  }

  /* KaTeX inline math */
  :global(.milkdown-editor .math-inline) {
    font-size: 0.95em;
  }

  /* KaTeX block math */
  :global(.milkdown-editor .math-block) {
    overflow-x: auto;
    padding: 0.5rem 0;
  }

  /* Code blocks */
  :global(.milkdown-editor pre) {
    border-radius: 0.375rem;
    padding: 1rem;
    overflow-x: auto;
  }

  /* Task list checkboxes */
  :global(.milkdown-editor input[type='checkbox']) {
    cursor: pointer;
  }

  /* Crepe floating UI - bubble toolbar + slash/block-edit menu */
  :global(.milkdown-editor .crepe-toolbar),
  :global(.milkdown-editor .block-edit-main),
  :global(.milkdown-editor .tableTooltip),
  :global(.milkdown-editor [data-tippy-root]) {
    z-index: 40 !important;
  }

  /* ── CSS Custom Highlight API - find panel & search-result flash ── */
  /* All occurrences: subtle background */
  :global(::highlight(fd-all)) {
    background-color: rgba(234, 179, 8, 0.28); /* amber-400 / 0.28 */
  }
  /* Current match: strong amber so it stands out */
  :global(::highlight(fd-cur)) {
    background-color: rgba(234, 179, 8, 0.85);
    color: rgb(23, 23, 23);
  }
  /* Search-panel result flash: moderate amber, auto-clears after 1.8 s */
  :global(::highlight(fd-flash)) {
    background-color: rgba(234, 179, 8, 0.5);
  }

  /* Wiki-links: [[note-name]] decorated by ProseMirror Decoration.inline */
  :global(.milkdown-editor .wikilink-highlight) {
    background-color: rgba(99, 102, 241, 0.15);
    color: hsl(var(--primary));
    text-decoration: underline dashed;
    cursor: pointer;
    border-radius: 2px;
    padding: 0 1px;
  }

  /* Images in WYSIWYG - show pointer so users know they're clickable */
  :global(.milkdown-editor img) {
    cursor: zoom-in;
    border-radius: 0.375rem;
    max-width: 100%;
  }

  /* Image alignment - set by ImageToolbar via ProseMirror title attr */
  :global(.milkdown-editor img[title="align-left"]) {
    display: block;
    margin-right: auto;
  }
  :global(.milkdown-editor img[title="align-center"]) {
    display: block;
    margin-left: auto;
    margin-right: auto;
  }
  :global(.milkdown-editor img[title="align-right"]) {
    display: block;
    margin-left: auto;
  }
</style>
