// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockEdge = Record<string, unknown>;

vi.mock("@xyflow/svelte", async () => {
  const MockSvelteFlow = (
    await import("./__tests__/mocks/MockSvelteFlow.svelte")
  ).default;
  const StubFlowComponent = (
    await import("./__tests__/mocks/StubFlowComponent.svelte")
  ).default;

  return {
    SvelteFlow: MockSvelteFlow,
    Controls: StubFlowComponent,
    Background: StubFlowComponent,
    Handle: StubFlowComponent,
    BackgroundVariant: { Dots: "dots" },
    Position: { Left: "left", Right: "right" },
    addEdge: (edge: MockEdge, edges: MockEdge[]) => [...edges, edge],
  };
});

import AttackChainPanel from "./AttackChainPanel.svelte";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hasDeleteCall(
  fetchMock: ReturnType<typeof vi.fn>,
  expectedUrl: string,
): boolean {
  return fetchMock.mock.calls.some(([input, init]) => {
    return String(input) === expectedUrl && init?.method === "DELETE";
  });
}

function methodAndUrlCallCount(
  fetchMock: ReturnType<typeof vi.fn>,
  expectedMethod: string,
  expectedUrl: string,
): number {
  return fetchMock.mock.calls.filter(([input, init]) => {
    return (
      String(input) === expectedUrl &&
      (init?.method ?? "GET") === expectedMethod
    );
  }).length;
}

describe("AttackChainPanel", () => {
  const workspaceId = "ws-attack";
  const nodeId = "node-1";

  beforeEach(() => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (
          url === `/api/workspaces/${workspaceId}/nodes` &&
          method === "GET"
        ) {
          return jsonResponse({
            nodes: [
              {
                id: nodeId,
                workspace_id: workspaceId,
                label: "Initial foothold",
                node_type: "initial-access",
                x: 120,
                y: 80,
                timestamp: null,
                mitre_technique_id: "",
                mitre_technique_name: "",
              },
            ],
            edges: [],
          });
        }

        if (
          url === `/api/workspaces/${workspaceId}/nodes/${nodeId}` &&
          method === "DELETE"
        ) {
          return jsonResponse({ ok: true });
        }

        throw new Error(
          `Unexpected fetch call in AttackChainPanel.test.ts: ${method} ${url}`,
        );
      },
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("closes add-step modal on Escape before panel close", async () => {
    const onClose = vi.fn();
    render(AttackChainPanel, { workspaceId, onClose });

    await screen.findByText("Initial foothold");
    await fireEvent.click(screen.getByRole("button", { name: "Add Node" }));

    expect(
      screen.getByRole("dialog", { name: "Add Attack Step" }),
    ).toBeTruthy();

    await fireEvent.keyDown(
      screen.getByRole("dialog", { name: "Add Attack Step" }),
      { key: "Escape" },
    );

    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes delete confirmation on Escape before panel close", async () => {
    const onClose = vi.fn();
    render(AttackChainPanel, { workspaceId, onClose });

    await screen.findByText("Initial foothold");
    await fireEvent.click(screen.getByRole("button", { name: "Delete node" }));

    expect(
      screen.getByRole("dialog", { name: "Delete Attack Step" }),
    ).toBeTruthy();

    await fireEvent.keyDown(
      screen.getByRole("dialog", { name: "Delete Attack Step" }),
      { key: "Escape" },
    );

    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens delete confirm, cancel keeps node, confirm deletes node", async () => {
    const onClose = vi.fn();
    render(AttackChainPanel, { workspaceId, onClose });

    await screen.findByText("Initial foothold");
    await fireEvent.click(screen.getByRole("button", { name: "Delete node" }));

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

    const firstConfirmDialog = screen.getByRole("dialog", {
      name: "Delete Attack Step",
    });
    await fireEvent.click(
      within(firstConfirmDialog).getByRole("button", { name: "Cancel" }),
    );

    expect(
      hasDeleteCall(
        fetchMock,
        `/api/workspaces/${workspaceId}/nodes/${nodeId}`,
      ),
    ).toBe(false);
    expect(screen.getByText("Initial foothold")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Delete node" }));

    const secondConfirmDialog = screen.getByRole("dialog", {
      name: "Delete Attack Step",
    });
    await fireEvent.click(
      within(secondConfirmDialog).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => {
      expect(
        hasDeleteCall(
          fetchMock,
          `/api/workspaces/${workspaceId}/nodes/${nodeId}`,
        ),
      ).toBe(true);
    });
    expect(
      methodAndUrlCallCount(
        fetchMock,
        "DELETE",
        `/api/workspaces/${workspaceId}/nodes/${nodeId}`,
      ),
    ).toBe(1);

    await waitFor(() => {
      expect(screen.queryByText("Initial foothold")).toBeNull();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    { nodeType: "privesc", nodeLabel: "Privilege escalation" },
    { nodeType: "lateral-movement", nodeLabel: "Pivot to host B" },
    { nodeType: "data-exfil", nodeLabel: "Exfiltrate archive" },
  ])(
    "renders loaded $nodeType node label in flow surface summary area",
    async ({ nodeType, nodeLabel }) => {
      const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const method = init?.method ?? "GET";

          if (
            url === `/api/workspaces/${workspaceId}/nodes` &&
            method === "GET"
          ) {
            return jsonResponse({
              nodes: [
                {
                  id: `${nodeType}-node`,
                  workspace_id: workspaceId,
                  label: nodeLabel,
                  node_type: nodeType,
                  x: 80,
                  y: 120,
                  timestamp: null,
                  mitre_technique_id: "",
                  mitre_technique_name: "",
                },
              ],
              edges: [],
            });
          }

          throw new Error(
            `Unexpected fetch call in AttackChainPanel.test.ts table case: ${method} ${url}`,
          );
        },
      );

      vi.stubGlobal("fetch", fetchMock);
      render(AttackChainPanel, { workspaceId, onClose: vi.fn() });

      expect(await screen.findByText(nodeLabel)).toBeTruthy();
      expect(
        methodAndUrlCallCount(
          fetchMock,
          "GET",
          `/api/workspaces/${workspaceId}/nodes`,
        ),
      ).toBe(1);
    },
  );
});
