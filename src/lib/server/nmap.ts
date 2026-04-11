/**
 * Pure TypeScript Nmap output parser.
 * Supports grepable (-oG) and XML (-oX) formats.
 * No I/O, no DB — safe to unit-test in isolation.
 */

import type { NmapHost, NmapParseResult, NmapPort } from '$lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Format detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectFormat(raw: string): 'grepable' | 'xml' | 'unknown' {
  const t = raw.trimStart();
  if (t.startsWith('<?xml') || t.startsWith('<nmaprun')) return 'xml';
  if (/# Nmap|^Host:/m.test(raw)) return 'grepable';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Grepable parser (-oG)
// ─────────────────────────────────────────────────────────────────────────────

export function parseNmapGrepable(raw: string): NmapParseResult {
  const lines = raw.split('\n');
  const errors: Array<{ line: number; message: string }> = [];

  // Keyed by IP so multiple Host: lines for the same IP are merged correctly.
  const hostMap = new Map<string, { host: NmapHost; skip: boolean }>();
  // Track the last IP seen so standalone Ports:/OS: lines can be associated.
  let lastIp: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trimEnd();

    if (line.trim() === '' || line.startsWith('#')) continue;

    const hostMatch = /^Host:\s+(\S+)\s+\(([^)]*)\)/.exec(line);
    if (hostMatch) {
      const ip = hostMatch[1];
      const hostname = hostMatch[2] ?? '';
      lastIp = ip;

      if (!hostMap.has(ip)) {
        hostMap.set(ip, { host: { ip, hostname, os: '', ports: [] }, skip: false });
      }
      const entry = hostMap.get(ip)!;
      if (!entry.host.hostname && hostname) entry.host.hostname = hostname;

      // Status: Down on any line for this IP marks it skipped.
      const statusMatch = /Status:\s+(\S+)/.exec(line);
      if (statusMatch && statusMatch[1].toLowerCase() === 'down') {
        entry.skip = true;
      }

      // Ports: may appear inline on a Host: line (real nmap -oG format).
      if (/Ports:\s+/.test(line)) {
        parsePorts(line, entry.host);
      }

      // OS: may also appear inline on a Host: line.
      const osMatch = /\bOS:\s+([^\t]+)/.exec(line);
      if (osMatch) {
        entry.host.os = osMatch[1].trim();
      }
      continue;
    }

    // Standalone Ports: line (spec format / some nmap variants).
    if (/^Ports:\s+/.test(line) && lastIp) {
      const entry = hostMap.get(lastIp);
      if (entry) parsePorts(line, entry.host);
      continue;
    }

    // Standalone OS: line.
    const osLine = /^OS:\s+(.+)/.exec(line);
    if (osLine && lastIp) {
      const entry = hostMap.get(lastIp);
      if (entry) entry.host.os = osLine[1].trim();
      continue;
    }

    // Standalone Status: line.
    const statusLine = /^Status:\s+(\S+)/.exec(line);
    if (statusLine && lastIp) {
      const entry = hostMap.get(lastIp);
      if (entry && statusLine[1].toLowerCase() === 'down') entry.skip = true;
      continue;
    }

    errors.push({ line: lineNum, message: `Unrecognised line: ${line.slice(0, 60)}` });
  }

  const hosts = Array.from(hostMap.values())
    .filter((e) => !e.skip)
    .map((e) => e.host);

  return { hosts, errors };
}

function parsePorts(line: string, host: NmapHost): void {
  const portPattern =
    /(\d+)\/(open(?:\|filtered)?|closed|filtered)\/(tcp|udp)\/\/([^/]*)\/\/([^/]*)\//g;
  let pm: RegExpExecArray | null;
  while ((pm = portPattern.exec(line)) !== null) {
    const rawState = pm[2];
    const state: NmapPort['state'] =
      rawState === 'open' ? 'open' : rawState === 'closed' ? 'closed' : 'filtered';
    host.ports.push({
      number: parseInt(pm[1], 10),
      protocol: pm[3] as 'tcp' | 'udp',
      service: pm[4].trim(),
      version: pm[5].trim(),
      state,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XML parser (-oX)
// ─────────────────────────────────────────────────────────────────────────────

export function parseNmapXml(raw: string): NmapParseResult {
  const hosts: NmapHost[] = [];
  const errors: Array<{ line: number; message: string }> = [];

  const hostBlockPattern = /<host\b[\s\S]*?<\/host>/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = hostBlockPattern.exec(raw)) !== null) {
    const block = blockMatch[0];

    // Extract IPv4 address.
    const ipMatch = /<address addr="([^"]+)"\s+addrtype="ipv4"/.exec(block);
    if (!ipMatch) continue; // skip IPv6-only hosts

    const ip = ipMatch[1];

    // Hostname: prefer type="user" over type="PTR".
    let hostname = '';
    const hostnamePattern = /<hostname name="([^"]+)"\s+type="(user|PTR)"/g;
    let hm: RegExpExecArray | null;
    let ptrHostname = '';
    while ((hm = hostnamePattern.exec(block)) !== null) {
      if (hm[2] === 'user') {
        hostname = hm[1];
        break;
      }
      if (hm[2] === 'PTR' && !ptrHostname) {
        ptrHostname = hm[1];
      }
    }
    if (!hostname) hostname = ptrHostname;

    // OS guess.
    const osMatch = /<osmatch name="([^"]+)"/.exec(block);
    const os = osMatch ? osMatch[1] : '';

    // Ports.
    const ports: NmapPort[] = [];
    // Match <port> blocks — each contains state and optionally service.
    const portBlockPattern = /<port\s[^>]*>[\s\S]*?<\/port>/g;
    let pb: RegExpExecArray | null;
    while ((pb = portBlockPattern.exec(block)) !== null) {
      const portBlock = pb[0];

      const protoMatch = /protocol="(tcp|udp)"/.exec(portBlock);
      const portidMatch = /portid="(\d+)"/.exec(portBlock);
      const stateMatch = /<state\s+state="([^"]+)"/.exec(portBlock);

      if (!protoMatch || !portidMatch || !stateMatch) continue;

      const rawState = stateMatch[1];
      const state: NmapPort['state'] =
        rawState === 'open' ? 'open'
        : rawState === 'closed' ? 'closed'
        : 'filtered';

      // Service — try both with and without product/version attrs.
      let service = '';
      let version = '';

      const nameFirstMatch =
        /<service\s[^>]*name="([^"]*)"[^>]*product="([^"]*)"[^>]*version="([^"]*)"/.exec(portBlock);
      const productFirstMatch =
        /<service\s[^>]*product="([^"]*)"[^>]*name="([^"]*)"[^>]*version="([^"]*)"/.exec(portBlock);

      if (nameFirstMatch) {
        service = nameFirstMatch[1];
        const prod = nameFirstMatch[2].trim();
        const ver = nameFirstMatch[3].trim();
        version = [prod, ver].filter(Boolean).join(' ').trim();
      } else if (productFirstMatch) {
        service = productFirstMatch[2];
        const prod = productFirstMatch[1].trim();
        const ver = productFirstMatch[3].trim();
        version = [prod, ver].filter(Boolean).join(' ').trim();
      } else {
        const simpleServiceMatch = /<service\s[^>]*name="([^"]*)"/.exec(portBlock);
        service = simpleServiceMatch ? simpleServiceMatch[1] : '';
      }

      ports.push({
        number: parseInt(portidMatch[1], 10),
        protocol: protoMatch[1] as 'tcp' | 'udp',
        service,
        version,
        state,
      });
    }

    hosts.push({ ip, hostname, os, ports });
  }

  return { hosts, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified entry point
// ─────────────────────────────────────────────────────────────────────────────

export function parseNmap(raw: string): NmapParseResult {
  const fmt = detectFormat(raw);
  if (fmt === 'grepable') return parseNmapGrepable(raw);
  if (fmt === 'xml') return parseNmapXml(raw);
  return {
    hosts: [],
    errors: [{ line: 0, message: 'Unrecognised format. Paste Nmap -oG or -oX output.' }],
  };
}
