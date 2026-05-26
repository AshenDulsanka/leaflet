# Note Graph

## Purpose
Visual graph showing relationships between notes via backlinks (wikilink references). The graph is workspace-scoped — only notes in the active workspace appear. Nodes represent notes; edges represent `[[wikilink]]` references between them. A separate backlinks panel shows incoming links for the currently open note.

## Key Files
- `src/lib/components/panels/NoteGraphPanel.svelte` — interactive graph canvas; renders nodes and edges
- `src/lib/components/panels/BacklinksPanel.svelte` — list of notes that link to the current note

## Status
stable

## Notes
- Uses `@xyflow/svelte` for the graph rendering canvas.
- Graph is computed from wikilink references parsed from note content — not stored separately in DB.
- Backlinks are recalculated when the note changes or when the panel opens.
- `readTree()` in `src/lib/server/notes.ts` strips `.md` from node names — use `node.type === 'file'` not `node.name.endsWith('.md')` when filtering file nodes for wikilink resolution.
