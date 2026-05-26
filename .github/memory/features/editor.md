# Editor

## Purpose
Dual-mode markdown editor. WYSIWYG mode uses Milkdown (@milkdown/crepe) with math support via @milkdown/plugin-math + KaTeX. Source mode uses CodeMirror 6 (svelte-codemirror-editor). Users toggle between modes. The editor supports image upload, inline image alignment controls, zoom via lightbox, and a find/replace panel.

## Key Files
- `src/lib/components/editor/Editor.svelte` — main editor component; hosts Milkdown and CodeMirror, handles mode toggle
- `src/lib/components/editor/FindPanel.svelte` — find/replace panel, keyboard shortcut activated
- `src/lib/components/editor/ImageLightbox.svelte` — fullscreen image zoom overlay
- `src/lib/components/editor/ImageToolbar.svelte` — floating toolbar for image alignment (left/center/right) and deletion

## Status
stable

## Notes
- Use `view.posAtDOM(imgElement, 0)` with try/catch to get ProseMirror position of image nodes — `posAtCoords()` is unreliable for inline elements.
- Math rendering requires KaTeX CSS to be loaded globally in `app.html`.
- ImageToolbar appears on image click; position is calculated relative to the image DOM node.
- See [[learnings/milkdown-posatdom]] for the posAtCoords pitfall.
