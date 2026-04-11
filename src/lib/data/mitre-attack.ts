export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
}

export const MITRE_TECHNIQUES: MitreTechnique[] = [
  // Initial Access
  { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access' },
  { id: 'T1133', name: 'External Remote Services', tactic: 'Initial Access' },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access' },
  { id: 'T1078.001', name: 'Valid Accounts: Default Accounts', tactic: 'Initial Access' },
  { id: 'T1078.002', name: 'Valid Accounts: Domain Accounts', tactic: 'Initial Access' },
  { id: 'T1078.003', name: 'Valid Accounts: Local Accounts', tactic: 'Initial Access' },
  { id: 'T1566', name: 'Phishing', tactic: 'Initial Access' },
  { id: 'T1566.001', name: 'Phishing: Spearphishing Attachment', tactic: 'Initial Access' },
  { id: 'T1566.002', name: 'Phishing: Spearphishing Link', tactic: 'Initial Access' },
  { id: 'T1195', name: 'Supply Chain Compromise', tactic: 'Initial Access' },
  { id: 'T1199', name: 'Trusted Relationship', tactic: 'Initial Access' },
  { id: 'T1091', name: 'Replication Through Removable Media', tactic: 'Initial Access' },

  // Execution
  { id: 'T1059', name: 'Command and Scripting Interpreter', tactic: 'Execution' },
  { id: 'T1059.001', name: 'Command and Scripting Interpreter: PowerShell', tactic: 'Execution' },
  { id: 'T1059.002', name: 'Command and Scripting Interpreter: AppleScript', tactic: 'Execution' },
  { id: 'T1059.003', name: 'Command and Scripting Interpreter: Windows Command Shell', tactic: 'Execution' },
  { id: 'T1059.004', name: 'Command and Scripting Interpreter: Unix Shell', tactic: 'Execution' },
  { id: 'T1059.005', name: 'Command and Scripting Interpreter: Visual Basic', tactic: 'Execution' },
  { id: 'T1059.006', name: 'Command and Scripting Interpreter: Python', tactic: 'Execution' },
  { id: 'T1059.007', name: 'Command and Scripting Interpreter: JavaScript', tactic: 'Execution' },
  { id: 'T1203', name: 'Exploitation for Client Execution', tactic: 'Execution' },
  { id: 'T1204', name: 'User Execution', tactic: 'Execution' },
  { id: 'T1204.001', name: 'User Execution: Malicious Link', tactic: 'Execution' },
  { id: 'T1204.002', name: 'User Execution: Malicious File', tactic: 'Execution' },
  { id: 'T1053', name: 'Scheduled Task/Job', tactic: 'Execution' },
  { id: 'T1053.005', name: 'Scheduled Task/Job: Scheduled Task', tactic: 'Execution' },

  // Persistence
  { id: 'T1136', name: 'Create Account', tactic: 'Persistence' },
  { id: 'T1136.001', name: 'Create Account: Local Account', tactic: 'Persistence' },
  { id: 'T1136.002', name: 'Create Account: Domain Account', tactic: 'Persistence' },
  { id: 'T1547', name: 'Boot or Logon Autostart Execution', tactic: 'Persistence' },
  { id: 'T1547.001', name: 'Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder', tactic: 'Persistence' },
  { id: 'T1505', name: 'Server Software Component', tactic: 'Persistence' },
  { id: 'T1505.003', name: 'Server Software Component: Web Shell', tactic: 'Persistence' },
  { id: 'T1098', name: 'Account Manipulation', tactic: 'Persistence' },
  { id: 'T1098.001', name: 'Account Manipulation: Additional Cloud Credentials', tactic: 'Persistence' },

  // Privilege Escalation
  { id: 'T1068', name: 'Exploitation for Privilege Escalation', tactic: 'Privilege Escalation' },
  { id: 'T1055', name: 'Process Injection', tactic: 'Privilege Escalation' },
  { id: 'T1055.001', name: 'Process Injection: Dynamic-link Library Injection', tactic: 'Privilege Escalation' },
  { id: 'T1055.002', name: 'Process Injection: Portable Executable Injection', tactic: 'Privilege Escalation' },
  { id: 'T1055.012', name: 'Process Injection: Process Hollowing', tactic: 'Privilege Escalation' },
  { id: 'T1548', name: 'Abuse Elevation Control Mechanism', tactic: 'Privilege Escalation' },
  { id: 'T1548.001', name: 'Abuse Elevation Control Mechanism: Setuid and Setgid', tactic: 'Privilege Escalation' },
  { id: 'T1548.002', name: 'Abuse Elevation Control Mechanism: Bypass User Account Control', tactic: 'Privilege Escalation' },
  { id: 'T1134', name: 'Access Token Manipulation', tactic: 'Privilege Escalation' },
  { id: 'T1134.001', name: 'Access Token Manipulation: Token Impersonation/Theft', tactic: 'Privilege Escalation' },
  { id: 'T1611', name: 'Escape to Host', tactic: 'Privilege Escalation' },

  // Defense Evasion
  { id: 'T1070', name: 'Indicator Removal', tactic: 'Defense Evasion' },
  { id: 'T1070.001', name: 'Indicator Removal: Clear Windows Event Logs', tactic: 'Defense Evasion' },
  { id: 'T1070.003', name: 'Indicator Removal: Clear Command History', tactic: 'Defense Evasion' },
  { id: 'T1070.004', name: 'Indicator Removal: File Deletion', tactic: 'Defense Evasion' },
  { id: 'T1027', name: 'Obfuscated Files or Information', tactic: 'Defense Evasion' },
  { id: 'T1562', name: 'Impair Defenses', tactic: 'Defense Evasion' },
  { id: 'T1562.001', name: 'Impair Defenses: Disable or Modify Tools', tactic: 'Defense Evasion' },
  { id: 'T1036', name: 'Masquerading', tactic: 'Defense Evasion' },
  { id: 'T1218', name: 'System Binary Proxy Execution', tactic: 'Defense Evasion' },
  { id: 'T1218.011', name: 'System Binary Proxy Execution: Rundll32', tactic: 'Defense Evasion' },
  { id: 'T1140', name: 'Deobfuscate/Decode Files or Information', tactic: 'Defense Evasion' },
  { id: 'T1112', name: 'Modify Registry', tactic: 'Defense Evasion' },
  { id: 'T1553', name: 'Subvert Trust Controls', tactic: 'Defense Evasion' },

  // Credential Access
  { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access' },
  { id: 'T1110.001', name: 'Brute Force: Password Guessing', tactic: 'Credential Access' },
  { id: 'T1110.002', name: 'Brute Force: Password Cracking', tactic: 'Credential Access' },
  { id: 'T1110.003', name: 'Brute Force: Password Spraying', tactic: 'Credential Access' },
  { id: 'T1555', name: 'Credentials from Password Stores', tactic: 'Credential Access' },
  { id: 'T1555.003', name: 'Credentials from Password Stores: Credentials from Web Browsers', tactic: 'Credential Access' },
  { id: 'T1003', name: 'OS Credential Dumping', tactic: 'Credential Access' },
  { id: 'T1003.001', name: 'OS Credential Dumping: LSASS Memory', tactic: 'Credential Access' },
  { id: 'T1003.002', name: 'OS Credential Dumping: Security Account Manager', tactic: 'Credential Access' },
  { id: 'T1003.003', name: 'OS Credential Dumping: NTDS', tactic: 'Credential Access' },
  { id: 'T1552', name: 'Unsecured Credentials', tactic: 'Credential Access' },
  { id: 'T1552.001', name: 'Unsecured Credentials: Credentials In Files', tactic: 'Credential Access' },
  { id: 'T1187', name: 'Forced Authentication', tactic: 'Credential Access' },
  { id: 'T1558', name: 'Steal or Forge Kerberos Tickets', tactic: 'Credential Access' },
  { id: 'T1558.003', name: 'Steal or Forge Kerberos Tickets: Kerberoasting', tactic: 'Credential Access' },
  { id: 'T1649', name: 'Steal or Forge Authentication Certificates', tactic: 'Credential Access' },

  // Discovery
  { id: 'T1018', name: 'Remote System Discovery', tactic: 'Discovery' },
  { id: 'T1082', name: 'System Information Discovery', tactic: 'Discovery' },
  { id: 'T1083', name: 'File and Directory Discovery', tactic: 'Discovery' },
  { id: 'T1087', name: 'Account Discovery', tactic: 'Discovery' },
  { id: 'T1087.001', name: 'Account Discovery: Local Account', tactic: 'Discovery' },
  { id: 'T1087.002', name: 'Account Discovery: Domain Account', tactic: 'Discovery' },
  { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery' },
  { id: 'T1069', name: 'Permission Groups Discovery', tactic: 'Discovery' },
  { id: 'T1069.001', name: 'Permission Groups Discovery: Local Groups', tactic: 'Discovery' },
  { id: 'T1069.002', name: 'Permission Groups Discovery: Domain Groups', tactic: 'Discovery' },
  { id: 'T1057', name: 'Process Discovery', tactic: 'Discovery' },
  { id: 'T1135', name: 'Network Share Discovery', tactic: 'Discovery' },
  { id: 'T1201', name: 'Password Policy Discovery', tactic: 'Discovery' },

  // Lateral Movement
  { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement' },
  { id: 'T1021.001', name: 'Remote Services: Remote Desktop Protocol', tactic: 'Lateral Movement' },
  { id: 'T1021.002', name: 'Remote Services: SMB/Windows Admin Shares', tactic: 'Lateral Movement' },
  { id: 'T1021.004', name: 'Remote Services: SSH', tactic: 'Lateral Movement' },
  { id: 'T1021.006', name: 'Remote Services: Windows Remote Management', tactic: 'Lateral Movement' },
  { id: 'T1550', name: 'Use Alternate Authentication Material', tactic: 'Lateral Movement' },
  { id: 'T1550.001', name: 'Use Alternate Authentication Material: Application Access Token', tactic: 'Lateral Movement' },
  { id: 'T1550.002', name: 'Use Alternate Authentication Material: Pass the Hash', tactic: 'Lateral Movement' },
  { id: 'T1550.003', name: 'Use Alternate Authentication Material: Pass the Ticket', tactic: 'Lateral Movement' },
  { id: 'T1563', name: 'Remote Service Session Hijacking', tactic: 'Lateral Movement' },

  // Collection
  { id: 'T1560', name: 'Archive Collected Data', tactic: 'Collection' },
  { id: 'T1560.001', name: 'Archive Collected Data: Archive via Utility', tactic: 'Collection' },
  { id: 'T1114', name: 'Email Collection', tactic: 'Collection' },
  { id: 'T1056', name: 'Input Capture', tactic: 'Collection' },
  { id: 'T1056.001', name: 'Input Capture: Keylogging', tactic: 'Collection' },
  { id: 'T1039', name: 'Data from Network Shared Drive', tactic: 'Collection' },
  { id: 'T1025', name: 'Data from Removable Media', tactic: 'Collection' },
  { id: 'T1213', name: 'Data from Information Repositories', tactic: 'Collection' },
  { id: 'T1074', name: 'Data Staged', tactic: 'Collection' },

  // Command and Control
  { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control' },
  { id: 'T1071.001', name: 'Application Layer Protocol: Web Protocols', tactic: 'Command and Control' },
  { id: 'T1071.004', name: 'Application Layer Protocol: DNS', tactic: 'Command and Control' },
  { id: 'T1105', name: 'Ingress Tool Transfer', tactic: 'Command and Control' },
  { id: 'T1572', name: 'Protocol Tunneling', tactic: 'Command and Control' },
  { id: 'T1095', name: 'Non-Application Layer Protocol', tactic: 'Command and Control' },
  { id: 'T1102', name: 'Web Service', tactic: 'Command and Control' },
  { id: 'T1090', name: 'Proxy', tactic: 'Command and Control' },
  { id: 'T1090.001', name: 'Proxy: Internal Proxy', tactic: 'Command and Control' },
  { id: 'T1219', name: 'Remote Access Software', tactic: 'Command and Control' },

  // Exfiltration
  { id: 'T1048', name: 'Exfiltration Over Alternative Protocol', tactic: 'Exfiltration' },
  { id: 'T1048.001', name: 'Exfiltration Over Alternative Protocol: Exfiltration Over Symmetric Encrypted Non-C2 Protocol', tactic: 'Exfiltration' },
  { id: 'T1048.002', name: 'Exfiltration Over Alternative Protocol: Exfiltration Over Asymmetric Encrypted Non-C2 Protocol', tactic: 'Exfiltration' },
  { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration' },
  { id: 'T1020', name: 'Automated Exfiltration', tactic: 'Exfiltration' },
  { id: 'T1030', name: 'Data Transfer Size Limits', tactic: 'Exfiltration' },
  { id: 'T1537', name: 'Transfer Data to Cloud Account', tactic: 'Exfiltration' },

  // Impact
  { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact' },
  { id: 'T1490', name: 'Inhibit System Recovery', tactic: 'Impact' },
  { id: 'T1489', name: 'Service Stop', tactic: 'Impact' },
  { id: 'T1499', name: 'Endpoint Denial of Service', tactic: 'Impact' },
  { id: 'T1499.001', name: 'Endpoint Denial of Service: OS Exhaustion Flood', tactic: 'Impact' },
  { id: 'T1485', name: 'Data Destruction', tactic: 'Impact' },
  { id: 'T1491', name: 'Defacement', tactic: 'Impact' },
  { id: 'T1561', name: 'Disk Wipe', tactic: 'Impact' },
];

const MITRE_MAP = new Map(MITRE_TECHNIQUES.map((t) => [t.id.toUpperCase(), t]));

export function getMitreTechnique(id: string): MitreTechnique | undefined {
  return MITRE_MAP.get(id.toUpperCase());
}

export function searchMitreTechniques(query: string): MitreTechnique[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return MITRE_TECHNIQUES.filter(
    (t) => t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
  ).slice(0, 8);
}
