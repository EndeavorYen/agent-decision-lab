# Security Policy

## Supported Versions

Security fixes target the latest released minor version. Version 0.2 is the
current development line.

## Reporting a Vulnerability

Do not attach private experiment stores, transcripts, credentials, or
unredacted exports to a public issue. Use the repository owner's private
GitHub security-reporting channel when available, or request a private contact
channel without disclosing the sensitive payload.

## Security Boundaries

- ADL stores experiment data locally and does not upload it automatically.
- The local UI requires a per-launch token and same-origin mutation requests.
- MCP records supplied evidence but does not execute arbitrary shell commands.
- Redaction is best-effort; run `adl privacy audit` before sharing artifacts.
