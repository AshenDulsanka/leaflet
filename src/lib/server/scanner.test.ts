/**
 * Unit tests for the scanner XML parser (src/lib/server/scanner.ts).
 * No I/O or DB is touched — the module is purely functional.
 */

import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";

process.env.NOTES_DATA_DIR = join(
  tmpdir(),
  `leaflet-scanner-test-${process.pid}`,
);

import {
  detectScannerFormat,
  parseNessus,
  parseBurp,
  parseScanner,
} from "$lib/server/scanner.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NESSUS_SINGLE = `<?xml version="1.0"?>
<NessusClientData_v2>
  <Report name="Test Scan">
    <ReportHost name="10.0.0.1">
      <HostProperties>
        <tag name="host-ip">10.0.0.1</tag>
      </HostProperties>
      <ReportItem port="443" svc_name="https" protocol="tcp" severity="3" pluginID="56984" pluginName="SSL / TLS Versions Supported">
        <synopsis>The remote service encrypts communications using SSL/TLS.</synopsis>
        <description>This plugin detects which SSL and TLS versions are supported.</description>
      </ReportItem>
    </ReportHost>
  </Report>
</NessusClientData_v2>`;

const NESSUS_CDATA = `<NessusClientData_v2><Report name="S">
  <ReportHost name="192.168.1.5">
    <ReportItem port="80" svc_name="www" protocol="tcp" severity="2" pluginID="11219" pluginName="Nessus SYN scanner">
      <synopsis><![CDATA[SYN-based port scanner.]]></synopsis>
      <description><![CDATA[This plugin performs a SYN port scan.]]></description>
    </ReportItem>
  </ReportHost>
</Report></NessusClientData_v2>`;

const BURP_SINGLE = `<?xml version="1.0"?>
<issues burpVersion="2023.1.1">
  <issue>
    <type>2097152</type>
    <name>SQL injection</name>
    <host ip="10.10.10.5">https://target.htb</host>
    <severity>High</severity>
    <issueBackground>SQL injection vulnerabilities arise when user-controllable data is incorporated into SQL queries unsafely.</issueBackground>
    <issueDetail>The parameter 'username' appears to be vulnerable.</issueDetail>
  </issue>
</issues>`;

const BURP_MULTI = `<?xml version="1.0"?>
<issues>
  <issue>
    <type>16777984</type>
    <name>Cross-site scripting (reflected)</name>
    <host ip="10.10.10.5">https://target.htb</host>
    <severity>High</severity>
    <issueBackground>Reflected XSS background.</issueBackground>
    <issueDetail></issueDetail>
  </issue>
  <issue>
    <type>134217728</type>
    <name>Password field with autocomplete enabled</name>
    <host ip="10.10.10.5">https://target.htb</host>
    <severity>Low</severity>
    <issueBackground>Autocomplete background.</issueBackground>
    <issueDetail></issueDetail>
  </issue>
</issues>`;

// ─── detectScannerFormat ──────────────────────────────────────────────────────

describe("detectScannerFormat", () => {
  it("returns nessus for NessusClientData_v2 XML", () => {
    expect(detectScannerFormat(NESSUS_SINGLE)).toBe("nessus");
  });

  it("returns nessus for NessusClientData (no _v2)", () => {
    expect(
      detectScannerFormat(
        "<NessusClientData><Report></Report></NessusClientData>",
      ),
    ).toBe("nessus");
  });

  it("returns burp for <issues> root element", () => {
    expect(detectScannerFormat(BURP_SINGLE)).toBe("burp");
  });

  it("returns unknown for <nmaprun> XML", () => {
    expect(detectScannerFormat('<?xml version="1.0"?><nmaprun>')).toBe(
      "unknown",
    );
  });

  it("returns unknown for empty string", () => {
    expect(detectScannerFormat("")).toBe("unknown");
  });
});

// ─── parseNessus — basic ──────────────────────────────────────────────────────

describe("parseNessus — basic", () => {
  it("parses hostIp from ReportHost name attribute", () => {
    const result = parseNessus(NESSUS_SINGLE);
    expect(result.findings[0].hostIp).toBe("10.0.0.1");
  });

  it("parses pluginName as title", () => {
    const result = parseNessus(NESSUS_SINGLE);
    expect(result.findings[0].title).toBe("SSL / TLS Versions Supported");
  });

  it("parses pluginID as pluginId", () => {
    const result = parseNessus(NESSUS_SINGLE);
    expect(result.findings[0].pluginId).toBe("56984");
  });

  it("parses port number (443)", () => {
    const result = parseNessus(NESSUS_SINGLE);
    expect(result.findings[0].hostPort).toBe(443);
  });

  it("severity=3 maps to high", () => {
    const result = parseNessus(NESSUS_SINGLE);
    expect(result.findings[0].severity).toBe("high");
  });

  it("source is nessus", () => {
    const result = parseNessus(NESSUS_SINGLE);
    expect(result.findings[0].source).toBe("nessus");
  });
});

// ─── parseNessus — severity mapping ──────────────────────────────────────────

describe("parseNessus — severity mapping", () => {
  function makeSeverityXml(sev: string): string {
    return `<NessusClientData_v2><Report name="T">
      <ReportHost name="1.2.3.4">
        <ReportItem port="22" svc_name="ssh" protocol="tcp" severity="${sev}" pluginID="1" pluginName="Test">
          <description>test</description>
        </ReportItem>
      </ReportHost>
    </Report></NessusClientData_v2>`;
  }

  it("severity=4 maps to critical", () => {
    expect(parseNessus(makeSeverityXml("4")).findings[0].severity).toBe(
      "critical",
    );
  });

  it("severity=2 maps to medium", () => {
    expect(parseNessus(makeSeverityXml("2")).findings[0].severity).toBe(
      "medium",
    );
  });

  it("severity=1 maps to low", () => {
    expect(parseNessus(makeSeverityXml("1")).findings[0].severity).toBe("low");
  });

  it("severity=0 maps to info", () => {
    expect(parseNessus(makeSeverityXml("0")).findings[0].severity).toBe("info");
  });
});

// ─── parseNessus — CDATA ──────────────────────────────────────────────────────

describe("parseNessus — CDATA", () => {
  it("strips CDATA wrappers from description", () => {
    const result = parseNessus(NESSUS_CDATA);
    expect(result.findings[0].description).not.toContain("<![CDATA[");
    expect(result.findings[0].description).toContain("SYN-based port scanner");
  });

  it("CDATA fixture returns exactly 1 finding", () => {
    const result = parseNessus(NESSUS_CDATA);
    expect(result.findings).toHaveLength(1);
  });
});

// ─── parseBurp — basic ────────────────────────────────────────────────────────

describe("parseBurp — basic", () => {
  it("parses <name> as title", () => {
    const result = parseBurp(BURP_SINGLE);
    expect(result.findings[0].title).toBe("SQL injection");
  });

  it('extracts hostIp from <host ip="..."> attribute', () => {
    const result = parseBurp(BURP_SINGLE);
    expect(result.findings[0].hostIp).toBe("10.10.10.5");
  });

  it("High maps to high", () => {
    const result = parseBurp(BURP_SINGLE);
    expect(result.findings[0].severity).toBe("high");
  });

  it("Information maps to info", () => {
    const xml = `<issues><issue>
      <type>123</type>
      <name>Clickjacking</name>
      <host ip="1.2.3.4">http://example.htb</host>
      <severity>Information</severity>
      <issueBackground>Background.</issueBackground>
      <issueDetail></issueDetail>
    </issue></issues>`;
    expect(parseBurp(xml).findings[0].severity).toBe("info");
  });

  it("<type> is used as pluginId", () => {
    const result = parseBurp(BURP_SINGLE);
    expect(result.findings[0].pluginId).toBe("2097152");
  });
});

// ─── parseBurp — multi ────────────────────────────────────────────────────────

describe("parseBurp — multi", () => {
  it("parses two findings from BURP_MULTI", () => {
    const result = parseBurp(BURP_MULTI);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].title).toBe("Cross-site scripting (reflected)");
    expect(result.findings[1].title).toBe(
      "Password field with autocomplete enabled",
    );
  });
});

// ─── parseScanner dispatch ────────────────────────────────────────────────────

describe("parseScanner dispatch", () => {
  it("delegates to parseNessus on nessus format", () => {
    const result = parseScanner(NESSUS_SINGLE);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].source).toBe("nessus");
  });

  it("delegates to parseBurp on burp format", () => {
    const result = parseScanner(BURP_SINGLE);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].source).toBe("burp");
  });

  it("returns error entry for unknown format", () => {
    const result = parseScanner('<nmaprun scanner="nmap"></nmaprun>');
    expect(result.findings).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/unrecognised/i);
  });
});
