/**
 * Shared types for the notes app.
 * These are used both client-side and in server routes.
 */

/** A node in the file tree -- either a folder or a .md file */
export interface FileNode {
  name: string;
  path: string; // relative path from NOTES_DIR root
  type: "file" | "folder";
  children?: FileNode[]; // only present when type === 'folder'
  extension?: string; // only present when type === 'file'
  sort_order?: number; // custom sort position; absent means unset (treated as Infinity)
}

/** A screenshot with workspace-scoped metadata */
export interface ScreenshotMeta {
  filename: string;
  url: string;
  sizeBytes: number;
  caption: string;
  linked_note_path: string;
}

/** Result from the search API */
export interface SearchResult {
  path: string;
  fileName: string;
  line: number;
  lineText: string;
  context: string; // surrounding lines for preview
}

/** A note loaded from disk */
export interface Note {
  path: string;
  name: string;
  content: string;
  lastModified: number;
}

/** A workspace groups notes and engagement data (matches DB schema) */
export interface Workspace {
  id: string;
  name: string;
  type: "pentest" | "general";
  icon_color: string;
  exam_start_date: string | null;
  exam_duration_days: number;
  total_flags: number;
  passing_flags: number;
  notes_folder: string;
  /** Built-in workspace preset identifier, e.g. 'cpts'. NULL means no preset. */
  preset: string | null;
  /** Display order — lower values appear first in workspace lists. */
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined aggregates (from list/get queries)
  host_count?: number;
  flag_count?: number;
}

/** A discovered network host in an engagement workspace */
export interface Host {
  id: string;
  workspaceId: string;
  ip: string;
  hostname?: string;
  os?: string;
  segment?: string; // network segment / subnet
  ports: Port[];
  status: HostStatus;
  accessMethod?: string;
  pivotTo?: string[]; // host IDs reachable from this host
  credentialIds: string[];
  flagIds: string[];
  notes?: string;
}

export type HostStatus =
  | "discovered"
  | "scanning"
  | "foothold"
  | "user"
  | "root"
  | "compromised";

/** A single open port on a host */
export interface Port {
  number: number;
  protocol: "tcp" | "udp";
  service?: string;
  version?: string;
  state: "open" | "filtered" | "closed";
}

/** A credential found during an engagement */
export interface Credential {
  id: string;
  workspaceId: string;
  username: string;
  secret: string; // password, hash, key contents
  credentialType: CredentialType;
  sourceHostId?: string;
  sourceMethod?: string;
  validOnHostIds: string[];
  status: "untested" | "valid" | "cracked" | "expired";
  notes?: string;
}

export type CredentialType =
  | "password"
  | "ntlm"
  | "netntlmv2"
  | "kerberos"
  | "ssh-key"
  | "token";

/** A captured flag */
export interface Flag {
  id: string;
  workspaceId: string;
  value: string;
  hostId?: string;
  flagType: "user" | "root" | "other";
  captureMethod?: string;
  capturedAt: string;
  screenshotPath?: string;
  submitted: boolean;
}

/** A command snippet with variable placeholders */
export interface CommandSnippet {
  id: string;
  workspaceId?: string; // null means it's a global snippet
  category: SnippetCategory;
  title: string;
  command: string; // may contain {VARIABLE_NAME} placeholders
  description?: string;
  tags: string[];
}

export type SnippetCategory =
  | "recon"
  | "exploitation"
  | "privesc-linux"
  | "privesc-windows"
  | "pivoting"
  | "ad-attacks"
  | "file-transfer"
  | "credential-attacks"
  | "custom";

/** Variable substitution context for command snippets */
export interface SnippetContext {
  [variableName: string]: string;
}

/** A reusable note template with pre-filled markdown content */
export interface NoteTemplate {
  id: string;
  title: string;
  description: string;
  content: string;
  workspaceId?: string | null;
}

/** A user-created note template stored in the database */
export interface UserTemplate {
  id: string;
  workspace_id: string | null;
  title: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type FindingSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info"
  | "none";

export type FindingStatus =
  | "open"
  | "confirmed"
  | "remediated"
  | "false-positive";

/** A vulnerability/finding discovered during a pentest engagement */
export interface Finding {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  cvss_score: number;
  cvss_vector: string;
  status: FindingStatus;
  host_id: string | null;
  note_path: string;
  mitre_technique_id: string;
  mitre_technique_name: string;
  created_at: string;
  updated_at: string;
  // Joined from hosts table
  host_ip?: string | null;
  host_hostname?: string | null;
}

/** A single port parsed from Nmap output */
export interface NmapPort {
  number: number;
  protocol: "tcp" | "udp";
  service: string;
  version: string;
  state: "open" | "closed" | "filtered";
}

/** A host parsed from Nmap output */
export interface NmapHost {
  ip: string;
  hostname: string;
  os: string;
  ports: NmapPort[];
}

/** Result returned by the Nmap parser */
export interface NmapParseResult {
  hosts: NmapHost[];
  errors: Array<{ line: number; message: string }>;
}

/** Category for an AI prompt template */
export type AiPromptCategory =
  | "recon"
  | "exploitation"
  | "privesc"
  | "post-exploitation"
  | "reporting"
  | "ad-attacks"
  | "general";

/** A built-in AI prompt template; prompts may contain [PLACEHOLDER] tokens */
export interface AiPromptTemplate {
  id: string;
  category: AiPromptCategory;
  title: string;
  description: string;
  prompt: string;
}

export type FindingTemplateCategory =
  | "injection"
  | "auth"
  | "crypto"
  | "exposure"
  | "misc";

/** A built-in vulnerability finding template for pre-filling the findings form */
export interface FindingTemplate {
  id: string;
  category: FindingTemplateCategory;
  title: string;
  description: string;
  severity: FindingSeverity;
  mitre_technique_id: string;
  mitre_technique_name: string;
}

/** A node in the attack chain canvas (matches attack_chain_nodes DB schema) */
export interface AttackNode {
  id: string;
  workspace_id: string;
  label: string;
  node_type: string;
  x: number;
  y: number;
  host_id: string | null;
  metadata: string;
  timestamp: string | null;
  mitre_technique_id: string;
  mitre_technique_name: string;
}

/** Category for an operation log timeline entry */
export type OpLogCategory =
  | "recon"
  | "initial-access"
  | "exploitation"
  | "post-exploitation"
  | "lateral-movement"
  | "privilege-escalation"
  | "exfiltration"
  | "cleanup"
  | "other";

/** An operation log entry in a pentest engagement workspace */
export interface OperationLogEntry {
  id: string;
  workspace_id: string;
  category: OpLogCategory;
  description: string;
  host_id: string | null;
  timestamp: string;
  created_at: string;
  updated_at: string;
  // Joined fields from hosts table
  host_ip?: string | null;
  host_hostname?: string | null;
}

/** A directed connection between two hosts in the network topology diagram */
export interface TopologyEdge {
  id: string;
  workspace_id: string;
  source_host_id: string;
  target_host_id: string;
  label: string;
  created_at: string;
}

/** A host row enriched with port count and canvas position for topology rendering */
export interface TopologyHost {
  id: string;
  workspace_id: string;
  ip: string;
  hostname: string;
  os: string;
  status: string;
  port_count: number;
  topo_x: number | null;
  topo_y: number | null;
}

/** A vulnerability finding parsed from a scanner export (Nessus / Burp Suite) */
export interface ScannedFinding {
  title: string;
  description: string;
  severity: FindingSeverity;
  hostIp: string;
  hostPort: number | null;
  pluginId: string;
  source: "nessus" | "burp";
}

/** Result returned by parseScanner() / parseNessus() / parseBurp() */
export interface ScannerParseResult {
  findings: ScannedFinding[];
  errors: Array<{ message: string }>;
}
