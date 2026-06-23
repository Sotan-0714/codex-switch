const fs = require("fs/promises");
const path = require("path");
const { maskSecret } = require("./util/mask");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function sanitize(value) {
  if (typeof value === "string") {
    return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, (match) => maskSecret(match));
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = key.toLowerCase().includes("key") || key.toLowerCase().includes("token") ? maskSecret(String(item || "")) : sanitize(item);
    }
    return next;
  }
  return value;
}

function createLogger(appDataDir) {
  const file = path.join(appDataDir, "logs.jsonl");

  return {
    file,
    async append(type, details = {}) {
      await ensureDir(appDataDir);
      const entry = {
        at: new Date().toISOString(),
        type,
        details: sanitize(details)
      };
      await fs.appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
      return entry;
    },
    async list(limit = 200) {
      try {
        const raw = await fs.readFile(file, "utf8");
        return raw
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-limit)
          .map((line) => JSON.parse(line))
          .reverse();
      } catch {
        return [];
      }
    },
    async clear() {
      await ensureDir(appDataDir);
      await fs.writeFile(file, "", "utf8");
    }
  };
}

module.exports = { createLogger };
