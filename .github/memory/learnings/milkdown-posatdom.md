---
title: "Use posAtDOM Instead of posAtCoords in Milkdown"
date: 2026-04-27
type: learning
status: active
agent: orchestrator
task: "Image toolbar position resolution in Milkdown editor"
tags:
  - learning
  - milkdown
  - editor
aliases: []
---

# Use posAtDOM Instead of posAtCoords in Milkdown

## What Happened
While implementing the image alignment/delete toolbar in `src/lib/components/editor/ImageToolbar.svelte`, `posAtCoords()` was used to find the ProseMirror position of an image node. It returned null or wrong positions for inline image elements, causing toolbar actions to apply to the wrong node or fail silently.

## Root Cause
`posAtCoords()` relies on screen/viewport coordinates. For inline elements like images, the reported coordinates may not map reliably to the DOM node — especially when the editor has scrolled or the image is partially out of view. The result is unreliable.

## Fix / Workaround
Use `view.posAtDOM(img, 0)` where `img` is the actual `HTMLImageElement` reference. Wrap in try/catch because `posAtDOM` throws if the node is not in the ProseMirror document:

```typescript
let pos: number;
try {
  pos = view.posAtDOM(imgElement, 0);
} catch {
  return; // image not in document, abort
}
```

Used in `src/lib/components/editor/Editor.svelte` and `src/lib/components/editor/ImageToolbar.svelte`.

## Prevention
Never use `posAtCoords()` for image toolbar operations. If you need a ProseMirror position from a DOM element, always use `posAtDOM(element, 0)` with a try/catch guard.

## Related
- [[features/editor]] — the Milkdown editor feature
- [[sessions/2026-04-27-analyze-codebase]] — session where this was documented
