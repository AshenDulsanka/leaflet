/**
 * GET  /api/workspaces/[id]/hosts        - List hosts with ports
 * POST /api/workspaces/[id]/hosts        - Create a host
 */

import { json } from "@sveltejs/kit";
import { randomUUID } from "crypto";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ params, locals }) => {
  const { db } = locals;
  const hosts = db
    .prepare(
      `
    SELECT h.*,
      json_group_array(
        CASE WHEN p.id IS NOT NULL THEN
          json_object('id',p.id,'number',p.number,'protocol',p.protocol,'service',p.service,'version',p.version,'state',p.state,'notes',p.notes)
        END
      ) AS ports_json
    FROM hosts h
    LEFT JOIN ports p ON p.host_id = h.id
    WHERE h.workspace_id = ?
    GROUP BY h.id
    ORDER BY h.created_at ASC
  `,
    )
    .all(params.id) as Array<Record<string, unknown>>;

  const result = hosts.map((h) => {
    const raw = JSON.parse(h.ports_json as string) as (Record<
      string,
      unknown
    > | null)[];
    return { ...h, ports: raw.filter(Boolean), ports_json: undefined };
  });

  return json(result);
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const { db } = locals;
  const body = (await request.json()) as {
    ip: string;
    hostname?: string;
    os?: string;
    segment?: string;
    status?: string;
    scope?: string;
    notes?: string;
  };

  if (!body.ip?.trim()) {
    return json({ error: "ip is required" }, { status: 400 });
  }

  const VALID_SCOPES = new Set(["in-scope", "out-of-scope", "unknown"]);
  const scope = VALID_SCOPES.has(body.scope ?? "") ? body.scope : "unknown";

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO hosts (id, workspace_id, ip, hostname, os, segment, status, scope, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    params.id,
    body.ip.trim(),
    body.hostname ?? "",
    body.os ?? "",
    body.segment ?? "",
    body.status ?? "unknown",
    scope,
    body.notes ?? "",
    now,
    now,
  );

  const host = db.prepare("SELECT * FROM hosts WHERE id = ?").get(id) as Record<
    string,
    unknown
  >;
  return json({ ...host, ports: [] }, { status: 201 });
};
