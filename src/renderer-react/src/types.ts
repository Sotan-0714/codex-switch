export type ProfileKey = "openai" | "thirdParty";
export type TabKey = "switch" | "status" | "profiles" | "test" | "records" | "tokens" | "settings";

export type Profile = {
  name?: string;
  providerId: string;
  authMode?: "chatgpt" | "api";
  apiKey: string;
  baseUrl: string;
  model: string;
  modelOptions?: string[];
  compatible?: boolean;
  wireApi: "responses" | "chat_completions" | string;
  envKey: string;
  updateEnv?: boolean;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  targetModel?: string;
  claudeFacingModel?: string;
  capabilities?: string;
  enableOneMillionContext?: boolean;
  enableGatewayModelDiscovery?: boolean;
};

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  requests?: number;
};

export type UsageHistoryEntry = {
  at: string;
  engine?: "codex" | "claude";
  profile: ProfileKey;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model?: string;
  status?: string;
};

export type AppState = {
  data: {
    activeEngine?: "codex" | "claude";
    activeEngineLabel?: string;
    activeConfigPath: string;
    eulaAcceptance?: { version: string; acceptedAt: string };
    lastSwitch?: {
      at: string;
      target: string;
      engine?: "codex" | "claude";
      success?: boolean;
      backupId?: string;
      codexStateSnapshotId?: string;
      claudeStateSnapshotId?: string;
      configPath?: string;
      processCount?: number;
      status?: {
        mode?: string;
        baseUrl?: string;
        model?: string;
        provider?: string;
        wireApi?: string;
        configPath?: string;
      };
    } | null;
    usageStats?: Record<ProfileKey, Usage>;
    usageHistory?: UsageHistoryEntry[];
    profiles: Record<ProfileKey, Profile>;
    engines?: Record<string, unknown>;
    settings?: { closeToTray?: boolean };
  };
  auth: {
    mode: string;
    signedIn: boolean;
    hasChatGptSession: boolean;
    hasApiKeySession: boolean;
    source: string;
  };
  config: {
    ok: boolean;
    error?: string;
    status: {
      mode: string;
      baseUrl: string;
      model: string;
      provider: string;
      wireApi: string;
      activeEnvKey?: string;
      activeEnvValue?: string;
      configPath: string;
      envConflicts?: Array<{ key: string; value: string; conflictsWith?: string; priorityNote?: string; fixCommand?: string }>;
    };
  };
  candidates: Array<{ path: string; kind: string; exists: boolean }>;
  adapter?: { running: boolean; port: number; baseUrl: string; targetBaseUrl: string; model: string; startedAt?: string };
  enginesStatus?: Record<string, unknown>;
  backups: Array<{
    id: string;
    createdAt?: string;
    originalConfigPath?: string;
    originalMode?: string;
    originalBaseUrl?: string;
    originalModel?: string;
    fileSize?: number;
  }>;
  logs: Array<{ at: string; type: string; details: unknown }>;
  paths: {
    appDataDir: string;
    profilesFile: string;
    backupRoot: string;
    codexStateSnapshotRoot?: string;
    defaultConfigPath: string;
    claudeBackupRoot?: string;
    codexBackupRoot?: string;
    claudeStateSnapshotRoot?: string;
  };
  appInfo?: { name: string; version: string };
};

export type ConnectionResult = {
  ok?: boolean;
  status?: number;
  url?: string;
  model?: string;
  error?: string;
  authMode?: string;
  codexCompatible?: boolean;
  claudeCompatible?: boolean;
  compatibilityError?: string;
  adapterAvailable?: boolean;
  chatFallbackStatus?: number;
  chatFallbackUrl?: string;
  chatFallbackError?: string;
  usage?: Usage;
  [key: string]: unknown;
};

export type ChatRecord = {
  id: string;
  engine: "codex" | "claude";
  kind: string;
  path: string;
  label: string;
  size: number;
  modifiedAt: string;
  title?: string;
  subtitle?: string;
  preview?: string;
  firstUserText?: string;
  lastUserText?: string;
  lastAssistantText?: string;
  lastMessageAt?: string;
  cwd?: string;
  model?: string;
  provider?: string;
  sessionId?: string;
  codexThreadName?: string;
  codexSource?: "official" | "thirdParty" | "unknown";
  codexSourceLabel?: string;
};

export type LaunchDetection = {
  ok: boolean;
  canAutoLaunch?: boolean;
  launched?: boolean;
  engine?: "codex" | "claude";
  method?: string;
  mode?: string;
  command?: string;
  terminal?: string;
  cwd?: string;
  checked?: string[];
  manualMessage?: string;
  manualCommand?: string;
  error?: string;
};

export type WindowApi = {
  getState: () => Promise<AppState>;
  setActiveEngine: (engine: "codex" | "claude") => Promise<AppState>;
  selectConfig: () => Promise<AppState>;
  setConfigPath: (path: string) => Promise<AppState>;
  saveProfiles: (profiles: Record<ProfileKey, Profile>) => Promise<AppState>;
  resetProfile: (key: ProfileKey) => Promise<AppState>;
  applySwitch: (target: ProfileKey) => Promise<{ ok: boolean; steps: string[]; backup?: unknown; result?: unknown; receipt?: { configPath?: string; file?: string; beforeBaseUrl?: string; afterBaseUrl?: string; beforeUrl?: string; afterUrl?: string; anthropicUrl?: string; beforeModel?: string; afterModel?: string; visibleModel?: string; realModel?: string; backupId: string; codexStateSnapshotId?: string; claudeStateSnapshotId?: string; envAction: string; restartRequired?: boolean; needRestart?: boolean }; error?: string; state: AppState }>;
  testConnection: (key: ProfileKey) => Promise<{ result: ConnectionResult; state: AppState }>;
  fetchThirdPartyModels: (profile: Profile) => Promise<{ result: { count: number; url: string; models: string[] }; state: AppState }>;
  resetCleanOpenAI: () => Promise<{ ok: boolean; backup?: { id: string }; cleared: string[]; state: AppState }>;
  restoreBackup: (id: string) => Promise<AppState>;
  deleteBackup: (id: string) => Promise<AppState>;
  openPath: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
  clearUsage: () => Promise<AppState>;
  clearLogs: () => Promise<AppState>;
  listChatRecords: () => Promise<ChatRecord[]>;
  deleteChatRecords: (ids: string[]) => Promise<{ result: { deleted: Array<{ id: string; path: string }>; skipped: Array<{ id: string; error: string }> }; state: AppState; records: ChatRecord[] }>;
  setCloseToTray: (enabled: boolean) => Promise<boolean>;
  acceptEula: (version: string) => Promise<AppState>;
  declineEula: () => Promise<void>;
  listCodexProcesses: () => Promise<Array<{ ProcessId: number; Name: string; CommandLine?: string }>>;
  stopCodexProcesses: (ids: number[]) => Promise<unknown>;
  detectCodexLaunch: () => Promise<LaunchDetection>;
  launchCodex: () => Promise<LaunchDetection>;
  detectClaudeCodeLaunch: () => Promise<LaunchDetection>;
  launchClaudeCode: () => Promise<LaunchDetection>;
  minimizeWindow: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  getWindowState: () => Promise<"maximized" | "normal">;
  onWindowState: (callback: (state: "maximized" | "normal") => void) => () => void;
  closeWindow: () => Promise<void>;
};

declare global {
  interface Window {
    api: WindowApi;
  }
}
