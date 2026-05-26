/**
 * GET  /api/workspaces/[id]/findings  - List findings for a workspace (newest first)
 * POST /api/workspaces/[id]/findings  - Create a new finding
 */

import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "@sveltejs/kit";
import type { FindingSeverity, FindingStatus } from "$lib/types";

const VALID_SEVERITIES = new Set<FindingSeverity>([
  "critical",
  "high",
  "medium",
  "low",
  "info",
  "none",
]);

const VALID_STATUSES = new Set<FindingStatus>([
  "open",
  "confirmed",
  "remediated",
  "false-positive",
]);

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const findings = db
    .prepare(
      `
      SELECT f.*, h.ip AS host_ip, h.hostname AS host_hostname
      FROM findings f
      LEFT JOIN hosts h ON h.id = f.host_id
      WHERE f.workspace_id = ?
      ORDER BY f.created_at DESC
    `,
    )
    .all(params.id);
  return json(findings);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    severity?: string;
    status?: string;
    cvss_score?: number;
    cvss_vector?: string;
    host_id?: string | null;
    note_path?: string;
    mitre_technique_id?: string;
    mitre_technique_name?: string;
  };

  const title = (body.title ?? "").trim();
  if (!title) {
    return json({ error: "title is required" }, { status: 400 });
  }

  const severity = (body.severity ?? "info") as FindingSeverity;
  if (!VALID_SEVERITIES.has(severity)) {
    return json({ error: `Invalid severity: ${severity}` }, { status: 400 });
  }

  const status = (body.status ?? "open") as FindingStatus;
  if (!VALID_STATUSES.has(status)) {
    return json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const cvssScore = body.cvss_score ?? 0;
  if (typeof cvssScore !== "number" || cvssScore < 0 || cvssScore > 10) {
    return json(
      { error: "cvss_score must be a number between 0 and 10" },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO findings
      (id, workspace_id, title, description, severity, cvss_score, cvss_vector, status, host_id, note_path, mitre_technique_id, mitre_technique_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    params.id,
    title,
    (body.description ?? "").trim(),
    severity,
    cvssScore,
    (body.cvss_vector ?? "").trim(),
    status,
    body.host_id ?? null,
    (body.note_path ?? "").trim(),
    (body.mitre_technique_id ?? "").trim(),
    (body.mitre_technique_name ?? "").trim(),
    now,
    now,
  );

  const finding = db
    .prepare(
      `
    SELECT f.*, h.ip AS host_ip, h.hostname AS host_hostname
    FROM findings f
    LEFT JOIN hosts h ON h.id = f.host_id
    WHERE f.id = ?
  `,
    )
    .get(id);

  return json(finding, { status: 201 });
};
