import { describe, expect, it } from "vitest";
import { extractSnippetVarNames, searchCommands } from "$lib/data/commands.js";

describe("extractSnippetVarNames", () => {
  it("returns empty array for no commands", () => {
    expect(extractSnippetVarNames([])).toEqual([]);
  });

  it("returns empty array for a command with no placeholders", () => {
    expect(extractSnippetVarNames(["echo hello world"])).toEqual([]);
  });

  it("extracts a single variable from one command", () => {
    expect(extractSnippetVarNames(["{TARGET_IP}"])).toEqual(["TARGET_IP"]);
  });

  it("extracts multiple variables from one command", () => {
    expect(extractSnippetVarNames(["nmap -p {PORTS} {TARGET_IP}"])).toEqual([
      "PORTS",
      "TARGET_IP",
    ]);
  });

  it("deduplicates within a single command", () => {
    expect(extractSnippetVarNames(["{HOST} connect {HOST}"])).toEqual(["HOST"]);
  });

  it("deduplicates across multiple commands", () => {
    expect(
      extractSnippetVarNames(["{TARGET_IP}", "{TARGET_IP}/{PATH}"]),
    ).toEqual(["PATH", "TARGET_IP"]);
  });

  it("returns names sorted alphabetically", () => {
    expect(extractSnippetVarNames(["{ZEBRA} {ALPHA} {MIDDLE}"])).toEqual([
      "ALPHA",
      "MIDDLE",
      "ZEBRA",
    ]);
  });

  it("ignores lowercase or mixed-case placeholders", () => {
    expect(extractSnippetVarNames(["{lower}", "{Mixed}", "{VALID}"])).toEqual([
      "VALID",
    ]);
  });

  it("correctly handles placeholders with digits and underscores", () => {
    expect(
      extractSnippetVarNames(["{DC_IP}", "{PORT2}", "{C2_SERVER}"]),
    ).toEqual(["C2_SERVER", "DC_IP", "PORT2"]);
  });

  it("handles multiple commands with disjoint variable sets", () => {
    const result = extractSnippetVarNames([
      "{LHOST}:{LPORT}",
      "nc -lvnp {LPORT}",
      "wget {URL}",
    ]);
    expect(result).toEqual(["LHOST", "LPORT", "URL"]);
  });
});

describe("searchCommands", () => {
  const commands = [
    {
      id: "c1",
      category: "recon" as const,
      title: "Nmap quick scan",
      command: "nmap -p- {TARGET_IP}",
      description: "Fast TCP discovery",
      tags: ["nmap", "ports"],
    },
    {
      id: "c2",
      category: "exploitation" as const,
      title: "Curl target",
      command: "curl http://{TARGET_IP}/health",
      description: "Probe HTTP health endpoint",
      tags: ["web", "curl"],
    },
  ];

  it("returns all commands for empty and whitespace query", () => {
    expect(searchCommands("", commands)).toEqual(commands);
    expect(searchCommands("   ", commands)).toEqual(commands);
  });

  it("matches title and command text case-insensitively", () => {
    expect(searchCommands("NMAP", commands).map((c) => c.id)).toEqual(["c1"]);
    expect(
      searchCommands("http://{target_ip}", commands).map((c) => c.id),
    ).toEqual(["c2"]);
  });

  it("matches description and tags", () => {
    expect(
      searchCommands("health endpoint", commands).map((c) => c.id),
    ).toEqual(["c2"]);
    expect(searchCommands("ports", commands).map((c) => c.id)).toEqual(["c1"]);
  });

  it("returns an empty list when there is no match", () => {
    expect(searchCommands("no-match-term", commands)).toEqual([]);
  });
});
