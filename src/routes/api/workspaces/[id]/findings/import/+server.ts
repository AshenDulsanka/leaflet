/**
 * POST /api/workspaces/[id]/findings/import
 * Accept a multipart/form-data upload with a `file` field containing
 * a Nessus (.nessus) or Burp Suite XML export.  Deduplicates by title
 * (case-insensitive), links findings to tracked hosts by IP, and inserts
 * in a single transaction.
 */

import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "./$types";
import { parseScanner } from "$lib/server/scanner";
import type { ScannedFinding } from "$lib/types";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return json({ error: "file field is required" }, { status: 400 });
  }

  const xml = await file.text();
  const result = parseScanner(xml);

  if (result.errors.length > 0 && result.findings.length === 0) {
    return json({ error: result.errors[0].message }, { status: 422 });
  }

  const workspaceId = params.id;

  // Build set of existing finding titles (normalised) for deduplication.
  const existingRows = db
    .prepare(
      `SELECT lower(trim(title)) AS norm FROM findings WHERE workspace_id = ?`,
    )
    .all(workspaceId) as { norm: string }[];
  const existing = new Set(existingRows.map((r) => r.norm));

  // Build host IP → id cache for the workspace.
  const hostCache = new Map<string, string | null>();
  for (const f of result.findings) {
    if (!hostCache.has(f.hostIp)) {
      const row = db
        .prepare(
          `SELECT id FROM hosts WHERE workspace_id = ? AND ip = ? LIMIT 1`,
        )
        .get(workspaceId, f.hostIp) as { id: string } | undefined;
      hostCache.set(f.hostIp, row?.id ?? null);
    }
  }

  // Filter out findings with empty titles and exact-duplicate titles.
  const toImport = result.findings.filter(
    (f) => f.title.trim() && !existing.has(f.title.trim().toLowerCase()),
  );
  const skipped = result.findings.length - toImport.length;

  const insertStmt = db.prepare(`
    INSERT INTO findings
      (id, workspace_id, title, description, severity, cvss_score, cvss_vector,
       status, host_id, note_path, mitre_technique_id, mitre_technique_name,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0.0, '', 'open', ?, '', '', '', datetime('now'), datetime('now'))
  `);

  const importTx = db.transaction((batch: ScannedFinding[]) => {
    for (const f of batch) {
      const hostId = hostCache.get(f.hostIp) ?? null;
      const desc = f.hostPort
        ? `**Host:** ${f.hostIp}:${f.hostPort}\n\n${f.description}`
        : f.hostIp
          ? `**Host:** ${f.hostIp}\n\n${f.description}`
          : f.description;
      insertStmt.run(
        randomUUID(),
        workspaceId,
        f.title,
        desc,
        f.severity,
        hostId,
      );
    }
  });

  importTx(toImport);

  return json({
    imported: toImport.length,
    skipped,
    parseErrors: result.errors.length,
  });
};
