---
description: Review the selected code for security vulnerabilities. Checks for OWASP Top 10 issues specific to Leaflet — path traversal against NOTES_DATA_DIR, SQL injection in better-sqlite3 queries, XSS via @html in Svelte templates, hardcoded secrets, and missing input validation on API routes.
---

Review the following Leaflet source code for security vulnerabilities.

## What to Check

Run through each of these OWASP categories:

### A01 — Broken Access Control
- Can a user access notes outside their workspace via path manipulation?
- Does every file system operation in `notes.ts` go through `safePath()`?
- Are there any directory traversal possibilities with `../` or URL-encoded `%2F`?

### A03 — Injection
- Are all SQL queries in `better-sqlite3` using `?` placeholders?
- Is there any string interpolation directly into a `.prepare(...)` call?
- Is user-supplied content passed to `eval`, `Function()`, or `child_process.exec`?

### A07 — Cross-Site Scripting (XSS)
- Is note content or workspace names rendered with `{@html ...}` in any Svelte template?
- If so, is it sanitised with DOMPurify or equivalent before rendering?

### A02 — Cryptographic Failures / Hardcoded Secrets
- Are there any API keys, tokens, or passwords hardcoded in source files?
- Is `NOTES_DATA_DIR` or any other secret passed in a way that could be logged?

### A05 — Security Misconfiguration
- Do error handlers expose stack traces or internal paths to the client?
- Are there any `.env` values being returned in API responses?

## Output Format

For each finding:
1. **Severity**: Critical / High / Medium / Low
2. **Category**: OWASP category name
3. **Location**: File path and approximate line number
4. **Problem**: What the vulnerability is
5. **Fix**: Concrete code change to remediate it

If no vulnerabilities are found in a category, mark it as "Clear".
