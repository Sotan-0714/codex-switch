# GitHub Upload Guide

Apivot now uses a single public MIT repository.

## Repository

- Repository name: `Apivot`
- Visibility: Public
- License: MIT
- Source folder: `github-ready/Apivot`
- Description: `Local-first desktop tool for managing Codex & Claude Code configuration profiles — official login, third-party API adapters, backups, usage stats, and no telemetry. Windows & macOS.`
- Topics: `electron`, `codex`, `claude-code`, `desktop-app`, `account-switcher`, `local-first`, `privacy`, `windows`, `macos`, `typescript`

## Release Assets

Do not commit packaged binaries into git. Release assets are generated and uploaded by GitHub Actions from version tags:

- Windows portable `.exe`
- Windows setup `.exe`
- macOS `.dmg`
- macOS `.zip`
- matching `.sha256.txt` files

## Before Publishing

Run a secret scan for:

- `sk-` style API keys;
- private provider URLs;
- `.env*`;
- `profiles.json`;
- local app data under `AppData/Roaming/Apivot`;
- logs, backups, screenshots, and release bundles inside git history.
