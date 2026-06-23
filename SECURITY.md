# Security Policy

Apivot is a local-first desktop application. It does not include telemetry, cloud sync, or bundled user credentials.

## Sensitive Data

Do not commit:

- API keys or access tokens
- Private provider URLs
- `.env` files
- Local profile data
- Logs, backups, and session snapshots
- Packaged release binaries

Use placeholders such as `https://api.example.com/v1` in documentation and tests.

## Reporting Issues

Please open a GitHub issue with:

- the Apivot version;
- operating system;
- affected tool, such as Codex or Claude Code;
- reproduction steps;
- screenshots with credentials and private URLs removed.
