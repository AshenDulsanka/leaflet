/**
 * POST /api/workspaces/[id]/hosts/bulk
 *
 * Accepts raw Nmap grepable (-oG) or XML (-oX) output and upserts
 * all discovered hosts and ports into the database in a single transaction.
 */

import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "@sveltejs/kit";

import { parseNmap } from "$lib/server/nmap";

const MAX_BODY_LENGTH = 2_000_000; // 2 MB

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;

  // Parse and validate request body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).raw !== "string" ||
    !(body as Record<string, unknown>).raw
  ) {
    return json(
      { error: '"raw" field is required and must be a non-empty string' },
      { status: 400 },
    );
  }

  const raw = (body as Record<string, unknown>).raw as string;

  if (raw.length > MAX_BODY_LENGTH) {
    return json({ error: "Payload too large (max 2 MB)" }, { status: 413 });
  }

  // Validate workspace exists.
  const workspace = db
    .prepare("SELECT id FROM workspaces WHERE id = ?")
    .get(params.id) as { id: string } | undefined;

  if (!workspace) {
    return json({ error: "Workspace not found" }, { status: 404 });
  }

  // Parse the Nmap output.
  const parseResult = parseNmap(raw);

  // Prepare statements once outside the loop (better-sqlite3 best practice).
  const selectHost = db.prepare<[string, string]>(
    "SELECT id FROM hosts WHERE ip = ? AND workspace_id = ?",
  );
  const insertHost = db.prepare<
    [string, string, string, string, string, string, string]
  >(`
    INSERT INTO hosts (id, workspace_id, ip, hostname, os, segment, status, scope, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '', 'up', 'unknown', '', ?, ?)
  `);
  const updateHost = db.prepare<[string, string, string, string]>(`
    UPDATE hosts SET hostname = ?, os = ?, updated_at = ? WHERE id = ?
  `);

  const selectPort = db.prepare<[string, number, string]>(
    "SELECT id FROM ports WHERE host_id = ? AND number = ? AND protocol = ?",
  );
  const insertPort = db.prepare<
    [string, string, number, string, string, string, string]
  >(`
    INSERT INTO ports (id, host_id, number, protocol, service, version, state)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updatePort = db.prepare<[string, string, string, string]>(`
    UPDATE ports SET service = ?, version = ?, state = ? WHERE id = ?
  `);

  let imported = 0;
  let updated = 0;
  let portCount = 0;

  db.transaction(() => {
    const now = new Date().toISOString();

    for (const nmapHost of parseResult.hosts) {
      const existingHost = selectHost.get(nmapHost.ip, params.id!) as
        | { id: string }
        | undefined;

      let hostId: string;
      if (existingHost) {
        hostId = existingHost.id;
        updateHost.run(nmapHost.hostname, nmapHost.os, now, hostId);
        updated++;
      } else {
        hostId = randomUUID();
        insertHost.run(
          hostId,
          params.id!,
          nmapHost.ip,
          nmapHost.hostname,
          nmapHost.os,
          now,
          now,
        );
        imported++;
      }

      for (const port of nmapHost.ports) {
        const existingPort = selectPort.get(
          hostId,
          port.number,
          port.protocol,
        ) as { id: string } | undefined;

        if (existingPort) {
          updatePort.run(
            port.service,
            port.version,
            port.state,
            existingPort.id,
          );
        } else {
          const portId = randomUUID();
          insertPort.run(
            portId,
            hostId,
            port.number,
            port.protocol,
            port.service,
            port.version,
            port.state,
          );
        }
        portCount++;
      }
    }
  })();

  return json({
    imported,
    updated,
    portCount,
    errors: parseResult.errors,
  });
};
