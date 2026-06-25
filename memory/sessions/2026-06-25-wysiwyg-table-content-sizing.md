---
title: WYSIWYG Table Content Sizing
type: session
date: 2026-06-25
tags:
  - session
  - editor
  - tables
---

# WYSIWYG Table Content Sizing

## Summary

Adjusted Milkdown table CSS so note tables size columns from cell content instead of preserving equal injected column widths.

## Changes

- Updated `src/app.css` table rules to use `table-layout: auto`, `width: auto`, and `min-width: 100%`.
- Overrode Milkdown/ProseMirror generated `col` widths with `width: auto !important`.
- Added top vertical alignment for table cells so tall content reads cleanly.
- Updated `CHANGELOG.md` under `[Unreleased]`.

## Verification

- `npm run check` passed with 0 errors and 2 pre-existing warnings.
- `npm run build` passed; Vite reported existing large chunk warnings.
