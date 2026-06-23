# Apivot User Guide

Portable / setup 1.0.1 quick guide.

## Advantages

Apivot manages Codex and Claude Code profiles in one local desktop app. It separates official login from third-party API mode, translates incompatible API routes through local adapters, and provides preflight checks, backups, restore previews, launch detection, status verification, usage stats, and categorized chat cleanup.

## Installation

Download platform builds from GitHub Releases:

- Windows installer: `Apivot-Setup-1.0.1-x64.exe`
- Windows portable: `Apivot-Portable-1.0.1-x64.exe`
- macOS Apple Silicon: `Apivot-Setup-1.0.1-arm64.dmg`
- macOS Intel: `Apivot-Setup-1.0.1-x64.dmg`

## macOS Packaging

macOS DMG/ZIP builds require GitHub Actions macOS runners or a real macOS machine. Windows cannot reliably produce final macOS installers locally.

## Usage Statistics

Third-party API switching for Codex and Claude Code writes local adapter endpoints when needed so observable token usage can be recorded. Usage statistics come from requests Apivot can observe, such as local adapter traffic and connection tests that return `usage`. They are not official provider billing records.

## Chat Records

The Records page filters by Codex, Claude, or all records. Codex records are marked as OpenAI official, third-party API, or unknown when metadata is available.

## License

Apivot is released under the MIT License.
