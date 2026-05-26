import type { AiPromptTemplate } from "$lib/types";

let _id = 0;
const p = (f: Omit<AiPromptTemplate, "id">): AiPromptTemplate => ({
  id: String(++_id),
  ...f,
});

export const AI_PROMPT_TEMPLATES: AiPromptTemplate[] = [
  // ─── RECON ────────────────────────────────────────────────────────────────
  p({
    category: "recon",
    title: "Analyse scan results for quick wins",
    description:
      "Identify the most exploitable services from an Nmap / recon dump",
    prompt:
      "Review the recon findings in this note. Identify the top 3–5 services or misconfigurations most likely to yield initial access, explain why each is promising, and suggest a concrete next step for each.",
  }),
  p({
    category: "recon",
    title: "Enumerate attack surface",
    description: "Turn a list of open ports into a prioritised attack plan",
    prompt:
      "Based on the open ports and services listed in this note, enumerate the attack surface. For each service category (web, SMB, RPC, database, etc.) suggest enumeration commands or tools I should run next.",
  }),

  // ─── EXPLOITATION ──────────────────────────────────────────────────────────
  p({
    category: "exploitation",
    title: "Suggest exploits for [SERVICE]",
    description:
      "Get targeted exploit suggestions for a specific service or CVE",
    prompt:
      "I have found [SERVICE] running on [TARGET_IP]. Suggest known exploits, Metasploit modules, or manual techniques I should try. Include any required configuration steps and expected indicators of success.",
  }),
  p({
    category: "exploitation",
    title: "Debug my exploit attempt",
    description:
      "Troubleshoot a payload or exploit that is not working as expected",
    prompt:
      "My exploit attempt against [TARGET] is failing. The error or unexpected behaviour is described in this note. Analyse the output, identify the most likely cause of failure, and suggest two concrete fixes to try.",
  }),

  // ─── PRIVESC ───────────────────────────────────────────────────────────────
  p({
    category: "privesc",
    title: "Linux privilege escalation vectors",
    description:
      "Get a ranked list of Linux PrivEsc paths from enumeration output",
    prompt:
      "Review the Linux enumeration output in this note (SUID binaries, sudo rights, cron jobs, writable paths, kernel version, etc.). Rank the top privilege escalation vectors by exploitability and provide the exact commands to exploit the best option.",
  }),
  p({
    category: "privesc",
    title: "Windows privilege escalation vectors",
    description:
      "Get a ranked list of Windows PrivEsc paths from enumeration output",
    prompt:
      "Review the Windows enumeration output in this note (SePrivileges, service misconfigs, unquoted paths, scheduled tasks, AlwaysInstallElevated, etc.). Identify the top privilege escalation vectors and provide step-by-step exploitation instructions for the most viable path.",
  }),

  // ─── POST-EXPLOITATION ─────────────────────────────────────────────────────
  p({
    category: "post-exploitation",
    title: "Post-exploitation checklist for [HOSTNAME]",
    description:
      "Generate a tailored post-exploitation checklist after gaining a foothold",
    prompt:
      "I have a shell on [HOSTNAME] as [USER]. Generate a prioritised post-exploitation checklist covering: credential harvesting, lateral movement prep, persistence options, data exfiltration opportunities, and cleanup considerations.",
  }),
  p({
    category: "post-exploitation",
    title: "Lateral movement options",
    description: "Identify lateral movement paths from the current foothold",
    prompt:
      "Based on the credentials, network segments, and host information in this note, identify the most viable lateral movement options. For each path, list required tools, commands, and expected artefacts to clean up afterwards.",
  }),

  // ─── AD ATTACKS ────────────────────────────────────────────────────────────
  p({
    category: "ad-attacks",
    title: "Active Directory attack path",
    description: "Map an AD attack chain from current access to Domain Admin",
    prompt:
      "Review the Active Directory enumeration data in this note (users, groups, ACLs, Kerberoastable accounts, delegation settings, trust relationships). Map the most realistic attack path to Domain Admin and provide commands for each step.",
  }),
  p({
    category: "ad-attacks",
    title: "Kerberoasting and hash cracking plan",
    description:
      "Plan an end-to-end Kerberoast attack from SPN enumeration to DA",
    prompt:
      "I have domain user access on [DOMAIN]. Walk me through a complete Kerberoasting attack: enumerate SPNs, request service tickets, export hashes, choose the best cracking approach (wordlist, rules, mask), and explain what to do if I crack a privileged account hash.",
  }),

  // ─── REPORTING ─────────────────────────────────────────────────────────────
  p({
    category: "reporting",
    title: "Write a professional vulnerability finding",
    description:
      "Turn raw notes into a polished pentest finding with CVSS and remediation",
    prompt:
      "Using the vulnerability details in this note, write a professional penetration test finding. Include: Title, Severity (with CVSS v3.1 base score and vector), Description, Technical Details, Step-by-step reproduction, Business Impact, and Remediation recommendation.",
  }),
  p({
    category: "reporting",
    title: "Summarise engagement findings",
    description:
      "Produce an executive-friendly summary of all findings in the note",
    prompt:
      "Summarise the key security findings documented in this note for an executive audience. Group findings by severity, highlight the most critical risks to the business, and end with the top 3 remediation priorities.",
  }),

  // ─── GENERAL ───────────────────────────────────────────────────────────────
  p({
    category: "general",
    title: "Summarise this note",
    description: "Get a concise summary of the current note content",
    prompt:
      "Summarise the key points from this note in bullet form. Include any important findings, outstanding tasks, and critical information I should not forget.",
  }),
];

/** Search prompt templates by title or description (case-insensitive substring). */
export function searchAiPrompts(
  query: string,
  templates: AiPromptTemplate[] = AI_PROMPT_TEMPLATES,
): AiPromptTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q),
  );
}
