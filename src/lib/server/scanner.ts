/**
 * Pure TypeScript scanner output parser.
 * Supports Nessus (.nessus XML) and Burp Suite XML export formats.
 * No I/O, no DB — safe to unit-test in isolation.
 */

import type { FindingSeverity, ScannedFinding, ScannerParseResult } from '$lib/types';

// ─── Format detection ─────────────────────────────────────────────────────────

export function detectScannerFormat(raw: string): 'nessus' | 'burp' | 'unknown' {
  const t = raw.trimStart();
  if (/<NessusClientData/i.test(t)) return 'nessus';
  if (/<issues[\s>]/i.test(t)) return 'burp';
  return 'unknown';
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

/** Get the value of a named attribute from an XML opening tag string. */
function attr(tag: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(tag);
  return m ? decodeXmlEnt(m[1]) : '';
}

/** Extract and decode the text content of the first matching XML tag in block. */
function tagText(block: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  if (!m) return '';
  const inner = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(inner);
  return decodeXmlEnt(cdata ? cdata[1].trim() : inner);
}

function decodeXmlEnt(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cap(s: string, max = 4000): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// ─── Nessus ───────────────────────────────────────────────────────────────────

function mapNessusSeverity(raw: string): FindingSeverity {
  switch (raw.trim()) {
    case '4':  return 'critical';
    case '3':  return 'high';
    case '2':  return 'medium';
    case '1':  return 'low';
    default:   return 'info';
  }
}

export function parseNessus(xml: string): ScannerParseResult {
  const findings: ScannedFinding[] = [];

  const hostBlocks = xml.match(/<ReportHost\b[\s\S]*?<\/ReportHost>/g) ?? [];
  for (const hostBlock of hostBlocks) {
    const openTag = hostBlock.match(/<ReportHost\b[^>]*/)?.[0] ?? '';
    const hostIp = attr(openTag, 'name') || tagText(hostBlock, 'tag name="host-ip"');

    const itemBlocks = hostBlock.match(/<ReportItem\b[\s\S]*?<\/ReportItem>/g) ?? [];
    for (const item of itemBlocks) {
      const openItem = item.match(/<ReportItem\b[^>]*/)?.[0] ?? '';
      const title = attr(openItem, 'pluginName');
      const pluginId = attr(openItem, 'pluginID');
      const portRaw = parseInt(attr(openItem, 'port'), 10);
      const port = isNaN(portRaw) || portRaw === 0 ? null : portRaw;
      const severity = mapNessusSeverity(attr(openItem, 'severity'));
      const synopsis = tagText(item, 'synopsis');
      const desc = tagText(item, 'description');
      const pluginOutput = tagText(item, 'plugin_output');
      const description = cap(
        [synopsis, desc, pluginOutput].filter(Boolean).join('\n\n'),
      );

      if (title) {
        findings.push({ title, description, severity, hostIp, hostPort: port, pluginId, source: 'nessus' });
      }
    }
  }

  return { findings, errors: [] };
}

// ─── Burp Suite ───────────────────────────────────────────────────────────────

function mapBurpSeverity(raw: string): FindingSeverity {
  switch (raw.trim().toLowerCase()) {
    case 'critical':    return 'critical';
    case 'high':        return 'high';
    case 'medium':      return 'medium';
    case 'low':         return 'low';
    case 'information': return 'info';
    default:            return 'info';
  }
}

export function parseBurp(xml: string): ScannerParseResult {
  const findings: ScannedFinding[] = [];

  const issueBlocks = xml.match(/<issue\b[\s\S]*?<\/issue>/g) ?? [];
  for (const issue of issueBlocks) {
    const title = tagText(issue, 'name');
    const pluginId = tagText(issue, 'type');
    const hostIp = /(?:<host[^>]*\bip="|ip=")([^"]+)"/.exec(issue)?.[1] ?? '';
    const severity = mapBurpSeverity(tagText(issue, 'severity'));
    const background = tagText(issue, 'issueBackground');
    const detail = tagText(issue, 'issueDetail');
    const description = cap([background, detail].filter(Boolean).join('\n\n'));

    if (title) {
      findings.push({ title, description, severity, hostIp, hostPort: null, pluginId, source: 'burp' });
    }
  }

  return { findings, errors: [] };
}

// ─── Unified entry point ──────────────────────────────────────────────────────

export function parseScanner(xml: string): ScannerParseResult {
  const fmt = detectScannerFormat(xml);
  if (fmt === 'nessus') return parseNessus(xml);
  if (fmt === 'burp') return parseBurp(xml);
  return {
    findings: [],
    errors: [{ message: 'Unrecognised format. Upload a .nessus or Burp Suite XML export.' }],
  };
}
