import { AppState, ProfileKey, WindowApi } from "./types";

const sampleState: AppState = {
  data: {
    activeEngine: "codex",
    activeEngineLabel: "Codex",
    activeConfigPath: "C:\\Users\\yks\\.codex\\config.toml",
    lastSwitch: { at: new Date().toISOString(), target: "thirdParty", success: true },
    usageStats: {
      openai: { inputTokens: 18320, outputTokens: 9210, totalTokens: 27530, requests: 24 },
      thirdParty: { inputTokens: 45120, outputTokens: 22340, totalTokens: 67460, requests: 51 }
    },
    usageHistory: Array.from({ length: 10 }, (_, index) => ({
      at: new Date(Date.now() - (9 - index) * 86400000).toISOString(),
      profile: index % 2 ? "thirdParty" : "openai",
      inputTokens: 1000 + index * 420,
      outputTokens: 680 + index * 260,
      totalTokens: 1680 + index * 680
    })),
    profiles: {
      openai: {
        providerId: "openai",
        apiKey: "example-openai-api-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-5.5",
        wireApi: "responses",
        envKey: "OPENAI_API_KEY",
        updateEnv: true,
        compatible: true,
        headers: {}
      },
      thirdParty: {
        providerId: "third_party",
        apiKey: "example-third-party-api-key",
        baseUrl: "https://api.example.com/v1",
        model: "gpt-5.5",
        modelOptions: ["gpt-5.5", "gpt-5.4", "claude-sonnet-4-6", "gemini-3-pro"],
        wireApi: "chat_completions",
        envKey: "APIVOT_THIRD_PARTY_API_KEY",
        updateEnv: true,
        compatible: true,
        headers: {}
      }
    }
  },
  auth: {
    mode: "chatgpt",
    signedIn: true,
    hasChatGptSession: true,
    hasApiKeySession: false,
    source: "mock"
  },
  config: {
    ok: true,
    status: {
      mode: "Third-party API",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-5.5",
      provider: "third_party",
      wireApi: "chat_completions",
      activeEnvKey: "APIVOT_THIRD_PARTY_API_KEY",
      activeEnvValue: "",
      configPath: "C:\\Users\\yks\\.codex\\config.toml",
      envConflicts: []
    }
  },
  candidates: [{ path: "C:\\Users\\yks\\.codex\\config.toml", kind: "user", exists: true }],
  backups: [
    { id: "backup-1", createdAt: "2026-06-09T08:30:00.000Z", originalConfigPath: "C:\\Users\\yks\\.codex\\config.toml", originalMode: "OpenAI", originalModel: "gpt-5.5" },
    { id: "backup-2", createdAt: "2026-06-09T09:10:00.000Z", originalConfigPath: "C:\\Users\\yks\\.codex\\config.toml", originalMode: "Third-party API", originalModel: "gpt-5.5" }
  ],
  logs: [
    { at: "2026-06-09T09:10:10.000Z", type: "switch_success", details: { target: "thirdParty", baseUrl: "https://api.example.com/v1" } },
    { at: "2026-06-09T09:12:02.000Z", type: "connection_test", details: { profile: "thirdParty", result: { ok: true, status: 200, model: "gpt-5.5" } } }
  ],
  paths: {
    appDataDir: "C:\\Users\\yks\\AppData\\Roaming\\Apivot",
    profilesFile: "C:\\Users\\yks\\AppData\\Roaming\\Apivot\\profiles.json",
    backupRoot: "C:\\Users\\yks\\AppData\\Roaming\\Apivot\\backups",
    defaultConfigPath: "C:\\Users\\yks\\.codex\\config.toml"
  }
};

let currentState = sampleState;

export function installMockApi() {
  if (window.api) return;
  const api: WindowApi = {
    getState: async () => currentState,
    setActiveEngine: async (engine) => {
      currentState = { ...currentState, data: { ...currentState.data, activeEngine: engine, activeEngineLabel: engine === "claude" ? "Claude Code" : "Codex" } };
      return currentState;
    },
    selectConfig: async () => currentState,
    setConfigPath: async () => currentState,
    saveProfiles: async (profiles) => {
      currentState = { ...currentState, data: { ...currentState.data, profiles } };
      return currentState;
    },
    resetProfile: async (_key: ProfileKey) => currentState,
    applySwitch: async (target) => ({ ok: true, steps: ["Create backup", "Write target profile", "Re-read and verify config", "Compare configuration", "Check process reload state"], result: { target }, receipt: { configPath: currentState.config.status.configPath, beforeBaseUrl: "https://api.openai.com/v1", afterBaseUrl: currentState.data.profiles[target].baseUrl, beforeModel: "gpt-5.5", afterModel: currentState.data.profiles[target].model, backupId: "backup-mock", envAction: `Updated ${currentState.data.profiles[target].envKey}`, restartRequired: true }, state: currentState }),
    testConnection: async (key) => ({ result: { ok: true, status: 200, url: currentState.data.profiles[key].baseUrl, model: currentState.data.profiles[key].model }, state: currentState }),
    fetchThirdPartyModels: async () => ({ result: { count: 4, url: "https://api.example.com/v1/models", models: ["gpt-5.5", "gpt-5.4", "claude-sonnet-4-6", "gemini-3-pro"] }, state: currentState }),
    resetCleanOpenAI: async () => ({ ok: true, backup: { id: "backup-mock" }, cleared: ["OPENAI_BASE_URL", "OPENAI_MODEL"], state: currentState }),
    restoreBackup: async () => currentState,
    deleteBackup: async () => currentState,
    openPath: async () => ({ ok: true }),
    clearUsage: async () => currentState,
    clearLogs: async () => currentState,
    listChatRecords: async () => [
      { id: "mock-codex-session", engine: "codex", kind: "session", path: "C:\\Users\\yks\\.codex\\sessions\\mock.jsonl", label: "mock.jsonl", size: 2048, modifiedAt: new Date().toISOString() },
      { id: "mock-claude-project", engine: "claude", kind: "project", path: "C:\\Users\\yks\\.claude\\projects\\mock.jsonl", label: "mock-project/mock.jsonl", size: 4096, modifiedAt: new Date().toISOString() }
    ],
    deleteChatRecords: async () => ({ result: { deleted: [{ id: "mock-codex-session", path: "C:\\Users\\yks\\.codex\\sessions\\mock.jsonl" }], skipped: [] }, state: currentState, records: [] }),
    setCloseToTray: async (enabled) => enabled,
    acceptEula: async (version) => {
      currentState = { ...currentState, data: { ...currentState.data, eulaAcceptance: { version, acceptedAt: new Date().toISOString() } } };
      return currentState;
    },
    declineEula: async () => undefined,
    listCodexProcesses: async () => [],
    stopCodexProcesses: async () => [],
    detectCodexLaunch: async () => ({ ok: true, canAutoLaunch: true, method: "desktop", command: "codex.exe" }),
    launchCodex: async () => ({ ok: true, launched: true }),
    detectClaudeCodeLaunch: async () => ({ ok: true, canAutoLaunch: true, method: "windows-terminal", command: "claude.cmd" }),
    launchClaudeCode: async () => ({ ok: true, launched: true }),
    minimizeWindow: async () => undefined,
    toggleMaximize: async () => false,
    getWindowState: async () => "normal",
    onWindowState: () => () => undefined,
    closeWindow: async () => undefined
  };
  window.api = api;
}
