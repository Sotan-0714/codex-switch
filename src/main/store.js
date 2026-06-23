const fs = require("fs/promises");
const path = require("path");
const { atomicWriteFile } = require("./atomicWrite");

const codexProfiles = {
  openai: {
    name: "OpenAI official",
    providerId: "openai",
    authMode: "chatgpt",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.5",
    compatible: true,
    wireApi: "responses",
    envKey: "OPENAI_API_KEY",
    updateEnv: false,
    headers: {},
    queryParams: {}
  },
  thirdParty: {
    name: "Third-party API",
    providerId: "third_party",
    apiKey: "",
    baseUrl: "https://api.example.com/v1",
    model: "gpt-5.5",
    modelOptions: [
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.5",
      "gpt-image-2",
      "gpt-image-2-vip",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "gemini-3-flash-preview",
      "gemini-3-flash-preview-all",
      "gemini-3-pro",
      "gemini-3-pro-image-preview",
      "gemini-3-pro-preview",
      "gemini-3-pro-thinking"
    ],
    compatible: true,
    wireApi: "responses",
    envKey: "APIVOT_THIRD_PARTY_API_KEY",
    updateEnv: true,
    headers: {},
    queryParams: {}
  }
};

const claudeProfiles = {
  openai: {
    name: "Claude Code official",
    providerId: "official",
    authMode: "chatgpt",
    apiKey: "",
    baseUrl: "https://api.anthropic.com",
    model: "sonnet",
    compatible: true,
    wireApi: "anthropic_messages",
    envKey: "ANTHROPIC_AUTH_TOKEN",
    authEnvKey: "ANTHROPIC_AUTH_TOKEN",
    updateEnv: false,
    headers: {},
    queryParams: {}
  },
  thirdParty: {
    name: "Third-party API",
    providerId: "third_party",
    apiKey: "",
    baseUrl: "https://api.example.com/v1",
    model: "gpt-5.5",
    modelOptions: [
      "gpt-5.5",
      "gpt-5.4",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "sonnet",
      "opus",
      "haiku",
      "gemini-3-flash-preview",
      "gemini-3-pro"
    ],
    compatible: true,
    wireApi: "openai_chat_adapter",
    envKey: "ANTHROPIC_AUTH_TOKEN",
    authEnvKey: "ANTHROPIC_AUTH_TOKEN",
    updateEnv: false,
    enableGatewayModelDiscovery: false,
    claudeFacingModel: "claude-opus-4-8",
    enableOneMillionContext: false,
    capabilities: "effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking",
    headers: {},
    queryParams: {}
  }
};

const blankUsageStats = {
  openai: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 },
  thirdParty: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }
};

const engineDefaults = {
  codex: {
    activeConfigPath: "",
    lastSwitch: null,
    usageStats: JSON.parse(JSON.stringify(blankUsageStats)),
    usageHistory: [],
    profiles: codexProfiles
  },
  claude: {
    activeConfigPath: "",
    lastSwitch: null,
    usageStats: JSON.parse(JSON.stringify(blankUsageStats)),
    usageHistory: [],
    profiles: claudeProfiles
  }
};

const defaults = {
  activeEngine: "codex",
  eulaAcceptance: {
    version: "",
    acceptedAt: ""
  },
  settings: {
    closeToTray: false
  },
  engines: engineDefaults
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function mergeProfiles(base, saved = {}) {
  const savedOpenAI = saved.openai || saved.official || {};
  return {
    openai: {
      ...base.openai,
      ...savedOpenAI,
      authMode: savedOpenAI.authMode || base.openai.authMode,
      updateEnv: savedOpenAI.authMode ? Boolean(savedOpenAI.updateEnv) : Boolean(base.openai.updateEnv)
    },
    thirdParty: {
      ...base.thirdParty,
      ...(saved.thirdParty || {})
    }
  };
}

function mergeEngine(engine, saved = {}, legacyData = {}) {
  const base = engineDefaults[engine];
  const legacyForCodex = engine === "codex" && !legacyData.engines ? legacyData : {};
  return {
    ...base,
    ...saved,
    activeConfigPath: saved.activeConfigPath || legacyForCodex.activeConfigPath || "",
    lastSwitch: saved.lastSwitch || legacyForCodex.lastSwitch || null,
    usageStats: {
      openai: { ...blankUsageStats.openai, ...(saved.usageStats?.openai || legacyForCodex.usageStats?.openai || {}) },
      thirdParty: { ...blankUsageStats.thirdParty, ...(saved.usageStats?.thirdParty || legacyForCodex.usageStats?.thirdParty || {}) }
    },
    usageHistory: Array.isArray(saved.usageHistory)
      ? saved.usageHistory
      : Array.isArray(legacyForCodex.usageHistory)
        ? legacyForCodex.usageHistory
        : [],
    profiles: mergeProfiles(base.profiles, saved.profiles || legacyForCodex.profiles || {})
  };
}

function mergeDefaults(data = {}) {
  const activeEngine = data.activeEngine === "claude" ? "claude" : "codex";
  const engines = {
    codex: mergeEngine("codex", data.engines?.codex, data),
    claude: mergeEngine("claude", data.engines?.claude, data)
  };
  return {
    ...defaults,
    ...data,
    activeEngine,
    eulaAcceptance: { ...defaults.eulaAcceptance, ...(data.eulaAcceptance || {}) },
    settings: { ...defaults.settings, ...(data.settings || {}) },
    engines,
    activeConfigPath: engines[activeEngine].activeConfigPath,
    lastSwitch: engines[activeEngine].lastSwitch,
    usageStats: engines[activeEngine].usageStats,
    usageHistory: engines[activeEngine].usageHistory,
    profiles: engines[activeEngine].profiles
  };
}

function stripDerived(data) {
  const { activeConfigPath, lastSwitch, usageStats, usageHistory, profiles, ...rest } = data;
  return rest;
}

function createStore(appDataDir) {
  const file = path.join(appDataDir, "profiles.json");
  let writeQueue = Promise.resolve();

  async function withWriteLock(task) {
    const run = writeQueue.then(task, task);
    writeQueue = run.catch(() => {});
    return run;
  }

  return {
    file,
    async load() {
      await ensureDir(appDataDir);
      const data = mergeDefaults(await readJson(file, defaults));
      await this.save(data);
      return data;
    },
    async save(data) {
      await ensureDir(appDataDir);
      const next = mergeDefaults(data);
      await atomicWriteFile(file, JSON.stringify(stripDerived(next), null, 2), "utf8");
      return next;
    },
    async setActiveEngine(engine) {
      const data = await this.load();
      data.activeEngine = engine === "claude" ? "claude" : "codex";
      return this.save(data);
    },
    async saveActiveEnginePatch(engine, patch) {
      const data = await this.load();
      const key = engine === "claude" ? "claude" : "codex";
      data.engines[key] = { ...data.engines[key], ...patch };
      return this.save(data);
    },
    async resetProfile(engine, key) {
      const data = await this.load();
      const engineKey = engine === "claude" ? "claude" : "codex";
      data.engines[engineKey].profiles[key] = { ...engineDefaults[engineKey].profiles[key] };
      return this.save(data);
    },
    async addUsage(engine, key, usage) {
      return withWriteLock(async () => {
        const data = await this.load();
        const engineKey = engine === "claude" ? "claude" : "codex";
        const current = data.engines[engineKey].usageStats[key] || { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
        current.inputTokens += usage.inputTokens || 0;
        current.outputTokens += usage.outputTokens || 0;
        current.totalTokens += usage.totalTokens || 0;
        current.requests += usage.requests || 0;
        data.engines[engineKey].usageStats[key] = current;
        data.engines[engineKey].usageHistory = [
          ...(data.engines[engineKey].usageHistory || []),
          {
            at: new Date().toISOString(),
            engine: engineKey,
            profile: key,
            model: usage.model || "",
            status: usage.status || "ok",
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: usage.totalTokens || 0
          }
        ].slice(-500);
        return this.save(data);
      });
    },
    async clearUsage(engine) {
      const data = await this.load();
      const engineKey = engine === "claude" ? "claude" : "codex";
      data.engines[engineKey].usageStats = JSON.parse(JSON.stringify(blankUsageStats));
      data.engines[engineKey].usageHistory = [];
      return this.save(data);
    }
  };
}

module.exports = { createStore, defaults, engineDefaults };
