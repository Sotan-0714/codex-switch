const fs = require("fs/promises");
const path = require("path");

const LIGHT_STATE_FILES = [
  "auth.json",
  "session_index.jsonl",
  ".codex-global-state.json",
  "state_5.sqlite",
  "state_5.sqlite-shm",
  "state_5.sqlite-wal"
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

async function snapshotCodexState(configPath, snapshotRoot, mode) {
  const codexHome = path.dirname(configPath);
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeName(mode)}`;
  const targetDir = path.join(snapshotRoot, id);
  await fs.mkdir(targetDir, { recursive: true });

  const copied = [];
  const skipped = [];
  for (const file of LIGHT_STATE_FILES) {
    const source = path.join(codexHome, file);
    if (!(await exists(source))) {
      skipped.push({ file, reason: "missing" });
      continue;
    }
    const destination = path.join(targetDir, file);
    await fs.copyFile(source, destination).catch((error) => skipped.push({ file, reason: error.message }));
    if (await exists(destination)) copied.push({ file, bytes: await fileSize(destination) });
  }

  const sessionsDir = path.join(codexHome, "sessions");
  let sessions = { exists: false, files: 0, bytes: 0, note: "not copied automatically to keep switching fast" };
  if (await exists(sessionsDir)) {
    const stack = [sessionsDir];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of await fs.readdir(current, { withFileTypes: true }).catch(() => [])) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        if (entry.isFile()) {
          sessions.files += 1;
          sessions.bytes += await fileSize(full);
        }
      }
    }
    sessions.exists = true;
  }

  const meta = {
    id,
    createdAt: new Date().toISOString(),
    mode,
    codexHome,
    copied,
    skipped,
    sessions
  };
  await fs.writeFile(path.join(targetDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  return { ...meta, path: targetDir };
}

module.exports = { snapshotCodexState };
