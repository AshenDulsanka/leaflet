// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FileNode } from '$lib/types';
import FileTree from './FileTree.svelte';

const DRAG_SOURCE_KEY = '__leaflet_filetree_drag_source';

interface RectShape {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

function makeRect(top: number, height: number): RectShape {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 320,
    width: 320,
  };
}

function mockRect(element: Element, top: number, height = 100): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(makeRect(top, height) as DOMRect);
}

function createDataTransfer(initialPath = ''): DataTransfer {
  let storedPath = initialPath;

  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    files: {} as FileList,
    items: {} as DataTransferItemList,
    types: ['text/plain'],
    clearData: vi.fn(),
    getData: vi.fn((format: string) => (format === 'text/plain' ? storedPath : '')),
    setData: vi.fn((format: string, value: string) => {
      if (format === 'text/plain') {
        storedPath = value;
      }
    }),
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
}

async function dispatchDragEvent(target: Element, type: 'dragover' | 'drop', dataTransfer: DataTransfer, clientY: number): Promise<void> {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  Object.defineProperty(event, 'clientY', { value: clientY });
  await fireEvent(target, event);
}

function renderTree(nodes: FileNode[], callbacks?: {
  onMoveItem?: (fromPath: string, toFolderPath: string) => void;
  onReorderNotes?: (orderedPaths: string[]) => void;
}) {
  return render(FileTree, {
    nodes,
    activeFile: null,
    depth: 0,
    onOpenFile: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onDeleteItem: vi.fn(),
    onRenameItem: vi.fn(),
    onMoveItem: callbacks?.onMoveItem ?? vi.fn(),
    onReorderNotes: callbacks?.onReorderNotes ?? vi.fn(),
  });
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[DRAG_SOURCE_KEY];
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('FileTree drag and drop', () => {
  it('reorders file siblings on center drop deterministically', async () => {
    const onReorderNotes = vi.fn();
    const onMoveItem = vi.fn();

    renderTree(
      [
        { name: 'alpha', path: 'alpha.md', type: 'file' },
        { name: 'beta', path: 'beta.md', type: 'file' },
      ],
      { onReorderNotes, onMoveItem },
    );

    const source = document.querySelector('[data-filetree-row-path="alpha.md"]') as HTMLElement;
    const target = document.querySelector('[data-filetree-row-path="beta.md"]') as HTMLElement;
    const dataTransfer = createDataTransfer('alpha.md');
    (globalThis as Record<string, unknown>)[DRAG_SOURCE_KEY] = 'alpha.md';

    mockRect(target, 0, 100);

    expect(source).toBeTruthy();
    await dispatchDragEvent(target, 'dragover', dataTransfer, 50);
    await dispatchDragEvent(target, 'drop', dataTransfer, 50);

    expect(onReorderNotes).toHaveBeenCalledTimes(1);
    expect(onReorderNotes).toHaveBeenCalledWith(['beta.md', 'alpha.md']);
    expect(onMoveItem).not.toHaveBeenCalled();
  });

  it('reorders folder siblings reliably at edge drops', async () => {
    const onReorderNotes = vi.fn();

    renderTree(
      [
        { name: 'alpha', path: 'alpha', type: 'folder', children: [] },
        { name: 'beta', path: 'beta', type: 'folder', children: [] },
      ],
      { onReorderNotes },
    );

    const source = screen.getByRole('button', { name: 'beta' });
    const target = screen.getByRole('button', { name: 'alpha' });
    const dataTransfer = createDataTransfer('beta');
    (globalThis as Record<string, unknown>)[DRAG_SOURCE_KEY] = 'beta';

    mockRect(target, 0, 100);

    expect(source).toBeTruthy();
    await dispatchDragEvent(target, 'dragover', dataTransfer, 8);
    await dispatchDragEvent(target, 'drop', dataTransfer, 8);

    expect(onReorderNotes).toHaveBeenCalledTimes(1);
    expect(onReorderNotes).toHaveBeenCalledWith(['beta', 'alpha']);
  });

  it('moves nested item to root when dropped at top or bottom edge of list', async () => {
    const onMoveItem = vi.fn();

    renderTree(
      [
        {
          name: 'folder',
          path: 'folder',
          type: 'folder',
          children: [{ name: 'note', path: 'folder/note.md', type: 'file' }],
        },
      ],
      { onMoveItem },
    );

    expect(document.querySelector('.filetree-root-drop-zone')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'folder' }));

    const source = document.querySelector('[data-filetree-row-path="folder/note.md"]') as HTMLElement;
    const dataTransfer = createDataTransfer('folder/note.md');
    (globalThis as Record<string, unknown>)[DRAG_SOURCE_KEY] = 'folder/note.md';

    const folderButton = screen.getByRole('button', { name: 'folder' });
    mockRect(folderButton, 0, 100);

    expect(source).toBeTruthy();
    await dispatchDragEvent(folderButton, 'dragover', dataTransfer, 6);
    await dispatchDragEvent(folderButton, 'drop', dataTransfer, 6);

    expect(onMoveItem).toHaveBeenCalledTimes(1);
    expect(onMoveItem).toHaveBeenCalledWith('folder/note.md', '');
  });

  it('renders nested children with correct visual indentation', async () => {
    renderTree([
      {
        name: 'parent',
        path: 'parent',
        type: 'folder',
        children: [{ name: 'child', path: 'parent/child.md', type: 'file' }],
      },
    ]);

    await fireEvent.click(screen.getByRole('button', { name: 'parent' }));

    const parentRow = document.querySelector('[data-filetree-row-path="parent"]') as HTMLElement;
    const childRow = document.querySelector('[data-filetree-row-path="parent/child.md"]') as HTMLElement;

    const parentButton = parentRow.querySelector('button') as HTMLElement;
    const childButton = childRow.querySelector('button') as HTMLElement;
    expect(parentButton.style.paddingLeft).toBe('4px');
    expect(childButton.style.paddingLeft).toBe('20px');
  });
});
