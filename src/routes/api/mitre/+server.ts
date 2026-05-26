/**
 * GET /api/mitre
 * Returns the MITRE Enterprise ATT&CK technique list, extracted from the STIX bundle
 * hosted at https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json.
 *
 * Results are cached in-memory for 24 hours to avoid hammering the upstream source on
 * every request. The server process is long-running, so a module-level cache variable is adequate.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const MITRE_URL =
  'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface MitreTechnique {
  /** MITRE ATT&CK external ID, e.g. "T1059" or "T1059.001" */
  external_id: string;
  /** Human-readable technique name */
  name: string;
  /** First tactic phase this technique belongs to (from kill_chain_phases) */
  tactic: string;
  /** First 300 characters of the STIX description field */
  description: string;
  /** Canonical MITRE ATT&CK URL for this technique */
  url: string;
}

// Module-level cache — survives for the lifetime of the server process.
let cachedTechniques: MitreTechnique[] | null = null;
let cacheTimestamp = 0;

// --- STIX type definitions (minimal, for extraction purposes) ---

interface StixExternalReference {
  source_name: string;
  external_id?: string;
  url?: string;
}

interface StixKillChainPhase {
  kill_chain_name: string;
  phase_name: string;
}

interface StixAttackPattern {
  type: 'attack-pattern';
  name: string;
  description?: string;
  external_references?: StixExternalReference[];
  kill_chain_phases?: StixKillChainPhase[];
  x_mitre_deprecated?: boolean;
  revoked?: boolean;
}

interface StixBundle {
  type: 'bundle';
  objects: Array<{ type: string } & Partial<StixAttackPattern>>;
}

function extractTechniques(bundle: StixBundle): MitreTechnique[] {
  const results: MitreTechnique[] = [];

  for (const obj of bundle.objects) {
    if (obj.type !== 'attack-pattern') continue;
    // Skip deprecated and revoked entries
    if (obj.x_mitre_deprecated || obj.revoked) continue;

    const refs = obj.external_references ?? [];
    const mitreRef = refs.find((r) => r.source_name === 'mitre-attack');
    if (!mitreRef?.external_id) continue;

    const tactic =
      (obj.kill_chain_phases ?? []).find((kcp) => kcp.kill_chain_name === 'mitre-attack')
        ?.phase_name ?? '';

    const rawDesc = obj.description ?? '';
    const description = rawDesc.length > 300 ? rawDesc.slice(0, 300) : rawDesc;

    results.push({
      external_id: mitreRef.external_id,
      name: obj.name ?? '',
      tactic,
      description,
      url: mitreRef.url ?? '',
    });
  }

  results.sort((a, b) => a.external_id.localeCompare(b.external_id));
  return results;
}

export const GET: RequestHandler = async () => {
  const now = Date.now();

  if (cachedTechniques && now - cacheTimestamp < CACHE_TTL_MS) {
    return json(cachedTechniques);
  }

  let bundle: StixBundle;
  try {
    const res = await fetch(MITRE_URL);
    if (!res.ok) {
      console.error('[api/mitre] Upstream HTTP status:', res.status);
      return json(
        { error: 'MITRE ATT&CK data is temporarily unavailable' },
        { status: 503 },
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bundle = (await res.json()) as StixBundle;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/mitre] Fetch error:', message);
    return json({ error: 'Failed to fetch MITRE ATT&CK data from upstream' }, { status: 503 });
  }

  if (bundle.type !== 'bundle' || !Array.isArray(bundle.objects)) {
    return json({ error: 'Unexpected upstream response format' }, { status: 503 });
  }

  const techniques = extractTechniques(bundle);
  cachedTechniques = techniques;
  cacheTimestamp = now;

  return json(techniques);
};
