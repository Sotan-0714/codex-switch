# Codex Final QA Handoff

Date: 2026-06-22

This document records the follow-up work after Claude Code fixed the Vite browser-preview P0 regression. It is intended for Claude Code to independently verify the current repository state before release.

## Scope Completed by Codex

### 1. P0 Regression Guard

Added a repeatable browser preview smoke script:

- `scripts/qa-vite-smoke.cjs`
- npm script: `npm run qa:vite`

Coverage:

- starts a real Vite dev server on a free localhost port
- opens the browser preview with Playwright
- waits for `.app-shell`
- accepts EULA when needed
- verifies Apivot branding and Switch page text
- verifies sidebar collapse/expand
- verifies Profile page navigation
- fails on browser console warning/error
- writes screenshots to `outputs/qa/vite-smoke/`

This specifically guards the previous blank-page failure where `window.api.getWindowState()` ran before the dev mock API was installed.

### 2. Electron Product Path Smoke

Added a repeatable Electron smoke script:

- `scripts/qa-electron-smoke.cjs`
- npm script: `npm run qa:electron`

Coverage:

- launches the Electron app with an isolated temporary `APIVOT_USER_DATA_DIR`
- accepts first-run EULA
- verifies default page rendering
- verifies sidebar collapse/expand
- verifies Profile page navigation
- verifies Settings entry and page rendering
- resizes the window to the minimum supported size `980x720`
- fails on renderer console warning/error
- writes screenshots to `outputs/qa/electron-smoke/`

This does not replace manual Windows GUI acceptance, but it catches renderer crashes, missing preload APIs, broken first-run EULA flow, and obvious layout failures.

### 3. Codex Third-Party Token Usage Regression Tests

Extended `test/adapter.test.js` with adapter-level tests:

- non-stream Chat Completions usage is recorded through the Codex local adapter
- streamed Chat Completions usage is recorded through the Codex local adapter

These tests run a local mock upstream provider, start the real Codex adapter, call `/v1/responses`, and assert the usage recorder receives normalized usage.

This verifies the local adapter path that Apivot can observe. It does not prove that every real provider sends usage in the same streaming shape.

### 4. Combined QA Script

Added:

- npm script: `npm run qa:all`

Current sequence:

1. `npm run test`
2. `npm run typecheck`
3. `npm run build:renderer`
4. `npm run qa:vite`
5. `npm run qa:electron`

## Required Claude Code Verification

Run:

```powershell
npm run qa:all
npm audit --audit-level=high
npm run dist:preview
npm run dist:win
```

Expected:

- all unit tests pass
- typecheck passes
- renderer build passes
- Vite smoke passes
- Electron smoke passes
- no high-severity audit findings
- dist preview resolves the next portable version without error
- Windows portable and NSIS installer artifacts are created under `dist/`

Expected screenshot folders:

- `outputs/qa/vite-smoke/`
- `outputs/qa/electron-smoke/`

## Latest Codex Execution Result

Codex ran the full automated suite successfully after adding the QA coverage.

Commands completed successfully:

```powershell
npm run qa:all
npm audit --audit-level=high
npm run dist:preview
npm run dist:win
```

Observed results:

- `npm run qa:all`: passed
- `node --test`: 14/14 passed
- `tsc --noEmit`: passed
- `vite build`: passed
- `qa:vite`: passed, screenshots written to `outputs/qa/vite-smoke/`
- `qa:electron`: passed, screenshots written to `outputs/qa/electron-smoke/`
- `npm audit --audit-level=high`: `found 0 vulnerabilities`
- `npm run dist:preview`: `Next portable version 1.0.2`
- `npm run dist:win`: generated:
  - `dist/Apivot-Portable-1.0.1-x64.exe`
  - `dist/Apivot-Setup-1.0.1-x64.exe`
  - `dist/Apivot-Setup-1.0.1-x64.exe.blockmap`

Codex also attempted a Playwright packaged-portable smoke test with `Apivot-Portable-1.0.1-x64.exe`. That attempt timed out waiting for an Electron window, which is likely caused by the portable wrapper not being attachable through Playwright `_electron.launch`. Do not count packaged runtime startup as automatically passed based on that attempt. Manually double-click the portable executable and run the NSIS installer acceptance flow.

## Remaining Items That Still Need Real-Environment Verification

These cannot be fully proven by local mock tests alone.

### R1. Real Windows GUI Acceptance

Status: Requires runtime verification

Manual checks:

1. launch the packaged portable build
2. accept EULA on a clean user data directory
3. switch between Codex and Claude engines
4. open every nav item
5. verify sidebar expanded and collapsed states
6. verify Settings remains fixed at the lower-left
7. verify minimize, maximize, restore, and close behavior
8. verify 100%, 125%, and 150% Windows display scaling
9. verify install, uninstall, and update behavior for the Windows installer

### R2. Real Provider Streaming Usage Samples

Status: Requires runtime verification

The new tests prove the adapter records usage when usage appears in common OpenAI-compatible stream chunks. A real provider may emit usage as:

- final top-level `usage`
- nested `response.usage`
- nested `delta.usage`
- omitted usage
- cumulative usage
- incremental usage

Before changing accumulation logic, capture raw SSE samples from the actual third-party providers used by the owner.

Minimum sample set:

1. Codex third-party non-stream `/chat/completions`
2. Codex third-party stream `/chat/completions`
3. Codex third-party non-stream `/responses`
4. Codex third-party stream `/responses`
5. Claude gateway stream through Chat Completions adapter

Important: redact API keys before committing or sharing samples.

### R3. Packaged Build Launchers

Status: Requires runtime verification

Auto-launch behavior depends on the owner's local installation of Codex, Claude Code, Windows Terminal, PATH, and WindowsApps permissions.

Manual checks:

1. detect Codex launch target
2. launch Codex when auto-detected
3. show manual launch guidance when not detected
4. detect Claude Code launch target
5. launch Claude Code when auto-detected
6. verify injected environment variables match the active profile

## Notes for Release Decision

The automated regression coverage is stronger after this change, especially for:

- Vite browser-preview blank page
- Electron first-run startup
- sidebar collapse regression
- Profile and Settings entry regressions
- Codex third-party adapter usage recording

Do not treat this document as a sign-off for real provider billing accuracy or installer behavior. Those remain owner-machine acceptance tasks.
