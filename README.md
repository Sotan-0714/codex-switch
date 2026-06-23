# Apivot

> Local-first desktop manager for Codex and Claude Code. Switch providers safely, protect official API/login environments, and recover configuration with one click.

[![Release](https://img.shields.io/github/v/release/Sotan-0714/Apivot?color=4f46e5&label=release)](https://github.com/Sotan-0714/Apivot/releases)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6)

Apivot is a cross-platform desktop tool for managing Codex and Claude Code configuration profiles. It is designed for developers who move between official login flows, third-party API providers, local adapters, backups, and long-running AI coding sessions without breaking their official setup.

The main idea is simple: experiment with third-party providers while keeping your official Codex and Claude Code environments recoverable, inspectable, and easy to restore.

## What Apivot Does

- **One window for two tools**: manage Codex and Claude Code profiles from a single local app.
- **Official login and API modes**: keep official OAuth sessions and third-party API providers in clearly separated slots.
- **Protect official environments**: third-party API switching is isolated from official login profiles so experiments do not permanently damage your official setup.
- **One-click recovery**: restore official configuration quickly when an API provider, adapter, or environment variable causes trouble.
- **Smart local adapters**: translate API formats on-device for Codex Responses or Claude-compatible routing.
- **Built-in safety net**: preflight checks, automatic backups, restore previews, and launch detection catch configuration mistakes before they interrupt your workflow.
- **Session visibility**: local usage statistics for observable adapter requests and categorized chat-record cleanup help you understand long-running sessions.
- **Local-first privacy**: no telemetry, no cloud sync, and no bundled API keys or private provider URLs.

## Feature Highlights

| Profile Management | Safety and Privacy | Visibility |
| --- | --- | --- |
| Codex and Claude Code profiles | Local data storage | Usage statistics |
| Official login and third-party API modes | No telemetry or cloud sync | Session record browser |
| One-click provider switching | Protect official API/login profiles | Launch detection |
| Local adapter routing | Auto-backup before switching | Restore previews |
| Official environment recovery | Preflight config checks | Local operation logs |

## Screenshots

| Switch Workflow | Profile Management |
| --- | --- |
| ![Apivot English switch workflow](docs/screenshots/apivot-switch-en.png) | ![Apivot English profile management](docs/screenshots/apivot-profile-en.png) |
| ![Apivot Chinese switch workflow](docs/screenshots/apivot-switch-zh.png) | ![Apivot Chinese profile management](docs/screenshots/apivot-profile-zh.png) |

## Privacy and Data

**Apivot stores data locally on your machine. Nothing is uploaded by the app itself.**

Apivot does not overwrite official profiles blindly. Before risky changes, it creates backups, runs compatibility checks, and provides restore paths so you can return to a known-good official configuration.

| Platform | Default data location |
| --- | --- |
| Windows | `%APPDATA%\Apivot\` |
| macOS | `~/Library/Application Support/Apivot/` |

Local data may include API keys, base URLs, profile settings, usage logs, backups, and session snapshots. These files are excluded from version control through `.gitignore`.

Usage statistics are recorded only for requests Apivot can observe, such as local adapter traffic and connection tests that return `usage`. They are not official provider billing records.

> No telemetry. No cloud sync. No analytics. Your credentials stay on your device.

## Installation

### Option 1: Download a pre-built release

Go to [Releases](https://github.com/Sotan-0714/Apivot/releases) and download the package for your platform.

| Platform | File | Notes |
| --- | --- | --- |
| Windows installer | `Apivot-Setup-1.0.1-x64.exe` | Recommended for most Windows users |
| Windows portable | `Apivot-Portable-1.0.1-x64.exe` | No installation required |
| macOS Apple Silicon | `Apivot-Setup-1.0.1-arm64.dmg` | M1/M2/M3/M4 Macs |
| macOS Intel | `Apivot-Setup-1.0.1-x64.dmg` | Intel Macs |

Verify downloads with the matching `.sha256.txt` file.

### Option 2: Build from source

Prerequisites:

- Node.js 18 or newer
- npm

```bash
npm install
npm start
```

Build release packages:

```bash
npm run dist:win
npm run dist:mac
```

macOS packages require a macOS machine or a GitHub Actions macOS runner.

### Option 3: GitHub Actions build

Push a version tag such as `v1.0.2` to trigger automated Windows and macOS builds. Release assets are uploaded automatically by `.github/workflows/build-release.yml`.

## Roadmap

- [x] v1.0: Profile switching for Codex and Claude Code
- [x] v1.0: Automatic backups and restore previews
- [x] v1.0: Local usage statistics
- [x] v1.0.1: Windows and macOS release workflow
- [ ] v1.1: Linux support
- [ ] v1.2: Encrypted profile import and export
- [ ] v1.3: Gemini CLI profile support

[Open a feature request](https://github.com/Sotan-0714/Apivot/issues)

## Development

```bash
npm install
npm run build:renderer
npm start
```

Useful commands:

```bash
npm run legal:notices
npm run dist:win
npm run dist:mac
```

## Security

Do not commit real API keys, provider URLs, local profile data, app data directories, logs, backups, or packaged binaries. Use placeholders such as `https://api.example.com/v1` in documentation and commits.

## License

Apivot is released under the [MIT License](LICENSE).

Third-party dependencies remain governed by their own licenses. See [legal/THIRD_PARTY_NOTICES.md](legal/THIRD_PARTY_NOTICES.md).
