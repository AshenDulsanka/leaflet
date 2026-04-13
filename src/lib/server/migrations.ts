import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { safePath } from "./notes.js";

const MIGRATIONS: Array<{ version: number; up: string; disableFks?: boolean }> =
  [
    {
      version: 1,
      up: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id                  TEXT    PRIMARY KEY,
        name                TEXT    NOT NULL,
        type                TEXT    NOT NULL DEFAULT 'exam'
                                    CHECK(type IN ('exam','practice','ctf','other')),
        icon_color          TEXT    NOT NULL DEFAULT '#6366f1',
        exam_start_date     TEXT,
        exam_duration_days  INTEGER NOT NULL DEFAULT 10,
        total_flags         INTEGER NOT NULL DEFAULT 0,
        passing_flags       INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS hosts (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        ip           TEXT NOT NULL,
        hostname     TEXT NOT NULL DEFAULT '',
        os           TEXT NOT NULL DEFAULT '',
        segment      TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'unknown'
                          CHECK(status IN ('unknown','up','down','rooted')),
        notes        TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ports (
        id       TEXT PRIMARY KEY,
        host_id  TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
        number   INTEGER NOT NULL,
        protocol TEXT NOT NULL DEFAULT 'tcp' CHECK(protocol IN ('tcp','udp')),
        service  TEXT NOT NULL DEFAULT '',
        version  TEXT NOT NULL DEFAULT '',
        state    TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed','filtered')),
        notes    TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id             TEXT PRIMARY KEY,
        workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        username       TEXT NOT NULL DEFAULT '',
        secret         TEXT NOT NULL DEFAULT '',
        credential_type TEXT NOT NULL DEFAULT 'password'
                            CHECK(credential_type IN ('password','hash','key','ticket','token','other')),
        domain         TEXT NOT NULL DEFAULT '',
        source         TEXT NOT NULL DEFAULT '',
        source_host_id TEXT REFERENCES hosts(id) ON DELETE SET NULL,
        status         TEXT NOT NULL DEFAULT 'unknown'
                            CHECK(status IN ('unknown','valid','invalid','expired')),
        notes          TEXT NOT NULL DEFAULT '',
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS credential_valid_hosts (
        credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
        host_id       TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
        PRIMARY KEY (credential_id, host_id)
      );

      CREATE TABLE IF NOT EXISTS flags (
        id             TEXT PRIMARY KEY,
        workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        value          TEXT NOT NULL DEFAULT '',
        host_id        TEXT REFERENCES hosts(id) ON DELETE SET NULL,
        flag_type      TEXT NOT NULL DEFAULT 'user' CHECK(flag_type IN ('user','root','other')),
        capture_method TEXT NOT NULL DEFAULT '',
        captured_at    TEXT NOT NULL DEFAULT (datetime('now')),
        screenshot_path TEXT NOT NULL DEFAULT '',
        submitted      INTEGER NOT NULL DEFAULT 0,
        notes          TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS attack_chain_nodes (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        label        TEXT NOT NULL,
        node_type    TEXT NOT NULL DEFAULT 'action'
                          CHECK(node_type IN ('initial-access','recon','action','privesc','lateral-movement','data-exfil','flag')),
        x            REAL NOT NULL DEFAULT 0,
        y            REAL NOT NULL DEFAULT 0,
        host_id      TEXT REFERENCES hosts(id) ON DELETE SET NULL,
        metadata     TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS attack_chain_edges (
        id             TEXT PRIMARY KEY,
        workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_node_id TEXT NOT NULL REFERENCES attack_chain_nodes(id) ON DELETE CASCADE,
        target_node_id TEXT NOT NULL REFERENCES attack_chain_nodes(id) ON DELETE CASCADE,
        label          TEXT NOT NULL DEFAULT '',
        technique      TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS command_snippets (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        category     TEXT NOT NULL DEFAULT 'general',
        title        TEXT NOT NULL,
        command      TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        tags         TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS snippet_variables (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        value        TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS screenshot_metadata (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        filename     TEXT NOT NULL,
        caption      TEXT NOT NULL DEFAULT '',
        tags         TEXT NOT NULL DEFAULT '[]',
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_hosts_workspace        ON hosts(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_ports_host             ON ports(host_id);
      CREATE INDEX IF NOT EXISTS idx_credentials_workspace  ON credentials(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_flags_workspace        ON flags(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_workspace        ON attack_chain_nodes(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_edges_workspace        ON attack_chain_edges(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_snippets_workspace     ON command_snippets(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_snippet_vars_workspace ON snippet_variables(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_screenshots_workspace  ON screenshot_metadata(workspace_id);
    `,
    },
    {
      // v2: fix attack_chain_nodes CHECK constraint (old schema had wrong types)
      // and add notes_folder to workspaces for workspace-scoped note trees.
      // SQLite cannot ALTER CHECK constraints, so we recreate the tables.
      version: 2,
      disableFks: true,
      up: `
      -- Recreate attack_chain_nodes with correct node_type values
      CREATE TABLE IF NOT EXISTS attack_chain_nodes_v2 (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        label        TEXT NOT NULL,
        node_type    TEXT NOT NULL DEFAULT 'action'
                          CHECK(node_type IN ('initial-access','recon','action','privesc','lateral-movement','data-exfil','flag')),
        x            REAL NOT NULL DEFAULT 0,
        y            REAL NOT NULL DEFAULT 0,
        host_id      TEXT REFERENCES hosts(id) ON DELETE SET NULL,
        metadata     TEXT NOT NULL DEFAULT '{}'
      );

      INSERT INTO attack_chain_nodes_v2 (id, workspace_id, label, node_type, x, y, host_id, metadata)
      SELECT id, workspace_id, label,
        CASE node_type
          WHEN 'initial-access'   THEN 'initial-access'
          WHEN 'recon'            THEN 'recon'
          WHEN 'action'           THEN 'action'
          WHEN 'privesc'          THEN 'privesc'
          WHEN 'lateral-movement' THEN 'lateral-movement'
          WHEN 'data-exfil'       THEN 'data-exfil'
          WHEN 'flag'             THEN 'flag'
          ELSE 'action'
        END,
        x, y, host_id, metadata
      FROM attack_chain_nodes;

      DROP TABLE IF EXISTS attack_chain_edges;
      DROP TABLE IF EXISTS attack_chain_nodes;
      ALTER TABLE attack_chain_nodes_v2 RENAME TO attack_chain_nodes;

      CREATE TABLE IF NOT EXISTS attack_chain_edges (
        id             TEXT PRIMARY KEY,
        workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_node_id TEXT NOT NULL REFERENCES attack_chain_nodes(id) ON DELETE CASCADE,
        target_node_id TEXT NOT NULL REFERENCES attack_chain_nodes(id) ON DELETE CASCADE,
        label          TEXT NOT NULL DEFAULT '',
        technique      TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_workspace ON attack_chain_nodes(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_edges_workspace ON attack_chain_edges(workspace_id);

      -- Add notes_folder column (safe to run even if column already exists via IF NOT EXISTS workaround)
      ALTER TABLE workspaces ADD COLUMN notes_folder TEXT NOT NULL DEFAULT '';
    `,
    },
    {
      // v3: reduce workspace types to 'pentest' | 'general'.
      // SQLite cannot ALTER CHECK constraints, so recreate the workspaces table
      // and migrate existing rows: exam/practice/ctf → pentest, other → general.
      version: 3,
      disableFks: true,
      up: `
      CREATE TABLE workspaces_v3 (
        id                  TEXT    PRIMARY KEY,
        name                TEXT    NOT NULL,
        type                TEXT    NOT NULL DEFAULT 'general'
                                    CHECK(type IN ('pentest','general')),
        icon_color          TEXT    NOT NULL DEFAULT '#6366f1',
        exam_start_date     TEXT,
        exam_duration_days  INTEGER NOT NULL DEFAULT 10,
        total_flags         INTEGER NOT NULL DEFAULT 0,
        passing_flags       INTEGER NOT NULL DEFAULT 0,
        notes_folder        TEXT    NOT NULL DEFAULT '',
        created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO workspaces_v3
        (id, name, type, icon_color, exam_start_date, exam_duration_days,
         total_flags, passing_flags, notes_folder, created_at, updated_at)
      SELECT
        id, name,
        CASE type
          WHEN 'exam'     THEN 'pentest'
          WHEN 'practice' THEN 'pentest'
          WHEN 'ctf'      THEN 'pentest'
          ELSE 'general'
        END,
        icon_color, exam_start_date, exam_duration_days,
        total_flags, passing_flags, notes_folder, created_at, updated_at
      FROM workspaces;

      DROP TABLE workspaces;
      ALTER TABLE workspaces_v3 RENAME TO workspaces;
    `,
    },
    {
      // v4: add scope classification and screenshot_filename to hosts.
      // scope: 'in-scope' | 'out-of-scope' | 'unknown' - validated in the API layer
      // (SQLite CHECK constraints in ALTER TABLE ADD COLUMN are unreliable across versions)
      // screenshot_filename: references a screenshot file stored in the screenshots panel
      version: 4,
      up: `
      ALTER TABLE hosts ADD COLUMN scope TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE hosts ADD COLUMN screenshot_filename TEXT NOT NULL DEFAULT '';
    `,
    },
    {
      // v5: add linked_note_path to screenshot_metadata and a unique index on
      // (workspace_id, filename) so upserts are safe.
      version: 5,
      up: `
      ALTER TABLE screenshot_metadata ADD COLUMN linked_note_path TEXT NOT NULL DEFAULT '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_screenshot_metadata_workspace_filename ON screenshot_metadata(workspace_id, filename);
    `,
    },
    {
      // v6: add timestamp and MITRE ATT&CK tagging columns to attack_chain_nodes.
      version: 6,
      up: `
      ALTER TABLE attack_chain_nodes ADD COLUMN timestamp TEXT;
      ALTER TABLE attack_chain_nodes ADD COLUMN mitre_technique_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE attack_chain_nodes ADD COLUMN mitre_technique_name TEXT NOT NULL DEFAULT '';
    `,
    },
    {
      // v7: add operation_log table for workspace-scoped pentest timeline entries.
      // category check is enforced here; API layer also validates for defense in depth.
      version: 7,
      up: `
      CREATE TABLE IF NOT EXISTS operation_log (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        category     TEXT NOT NULL DEFAULT 'action'
                          CHECK(category IN (
                            'recon','initial-access','exploitation',
                            'post-exploitation','lateral-movement',
                            'privilege-escalation','exfiltration','cleanup','other'
                          )),
        description  TEXT NOT NULL DEFAULT '',
        host_id      TEXT REFERENCES hosts(id) ON DELETE SET NULL,
        timestamp    TEXT NOT NULL,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_oplog_workspace  ON operation_log(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_oplog_timestamp  ON operation_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_oplog_host       ON operation_log(host_id);
    `,
    },
    {
      // v8: add findings table for vulnerability/finding tracking in pentest workspaces.
      // severity and status CHECK constraints are also enforced in the API layer.
      version: 8,
      up: `
      CREATE TABLE IF NOT EXISTS findings (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title        TEXT NOT NULL DEFAULT '',
        description  TEXT NOT NULL DEFAULT '',
        severity     TEXT NOT NULL DEFAULT 'info'
                          CHECK(severity IN ('critical','high','medium','low','info','none')),
        cvss_score   REAL NOT NULL DEFAULT 0.0,
        cvss_vector  TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'open'
                          CHECK(status IN ('open','confirmed','remediated','false-positive')),
        host_id      TEXT REFERENCES hosts(id) ON DELETE SET NULL,
        note_path    TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_findings_workspace ON findings(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_findings_status    ON findings(status);
      CREATE INDEX IF NOT EXISTS idx_findings_host      ON findings(host_id);
    `,
    },
    {
      // v9: add MITRE ATT&CK technique tagging columns to findings.
      // Empty string default means "no tag" — consistent with other optional text fields.
      version: 9,
      up: `
      ALTER TABLE findings ADD COLUMN mitre_technique_id   TEXT NOT NULL DEFAULT '';
      ALTER TABLE findings ADD COLUMN mitre_technique_name TEXT NOT NULL DEFAULT '';
    `,
    },
    {
      // v10: add network topology support.
      // topo_x/topo_y store canvas positions for hosts in the topology diagram.
      // topology_edges models directed reachability connections between hosts.
      version: 10,
      up: `
      ALTER TABLE hosts ADD COLUMN topo_x REAL;
      ALTER TABLE hosts ADD COLUMN topo_y REAL;

      CREATE TABLE IF NOT EXISTS topology_edges (
        id               TEXT PRIMARY KEY,
        workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_host_id   TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
        target_host_id   TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
        label            TEXT NOT NULL DEFAULT '',
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(workspace_id, source_host_id, target_host_id)
      );

      CREATE INDEX IF NOT EXISTS idx_topo_edges_workspace ON topology_edges(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_topo_edges_source    ON topology_edges(source_host_id);
      CREATE INDEX IF NOT EXISTS idx_topo_edges_target    ON topology_edges(target_host_id);
    `,
    },
    {
      // v11: add user_templates table for workspace-scoped and global note templates.
      // workspace_id IS NULL means the template is global (visible in all workspaces).
      // workspace_id non-null means the template is scoped to that workspace.
      version: 11,
      up: `
      CREATE TABLE IF NOT EXISTS user_templates (
        id           TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        title        TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        content      TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_user_templates_workspace ON user_templates(workspace_id);
    `,
    },
  ];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all() as { version: number }[];
  const appliedSet = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) continue;
    if (migration.disableFks) db.pragma("foreign_keys = OFF");
    const run = db.transaction(() => {
      db.exec(migration.up);
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(
        migration.version,
      );
    });
    run();
    if (migration.disableFks) db.pragma("foreign_keys = ON");
    console.log(`[notes-db] Applied migration v${migration.version}`);
  }

  // Ensure workspace notes folders exist on disk
  const notesDir = process.env.NOTES_DIR;
  if (notesDir) {
    const folders = db
      .prepare(`SELECT notes_folder FROM workspaces WHERE notes_folder != ''`)
      .all() as { notes_folder: string }[];
    for (const { notes_folder } of folders) {
      try {
        const dir = safePath(notes_folder);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      } catch {
        console.warn(
          "[migrations] skipping unsafe notes_folder:",
          notes_folder,
        );
      }
    }
  }
}

/**
 * Create a default workspace if none exist, so the UI is never empty on first launch.
 */
export function seedDefaultWorkspace(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM workspaces").get() as {
    n: number;
  };
  if (count.n > 0) return;

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO workspaces (id, name, type, icon_color, notes_folder, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    "Default Workspace",
    "pentest",
    "#6366f1",
    "default-workspace",
    now,
    now,
  );

  // Create notes subfolder if NOTES_DIR is set
  const notesDir = process.env.NOTES_DIR;
  if (notesDir) {
    const dir = join(notesDir, "default-workspace");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  console.log("[notes-db] Created default workspace");
}
