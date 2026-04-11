import { describe, expect, it } from 'vitest';
import { extractSnippetVarNames } from '$lib/data/commands.js';

describe('extractSnippetVarNames', () => {
  it('returns empty array for no commands', () => {
    expect(extractSnippetVarNames([])).toEqual([]);
  });

  it('returns empty array for a command with no placeholders', () => {
    expect(extractSnippetVarNames(['echo hello world'])).toEqual([]);
  });

  it('extracts a single variable from one command', () => {
    expect(extractSnippetVarNames(['{TARGET_IP}'])).toEqual(['TARGET_IP']);
  });

  it('extracts multiple variables from one command', () => {
    expect(extractSnippetVarNames(['nmap -p {PORTS} {TARGET_IP}'])).toEqual(['PORTS', 'TARGET_IP']);
  });

  it('deduplicates within a single command', () => {
    expect(extractSnippetVarNames(['{HOST} connect {HOST}'])).toEqual(['HOST']);
  });

  it('deduplicates across multiple commands', () => {
    expect(extractSnippetVarNames(['{TARGET_IP}', '{TARGET_IP}/{PATH}'])).toEqual(['PATH', 'TARGET_IP']);
  });

  it('returns names sorted alphabetically', () => {
    expect(extractSnippetVarNames(['{ZEBRA} {ALPHA} {MIDDLE}'])).toEqual(['ALPHA', 'MIDDLE', 'ZEBRA']);
  });

  it('ignores lowercase or mixed-case placeholders', () => {
    expect(extractSnippetVarNames(['{lower}', '{Mixed}', '{VALID}'])).toEqual(['VALID']);
  });

  it('correctly handles placeholders with digits and underscores', () => {
    expect(extractSnippetVarNames(['{DC_IP}', '{PORT2}', '{C2_SERVER}'])).toEqual([
      'C2_SERVER',
      'DC_IP',
      'PORT2',
    ]);
  });

  it('handles multiple commands with disjoint variable sets', () => {
    const result = extractSnippetVarNames(['{LHOST}:{LPORT}', 'nc -lvnp {LPORT}', 'wget {URL}']);
    expect(result).toEqual(['LHOST', 'LPORT', 'URL']);
  });
});
