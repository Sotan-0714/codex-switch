const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const outputsDir = path.join(root, "outputs");
const dryRun = process.argv.includes("--dry-run");
const bump = process.argv.includes("--bump");
const versionIndex = process.argv.indexOf("--version");
const requestedVersion = versionIndex >= 0 ? process.argv[versionIndex + 1] : "";
const artifactPattern = /^Apivot-Portable-(\d+)\.(\d+)\.(\d+)-x64\.exe$/;

if (versionIndex >= 0 && !/^\d+\.\d+\.\d+$/.test(requestedVersion || "")) {
  throw new Error("--version requires a semantic version such as 1.0.0");
}

function runWindowsCommand(command) {
  execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", command], { cwd: root, stdio: "inherit" });
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function assertInside(parent, child) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove outside ${parent}: ${child}`);
  }
}

function currentPackageVersion() {
  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8")).version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function nextVersion() {
  const versions = fs.existsSync(outputsDir)
    ? fs.readdirSync(outputsDir).map((name) => name.match(artifactPattern)).filter(Boolean)
    : [];
  // With no prior artifacts to derive from, fall back to the version already in
  // package.json rather than resetting to 0.1.0.
  if (!versions.length) return currentPackageVersion();
  versions.sort((a, b) => Number(b[1]) - Number(a[1]) || Number(b[2]) - Number(a[2]) || Number(b[3]) - Number(a[3]));
  return `${versions[0][1]}.${versions[0][2]}.${Number(versions[0][3]) + 1}`;
}

const version = requestedVersion || nextVersion();
const artifactName = `Apivot-Portable-${version}-x64.exe`;
const outputArtifact = path.join(outputsDir, artifactName);
if (fs.existsSync(outputArtifact)) throw new Error(`Refusing to overwrite existing artifact: ${outputArtifact}`);

console.log(`${dryRun ? "Next" : "Building"} portable version ${version}`);
if (dryRun) process.exit(0);

const originalPackage = fs.readFileSync(packagePath, "utf8");
const originalLock = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, "utf8") : null;
const builderOutputDir = path.join(os.tmpdir(), `apivot-builder-${version}`);
if (fs.existsSync(builderOutputDir)) {
  assertInside(os.tmpdir(), builderOutputDir);
  fs.rmSync(builderOutputDir, { recursive: true, force: true });
}
const packageJson = JSON.parse(originalPackage);
packageJson.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

if (originalLock) {
  const lockJson = JSON.parse(originalLock);
  lockJson.version = version;
  if (lockJson.packages?.[""]) lockJson.packages[""].version = version;
  fs.writeFileSync(lockPath, `${JSON.stringify(lockJson, null, 2)}\n`);
}

try {
  runWindowsCommand("npm.cmd run legal:notices");
  runWindowsCommand("npm.cmd run build:renderer");
  runWindowsCommand(`npx.cmd electron-builder --win portable --x64 --config.electronDist=node_modules/electron/dist --config.directories.output=${quoteCmdArg(builderOutputDir)} --publish never`);
  const builtArtifact = path.join(builderOutputDir, artifactName);
  if (!fs.existsSync(builtArtifact)) throw new Error(`Builder did not create ${builtArtifact}`);

  fs.mkdirSync(outputsDir, { recursive: true });
  fs.copyFileSync(builtArtifact, outputArtifact, fs.constants.COPYFILE_EXCL);
  const hash = createHash("sha256").update(fs.readFileSync(outputArtifact)).digest("hex");
  const prefix = path.join(outputsDir, `Apivot-Portable-${version}`);
  fs.writeFileSync(`${prefix}-x64.sha256.txt`, `${hash}  ${artifactName}\n`);
  fs.writeFileSync(`${prefix}-release-notes.txt`, [
    `Apivot Windows ${version}`,
    "",
    "- Merged Codex and Claude Code switching into one local desktop program.",
    "- Codex keeps the local Responses adapter at http://127.0.0.1:17641/v1.",
    "- Claude Code uses the local Anthropic Messages gateway at http://127.0.0.1:17642 when third-party APIs need OpenAI Chat adapter routing.",
    "- Moved the Codex / Claude Code workspace switch to the sidebar and kept engine-specific theme colors.",
    "- Added post-switch Launch Codex / Launch Claude Code actions.",
    "- Rechecked the transparent rounded outer window frame and preserved the original app icon artwork.",
    "- Polished sidebar/header alignment so the brand row, title, status pill, refresh button, and window controls share the intended top rhythm.",
    "- Restored the original app icon artwork across PNG, ICO, and SVG references without redesigning the glyph.",
    "- Strengthened selected linear navigation icons for Codex and Claude themes while keeping inactive icons flat.",
    "- Preserved the v0.2.3 notice spacing, danger-zone spacing, collapsed engine dots, and maximized-window width behavior.",
    "- Smoke-tested Codex Responses, Codex Chat fallback, Claude Messages, Claude OpenAI Chat fallback, local adapters, and config write/read verification.",
    "- Fixed Codex local adapter fallback so it no longer writes a missing third-party API key env reference into config.toml.",
    "- Injected Codex third-party API env keys into launched Codex sessions and launched Codex/Claude Code from the user home directory instead of the portable extraction temp directory.",
    "- Improved the Test configuration notice spacing before the authentication/detail rows.",
    "- Fixed Launch Codex / Launch Claude Code command quoting so Windows no longer treats the window title as a missing executable.",
    "- Added launch-time command discovery and error reporting for codex and claude.cmd.",
    "- Synced Claude third-party targetModel with the selected model and documented the Claude-visible model versus upstream target model behavior.",
    "- Added selectable deletion for local Codex and Claude Code chat/session history records without deleting configuration, login state, or backups.",
    "- Added Codex WindowsApps detection so Store/App Installer Codex installs can launch even when codex is not available through PATH.",
    "- Prefer launching the Codex desktop executable directly when detected, with CLI fallback kept for non-Store installs.",
    "- Improved chat record labels with extracted conversation title, workspace/model/time metadata, and recent message preview.",
    "- Fixed Claude Code launch by replacing fragile PowerShell command-chain parsing with a Start-Process argument-array launcher.",
    "- Added AppX install-location detection for Codex and resolved resources/codex.exe to the desktop Codex.exe when available.",
    "- Added launch preflight checks: the app now reports the detected launch method or asks the user to start the client manually when no reliable method is found.",
    "- Prefer Windows Terminal for Claude Code and other CLI launch paths when wt.exe is available.",
    "- Matched Codex chat-record names to Codex session_index.jsonl thread names and hid index/history metadata files from the deletion list.",
    "- Added chat-record filters for All, Codex, and Claude, with Codex records marked as OpenAI official, third-party API, or unknown when metadata is available.",
    "- Increased chat-record display density and preview length so local conversations are easier to recognize before deletion.",
    "- Records usage statistics from connection tests and local Codex/Claude adapter requests, with automatic refresh on the Usage Stats page.",
    "- Treats a successful switch receipt as verified while the current config still matches the written profile, avoiding misleading Restart required status after a valid third-party launch.",
    "- Changed Apivot licensing to the MIT License and updated all bundled license, legal, third-party notice, and quick-guide text.",
    "- Adds Windows Setup packaging alongside the portable build for the upload-ready release bundle.",
    "- Updated bundled legal notices, third-party notices, and quick guides for this package version.",
    "",
    `SHA-256: ${hash}`,
    ""
  ].join("\n"));
  console.log(`Created ${outputArtifact}`);
  console.log(`SHA-256 ${hash}`);
} finally {
  // Always restore package.json/lock so a successful build leaves a clean
  // working tree; only keep the bumped version when --bump is explicitly given.
  if (!bump) {
    fs.writeFileSync(packagePath, originalPackage);
    if (originalLock) fs.writeFileSync(lockPath, originalLock);
  }
  if (fs.existsSync(builderOutputDir)) {
    assertInside(os.tmpdir(), builderOutputDir);
    fs.rmSync(builderOutputDir, { recursive: true, force: true });
  }
}
