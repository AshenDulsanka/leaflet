import type { FindingTemplate } from "$lib/types";

let _id = 0;
const t = (f: Omit<FindingTemplate, "id">): FindingTemplate => ({
  id: String(++_id),
  ...f,
});

export const FINDING_TEMPLATES: FindingTemplate[] = [
  // ─── INJECTION (5) ────────────────────────────────────────────────────────
  t({
    category: "injection",
    title: "SQL Injection",
    severity: "critical",
    description:
      "User-supplied input is concatenated directly into SQL queries, allowing an attacker to manipulate query logic, extract data, bypass authentication, or modify database records.",
    mitre_technique_id: "T1190",
    mitre_technique_name: "Exploit Public-Facing Application",
  }),
  t({
    category: "injection",
    title: "Blind SQL Injection",
    severity: "high",
    description:
      "The application does not return query results directly but responds differently to true/false conditions, enabling boolean-based or time-based inference of sensitive database content.",
    mitre_technique_id: "T1190",
    mitre_technique_name: "Exploit Public-Facing Application",
  }),
  t({
    category: "injection",
    title: "Reflected XSS",
    severity: "medium",
    description:
      "User-supplied input is reflected in the HTTP response without sanitisation, allowing an attacker to inject arbitrary JavaScript into the victim's browser via a crafted link.",
    mitre_technique_id: "T1189",
    mitre_technique_name: "Drive-by Compromise",
  }),
  t({
    category: "injection",
    title: "Stored XSS",
    severity: "high",
    description:
      "Malicious JavaScript is persisted to application storage and executed in any browser that renders the affected page, without requiring victim interaction with an attacker-controlled link.",
    mitre_technique_id: "T1189",
    mitre_technique_name: "Drive-by Compromise",
  }),
  t({
    category: "injection",
    title: "Command Injection",
    severity: "critical",
    description:
      "User-controlled input is passed unsanitised to a system shell command, enabling an attacker to execute arbitrary operating system commands on the underlying server.",
    mitre_technique_id: "T1059",
    mitre_technique_name: "Command and Scripting Interpreter",
  }),

  // ─── AUTH (2) ──────────────────────────────────────────────────────────────
  t({
    category: "auth",
    title: "Broken Authentication",
    severity: "high",
    description:
      "Authentication mechanisms can be bypassed or abused due to weak credentials, improper session management, absent brute-force protection, or insecure password-reset flows.",
    mitre_technique_id: "T1078",
    mitre_technique_name: "Valid Accounts",
  }),
  t({
    category: "auth",
    title: "Default Credentials",
    severity: "critical",
    description:
      "A service or application is accessible using unchanged factory-default credentials, granting full access without needing to discover or crack a password.",
    mitre_technique_id: "T1078",
    mitre_technique_name: "Valid Accounts",
  }),

  // ─── CRYPTO (1) ────────────────────────────────────────────────────────────
  t({
    category: "crypto",
    title: "Weak TLS Configuration",
    severity: "medium",
    description:
      "The server accepts deprecated SSL/TLS protocol versions (SSLv3, TLS 1.0, TLS 1.1) or weak cipher suites, increasing susceptibility to protocol downgrade and decryption attacks.",
    mitre_technique_id: "T1557",
    mitre_technique_name: "Adversary-in-the-Middle",
  }),

  // ─── EXPOSURE (2) ──────────────────────────────────────────────────────────
  t({
    category: "exposure",
    title: "Sensitive Data Exposure",
    severity: "medium",
    description:
      "Sensitive data such as PII, credentials, financial records, or cryptographic keys are transmitted or stored without adequate protection, making them accessible to attackers.",
    mitre_technique_id: "",
    mitre_technique_name: "",
  }),
  t({
    category: "exposure",
    title: "Directory Traversal",
    severity: "high",
    description:
      "User-controlled path parameters are not sufficiently validated, allowing an attacker to traverse the file system and read arbitrary files outside the intended directory.",
    mitre_technique_id: "T1083",
    mitre_technique_name: "File and Directory Discovery",
  }),

  // ─── MISC (3) ──────────────────────────────────────────────────────────────
  t({
    category: "misc",
    title: "Server-Side Request Forgery (SSRF)",
    severity: "high",
    description:
      "The server can be induced to make HTTP requests to arbitrary internal or external destinations, potentially exposing internal services or cloud metadata APIs to an attacker.",
    mitre_technique_id: "T1190",
    mitre_technique_name: "Exploit Public-Facing Application",
  }),
  t({
    category: "misc",
    title: "Insecure Deserialization",
    severity: "critical",
    description:
      "User-controlled serialised data is deserialised without integrity validation, potentially allowing an attacker to manipulate object graphs or achieve remote code execution.",
    mitre_technique_id: "",
    mitre_technique_name: "",
  }),
  t({
    category: "misc",
    title: "Missing Security Headers",
    severity: "low",
    description:
      "The application does not set recommended HTTP security headers such as Content-Security-Policy, X-Frame-Options, or Strict-Transport-Security, increasing exposure to common attacks.",
    mitre_technique_id: "",
    mitre_technique_name: "",
  }),
];

export function searchFindingTemplates(
  query: string,
  templates: FindingTemplate[] = FINDING_TEMPLATES,
): FindingTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter(
    (tmpl) =>
      tmpl.title.toLowerCase().includes(q) ||
      tmpl.description.toLowerCase().includes(q),
  );
}
