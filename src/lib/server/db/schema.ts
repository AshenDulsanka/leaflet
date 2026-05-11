import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// workspaces
// ---------------------------------------------------------------------------
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['pentest', 'general'] })
    .notNull()
    .default('general'),
  iconColor: text('icon_color').notNull().default('#6366f1'),
  examStartDate: text('exam_start_date'),
  examDurationDays: integer('exam_duration_days').notNull().default(10),
  totalFlags: integer('total_flags').notNull().default(0),
  passingFlags: integer('passing_flags').notNull().default(0),
  notesFolder: text('notes_folder').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  preset: text('preset'),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ---------------------------------------------------------------------------
// hosts
// ---------------------------------------------------------------------------
export const hosts = sqliteTable('hosts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  ip: text('ip').notNull(),
  hostname: text('hostname').notNull().default(''),
  os: text('os').notNull().default(''),
  segment: text('segment').notNull().default(''),
  status: text('status').notNull().default('unknown'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  scope: text('scope').notNull().default('unknown'),
  screenshotFilename: text('screenshot_filename').notNull().default(''),
  topoX: real('topo_x'),
  topoY: real('topo_y'),
});

// ---------------------------------------------------------------------------
// ports
// ---------------------------------------------------------------------------
export const ports = sqliteTable('ports', {
  id: text('id').primaryKey(),
  hostId: text('host_id')
    .notNull()
    .references(() => hosts.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  protocol: text('protocol').notNull().default('tcp'),
  service: text('service').notNull().default(''),
  version: text('version').notNull().default(''),
  state: text('state').notNull().default('open'),
  notes: text('notes').notNull().default(''),
});

// ---------------------------------------------------------------------------
// credentials
// ---------------------------------------------------------------------------
export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  username: text('username').notNull().default(''),
  secret: text('secret').notNull().default(''),
  credentialType: text('credential_type').notNull().default('password'),
  domain: text('domain').notNull().default(''),
  source: text('source').notNull().default(''),
  sourceHostId: text('source_host_id'),
  status: text('status').notNull().default('unknown'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// credential_valid_hosts
// ---------------------------------------------------------------------------
export const credentialValidHosts = sqliteTable(
  'credential_valid_hosts',
  {
    credentialId: text('credential_id')
      .notNull()
      .references(() => credentials.id, { onDelete: 'cascade' }),
    hostId: text('host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.credentialId, t.hostId] })],
);

// ---------------------------------------------------------------------------
// flags
// ---------------------------------------------------------------------------
export const flags = sqliteTable('flags', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  value: text('value').notNull().default(''),
  hostId: text('host_id'),
  flagType: text('flag_type').notNull().default('user'),
  captureMethod: text('capture_method').notNull().default(''),
  capturedAt: text('captured_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  screenshotPath: text('screenshot_path').notNull().default(''),
  submitted: integer('submitted', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes').notNull().default(''),
});

// ---------------------------------------------------------------------------
// attack_chain_nodes
// ---------------------------------------------------------------------------
export const attackChainNodes = sqliteTable('attack_chain_nodes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  nodeType: text('node_type').notNull().default('action'),
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  hostId: text('host_id'),
  metadata: text('metadata').notNull().default('{}'),
  timestamp: text('timestamp'),
  mitreTechniqueId: text('mitre_technique_id').notNull().default(''),
  mitreTechniqueName: text('mitre_technique_name').notNull().default(''),
});

// ---------------------------------------------------------------------------
// attack_chain_edges
// ---------------------------------------------------------------------------
export const attackChainEdges = sqliteTable('attack_chain_edges', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  sourceNodeId: text('source_node_id')
    .notNull()
    .references(() => attackChainNodes.id, { onDelete: 'cascade' }),
  targetNodeId: text('target_node_id')
    .notNull()
    .references(() => attackChainNodes.id, { onDelete: 'cascade' }),
  label: text('label').notNull().default(''),
  technique: text('technique').notNull().default(''),
});

// ---------------------------------------------------------------------------
// command_snippets
// workspace_id is nullable — snippets without a workspace are global
// ---------------------------------------------------------------------------
export const commandSnippets = sqliteTable('command_snippets', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade',
  }),
  category: text('category').notNull().default('general'),
  title: text('title').notNull(),
  command: text('command').notNull(),
  description: text('description').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
});

// ---------------------------------------------------------------------------
// snippet_variables
// ---------------------------------------------------------------------------
export const snippetVariables = sqliteTable('snippet_variables', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  value: text('value').notNull().default(''),
});

// ---------------------------------------------------------------------------
// screenshot_metadata
// ---------------------------------------------------------------------------
export const screenshotMetadata = sqliteTable('screenshot_metadata', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  caption: text('caption').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  linkedNotePath: text('linked_note_path').notNull().default(''),
});

// ---------------------------------------------------------------------------
// operation_log
// ---------------------------------------------------------------------------
export const operationLog = sqliteTable('operation_log', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  category: text('category').notNull().default('action'),
  description: text('description').notNull().default(''),
  hostId: text('host_id'),
  timestamp: text('timestamp').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// findings
// ---------------------------------------------------------------------------
export const findings = sqliteTable('findings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  description: text('description').notNull().default(''),
  severity: text('severity').notNull().default('info'),
  cvssScore: real('cvss_score').notNull().default(0.0),
  cvssVector: text('cvss_vector').notNull().default(''),
  status: text('status').notNull().default('open'),
  hostId: text('host_id'),
  notePath: text('note_path').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  mitreTechniqueId: text('mitre_technique_id').notNull().default(''),
  mitreTechniqueName: text('mitre_technique_name').notNull().default(''),
});

// ---------------------------------------------------------------------------
// topology_edges
// ---------------------------------------------------------------------------
export const topologyEdges = sqliteTable(
  'topology_edges',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceHostId: text('source_host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    targetHostId: text('target_host_id')
      .notNull()
      .references(() => hosts.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default(''),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex('topology_edges_unique').on(
      t.workspaceId,
      t.sourceHostId,
      t.targetHostId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// user_templates
// workspace_id is nullable — NULL means global (visible in all workspaces)
// ---------------------------------------------------------------------------
export const userTemplates = sqliteTable('user_templates', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id, {
    onDelete: 'cascade',
  }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  content: text('content').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// note_sort_order
// ---------------------------------------------------------------------------
export const noteSortOrder = sqliteTable('note_sort_order', {
  notePath: text('note_path').primaryKey(),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Host = typeof hosts.$inferSelect;
export type NewHost = typeof hosts.$inferInsert;
export type Port = typeof ports.$inferSelect;
export type NewPort = typeof ports.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type CredentialValidHost = typeof credentialValidHosts.$inferSelect;
export type NewCredentialValidHost = typeof credentialValidHosts.$inferInsert;
export type Flag = typeof flags.$inferSelect;
export type NewFlag = typeof flags.$inferInsert;
export type AttackChainNode = typeof attackChainNodes.$inferSelect;
export type NewAttackChainNode = typeof attackChainNodes.$inferInsert;
export type AttackChainEdge = typeof attackChainEdges.$inferSelect;
export type NewAttackChainEdge = typeof attackChainEdges.$inferInsert;
export type CommandSnippet = typeof commandSnippets.$inferSelect;
export type NewCommandSnippet = typeof commandSnippets.$inferInsert;
export type SnippetVariable = typeof snippetVariables.$inferSelect;
export type NewSnippetVariable = typeof snippetVariables.$inferInsert;
export type ScreenshotMetadata = typeof screenshotMetadata.$inferSelect;
export type NewScreenshotMetadata = typeof screenshotMetadata.$inferInsert;
export type OperationLog = typeof operationLog.$inferSelect;
export type NewOperationLog = typeof operationLog.$inferInsert;
export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;
export type TopologyEdge = typeof topologyEdges.$inferSelect;
export type NewTopologyEdge = typeof topologyEdges.$inferInsert;
export type UserTemplate = typeof userTemplates.$inferSelect;
export type NewUserTemplate = typeof userTemplates.$inferInsert;
export type NoteSortOrder = typeof noteSortOrder.$inferSelect;
export type NewNoteSortOrder = typeof noteSortOrder.$inferInsert;
