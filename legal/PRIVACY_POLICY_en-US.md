# Apivot Privacy Policy

Applies to Apivot 1.0.1.

Apivot is local-first desktop software. It does not provide an account system, advertising, telemetry, analytics, or Hardcopia cloud sync.

## Local Processing

Profiles, API keys, base URLs, models, headers, configuration paths, logs, backups, usage statistics, chat-record selection state, and license acceptance records are stored locally by default.

Default locations:

- Windows: `%APPDATA%\Apivot\`
- macOS: `~/Library/Application Support/Apivot/`

## Network Requests

The app sends requests only when you refresh models, test a connection, launch a client, or run a local adapter. Requests go to the endpoint shown in the interface.

The local adapter listens only on `127.0.0.1` and forwards or translates requests according to your local profile settings.

## Usage Statistics

Usage statistics are stored locally and come only from requests Apivot can observe, such as local adapter traffic and connection tests that return `usage`. They may be incomplete when a provider does not return usage fields, and they are not official provider billing records.

## Chat Records

The Records page reads local Codex and Claude Code session/history files for display, filtering, and selective deletion. Deleting chat records does not remove configuration, login state, or backups.

## Third-Party Services

Your chosen API provider may process request content under its own policies. Hardcopia does not collect or sell your local app data through this software.

## License

Apivot is released under the MIT License. Third-party dependencies remain governed by their own licenses.
