const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { atomicWriteFile } = require("./atomicWrite");

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const DEFAULT_CLAUDE_SETTINGS = path.join(CLAUDE_DIR, "settings.json");
const CLAUDE_STATE_FILE = path.join(os.homedir(), ".claude.json");

const ROUTING_ENV_VARS = [
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_SMALL_FAST_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME",
  "ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION",
  "ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES",
  "ANTHROPIC_CUSTOM_HEADERS",
  "ANTHROPIC_CUSTOM_MODEL_OPTION",
  "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME",
  "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION",
  "ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES",
  "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY"
];

function nowIso() {
  return new Date().toISOString();
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function normalizeBaseUrl(value) {
  return (value || "").trim().replace(/\/+$/, "");
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function parseJson(raw) {
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function stringifyJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function envFromSettings(parsed) {
  return parsed && typeof parsed.env === "object" && !Array.isArray(parsed.env) ? parsed.env : {};
}

function getConfiguredBaseUrl(parsed) {
  const env = envFromSettings(parsed);
  return env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
}

function getConfiguredModel(parsed) {
  const env = envFromSettings(parsed);
  return parsed.model || env.ANTHROPIC_MODEL || "";
}

function inferMode(parsed) {
  const env = envFromSettings(parsed);
  const baseUrl = normalizeBaseUrl(env.ANTHROPIC_BASE_URL);
  if (env.CLAUDE_CODE_USE_BEDROCK === "1") return "bedrock";
  if (env.CLAUDE_CODE_USE_VERTEX === "1") return "vertex";
  if (env.CLAUDE_CODE_USE_FOUNDRY === "1") return "foundry";
  if (!baseUrl || baseUrl === "https://api.anthropic.com") return "official";
  if (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) return "local-adapter";
  return "third-party";
}

function detectEnvConflicts(parsed) {
  const configEnv = envFromSettings(parsed);
  const activeBaseUrl = normalizeBaseUrl(getConfiguredBaseUrl(parsed));
  const activeModel = getConfiguredModel(parsed);
  const conflicts = [];
  for (const key of ROUTING_ENV_VARS) {
    const processValue = process.env[key];
    if (!processValue) continue;
    const configuredValue = configEnv[key] || (key === "ANTHROPIC_MODEL" ? parsed.model : "");
    let conflictsWith = "";
    if (key === "ANTHROPIC_BASE_URL" && normalizeBaseUrl(processValue) !== activeBaseUrl) {
      conflictsWith = `settings base URL: ${activeBaseUrl}`;
    } else if (key === "ANTHROPIC_MODEL" && activeModel && processValue !== activeModel) {
      conflictsWith = `settings model: ${activeModel}`;
    } else if (configuredValue && configuredValue !== processValue) {
      conflictsWith = "settings env value differs";
    }
    conflicts.push({
      key,
      value: key.includes("KEY") || key.includes("TOKEN") ? maskSecret(processValue) : processValue,
      conflictsWith,
      priorityNote: "Shell environment variables can override or change Claude Code behavior for sessions launched from that shell.",
      fixCommand: `setx ${key} ""`
    });
  }
  return conflicts;
}

function buildStatus(parsed, configPath) {
  const env = envFromSettings(parsed);
  const baseUrl = getConfiguredBaseUrl(parsed);
  const model = getConfiguredModel(parsed);
  return {
    mode: inferMode(parsed),
    baseUrl,
    model,
    configPath,
    provider: inferMode(parsed),
    wireApi: env.APIVOT_WIRE_API || "anthropic_messages",
    activeEnvKey: env.ANTHROPIC_AUTH_TOKEN ? "ANTHROPIC_AUTH_TOKEN" : env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY" : "",
    activeEnvValue: env.ANTHROPIC_AUTH_TOKEN ? maskSecret(env.ANTHROPIC_AUTH_TOKEN) : env.ANTHROPIC_API_KEY ? maskSecret(env.ANTHROPIC_API_KEY) : "",
    envConflicts: detectEnvConflicts(parsed)
  };
}

async function findConfigCandidates(cwd) {
  const candidates = [
    DEFAULT_CLAUDE_SETTINGS,
    path.join(CLAUDE_DIR, "settings.local.json")
  ];
  if (cwd) {
    let current = cwd;
    while (current && current !== path.dirname(current)) {
      candidates.push(path.join(current, ".claude", "settings.json"));
      candidates.push(path.join(current, ".claude", "settings.local.json"));
      current = path.dirname(current);
    }
  }
  const unique = [...new Set(candidates.filter(Boolean))];
  const results = [];
  for (const candidate of unique) {
    results.push({
      path: candidate,
      exists: await pathExists(candidate),
      kind: candidate === DEFAULT_CLAUDE_SETTINGS ? "user" : candidate.endsWith("settings.local.json") ? "local" : "project"
    });
  }
  return results;
}

async function readConfig(configPath = DEFAULT_CLAUDE_SETTINGS) {
  const exists = await pathExists(configPath);
  if (!exists) {
    return {
      ok: false,
      path: configPath,
      error: "Settings file does not exist.",
      raw: "",
      parsed: {},
      status: buildStatus({}, configPath)
    };
  }
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = parseJson(raw);
    return { ok: true, path: configPath, raw, parsed, status: buildStatus(parsed, configPath) };
  } catch (error) {
    return {
      ok: false,
      path: configPath,
      error: error.message,
      raw: "",
      parsed: {},
      status: buildStatus({}, configPath)
    };
  }
}

async function backupConfig(configPath, backupRoot) {
  await ensureDir(backupRoot);
  const read = await readConfig(configPath);
  const stamp = nowIso().replace(/[:.]/g, "-");
  const backupDir = path.join(backupRoot, stamp);
  await ensureDir(backupDir);
  const settingsBackupPath = path.join(backupDir, "settings.json");
  await atomicWriteFile(settingsBackupPath, read.ok ? read.raw : "", "utf8");
  const meta = {
    id: stamp,
    createdAt: nowIso(),
    originalConfigPath: configPath,
    originalBaseUrl: read.status.baseUrl,
    originalModel: read.status.model,
    originalMode: read.status.mode,
    readable: read.ok,
    readError: read.error || ""
  };
  await atomicWriteFile(path.join(backupDir, "meta.json"), stringifyJson(meta), "utf8");
  return meta;
}

function validateProfile(profile, mode) {
  const missing = [];
  if (!profile) missing.push("profile");
  if (mode !== "official" && !profile?.apiKey) missing.push("API Key / Auth Token");
  if (mode !== "official" && !profile?.baseUrl) missing.push("Base URL");
  if (!profile?.model) missing.push("Model");
  if (missing.length) throw new Error(`Target profile is incomplete: ${missing.join(", ")}.`);
}

function clearClaudeRoutingEnv(env) {
  for (const key of ROUTING_ENV_VARS) {
    delete env[key];
  }
  delete env.APIVOT_WIRE_API;
}

function buildConfigForProfile(currentParsed, profile, mode) {
  const next = JSON.parse(JSON.stringify(currentParsed || {}));
  const env = { ...envFromSettings(next) };
  clearClaudeRoutingEnv(env);

  if (mode === "official") {
    if (profile.model) next.model = profile.model;
    if (Object.keys(env).length) next.env = env;
    else delete next.env;
    return next;
  }

  env.ANTHROPIC_BASE_URL = normalizeBaseUrl(profile.baseUrl);
  if (profile.authEnvKey === "ANTHROPIC_API_KEY") {
    env.ANTHROPIC_API_KEY = profile.apiKey;
  } else {
    env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
  }
  if (profile.model) {
    next.model = profile.model;
    env.ANTHROPIC_MODEL = profile.model;
  }
  if (profile.customModelOption && profile.model) {
    const opusCapabilities = "effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking";
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = profile.model;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = "Opus 4.8";
    env.ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION = "Opus 4.8 routed through Apivot";
    env.ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES = opusCapabilities;
    env.ANTHROPIC_CUSTOM_MODEL_OPTION = profile.model;
    env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = "Opus 4.8";
    env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Opus 4.8 routed through Apivot";
    env.ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES = opusCapabilities;
  }
  if (profile.enableGatewayModelDiscovery) {
    env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1";
  }
  if (profile.wireApi) {
    env.APIVOT_WIRE_API = profile.wireApi;
  }
  if (profile.headers && Object.keys(profile.headers).length) {
    env.ANTHROPIC_CUSTOM_HEADERS = JSON.stringify(profile.headers);
  }
  next.env = env;
  return next;
}

async function writeConfigForProfile(configPath, profile, mode) {
  validateProfile(profile, mode);
  await ensureDir(path.dirname(configPath));
  const before = await readConfig(configPath);
  if (!before.ok && before.error !== "Settings file does not exist.") throw new Error(before.error);
  const nextParsed = buildConfigForProfile(before.ok ? before.parsed : {}, profile, mode);
  await atomicWriteFile(configPath, stringifyJson(nextParsed), "utf8");
  const after = await readConfig(configPath);
  if (!after.ok) throw new Error(`Settings were written but could not be read back: ${after.error}`);
  const expectedBaseUrl = normalizeBaseUrl(mode === "official" ? "https://api.anthropic.com" : profile.baseUrl);
  const actualBaseUrl = normalizeBaseUrl(after.status.baseUrl);
  if (mode !== "official" && actualBaseUrl !== expectedBaseUrl) {
    throw new Error(`Write verification failed. Expected ${expectedBaseUrl}; got ${actualBaseUrl}.`);
  }
  if (profile.model && after.status.model !== profile.model) {
    throw new Error(`Write verification failed. Expected model ${profile.model}; got ${after.status.model}.`);
  }
  return { before: before.status, after: after.status, changed: before.raw !== after.raw };
}

async function writeCleanOfficialConfig(configPath, model = "sonnet") {
  await ensureDir(path.dirname(configPath));
  const before = await readConfig(configPath);
  const next = before.ok ? JSON.parse(JSON.stringify(before.parsed || {})) : {};
  const env = { ...envFromSettings(next) };
  clearClaudeRoutingEnv(env);
  next.model = model || "sonnet";
  if (Object.keys(env).length) next.env = env;
  else delete next.env;
  await atomicWriteFile(configPath, stringifyJson(next), "utf8");
  const after = await readConfig(configPath);
  if (!after.ok) throw new Error(`Clean official settings were written but could not be read back: ${after.error}`);
  return { before: before.status, after: after.status };
}

async function restoreBackup(backupId, backupRoot, activeConfigPath) {
  const backupDir = path.join(backupRoot, backupId);
  const meta = JSON.parse(await fs.readFile(path.join(backupDir, "meta.json"), "utf8"));
  const raw = await fs.readFile(path.join(backupDir, "settings.json"), "utf8");

  // Validate the backup is parseable JSON BEFORE touching the live settings, so
  // a corrupted/unreadable backup can never overwrite a good file.
  try {
    parseJson(raw);
  } catch (error) {
    throw new Error(`Backup is corrupted and was not restored: ${error.message}`);
  }

  // Restore to the current active config path when provided; only fall back to
  // the path recorded in the backup when the caller has none.
  const targetPath = activeConfigPath || meta.originalConfigPath;
  await ensureDir(path.dirname(targetPath));
  await atomicWriteFile(targetPath, raw, "utf8");

  // Verify the restored file reads back and parses.
  const after = await readConfig(targetPath);
  if (!after.ok) {
    throw new Error(`Backup was restored but could not be read back: ${after.error}`);
  }

  return { ...meta, restoredTo: targetPath };
}

async function listBackups(backupRoot) {
  if (!(await pathExists(backupRoot))) return [];
  const entries = await fs.readdir(backupRoot, { withFileTypes: true });
  const backups = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(backupRoot, entry.name, "meta.json"), "utf8"));
      try {
        const stat = await fs.stat(path.join(backupRoot, entry.name, "settings.json"));
        meta.fileSize = stat.size;
      } catch {
        meta.fileSize = 0;
      }
      backups.push(meta);
    } catch {
      backups.push({ id: entry.name, createdAt: entry.name, readError: "Invalid backup metadata." });
    }
  }
  return backups.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function deleteBackup(backupId, backupRoot) {
  await fs.rm(path.join(backupRoot, backupId), { recursive: true, force: true });
}

module.exports = {
  DEFAULT_CLAUDE_SETTINGS,
  CLAUDE_STATE_FILE,
  ROUTING_ENV_VARS,
  maskSecret,
  findConfigCandidates,
  readConfig,
  backupConfig,
  writeConfigForProfile,
  writeCleanOfficialConfig,
  restoreBackup,
  listBackups,
  deleteBackup,
  detectEnvConflicts
};
