export type CvssSeverity = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';

export interface CvssMetrics {
  AV: 'N' | 'A' | 'L' | 'P' | null;
  AC: 'L' | 'H' | null;
  PR: 'N' | 'L' | 'H' | null;
  UI: 'N' | 'R' | null;
  S: 'U' | 'C' | null;
  C: 'H' | 'L' | 'N' | null;
  I: 'H' | 'L' | 'N' | null;
  A: 'H' | 'L' | 'N' | null;
}

export interface CvssResult {
  score: number;
  severity: CvssSeverity;
  vector: string;
}

interface MetricOption {
  value: string;
  label: string;
  abbr: string;
  weight: number;
}

export interface MetricDefinition {
  key: keyof CvssMetrics;
  label: string;
  options: MetricOption[];
}

// AV weights
const AV_WEIGHTS: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
// AC weights
const AC_WEIGHTS: Record<string, number> = { L: 0.77, H: 0.44 };
// PR weights are scope-dependent; defined inline in calculateCvss
const PR_WEIGHTS_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_WEIGHTS_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.50 };
// UI weights
const UI_WEIGHTS: Record<string, number> = { N: 0.85, R: 0.62 };
// CIA weights
const CIA_WEIGHTS: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

export const METRIC_OPTIONS: MetricDefinition[] = [
  {
    key: 'AV',
    label: 'Attack Vector',
    options: [
      { value: 'N', label: 'Network',          abbr: 'N', weight: 0.85 },
      { value: 'A', label: 'Adjacent',         abbr: 'A', weight: 0.62 },
      { value: 'L', label: 'Local',            abbr: 'L', weight: 0.55 },
      { value: 'P', label: 'Physical',         abbr: 'P', weight: 0.2  },
    ],
  },
  {
    key: 'AC',
    label: 'Attack Complexity',
    options: [
      { value: 'L', label: 'Low',  abbr: 'L', weight: 0.77 },
      { value: 'H', label: 'High', abbr: 'H', weight: 0.44 },
    ],
  },
  {
    key: 'PR',
    label: 'Privileges Required',
    options: [
      { value: 'N', label: 'None',  abbr: 'N', weight: 0.85 },
      { value: 'L', label: 'Low',   abbr: 'L', weight: 0.62 },
      { value: 'H', label: 'High',  abbr: 'H', weight: 0.27 },
    ],
  },
  {
    key: 'UI',
    label: 'User Interaction',
    options: [
      { value: 'N', label: 'None',     abbr: 'N', weight: 0.85 },
      { value: 'R', label: 'Required', abbr: 'R', weight: 0.62 },
    ],
  },
  {
    key: 'S',
    label: 'Scope',
    options: [
      { value: 'U', label: 'Unchanged', abbr: 'U', weight: 0 },
      { value: 'C', label: 'Changed',   abbr: 'C', weight: 0 },
    ],
  },
  {
    key: 'C',
    label: 'Confidentiality',
    options: [
      { value: 'H', label: 'High', abbr: 'H', weight: 0.56 },
      { value: 'L', label: 'Low',  abbr: 'L', weight: 0.22 },
      { value: 'N', label: 'None', abbr: 'N', weight: 0    },
    ],
  },
  {
    key: 'I',
    label: 'Integrity',
    options: [
      { value: 'H', label: 'High', abbr: 'H', weight: 0.56 },
      { value: 'L', label: 'Low',  abbr: 'L', weight: 0.22 },
      { value: 'N', label: 'None', abbr: 'N', weight: 0    },
    ],
  },
  {
    key: 'A',
    label: 'Availability',
    options: [
      { value: 'H', label: 'High', abbr: 'H', weight: 0.56 },
      { value: 'L', label: 'Low',  abbr: 'L', weight: 0.22 },
      { value: 'N', label: 'None', abbr: 'N', weight: 0    },
    ],
  },
];

function ceilToOnDecimal(value: number): number {
  // CVSS always rounds UP (ceiling) to one decimal place, not rounds-to-nearest.
  return Math.ceil(value * 10) / 10;
}

function getSeverity(score: number): CvssSeverity {
  if (score === 0) return 'None';
  if (score < 4.0) return 'Low';
  if (score < 7.0) return 'Medium';
  if (score < 9.0) return 'High';
  return 'Critical';
}

export function calculateCvss(metrics: CvssMetrics): CvssResult | null {
  const { AV, AC, PR, UI, S, C, I, A } = metrics;
  if (AV === null || AC === null || PR === null || UI === null || S === null || C === null || I === null || A === null) {
    return null;
  }

  const avW = AV_WEIGHTS[AV];
  const acW = AC_WEIGHTS[AC];
  // PR weights depend on Scope
  const prWeights = S === 'C' ? PR_WEIGHTS_CHANGED : PR_WEIGHTS_UNCHANGED;
  const prW = prWeights[PR];
  const uiW = UI_WEIGHTS[UI];
  const cW = CIA_WEIGHTS[C];
  const iW = CIA_WEIGHTS[I];
  const aW = CIA_WEIGHTS[A];

  const iscBase = 1 - (1 - cW) * (1 - iW) * (1 - aW);

  let isc: number;
  if (S === 'U') {
    isc = 6.42 * iscBase;
  } else {
    // S === 'C'
    isc = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15);
  }

  if (isc <= 0) {
    const vector = buildVector(metrics as Required<CvssMetrics>);
    return { score: 0, severity: 'None', vector };
  }

  const exss = 8.22 * avW * acW * prW * uiW;

  let rawScore: number;
  if (S === 'U') {
    rawScore = Math.min(isc + exss, 10);
  } else {
    rawScore = Math.min(1.08 * (isc + exss), 10);
  }

  const score = ceilToOnDecimal(rawScore);
  const severity = getSeverity(score);
  const vector = buildVector(metrics as Required<CvssMetrics>);

  return { score, severity, vector };
}

function buildVector(metrics: Required<CvssMetrics>): string {
  return (
    `CVSS:3.1/AV:${metrics.AV}/AC:${metrics.AC}/PR:${metrics.PR}` +
    `/UI:${metrics.UI}/S:${metrics.S}/C:${metrics.C}/I:${metrics.I}/A:${metrics.A}`
  );
}

export function formatCvssInsert(result: CvssResult): string {
  return `${result.vector} (Score: ${result.score.toFixed(1)} - ${result.severity})`;
}
