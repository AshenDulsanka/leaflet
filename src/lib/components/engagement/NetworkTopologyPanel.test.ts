// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockEdge = Record<string, unknown>;

vi.mock('svelte/transition', () => ({
  fly: () => ({ duration: 0 }),
  fade: () => ({ duration: 0 }),
}));

vi.mock('@xyflow/svelte', async () => {
  const MockSvelteFlow = (await import('./__tests__/mocks/MockSvelteFlow.svelte')).default;
  const StubFlowComponent = (await import('./__tests__/mocks/StubFlowComponent.svelte')).default;

  return {
    SvelteFlow: MockSvelteFlow,
    Controls: StubFlowComponent,
    Background: StubFlowComponent,
    Handle: StubFlowComponent,
    BackgroundVariant: { Dots: 'dots' },
    Position: { Left: 'left', Right: 'right' },
    addEdge: (edge: MockEdge, edges: MockEdge[]) => [...edges, edge],
  };
});

import NetworkTopologyPanel from './NetworkTopologyPanel.svelte';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hasDeleteCall(fetchMock: ReturnType<typeof vi.fn>, expectedUrl: string): boolean {
  return fetchMock.mock.calls.some(([input, init]) => {
    return String(input) === expectedUrl && init?.method === 'DELETE';
  });
}

function methodAndUrlCallCount(
  fetchMock: ReturnType<typeof vi.fn>,
  expectedMethod: string,
  expectedUrl: string,
): number {
  return fetchMock.mock.calls.filter(([input, init]) => {
    return String(input) === expectedUrl && (init?.method ?? 'GET') === expectedMethod;
  }).length;
}

describe('NetworkTopologyPanel', () => {
  const workspaceId = 'ws-topology';
  const edgeId = 'edge-1';

  beforeEach(() => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === `/api/workspaces/${workspaceId}/topology` && method === 'GET') {
        return jsonResponse({
          hosts: [
            {
              id: '1',
              workspace_id: workspaceId,
              ip: '10.10.10.10',
              hostname: 'edge-host',
              status: 'up',
              os: '',
              ports: '',
              notes: '',
              screenshots: '',
              topo_x: 200,
              topo_y: 140,
              port_count: 2,
              discovered_at: new Date().toISOString(),
            },
            {
              id: '2',
              workspace_id: workspaceId,
              ip: '10.10.10.20',
              hostname: 'db-host',
              status: 'up',
              os: '',
              ports: '',
              notes: '',
              screenshots: '',
              topo_x: 420,
              topo_y: 220,
              port_count: 3,
              discovered_at: new Date().toISOString(),
            },
          ],
          edges: [
            {
              id: edgeId,
              source_host_id: '1',
              target_host_id: '2',
              protocol: 'tcp',
              source_port: 443,
              target_port: 8443,
              label: 'https',
            },
          ],
        });
      }

      if (url === `/api/workspaces/${workspaceId}/topology/edges/${edgeId}` && method === 'DELETE') {
        return jsonResponse({ ok: true });
      }

      throw new Error(`Unexpected fetch call in NetworkTopologyPanel.test.ts: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('requires confirmation before deleting selected edge', async () => {
    render(NetworkTopologyPanel, { workspaceId, onClose: vi.fn() });

    await screen.findByText(/2 hosts, 1 connection/i);
    await fireEvent.click(screen.getByTestId('mock-edge-click'));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete connection' }));

    const confirmDialog = screen.getByRole('dialog', { name: 'Delete Connection' });
    expect(confirmDialog).toBeTruthy();

    await fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Cancel' }));

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(hasDeleteCall(fetchMock, `/api/workspaces/${workspaceId}/topology/edges/${edgeId}`)).toBe(false);
    expect(screen.getByRole('button', { name: 'Delete connection' })).toBeTruthy();
  });

  it('applies Escape precedence confirm -> selected edge -> close panel', async () => {
    const onClose = vi.fn();
    render(NetworkTopologyPanel, { workspaceId, onClose });

    await screen.findByText(/2 hosts, 1 connection/i);
    await fireEvent.click(screen.getByTestId('mock-edge-click'));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete connection' }));

    await fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete Connection' })).toBeNull();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete connection' })).toBeTruthy();

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Delete connection' })).toBeNull();

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('deletes selected edge after confirmation', async () => {
    render(NetworkTopologyPanel, { workspaceId, onClose: vi.fn() });

    await screen.findByText(/2 hosts, 1 connection/i);
    await fireEvent.click(screen.getByTestId('mock-edge-click'));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete connection' }));

    const confirmDialog = screen.getByRole('dialog', { name: 'Delete Connection' });
    await fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => {
      expect(hasDeleteCall(fetchMock, `/api/workspaces/${workspaceId}/topology/edges/${edgeId}`)).toBe(true);
    });
    expect(methodAndUrlCallCount(fetchMock, 'DELETE', `/api/workspaces/${workspaceId}/topology/edges/${edgeId}`)).toBe(1);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Delete connection' })).toBeNull();
    });
  });
});