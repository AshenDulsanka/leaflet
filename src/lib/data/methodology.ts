export interface MethodologyStep {
  id: string;
  label: string;
  steps?: MethodologyStep[];
}

export const METHODOLOGY: MethodologyStep[] = [
  {
    id: "pre-engagement",
    label: "1. Pre-Engagement",
    steps: [
      { id: "pe-scope", label: "Review scope & Rules of Engagement (RoE)" },
      { id: "pe-targets", label: "Confirm in-scope IPs / domains / subnets" },
      { id: "pe-vpn", label: "Verify VPN / HTB connection is active" },
      {
        id: "pe-dirs",
        label:
          "Create workspace folder structure (recon/, exploit/, post/, loot/)",
      },
      { id: "pe-notes", label: "Open note-taking template for the engagement" },
    ],
  },
  {
    id: "info-gathering",
    label: "2. Information Gathering",
    steps: [
      {
        id: "ig-tcp",
        label:
          "Full TCP port scan all in-scope hosts (Nmap -p- --min-rate 5000)",
      },
      {
        id: "ig-udp",
        label: "UDP scan top ports (sudo nmap -sU --top-ports 20)",
      },
      { id: "ig-svc", label: "Service version & OS detection (-sCV / -O)" },
      {
        id: "ig-dns",
        label: "DNS enumeration: zone transfer, brute force subdomains",
      },
      {
        id: "ig-smb",
        label: "SMB enumeration: enum4linux / smbclient / CrackMapExec shares",
      },
      {
        id: "ig-ldap",
        label: "LDAP anonymous enumeration (if AD environment)",
      },
      {
        id: "ig-snmp",
        label: "SNMP walk (community string: public / private)",
      },
      {
        id: "ig-web",
        label: "Web fingerprinting: whatweb, Wappalyzer, response headers",
      },
      {
        id: "ig-dir",
        label: "Directory / file brute force (ffuf, feroxbuster, gobuster)",
      },
      {
        id: "ig-vhost",
        label: 'Subdomain / vhost enumeration (ffuf -H "Host: FUZZ.domain")',
      },
    ],
  },
  {
    id: "vuln-assessment",
    label: "3. Vulnerability Assessment",
    steps: [
      {
        id: "va-cve",
        label: "Research CVEs for each identified service & version",
      },
      {
        id: "va-defcreds",
        label: "Check for default credentials on all services",
      },
      {
        id: "va-misconfig",
        label: "Identify misconfigurations: anonymous FTP/SMB/LDAP, open NFS",
      },
      {
        id: "va-web",
        label:
          "Web app manual testing: SQLi, XSS, LFI/RFI, command injection, SSRF",
      },
      {
        id: "va-exploits",
        label: "Search for public exploits (searchsploit, ExploitDB, GitHub)",
      },
    ],
  },
  {
    id: "exploitation",
    label: "4. Exploitation / Initial Foothold",
    steps: [
      {
        id: "ex-exploit",
        label: "Exploit chosen vulnerability to gain initial access",
      },
      {
        id: "ex-shell",
        label: "Stabilize / upgrade shell (python3 pty, rlwrap, Ctrl+Z + stty)",
      },
      { id: "ex-proof", label: "Grab user.txt / initial access proof flag" },
      {
        id: "ex-screenshot",
        label: "Screenshot initial shell proof with IP/hostname visible",
      },
      {
        id: "ex-document",
        label: "Document: vulnerability, exploit used, command, result",
      },
    ],
  },
  {
    id: "post-exploitation",
    label: "5. Post-Exploitation / Pillaging",
    steps: [
      { id: "po-enum", label: "Run local enumeration (LinPEAS / WinPEAS)" },
      { id: "po-sudo", label: "Check sudo / SUID / capabilities (Linux)" },
      {
        id: "po-privs",
        label: "Check privileges, tokens, groups (Windows: whoami /all)",
      },
      {
        id: "po-creds",
        label:
          "Harvest credentials: config files, ~/.bash_history, env vars, SAM",
      },
      { id: "po-cron", label: "Check cron jobs / scheduled tasks" },
      {
        id: "po-network",
        label: "Enumerate interfaces, ARP cache, routing table, hosts",
      },
      {
        id: "po-pivot",
        label: "Identify internal hosts / networks for potential pivoting",
      },
    ],
  },
  {
    id: "privilege-escalation",
    label: "6. Privilege Escalation",
    steps: [
      {
        id: "priv-identify",
        label: "Identify privesc vector from enumeration output",
      },
      { id: "priv-exploit", label: "Exploit privilege escalation path" },
      { id: "priv-proof", label: "Grab root.txt / admin proof flag" },
      {
        id: "priv-screenshot",
        label: "Screenshot root/SYSTEM shell with proof visible",
      },
      {
        id: "priv-document",
        label: "Document: escalation path, commands used, result",
      },
    ],
  },
  {
    id: "lateral-movement",
    label: "7. Lateral Movement",
    steps: [
      {
        id: "lm-pivot",
        label:
          "Setup pivot tunnel to internal network (Ligolo-ng / Chisel / SSH)",
      },
      {
        id: "lm-enum",
        label:
          "Enumerate new network segment (ping sweep, Nmap via proxychains)",
      },
      {
        id: "lm-creds",
        label: "Reuse / spray harvested credentials against new hosts",
      },
      {
        id: "lm-pth",
        label: "Pass-the-hash / Pass-the-ticket against new targets",
      },
      {
        id: "lm-access",
        label: "Gain access to new hosts and repeat exploitation cycle",
      },
    ],
  },
  {
    id: "ad-attacks",
    label: "8. Active Directory Attacks",
    steps: [
      {
        id: "ad-bh",
        label: "BloodHound collection (SharpHound or bloodhound-python)",
      },
      {
        id: "ad-bh-analyze",
        label: "Analyze BloodHound: shortest path to Domain Admin",
      },
      {
        id: "ad-kerb",
        label: "Kerberoasting / AS-REP Roasting → crack hashes",
      },
      { id: "ad-acl", label: "Identify & abuse ACL/ACE misconfigurations" },
      {
        id: "ad-dcsync",
        label: "DCSync (secretsdump) to dump all domain credentials",
      },
      {
        id: "ad-da",
        label: "Domain Admin / Enterprise Admin compromise proof",
      },
    ],
  },
  {
    id: "reporting",
    label: "9. Reporting",
    steps: [
      {
        id: "rep-review",
        label: "Review all notes, screenshots, and command output",
      },
      { id: "rep-exec", label: "Write executive summary (business impact)" },
      {
        id: "rep-findings",
        label: "Write technical findings with severity (CVSS) and POC steps",
      },
      {
        id: "rep-remed",
        label: "Add remediation recommendations for each finding",
      },
      { id: "rep-proof", label: "Attach all screenshots and proof files" },
      {
        id: "rep-final",
        label: "Proofread, review accuracy, finalize and submit report",
      },
    ],
  },
];

export const METHODOLOGY_PRESETS: Record<
  string,
  { label: string; steps: typeof METHODOLOGY }
> = {
  cpts: {
    label: "HTB CPTS",
    steps: METHODOLOGY,
  },
};
