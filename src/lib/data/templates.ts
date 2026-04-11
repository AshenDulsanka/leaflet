import type { NoteTemplate } from '$lib/types';

let _id = 0;
const t = (f: Omit<NoteTemplate, 'id'>): NoteTemplate => ({ id: String(++_id), ...f });

export const NOTE_TEMPLATES: NoteTemplate[] = [
  t({
    title: 'Recon',
    description: 'Initial reconnaissance notes — scope, ports, web, SMB/LDAP and key findings',
    content: `# Recon — {TARGET}

## Scope

- **Target IP**: 
- **Hostname**: 
- **OS**: 
- **In-Scope Ports**: 

---

## Nmap Results

<!-- paste nmap output or summarise here -->

| Port | Protocol | Service | Version |
|------|----------|---------|---------|
|      |          |         |         |

---

## Web Enumeration

- **Technologies**: 
- **Directories found**: 
- **Subdomains / vhosts**: 
- **Interesting endpoints**: 

---

## SMB / LDAP

- **Shares**: 
- **Null session**: 
- **Users enumerated**: 

---

## DNS

- **Zone transfer**: 
- **A / CNAME records**: 

---

## Key Findings

- 

---

## Next Steps

- 
`,
  }),

  t({
    title: 'Vulnerability Finding',
    description: 'Document a single vulnerability — CVSS score, PoC steps, impact, and remediation',
    content: `# Vulnerability Finding — {TITLE}

## Summary

> One-sentence description of the vulnerability.

---

## Metadata

| Field | Value |
|-------|-------|
| **Severity** | Critical / High / Medium / Low / Informational |
| **CVSS Score** |  |
| **CVE** |  |
| **Affected Component** |  |
| **Affected Version** |  |
| **Discovery Date** |  |

---

## Description

Detailed explanation of the vulnerability, root cause, and affected code path.

---

## Proof of Concept

### Prerequisites

- 

### Steps to Reproduce

1. 
2. 
3. 

### Evidence

<!-- screenshots, hashes, or captured output -->

---

## Impact

What an attacker can achieve by exploiting this vulnerability.

---

## Remediation

Recommended fix or mitigation.

---

## References

- 
`,
  }),

  t({
    title: 'Exploit Log',
    description: 'Step-by-step record of an exploitation attempt — commands used, outcome, and next path',
    content: `# Exploit Log — {TARGET}

## Date / Time

- **Date**: 
- **Duration**: 

---

## Exploit Reference

- **CVE / Module**: 
- **Tool**: 
- **Source**: 

---

## Preconditions

- 

---

## Steps

1. 
2. 
3. 

---

## Commands Used

\`\`\`
# replace with actual commands
\`\`\`

---

## Outcome

- **Success**: Yes / No
- **Shell obtained**: 
- **Privileges**: 

---

## Evidence

<!-- file hashes, screenshots, session identifiers -->

---

## Post-Exploitation Path

- 
`,
  }),

  t({
    title: 'Post-Exploitation Checklist',
    description: 'Systematic checklist covering identity, enumeration, persistence, lateral movement, and flags',
    content: `# Post-Exploitation Checklist — {TARGET}

## Identity

- [ ] Current user: \`whoami /all\` / \`id\`
- [ ] User: 
- [ ] Privileges: 

---

## System Info

- [ ] Hostname: 
- [ ] OS / Kernel: 
- [ ] Network interfaces: \`ipconfig /all\` / \`ip a\`
- [ ] Internal IPs: 

---

## Local Enumeration

- [ ] Local users: \`net user\` / \`cat /etc/passwd\`
- [ ] Local groups: \`net localgroup administrators\` / \`groups\`
- [ ] Running processes: \`tasklist\` / \`ps aux\`
- [ ] Installed software: \`reg query HKLM\\\\Software\` / \`dpkg -l\`
- [ ] Scheduled tasks / cron: \`schtasks /query\` / \`crontab -l\`
- [ ] Interesting files found: 

---

## Credential Hunting

- [ ] SAM / SYSTEM / NTDS: 
- [ ] Config files with credentials: 
- [ ] Browser credentials: 
- [ ] SSH keys: 

---

## Persistence

- [ ] Tactic: 
- [ ] Location / Registry key: 

---

## Lateral Movement

- [ ] Credentials to use: 
- [ ] Next target host: 
- [ ] Method: 

---

## Flags

- [ ] User flag (\`user.txt\`): 
- [ ] Root / Admin flag (\`root.txt\`): 

---

## Cleanup

- [ ] Uploaded files removed
- [ ] Accounts removed
- [ ] Logs reviewed (only clear if authorised)
`,
  }),

  t({
    title: 'Active Directory',
    description: 'Domain enumeration, attack path, Kerberoast/ASREPRoast findings, ACL abuse, and domain compromise',
    content: `# Active Directory — {DOMAIN}

## Environment

| Field | Value |
|-------|-------|
| **Domain** |  |
| **Forest** |  |
| **DC IP** |  |
| **Functional Level** |  |

---

## Domain Users of Interest

| Username | Description | Groups | Enabled |
|----------|-------------|--------|---------|
|          |             |        |         |

---

## Domain Groups of Interest

| Group | Members | Notes |
|-------|---------|-------|
|       |         |       |

---

## Kerberoastable Accounts

| Username | SPN | Hash Cracked | Password |
|----------|-----|-------------|----------|
|          |     |             |          |

---

## ASREPRoastable Accounts

| Username | Hash Cracked | Password |
|----------|-------------|----------|
|          |             |          |

---

## ACL / GPO Abuse

- **Abusable ACE**: 
- **Target object**: 
- **Attack vector**: 

---

## Attack Path

\`\`\`
[Initial Foothold] → [User] → [Priv Esc] → [Domain Admin]
\`\`\`

1. 
2. 
3. 

---

## Domain Compromise

- [ ] DCSync performed
- [ ] NTDS extracted
- [ ] Domain Admin hash: 
- [ ] krbtgt hash: 

---

## Timeline

| Time | Action | Result |
|------|--------|--------|
|      |        |        |
`,
  }),
];

/** Search templates by title or description (case-insensitive substring) */
export function searchTemplates(query: string, templates = NOTE_TEMPLATES): NoteTemplate[] {
  if (!query.trim()) return templates;
  const q = query.toLowerCase();
  return templates.filter(
    (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
}
