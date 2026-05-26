// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/svelte", async () => {
  const StubFlowComponent = (
    await import("./__tests__/mocks/StubFlowComponent.svelte")
  ).default;

  return {
    Handle: StubFlowComponent,
    Position: { Left: "left", Right: "right" },
  };
});

import AttackChainNode from "./AttackChainNode.svelte";

interface AttackNodeData extends Record<string, unknown> {
  label: string;
  type: string;
  mitreId: string;
  mitreName: string;
  timestamp: string;
}

function buildNodeProps(nodeId: string, data: AttackNodeData) {
  return {
    id: nodeId,
    data,
    type: "attackNode",
    dragging: false,
    zIndex: 1,
    selectable: true,
    deletable: true,
    selected: false,
    draggable: true,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
}

interface KnownTypeCase {
  nodeType: string;
  shortLabel: string;
  label: string;
  accent: string;
}

const knownTypeCases: KnownTypeCase[] = [
  { nodeType: "flag", shortLabel: "FLAG", label: "Flag", accent: "#22c55e" },
  { nodeType: "recon", shortLabel: "RECON", label: "Recon", accent: "#3b82f6" },
  {
    nodeType: "initial-access",
    shortLabel: "ENTRY",
    label: "Initial Access",
    accent: "#f97316",
  },
  {
    nodeType: "privesc",
    shortLabel: "PRIV",
    label: "Privilege Esc",
    accent: "#ef4444",
  },
  {
    nodeType: "lateral-movement",
    shortLabel: "LATERAL",
    label: "Lateral Move",
    accent: "#ec4899",
  },
  {
    nodeType: "data-exfil",
    shortLabel: "EXFIL",
    label: "Data Exfil",
    accent: "#14b8a6",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AttackChainNode", () => {
  it.each(knownTypeCases)(
    "maps known node type $nodeType to expected observable visual contract",
    ({ nodeType, shortLabel, label, accent }) => {
      const nodeTitle = `Node for ${nodeType}`;

      render(
        AttackChainNode,
        buildNodeProps(`node-${nodeType}`, {
          label: nodeTitle,
          type: nodeType,
          mitreId: "",
          mitreName: "",
          timestamp: "",
        }),
      );

      const nodeLabel = screen.getByText(nodeTitle);
      const nodeRoot = nodeLabel.closest('div[style*="--node-accent"]');

      expect(nodeRoot).not.toBeNull();
      expect(nodeRoot?.getAttribute("style")).toContain(
        `--node-accent: ${accent};`,
      );
      expect(screen.getByText(shortLabel)).toBeTruthy();
      expect(screen.getByText(label)).toBeTruthy();
    },
  );

  it("falls back unknown node types to action visual mapping", () => {
    render(
      AttackChainNode,
      buildNodeProps("node-unknown", {
        label: "Unknown stage",
        type: "unexpected-stage",
        mitreId: "",
        mitreName: "",
        timestamp: "",
      }),
    );

    const nodeLabel = screen.getByText("Unknown stage");
    const nodeRoot = nodeLabel.closest('div[style*="--node-accent"]');

    expect(nodeRoot).not.toBeNull();
    expect(nodeRoot?.className).toContain("type-action");
    expect(nodeRoot?.getAttribute("style")).toContain(
      "--node-accent: #8b5cf6;",
    );
    expect(screen.getByText("ACTION")).toBeTruthy();
    expect(screen.getByText("Action")).toBeTruthy();
  });
});
