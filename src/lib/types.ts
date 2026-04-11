/**
 * Shared types for the notes app.
 * These are used both client-side and in server routes.
 */

/** A node in the file tree -- either a folder or a .md file */
export interface FileNode {
  name: string;
  path: string; // relative path from NOTES_DIR root
  type: 'file' | 'folder';
  children?: FileNode[]; // only present when type === 'folder'
  extension?: string; // only present when type === 'file'
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
  type: 'pentest' | 'general';
  icon_color: string;
  exam_start_date: string | null;
  exam_duration_days: number;
  total_flags: number;
  passing_flags: number;
  notes_folder: string;
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

export type HostStatus = 'discovered' | 'scanning' | 'foothold' | 'user' | 'root' | 'compromised';

/** A single open port on a host */
export interface Port {
  number: number;
  protocol: 'tcp' | 'udp';
  service?: string;
  version?: string;
  state: 'open' | 'filtered' | 'closed';
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
  status: 'untested' | 'valid' | 'cracked' | 'expired';
  notes?: string;
}

export type CredentialType = 'password' | 'ntlm' | 'netntlmv2' | 'kerberos' | 'ssh-key' | 'token';

/** A captured flag */
export interface Flag {
  id: string;
  workspaceId: string;
  value: string;
  hostId?: string;
  flagType: 'user' | 'root' | 'other';
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
  | 'recon'
  | 'exploitation'
  | 'privesc-linux'
  | 'privesc-windows'
  | 'pivoting'
  | 'ad-attacks'
  | 'file-transfer'
  | 'credential-attacks'
  | 'custom';

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
}

/** A single port parsed from Nmap output */
export interface NmapPort {
  number: number;
  protocol: 'tcp' | 'udp';
  service: string;
  version: string;
  state: 'open' | 'closed' | 'filtered';
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
  | 'recon'
  | 'exploitation'
  | 'privesc'
  | 'post-exploitation'
  | 'reporting'
  | 'ad-attacks'
  | 'general';

/** A built-in AI prompt template; prompts may contain [PLACEHOLDER] tokens */
export interface AiPromptTemplate {
  id: string;
  category: AiPromptCategory;
  title: string;
  description: string;
  prompt: string;
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
  | 'recon'
  | 'initial-access'
  | 'exploitation'
  | 'post-exploitation'
  | 'lateral-movement'
  | 'privilege-escalation'
  | 'exfiltration'
  | 'cleanup'
  | 'other';

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
