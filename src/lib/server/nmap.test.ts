/**
 * Unit tests for the Nmap output parser (src/lib/server/nmap.ts).
 * Uses an isolated temp NOTES_DATA_DIR so no real DB is touched.
 */

import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";

process.env.NOTES_DATA_DIR = join(tmpdir(), `leaflet-nmap-test-${process.pid}`);

import {
  detectFormat,
  parseNmap,
  parseNmapGrepable,
  parseNmapXml,
} from "$lib/server/nmap.js";

// ─────────────────────────────────────────────────────────────────────────────
// detectFormat
// ─────────────────────────────────────────────────────────────────────────────

describe("detectFormat", () => {
  it("detects grepable format from # Nmap header", () => {
    expect(detectFormat("# Nmap 7.94 scan initiated\nHost: 10.0.0.1 ()")).toBe(
      "grepable",
    );
  });

  it("detects grepable format from ^Host: line", () => {
    expect(
      detectFormat("Host: 192.168.1.1 ()\nPorts: 22/open/tcp//ssh//"),
    ).toBe("grepable");
  });

  it("detects XML format from <?xml declaration", () => {
    expect(detectFormat('<?xml version="1.0"?>\n<nmaprun>')).toBe("xml");
  });

  it("detects XML format from <nmaprun start", () => {
    expect(detectFormat('<nmaprun scanner="nmap">')).toBe("xml");
  });

  it("returns unknown for empty string", () => {
    expect(detectFormat("")).toBe("unknown");
  });

  it("returns unknown for random text", () => {
    expect(detectFormat("hello world this is not nmap output")).toBe("unknown");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseNmapGrepable
// ─────────────────────────────────────────────────────────────────────────────

const GREPABLE_SINGLE = `# Nmap 7.94 scan initiated Mon Jan  1 00:00:00 2024
Host: 10.0.0.1 (target.lab)	Status: Up
Host: 10.0.0.1 (target.lab)	Ports: 22/open/tcp//ssh//OpenSSH 8.9p1/, 80/open/tcp//http//Apache 2.4/, 443/filtered/tcp//https///
OS: Linux 5.x
# Nmap done`;

describe("parseNmapGrepable – single host", () => {
  it("parses IP and hostname", () => {
    const result = parseNmapGrepable(GREPABLE_SINGLE);
    expect(result.hosts).toHaveLength(1);
    expect(result.hosts[0].ip).toBe("10.0.0.1");
    expect(result.hosts[0].hostname).toBe("target.lab");
  });

  it("parses OS line", () => {
    const result = parseNmapGrepable(GREPABLE_SINGLE);
    expect(result.hosts[0].os).toBe("Linux 5.x");
  });

  it("parses open ports correctly", () => {
    const result = parseNmapGrepable(GREPABLE_SINGLE);
    const ports = result.hosts[0].ports;
    expect(ports).toHaveLength(3);
    expect(ports[0]).toMatchObject({
      number: 22,
      protocol: "tcp",
      service: "ssh",
      state: "open",
    });
    expect(ports[1]).toMatchObject({
      number: 80,
      protocol: "tcp",
      service: "http",
      state: "open",
    });
  });

  it("normalises open|filtered state to filtered", () => {
    const input =
      "Host: 10.0.0.2 ()\nPorts: 8080/open|filtered/tcp//http-proxy///\n";
    const result = parseNmapGrepable(input);
    expect(result.hosts[0].ports[0].state).toBe("filtered");
  });

  it("normalises filtered state correctly", () => {
    const result = parseNmapGrepable(GREPABLE_SINGLE);
    expect(result.hosts[0].ports[2].state).toBe("filtered");
  });
});

describe("parseNmapGrepable – Status:Down excluded", () => {
  it("skips hosts with Status: Down", () => {
    const input = `Host: 10.0.0.3 ()	Status: Down\nHost: 10.0.0.3 ()	Ports: 22/open/tcp//ssh///\n`;
    const result = parseNmapGrepable(input);
    expect(result.hosts).toHaveLength(0);
  });
});

describe("parseNmapGrepable – host with no ports", () => {
  it("returns ports array as empty when no Ports line", () => {
    const input = "Host: 10.0.0.4 (noporthost)\nStatus: Up\n";
    const result = parseNmapGrepable(input);
    expect(result.hosts).toHaveLength(1);
    expect(result.hosts[0].ports).toHaveLength(0);
  });
});

describe("parseNmapGrepable – multi-host scan", () => {
  it("parses multiple hosts", () => {
    const input = `# Nmap scan
Host: 10.0.0.5 (alpha)	Status: Up
Host: 10.0.0.5 (alpha)	Ports: 22/open/tcp//ssh///
Host: 10.0.0.6 (beta)	Status: Up
Host: 10.0.0.6 (beta)	Ports: 80/open/tcp//http///
`;
    const result = parseNmapGrepable(input);
    expect(result.hosts).toHaveLength(2);
    expect(result.hosts[0].ip).toBe("10.0.0.5");
    expect(result.hosts[1].ip).toBe("10.0.0.6");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseNmapXml
// ─────────────────────────────────────────────────────────────────────────────

const XML_SINGLE = `<?xml version="1.0"?>
<nmaprun>
  <host>
    <address addr="192.168.1.10" addrtype="ipv4"/>
    <hostnames><hostname name="webserver.local" type="PTR"/></hostnames>
    <os><osmatch name="Linux 5.x" accuracy="95"/></os>
    <ports>
      <port protocol="tcp" portid="80">
        <state state="open" reason="syn-ack"/>
        <service name="http" product="Apache" version="2.4"/>
      </port>
      <port protocol="tcp" portid="443">
        <state state="filtered" reason="no-response"/>
        <service name="https"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

describe("parseNmapXml – single host", () => {
  it("parses IP", () => {
    const result = parseNmapXml(XML_SINGLE);
    expect(result.hosts).toHaveLength(1);
    expect(result.hosts[0].ip).toBe("192.168.1.10");
  });

  it("parses PTR hostname", () => {
    const result = parseNmapXml(XML_SINGLE);
    expect(result.hosts[0].hostname).toBe("webserver.local");
  });

  it("parses osmatch name as os", () => {
    const result = parseNmapXml(XML_SINGLE);
    expect(result.hosts[0].os).toBe("Linux 5.x");
  });

  it("parses open port with product and version concatenated", () => {
    const result = parseNmapXml(XML_SINGLE);
    const port80 = result.hosts[0].ports.find((p) => p.number === 80);
    expect(port80).toBeDefined();
    expect(port80?.state).toBe("open");
    expect(port80?.service).toBe("http");
    expect(port80?.version).toMatch(/Apache/);
  });

  it("parses filtered port", () => {
    const result = parseNmapXml(XML_SINGLE);
    const port443 = result.hosts[0].ports.find((p) => p.number === 443);
    expect(port443?.state).toBe("filtered");
  });
});

describe("parseNmapXml – no osmatch", () => {
  it("returns empty string for os when no osmatch", () => {
    const xml = `<?xml version="1.0"?><nmaprun>
    <host><address addr="10.1.1.1" addrtype="ipv4"/><ports></ports></host>
    </nmaprun>`;
    const result = parseNmapXml(xml);
    expect(result.hosts[0].os).toBe("");
  });
});

describe("parseNmapXml – IPv6 only host skipped", () => {
  it("skips host with only ipv6 address", () => {
    const xml = `<?xml version="1.0"?><nmaprun>
    <host><address addr="::1" addrtype="ipv6"/><ports></ports></host>
    </nmaprun>`;
    const result = parseNmapXml(xml);
    expect(result.hosts).toHaveLength(0);
  });
});

describe("parseNmapXml – type=user hostname preferred", () => {
  it("prefers type=user over type=PTR", () => {
    const xml = `<?xml version="1.0"?><nmaprun>
    <host>
      <address addr="10.2.2.2" addrtype="ipv4"/>
      <hostnames>
        <hostname name="ptr-name.local" type="PTR"/>
        <hostname name="user-alias" type="user"/>
      </hostnames>
      <ports></ports>
    </host>
    </nmaprun>`;
    const result = parseNmapXml(xml);
    expect(result.hosts[0].hostname).toBe("user-alias");
  });
});

describe("parseNmapXml – empty ports block", () => {
  it("returns zero ports for host with empty ports element", () => {
    const xml = `<?xml version="1.0"?><nmaprun>
    <host><address addr="10.3.3.3" addrtype="ipv4"/><ports></ports></host>
    </nmaprun>`;
    const result = parseNmapXml(xml);
    expect(result.hosts[0].ports).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseNmap (unified entry point)
// ─────────────────────────────────────────────────────────────────────────────

describe("parseNmap", () => {
  it("delegates to grepable parser", () => {
    const input = "# Nmap\nHost: 10.0.0.1 ()\n";
    const result = parseNmap(input);
    expect(result.hosts).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("delegates to xml parser", () => {
    const result = parseNmap(XML_SINGLE);
    expect(result.hosts).toHaveLength(1);
  });

  it("returns error for unknown format", () => {
    const result = parseNmap("totally random text");
    expect(result.hosts).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/Unrecognised format/);
  });
});
