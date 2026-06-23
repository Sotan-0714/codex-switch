const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const TOML = require("@iarna/toml");
const { atomicWriteFile } = require("./atomicWrite");

const DEFAULT_CODEX_CONFIG = path.join(os.homedir(), ".codex", "config.toml");
const ENV_VARS = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "CODEX_API_KEY",
  "CODEX_ACCESS_TOKEN",
  "AZURE_OPENAI_API_KEY"
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

function parseToml(content) {
  if (!content.trim()) return {};
  return TOML.parse(content);
}

function stringifyToml(data) {
  return TOML.stringify(data);
}

function inferMode(parsed) {
  const provider = parsed.model_provider;
  const baseUrl = parsed.openai_base_url || parsed?.model_providers?.[provider]?.base_url || "";
  if (!provider && !baseUrl) return "openai";
  if (provider === "openai" || baseUrl.includes("api.openai.com")) return "openai";
  if (provider || baseUrl) return "third-party";
  return "unknown";
}

function getActiveBaseUrl(parsed) {
  const provider = parsed.model_provider;
  if (provider && parsed.model_providers && parsed.model_providers[provider]?.base_url) {
    return parsed.model_providers[provider].base_url;
  }
  return parsed.openai_base_url || "https://api.openai.com/v1";
}

function detectEnvConflicts(parsed) {
  const activeBaseUrl = normalizeBaseUrl(getActiveBaseUrl(parsed));
  const model = parsed.model || "";
  const conflicts = [];
  const providerEnvKey = getProviderEnvKey(parsed);
  const customProviderUsesEnv = Boolean(parsed.model_provider && parsed.model_provider !== "openai" && providerEnvKey);
  const keys = [...new Set([...ENV_VARS, providerEnvKey].filter(Boolean))];

  for (const key of keys) {
    const value = process.env[key];
    if (!value) continue;
    if (customProviderUsesEnv && key === providerEnvKey) continue;

    let conflictsWith = "";
    let priorityNote = "Environment variables can affect API-backed commands or child processes. Codex config precedence may differ by surface.";
    if (key === "OPENAI_BASE_URL" && activeBaseUrl && normalizeBaseUrl(value) !== activeBaseUrl) {
      conflictsWith = `config base URL: ${activeBaseUrl}`;
    }
    if (key === "OPENAI_MODEL" && model && value !== model) {
      conflictsWith = `config model: ${model}`;
    }
    if (key === "OPENAI_API_KEY" || key === "CODEX_API_KEY" || key === "AZURE_OPENAI_API_KEY") {
      conflictsWith = "config/profile API key cannot be compared directly";
    }
    if (key === providerEnvKey) {
      priorityNote = "This is the active provider env_key referenced by config.toml. Codex should read it after restart.";
    }
    if (key === "CODEX_ACCESS_TOKEN") {
      priorityNote = "ChatGPT/Codex access-token auth can indicate a different auth path than API-key profiles.";
    }

    conflicts.push({
      key,
      value: key.includes("KEY") || key.includes("TOKEN") ? maskSecret(value) : value,
      conflictsWith,
      priorityNote,
      fixCommand: `setx ${key} ""`
    });
  }

  return conflicts;
}

function getProviderEnvKey(parsed) {
  const provider = parsed.model_provider;
  if (provider && parsed.model_providers && parsed.model_providers[provider]?.env_key) {
    return parsed.model_providers[provider].env_key;
  }
  return "";
}

async function findConfigCandidates(cwd) {
  const candidates = [
    DEFAULT_CODEX_CONFIG,
    path.join(process.env.APPDATA || "", "Codex", "config.toml"),
    path.join(process.env.LOCALAPPDATA || "", "Codex", "config.toml")
  ];

  if (cwd) {
    let current = cwd;
    while (current && current !== path.dirname(current)) {
      candidates.push(path.join(current, ".codex", "config.toml"));
      current = path.dirname(current);
    }
  }

  const unique = [...new Set(candidates.filter(Boolean))];
  const results = [];
  for (const candidate of unique) {
    results.push({
      path: candidate,
      exists: await pathExists(candidate),
      kind: candidate === DEFAULT_CODEX_CONFIG ? "user" : candidate.includes(`${path.sep}.codex${path.sep}`) ? "project" : "appdata"
    });
  }
  return results;
}

async function readConfig(configPath = DEFAULT_CODEX_CONFIG) {
  const exists = await pathExists(configPath);
  if (!exists) {
    return {
      ok: false,
      path: configPath,
      error: "Config file does not exist.",
      raw: "",
      parsed: {},
      status: buildStatus({}, configPath)
    };
  }

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = parseToml(raw);
    return {
      ok: true,
      path: configPath,
      raw,
      parsed,
      status: buildStatus(parsed, configPath)
    };
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

function buildStatus(parsed, configPath) {
  const activeEnvKey = getProviderEnvKey(parsed);
  const provider = parsed.model_provider;
  const providerConfig = provider && parsed.model_providers ? parsed.model_providers[provider] : {};
  return {
    mode: inferMode(parsed),
    baseUrl: getActiveBaseUrl(parsed),
    model: parsed.model || "",
    configPath,
    provider: parsed.model_provider || "openai",
    wireApi: providerConfig?.wire_api || "responses",
    activeEnvKey,
    activeEnvValue: activeEnvKey && process.env[activeEnvKey] ? maskSecret(process.env[activeEnvKey]) : "",
    envConflicts: detectEnvConflicts(parsed)
  };
}

async function backupConfig(configPath, backupRoot) {
  await ensureDir(backupRoot);
  const read = await readConfig(configPath);
  const stamp = nowIso().replace(/[:.]/g, "-");
  const backupDir = path.join(backupRoot, stamp);
  await ensureDir(backupDir);
  const configBackupPath = path.join(backupDir, "config.toml");

  if (read.ok) {
    await atomicWriteFile(configBackupPath, read.raw, "utf8");
  } else {
    await atomicWriteFile(configBackupPath, "", "utf8");
  }

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
  await atomicWriteFile(path.join(backupDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  return meta;
}

function validateProfile(profile, mode) {
  const missing = [];
  if (!profile) missing.push("profile");
  if (mode !== "openai" || profile?.authMode === "api") {
    if (!profile?.apiKey) missing.push("API Key");
  }
  if (!profile?.baseUrl) missing.push("Base URL");
  if (!profile?.model) missing.push("Model");
  if ((mode !== "openai" || profile?.authMode === "api") && profile?.updateEnv && !profile?.envKey) missing.push("Env Key");
  if (missing.length) {
    throw new Error(`Target profile is incomplete: ${missing.join(", ")}`);
  }
}

function buildConfigForProfile(currentParsed, profile, mode) {
  const next = JSON.parse(JSON.stringify(currentParsed || {}));
  const previousProvider = next.model_provider;
  next.model = profile.model;
  next.model_provider = profile.providerId || mode;

  if (mode === "openai") {
    delete next.model_provider;
    if (profile.baseUrl && normalizeBaseUrl(profile.baseUrl) !== "https://api.openai.com/v1") {
      next.openai_base_url = normalizeBaseUrl(profile.baseUrl);
    } else {
      delete next.openai_base_url;
    }
    if (next.model_providers) {
      delete next.model_providers.openai;
      delete next.model_providers.apivot_codex_adapter;
      delete next.model_providers.codex_switch_adapter;
      delete next.model_providers.codex_switcher_adapter;
      if (previousProvider && previousProvider !== "openai") delete next.model_providers[previousProvider];
      if (!Object.keys(next.model_providers).length) delete next.model_providers;
    }
    return next;
  }

  const providerId = profile.providerId || "third_party";
  next.model_provider = providerId;
  delete next.openai_base_url;
  next.model_providers = next.model_providers || {};
  next.model_providers[providerId] = {
    name: profile.name || "Third-party OpenAI-compatible API",
    base_url: normalizeBaseUrl(profile.baseUrl),
    wire_api: profile.wireApi || "responses"
  };
  if (!profile.noAuth) {
    next.model_providers[providerId].env_key = profile.envKey || "APIVOT_THIRD_PARTY_API_KEY";
  }

  if (profile.headers && Object.keys(profile.headers).length) {
    next.model_providers[providerId].http_headers = profile.headers;
  }
  if (profile.queryParams && Object.keys(profile.queryParams).length) {
    next.model_providers[providerId].query_params = profile.queryParams;
  }
  return next;
}

async function writeConfigForProfile(configPath, profile, mode) {
  validateProfile(profile, mode);
  await ensureDir(path.dirname(configPath));

  const before = await readConfig(configPath);
  const currentParsed = before.ok ? before.parsed : {};
  const nextParsed = buildConfigForProfile(currentParsed, profile, mode);
  const nextRaw = stringifyToml(nextParsed);
  await atomicWriteFile(configPath, nextRaw, "utf8");

  const after = await readConfig(configPath);
  if (!after.ok) {
    throw new Error(`Config was written but could not be read back: ${after.error}`);
  }

  const expectedBaseUrl = normalizeBaseUrl(mode === "openai" ? profile.baseUrl || "https://api.openai.com/v1" : profile.baseUrl);
  const actualBaseUrl = normalizeBaseUrl(after.status.baseUrl);
  const expectedProvider = mode === "openai" ? "openai" : profile.providerId || "third_party";
  const checks = [
    after.status.model === profile.model,
    actualBaseUrl === expectedBaseUrl,
    after.status.provider === expectedProvider
  ];

  if (!checks.every(Boolean)) {
    throw new Error(`Write verification failed. Expected ${expectedProvider}, ${expectedBaseUrl}, ${profile.model}; got ${after.status.provider}, ${actualBaseUrl}, ${after.status.model}.`);
  }

  return {
    before: before.status,
    after: after.status,
    changed: before.raw !== after.raw
  };
}

async function writeCleanOpenAIConfig(configPath, model = "gpt-5.5") {
  await ensureDir(path.dirname(configPath));
  const before = await readConfig(configPath);
  const next = before.ok ? JSON.parse(JSON.stringify(before.parsed || {})) : {};
  const activeProvider = next.model_provider;
  next.model = model || "gpt-5.5";
  delete next.model_provider;
  delete next.openai_base_url;
  if (next.model_providers && typeof next.model_providers === "object") {
    // Remove the previously active provider, whatever its name.
    if (activeProvider && activeProvider !== "openai") {
      delete next.model_providers[activeProvider];
    }
    // Generic cleanup: drop any provider that points at the local adapter
    // (127.0.0.1 / localhost), regardless of its name, so a custom-named
    // adapter provider never lingers after restoring official defaults.
    for (const [name, prov] of Object.entries(next.model_providers)) {
      const baseUrl = normalizeBaseUrl(prov && prov.base_url ? prov.base_url : "");
      if (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost")) {
        delete next.model_providers[name];
      }
    }
    // Compatibility: also remove known historical/dirty names (ccswith was a
    // legacy typo kept here so old configs still get cleaned).
    for (const legacy of ["third_party", "apivot_codex_adapter", "codex_switch_adapter", "codex_switcher_adapter", "ccswitch", "ccswith", "proxy"]) {
      delete next.model_providers[legacy];
    }
    if (!Object.keys(next.model_providers).length) {
      delete next.model_providers;
    }
  }
  await atomicWriteFile(configPath, stringifyToml(next), "utf8");
  const after = await readConfig(configPath);
  if (!after.ok) {
    throw new Error(`Clean OpenAI config was written but could not be read back: ${after.error}`);
  }
  return { before: before.status, after: after.status };
}

async function restoreBackup(backupId, backupRoot, activeConfigPath) {
  const backupDir = path.join(backupRoot, backupId);
  const metaPath = path.join(backupDir, "meta.json");
  const configPath = path.join(backupDir, "config.toml");
  const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
  const raw = await fs.readFile(configPath, "utf8");

  // Validate the backup is parseable BEFORE touching the live config, so a
  // corrupted/unreadable backup can never overwrite a good file.
  try {
    parseToml(raw);
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
        const stat = await fs.stat(path.join(backupRoot, entry.name, "config.toml"));
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
  DEFAULT_CODEX_CONFIG,
  maskSecret,
  findConfigCandidates,
  readConfig,
  backupConfig,
  writeConfigForProfile,
  writeCleanOpenAIConfig,
  restoreBackup,
  listBackups,
  deleteBackup,
  detectEnvConflicts
};
