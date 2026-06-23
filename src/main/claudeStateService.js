const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const LIGHT_STATE_FILES = [
  path.join(os.homedir(), ".claude.json"),
  path.join(os.homedir(), ".claude", "settings.json"),
  path.join(os.homedir(), ".claude", "settings.local.json")
];

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function safeName(value) {
  return String(value || "unknown").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80);
}

async function fileSize(target) {
  try {
    return (await fs.stat(target)).size;
  } catch {
    return 0;
  }
}

async function snapshotClaudeState(_configPath, snapshotRoot, mode) {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeName(mode)}`;
  const targetDir = path.join(snapshotRoot, id);
  await fs.mkdir(targetDir, { recursive: true });

  const copied = [];
  const skipped = [];
  for (const source of LIGHT_STATE_FILES) {
    const file = path.basename(source);
    if (!(await exists(source))) {
      skipped.push({ file, source, reason: "missing" });
      continue;
    }
    const destination = path.join(targetDir, file);
    await fs.copyFile(source, destination).catch((error) => skipped.push({ file, source, reason: error.message }));
    if (await exists(destination)) copied.push({ file, source, bytes: await fileSize(destination) });
  }

  const meta = {
    id,
    createdAt: new Date().toISOString(),
    mode,
    claudeHome: path.join(os.homedir(), ".claude"),
    copied,
    skipped,
    desktopNote: "Claude Desktop app data is intentionally not copied or modified."
  };
  await fs.writeFile(path.join(targetDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  return { ...meta, path: targetDir };
}

module.exports = { snapshotClaudeState };
