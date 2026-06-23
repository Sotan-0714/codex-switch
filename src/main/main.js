const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFile, spawn } = require("child_process");
const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, shell } = require("electron");

const codexConfig = require("./codexConfigService");
const claudeConfig = require("./claudeConfigService");
const codexConnection = require("./codexConnectionTest");
const claudeConnection = require("./claudeConnectionTest");
const { getOpenAIAuthStatus } = require("./codexAuthService");
const { getClaudeAuthStatus } = require("./claudeAuthService");
const codexProcess = require("./codexProcessService");
const claudeProcess = require("./claudeProcessService");
const codexAdapter = require("./codexAdapterService");
const claudeAdapter = require("./claudeAdapterService");
const { snapshotCodexState } = require("./codexStateService");
const { snapshotClaudeState } = require("./claudeStateService");
const chatRecords = require("./chatRecordService");
const { setUserEnvVar, deleteUserEnvVar } = require("./environmentService");
const { createLogger } = require("./logger");
const { createStore, defaults } = require("./store");

let mainWindow;
let tray;
let store;
let logger;
let backupRoots = {};
let stateSnapshotRoots = {};

app.setName("Apivot");
if (process.env.APIVOT_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.APIVOT_USER_DATA_DIR));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 720,
    frame: false,
    transparent: true,
    hasShadow: false,
    roundedCorners: true,
    titleBarStyle: "hidden",
    backgroundColor: "#00000000",
    icon: path.join(__dirname, "../assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererPath = path.join(__dirname, "../../renderer-dist/index.html");
  mainWindow.loadFile(rendererPath);

  mainWindow.on("maximize", () => mainWindow?.webContents.send("window:state", "maximized"));
  mainWindow.on("unmaximize", () => mainWindow?.webContents.send("window:state", "normal"));
  mainWindow.on("close", (event) => {
    if (storeDataCloseToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

let storeDataCloseToTray = false;

function createTray() {
  tray = new Tray(path.join(__dirname, "../assets/icon.ico"));
  tray.setToolTip("Apivot");
  const menu = Menu.buildFromTemplate([
    {
      label: "Show Apivot",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        storeDataCloseToTray = false;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.on("double-click", () => mainWindow?.show());
}

function getEngineKey(engine) {
  return engine === "claude" ? "claude" : "codex";
}

function wireUsageRecorders() {
  codexAdapter.setUsageRecorder((usage) => store.addUsage("codex", "thirdParty", usage));
  claudeAdapter.setUsageRecorder((usage) => store.addUsage("claude", "thirdParty", usage));
}

function getEngineConfig(engine) {
  return getEngineKey(engine) === "claude"
    ? {
        key: "claude",
        label: "Claude Code",
        config: claudeConfig,
        connection: claudeConnection,
        authStatus: getClaudeAuthStatus,
        adapter: claudeAdapter,
        process: claudeProcess,
        defaultConfigPath: claudeConfig.DEFAULT_CLAUDE_SETTINGS,
        backupRoot: backupRoots.claude,
        snapshotRoot: stateSnapshotRoots.claude
      }
    : {
        key: "codex",
        label: "Codex",
        config: codexConfig,
        connection: codexConnection,
        authStatus: getOpenAIAuthStatus,
        adapter: codexAdapter,
        process: codexProcess,
        defaultConfigPath: codexConfig.DEFAULT_CODEX_CONFIG,
        backupRoot: backupRoots.codex,
        snapshotRoot: stateSnapshotRoots.codex
      };
}

function getActiveEngineData(data) {
  const engine = getEngineKey(data.activeEngine);
  return data.engines[engine];
}

function getClaudeFacingModel(profile = {}) {
  const base = profile.claudeFacingModel || "claude-opus-4-8";
  return profile.enableOneMillionContext && !String(base).includes("[1m]") ? `${base}[1m]` : base;
}

function buildAdapterCodexProfile(profile, adapterStatus) {
  return {
    ...profile,
    name: "Apivot Local Adapter",
    providerId: "apivot_codex_adapter",
    baseUrl: adapterStatus.baseUrl,
    wireApi: "responses",
    updateEnv: false,
    noAuth: true,
    apiKey: "local-adapter"
  };
}

function buildAdapterClaudeProfile(profile, adapterStatus) {
  const claudeFacingModel = getClaudeFacingModel(profile);
  return {
    ...profile,
    name: "Apivot Claude Gateway",
    providerId: "apivot_claude_adapter",
    baseUrl: adapterStatus.baseUrl,
    model: claudeFacingModel,
    targetModel: profile.targetModel || profile.model,
    wireApi: "anthropic_messages",
    authEnvKey: "ANTHROPIC_AUTH_TOKEN",
    updateEnv: false,
    apiKey: "local-adapter",
    customModelOption: true,
    capabilities: profile.capabilities || defaults.engines.claude.profiles.thirdParty.capabilities
  };
}

async function readEngineState(data, engine) {
  const ctx = getEngineConfig(engine);
  const engineData = data.engines[ctx.key];
  const configPath = engineData.activeConfigPath || ctx.defaultConfigPath;
  const read = await ctx.config.readConfig(configPath);
  const backups = await ctx.config.listBackups(ctx.backupRoot);
  return {
    engine: ctx.key,
    label: ctx.label,
    configPath,
    read,
    backups,
    adapter: ctx.adapter.getAdapterStatus(),
    lastSwitch: engineData.lastSwitch,
    profiles: engineData.profiles,
    usageStats: engineData.usageStats,
    usageHistory: engineData.usageHistory
  };
}

async function getState() {
  const data = await store.load();
  storeDataCloseToTray = Boolean(data.settings?.closeToTray);
  const active = getEngineKey(data.activeEngine);
  const activeCtx = getEngineConfig(active);
  const activeState = await readEngineState(data, active);
  const codexState = active === "codex" ? activeState : await readEngineState(data, "codex");
  const claudeState = active === "claude" ? activeState : await readEngineState(data, "claude");
  const auth = active === "claude" ? await getClaudeAuthStatus() : await getOpenAIAuthStatus();
  const candidates = await activeCtx.config.findConfigCandidates(process.cwd());
  const activeData = getActiveEngineData(data);
  return {
    data: {
      ...data,
      activeEngine: active,
      activeEngineLabel: activeState.label,
      activeConfigPath: activeState.configPath,
      lastSwitch: activeState.lastSwitch,
      profiles: activeState.profiles,
      usageStats: activeState.usageStats,
      usageHistory: activeState.usageHistory,
      engines: data.engines,
      settings: data.settings,
      activeEngineData: activeData
    },
    auth,
    config: activeState.read,
    candidates,
    backups: activeState.backups,
    logs: await logger.list(),
    paths: {
      appDataDir: app.getPath("userData"),
      profilesFile: store.file,
      backupRoot: getEngineConfig(active).backupRoot,
      codexBackupRoot: backupRoots.codex,
      claudeBackupRoot: backupRoots.claude,
      codexStateSnapshotRoot: stateSnapshotRoots.codex,
      claudeStateSnapshotRoot: stateSnapshotRoots.claude,
      defaultConfigPath: getEngineConfig(active).defaultConfigPath
    },
    appInfo: {
      name: "Apivot",
      version: app.getVersion()
    },
    adapter: activeState.adapter,
    enginesStatus: {
      codex: {
        status: codexState.read.status,
        adapter: codexState.adapter,
        lastSwitch: codexState.lastSwitch
      },
      claude: {
        status: claudeState.read.status,
        adapter: claudeState.adapter,
        lastSwitch: claudeState.lastSwitch
      }
    }
  };
}

async function buildClaudeLaunchEnv() {
  const data = await store.load();
  const engineData = data.engines.claude;
  const configPath = engineData.activeConfigPath || claudeConfig.DEFAULT_CLAUDE_SETTINGS;
  const config = await claudeConfig.readConfig(configPath);
  const env = config.parsed?.env || {};
  const launchEnv = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("ANTHROPIC_") && !key.startsWith("CLAUDE_CODE_") && key !== "APIVOT_WIRE_API") continue;
    launchEnv[key] = value;
  }
  if (config.status.model) launchEnv.ANTHROPIC_MODEL = config.status.model;
  return launchEnv;
}

async function buildCodexLaunchEnv() {
  const data = await store.load();
  const engineData = data.engines.codex;
  const configPath = engineData.activeConfigPath || codexConfig.DEFAULT_CODEX_CONFIG;
  const config = await codexConfig.readConfig(configPath);
  const launchEnv = { ...process.env };
  const thirdParty = engineData.profiles.thirdParty || {};
  const openai = engineData.profiles.openai || {};
  const matchingProfile = config.status.mode === "third-party" || config.status.provider === (thirdParty.providerId || "third_party") ? thirdParty : openai;
  if (config.status.activeEnvKey && matchingProfile.apiKey) {
    launchEnv[config.status.activeEnvKey] = matchingProfile.apiKey;
  }
  return launchEnv;
}

function getLaunchCwd() {
  return process.env.USERPROFILE || os.homedir() || app.getPath("home") || path.parse(process.cwd()).root;
}

function assertCommandAvailable(command, env = process.env) {
  return new Promise((resolve, reject) => {
    execFile("where.exe", [command], { env, windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(new Error(`${command} was not found in PATH. Install it first, or add it to PATH and restart Apivot.`));
        return;
      }
      resolve(String(stdout || "").split(/\r?\n/).filter(Boolean)[0] || command);
    });
  });
}

function getAppxCodexInstallLocation(env = process.env) {
  return new Promise((resolve, reject) => {
    const script = "$pkg = Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1; if ($pkg) { $pkg.InstallLocation }";
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { env, windowsHide: true }, (error, stdout) => {
      const installLocation = String(stdout || "").trim();
      if (!error && installLocation) {
        resolve(installLocation);
        return;
      }
      reject(new Error("OpenAI.Codex AppX package was not found."));
    });
  });
}

function getWindowsAppsCodexTargets() {
  const roots = [
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WindowsApps"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "WindowsApps")
  ].filter(Boolean);
  const targets = [];

  const localAlias = path.join(roots[0] || "", "codex.exe");
  if (localAlias && fs.existsSync(localAlias)) {
    targets.push({ mode: "terminal", command: localAlias, label: localAlias });
  }

  const packageRoot = roots.find((item) => item.endsWith(`${path.sep}WindowsApps`) && item.includes("Program Files"));
  if (packageRoot && fs.existsSync(packageRoot)) {
    try {
      const dirs = fs.readdirSync(packageRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^OpenAI\.Codex_/i.test(entry.name))
        .map((entry) => path.join(packageRoot, entry.name))
        .sort((a, b) => {
          try {
            return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
          } catch {
            return 0;
          }
        });
      for (const dir of dirs) {
        const desktopExe = path.join(dir, "app", "Codex.exe");
        const cliExe = path.join(dir, "app", "resources", "codex.exe");
        if (fs.existsSync(desktopExe)) targets.push({ mode: "file", command: desktopExe, label: desktopExe });
        if (fs.existsSync(cliExe)) targets.push({ mode: "terminal", command: cliExe, label: cliExe });
      }
    } catch {
      // WindowsApps often denies directory enumeration to unpacked desktop apps.
    }
  }

  return targets;
}

function getPowerShellCommand(command, env = process.env) {
  return new Promise((resolve, reject) => {
    const script = `$cmd = Get-Command ${JSON.stringify(command)} -ErrorAction SilentlyContinue | Select-Object -First 1; if ($cmd) { $cmd.Source }`;
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { env, windowsHide: true }, (error, stdout) => {
      const value = String(stdout || "").trim();
      if (!error && value) {
        resolve(value);
        return;
      }
      reject(new Error(`${command} was not found by PowerShell Get-Command.`));
    });
  });
}

async function resolveCommandAvailable(command, env = process.env) {
  try {
    return await assertCommandAvailable(command, env);
  } catch {
    return getPowerShellCommand(command, env);
  }
}

async function resolveOptionalCommand(command, env = process.env) {
  try {
    return await resolveCommandAvailable(command, env);
  } catch {
    return "";
  }
}

async function resolveCodexLaunchTarget(env = process.env) {
  try {
    const command = await resolveCommandAvailable("codex.exe", env);
    const normalizedCommand = fs.existsSync(command) ? command : fs.existsSync(`${command}.exe`) ? `${command}.exe` : command;
    const desktopFromCli = normalizedCommand.replace(new RegExp(`${path.sep.replace("\\", "\\\\")}resources${path.sep.replace("\\", "\\\\")}codex(?:\\.exe)?$`, "i"), `${path.sep}Codex.exe`);
    if (desktopFromCli !== normalizedCommand && fs.existsSync(desktopFromCli)) {
      return { mode: "file", command: desktopFromCli, label: desktopFromCli };
    }
    return { mode: "terminal", command: normalizedCommand, label: normalizedCommand };
  } catch {
    try {
      const installLocation = await getAppxCodexInstallLocation(env);
      const desktopExe = path.join(installLocation, "app", "Codex.exe");
      const cliExe = path.join(installLocation, "app", "resources", "codex.exe");
      if (fs.existsSync(desktopExe)) return { mode: "file", command: desktopExe, label: desktopExe };
      if (fs.existsSync(cliExe)) return { mode: "terminal", command: cliExe, label: cliExe };
    } catch {
      // Continue through remaining local fallbacks.
    }
    const fallbackTargets = getWindowsAppsCodexTargets();
    const desktopTarget = fallbackTargets.find((item) => item.mode === "file");
    if (desktopTarget) return desktopTarget;
    const terminalTarget = fallbackTargets.find((item) => item.mode === "terminal");
    if (terminalTarget) return terminalTarget;
  }

  throw new Error("Codex was not found. Apivot checked PATH, PowerShell Get-Command, and WindowsApps OpenAI.Codex installation folders.");
}

function quoteCmd(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quotePowerShellSingle(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function startDetachedFile(file, options = {}) {
  const child = spawn(file, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    cwd: options.cwd || getLaunchCwd(),
    env: options.env || process.env
  });
  child.unref();
  return child;
}

async function startTerminal(commandLine, title, options = {}) {
  const cwd = options.cwd || getLaunchCwd();
  const shellPath = process.env.ComSpec || "cmd.exe";
  const terminalPath = await resolveOptionalCommand("wt.exe", options.env || process.env);
  if (terminalPath) {
    const child = spawn(terminalPath, ["-w", "0", "new-tab", "--title", title, "-d", cwd, shellPath, "/d", "/k", commandLine], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      cwd,
      env: options.env || process.env
    });
    child.unref();
    return child;
  }
  const script = [
    `$arguments = @('/d', '/k', ${quotePowerShellSingle(commandLine)})`,
    `Start-Process -FilePath ${quotePowerShellSingle(shellPath)} -ArgumentList $arguments -WorkingDirectory ${quotePowerShellSingle(cwd)} -WindowStyle Normal`
  ].join("; ");
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd,
    env: options.env || process.env
  });
  child.unref();
  return child;
}

async function detectCodexLaunch() {
  try {
    const launchEnv = await buildCodexLaunchEnv();
    const cwd = getLaunchCwd();
    const target = await resolveCodexLaunchTarget(launchEnv);
    return {
      ok: true,
      canAutoLaunch: true,
      engine: "codex",
      method: target.mode === "file" ? "desktop" : "terminal",
      command: target.command,
      mode: target.mode,
      cwd,
      checked: ["PATH codex.exe", "PowerShell Get-Command codex.exe", "OpenAI.Codex AppX install location", "WindowsApps aliases"]
    };
  } catch (error) {
    return {
      ok: false,
      canAutoLaunch: false,
      engine: "codex",
      error: error.message,
      manualCommand: "codex",
      manualMessage: 'Codex was not detected automatically. Open a terminal (or Start Menu) and run "codex" manually, then return to Apivot.',
      checked: ["PATH codex.exe", "PowerShell Get-Command codex.exe", "OpenAI.Codex AppX install location", "WindowsApps aliases"]
    };
  }
}

async function detectClaudeLaunch() {
  try {
    const launchEnv = await buildClaudeLaunchEnv();
    const cwd = getLaunchCwd();
    const command = await resolveCommandAvailable("claude.cmd", launchEnv);
    const terminal = await resolveOptionalCommand("wt.exe", launchEnv);
    return {
      ok: true,
      canAutoLaunch: true,
      engine: "claude",
      method: terminal ? "windows-terminal" : "cmd",
      command,
      terminal,
      cwd,
      checked: ["PATH claude.cmd", "PowerShell Get-Command claude.cmd", "Windows Terminal wt.exe"]
    };
  } catch (error) {
    return {
      ok: false,
      canAutoLaunch: false,
      engine: "claude",
      error: error.message,
      manualCommand: "claude.cmd",
      manualMessage: 'Claude Code was not detected automatically. Open a terminal and run "claude.cmd" manually, then return to Apivot.',
      checked: ["PATH claude.cmd", "PowerShell Get-Command claude.cmd", "Windows Terminal wt.exe"]
    };
  }
}

// Write the target profile and, if the write or its read-back verification
// fails, automatically restore the pre-switch backup so a failed switch never
// leaves the live config in a broken state. The original error is re-thrown
// (annotated with the rollback outcome) and carries a `rolledBack` flag.
async function writeWithRollback(configService, configPath, profileToWrite, mode, backup, backupRoot, engine, target, steps) {
  try {
    return await configService.writeConfigForProfile(configPath, profileToWrite, mode);
  } catch (writeError) {
    try {
      await configService.restoreBackup(backup.id, backupRoot, configPath);
      steps.push("Write failed; rolled back to pre-switch config");
      await logger.append("switch_rolled_back", { engine, target, configPath, backupId: backup.id, error: writeError.message });
      const err = new Error(`${writeError.message} (automatically rolled back to the pre-switch config)`);
      err.rolledBack = true;
      throw err;
    } catch (rollbackError) {
      if (rollbackError.rolledBack) throw rollbackError;
      steps.push("Write failed; automatic rollback also failed");
      await logger.append("switch_rollback_failed", { engine, target, configPath, backupId: backup.id, error: writeError.message, rollbackError: rollbackError.message });
      const err = new Error(`${writeError.message} (automatic rollback also failed: ${rollbackError.message})`);
      err.rolledBack = false;
      throw err;
    }
  }
}

async function applyCodexSwitch(data, target, steps) {
  const engineData = data.engines.codex;
  const profile = target === "openai" ? engineData.profiles.openai : engineData.profiles.thirdParty;
  const configPath = engineData.activeConfigPath || codexConfig.DEFAULT_CODEX_CONFIG;
  steps.push("Read current Codex config");
  const beforeRead = await codexConfig.readConfig(configPath);
  const backup = await codexConfig.backupConfig(configPath, backupRoots.codex);
  steps.push("Create switch backup");
  const codexStateSnapshot = await snapshotCodexState(configPath, stateSnapshotRoots.codex, target);
  steps.push("Protect Codex auth and conversation state");
  if (target === "openai" && profile.authMode !== "api") {
    const auth = await getOpenAIAuthStatus();
    if (!auth.hasChatGptSession) throw new Error("No Codex ChatGPT login was detected. Sign in to Codex with ChatGPT first.");
    await codexAdapter.stopAdapter();
    for (const envName of ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", engineData.profiles.thirdParty.envKey, "THIRD_PARTY_API_KEY"].filter(Boolean)) {
      await deleteUserEnvVar(envName);
    }
    steps.push("Use existing Codex ChatGPT login; no API key required");
  } else if (target === "thirdParty") {
    let adapterProfile = profile;
    if (profile.wireApi === "responses") {
      steps.push("Verify Responses API compatibility required by Codex");
      const compatibility = await codexConnection.testCodexCompatibility(profile);
      if (!compatibility.codexCompatible) {
        steps.push("Responses API failed; test local adapter fallback through Chat Completions");
        const chatFallback = await codexConnection.testConnection({ ...profile, wireApi: "chat_completions" });
        if (!chatFallback.ok) throw new Error(compatibility.compatibilityError || chatFallback.error || "The provider is not compatible with Codex.");
        adapterProfile = { ...profile, wireApi: "chat_completions" };
      }
    } else {
      steps.push("Verify Chat Completions endpoint for local Codex adapter");
      const chatFallback = await codexConnection.testConnection({ ...profile, wireApi: "chat_completions" });
      if (!chatFallback.ok) throw new Error(chatFallback.error || "The provider is not reachable through Chat Completions.");
    }
    const adapterStatus = await codexAdapter.startAdapter(adapterProfile);
    steps.push(`Start local usage-tracking Codex adapter at ${adapterStatus.baseUrl}`);
  }
  if ((target !== "openai" || profile.authMode === "api") && profile.updateEnv && !codexAdapter.getAdapterStatus().running) {
    await setUserEnvVar(profile.envKey, profile.apiKey);
    steps.push(`Write API key to user environment variable ${profile.envKey}`);
  }
  const activeAdapter = target === "thirdParty" && codexAdapter.getAdapterStatus().running ? codexAdapter.getAdapterStatus() : null;
  const profileToWrite = activeAdapter ? buildAdapterCodexProfile(profile, activeAdapter) : profile;
  const result = await writeWithRollback(codexConfig, configPath, profileToWrite, target === "openai" ? "openai" : "thirdParty", backup, backupRoots.codex, "codex", target, steps);
  steps.push("Write target profile");
  const afterRead = await codexConfig.readConfig(configPath);
  const processes = await codexProcess.listCodexProcesses();
  const lastSwitch = {
    at: new Date().toISOString(),
    target,
    engine: "codex",
    configPath,
    status: afterRead.status,
    backupId: backup.id,
    codexStateSnapshotId: codexStateSnapshot.id,
    processCount: processes.length,
    success: true
  };
  await store.saveActiveEnginePatch("codex", { lastSwitch });
  await logger.append("switch_success", { engine: "codex", target, configPath, backup, codexStateSnapshot, result, envConflicts: afterRead.status.envConflicts });
  return {
    ok: true,
    engine: "codex",
    steps,
    backup,
    result,
    before: beforeRead.status,
    after: afterRead.status,
    processCount: processes.length,
    receipt: {
      file: configPath,
      beforeUrl: beforeRead.status.baseUrl,
      afterUrl: afterRead.status.baseUrl,
      model: afterRead.status.model,
      backupId: backup.id,
      codexStateSnapshotId: codexStateSnapshot.id,
      envAction: activeAdapter ? `Started local adapter: ${activeAdapter.baseUrl} -> ${profile.baseUrl}` : target === "openai" && profile.authMode !== "api" ? "Used existing ChatGPT login and cleared API overrides" : profile.updateEnv ? `Updated ${profile.envKey}` : "Skipped environment variable write",
      needRestart: processes.length > 0
    }
  };
}

async function applyClaudeSwitch(data, target, steps) {
  const engineData = data.engines.claude;
  const profile = target === "openai" ? engineData.profiles.openai : engineData.profiles.thirdParty;
  const configPath = engineData.activeConfigPath || claudeConfig.DEFAULT_CLAUDE_SETTINGS;
  steps.push("Read current Claude Code settings");
  const beforeRead = await claudeConfig.readConfig(configPath);
  const backup = await claudeConfig.backupConfig(configPath, backupRoots.claude);
  steps.push("Create switch backup");
  const claudeStateSnapshot = await snapshotClaudeState(configPath, stateSnapshotRoots.claude, target);
  steps.push("Protect Claude Code auth and lightweight state");
  if (target === "openai") {
    const auth = await getClaudeAuthStatus();
    steps.push(auth.signedIn ? "Keep existing Claude Code login; no API key override required" : "No Claude Code login was detected; official mode will use Claude Code's normal login flow");
    await claudeAdapter.stopAdapter();
    for (const envName of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL", "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY"]) {
      await deleteUserEnvVar(envName);
    }
  } else if (target === "thirdParty") {
    if (profile.wireApi === "openai_chat_adapter") {
      steps.push("Endpoint is Chat Completions adapter; force local Anthropic Messages adapter");
      const chatFallback = await claudeConnection.testConnection({ ...profile, wireApi: "openai_chat_adapter" });
      if (!chatFallback.ok) throw new Error(chatFallback.error || "Chat Completions adapter endpoint is not reachable.");
      const adapterStatus = await claudeAdapter.startAdapter(profile);
      steps.push(`Start local Anthropic Messages adapter at ${adapterStatus.baseUrl}`);
    } else {
      steps.push("Verify Anthropic Messages compatibility required by Claude Code");
      const compatibility = await claudeConnection.testClaudeCompatibility(profile);
      if (!compatibility.claudeCompatible) {
        steps.push("Messages API failed; test local adapter fallback through Chat Completions");
        const chatFallback = await claudeConnection.testConnection({ ...profile, wireApi: "openai_chat_adapter" });
        if (!chatFallback.ok) throw new Error(compatibility.compatibilityError || chatFallback.error || "The provider is not compatible with Claude Code.");
        const adapterStatus = await claudeAdapter.startAdapter(profile);
        steps.push(`Start local Anthropic Messages adapter at ${adapterStatus.baseUrl}`);
      } else {
        await claudeAdapter.stopAdapter();
      }
    }
  }
  if (target !== "openai" && profile.updateEnv && !claudeAdapter.getAdapterStatus().running) {
    await setUserEnvVar(profile.envKey, profile.apiKey);
    steps.push(`Write API key to user environment variable ${profile.envKey}`);
  }
  const activeAdapter = target === "thirdParty" && claudeAdapter.getAdapterStatus().running ? claudeAdapter.getAdapterStatus() : null;
  const profileToWrite = activeAdapter ? buildAdapterClaudeProfile(profile, activeAdapter) : profile;
  const result = await writeWithRollback(claudeConfig, configPath, profileToWrite, target === "openai" ? "official" : "thirdParty", backup, backupRoots.claude, "claude", target, steps);
  steps.push("Write target profile");
  const afterRead = await claudeConfig.readConfig(configPath);
  const processes = await claudeProcess.listClaudeProcesses();
  const lastSwitch = {
    at: new Date().toISOString(),
    target,
    engine: "claude",
    configPath,
    status: afterRead.status,
    backupId: backup.id,
    claudeStateSnapshotId: claudeStateSnapshot.id,
    processCount: processes.length,
    success: true
  };
  await store.saveActiveEnginePatch("claude", { lastSwitch });
  await logger.append("switch_success", { engine: "claude", target, configPath, backup, claudeStateSnapshot, result, envConflicts: afterRead.status.envConflicts });
  return {
    ok: true,
    engine: "claude",
    steps,
    backup,
    result,
    before: beforeRead.status,
    after: afterRead.status,
    processCount: processes.length,
    receipt: {
      file: configPath,
      anthropicUrl: afterRead.status.baseUrl,
      visibleModel: afterRead.status.model,
      realModel: profile.targetModel || profile.model,
      capabilities: profileToWrite.capabilities || "",
      backupId: backup.id,
      claudeStateSnapshotId: claudeStateSnapshot.id,
      envAction: activeAdapter ? `Started local adapter: ${activeAdapter.baseUrl} -> ${profile.baseUrl}` : target === "openai" ? "Used official Claude Code login path and cleared API overrides" : profile.updateEnv ? `Updated ${profile.envKey}` : "Skipped environment variable write",
      needRestart: processes.length > 0
    }
  };
}

function registerHandlers() {
  ipcMain.handle("state:get", async () => getState());

  ipcMain.handle("engine:setActive", async (_event, engine) => {
    await store.setActiveEngine(engine);
    await logger.append("engine_selected", { engine: getEngineKey(engine) });
    return getState();
  });

  ipcMain.handle("config:select", async () => {
    const data = await store.load();
    const ctx = getEngineConfig(data.activeEngine);
    const result = await dialog.showOpenDialog(mainWindow, {
      title: ctx.key === "claude" ? "Select Claude Code settings.json" : "Select Codex config.toml",
      filters: ctx.key === "claude" ? [{ name: "Claude settings", extensions: ["json"] }] : [{ name: "Codex config", extensions: ["toml"] }],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    await store.saveActiveEnginePatch(ctx.key, { activeConfigPath: result.filePaths[0] });
    return getState();
  });

  ipcMain.handle("config:setPath", async (_event, configPath) => {
    const data = await store.load();
    await store.saveActiveEnginePatch(data.activeEngine, { activeConfigPath: configPath });
    await logger.append("config_path_set", { engine: data.activeEngine, configPath });
    return getState();
  });

  ipcMain.handle("profiles:save", async (_event, profiles) => {
    const data = await store.load();
    await store.saveActiveEnginePatch(data.activeEngine, { profiles });
    await logger.append("profiles_saved", { engine: data.activeEngine, profiles });
    return getState();
  });

  ipcMain.handle("profiles:reset", async (_event, key) => {
    const data = await store.load();
    await store.resetProfile(data.activeEngine, key);
    await logger.append("profile_reset", { engine: data.activeEngine, key });
    return getState();
  });

  ipcMain.handle("switch:apply", async (_event, target) => {
    const data = await store.load();
    const engine = getEngineKey(data.activeEngine);
    const steps = [];
    try {
      const result = engine === "claude" ? await applyClaudeSwitch(data, target, steps) : await applyCodexSwitch(data, target, steps);
      return { ...result, state: await getState() };
    } catch (error) {
      await logger.append("switch_failed", { engine, target, steps, error: error.message, rolledBack: Boolean(error.rolledBack) });
      return { ok: false, engine, steps, error: error.message, rolledBack: Boolean(error.rolledBack), state: await getState() };
    }
  });

  ipcMain.handle("test:connection", async (_event, key) => {
    const data = await store.load();
    const engine = getEngineKey(data.activeEngine);
    const engineData = data.engines[engine];
    const profile = key === "openai" ? engineData.profiles.openai : engineData.profiles.thirdParty;
    let result;
    if (engine === "codex") {
      if (key === "openai" && profile.authMode !== "api") {
        const auth = await getOpenAIAuthStatus();
        result = { ok: auth.hasChatGptSession, authMode: "chatgpt", codexCompatible: auth.hasChatGptSession, url: "Codex ChatGPT session", model: profile.model, error: auth.hasChatGptSession ? "" : "No active Codex ChatGPT session was detected." };
      } else if (key === "thirdParty") {
        result = await codexConnection.testCodexCompatibility(profile);
        if (!result.codexCompatible) {
          const chatFallback = await codexConnection.testConnection({ ...profile, wireApi: "chat_completions" });
          result = { ...result, adapterAvailable: Boolean(chatFallback.ok), chatFallbackStatus: chatFallback.status, chatFallbackUrl: chatFallback.url, chatFallbackError: chatFallback.error || "", adapterStatus: codexAdapter.getAdapterStatus() };
        }
      } else {
        result = { ...(await codexConnection.testConnection(profile)), authMode: "api" };
      }
    } else {
      if (key === "openai") {
        const auth = await getClaudeAuthStatus();
        result = { ok: auth.signedIn, authMode: "chatgpt", claudeCompatible: auth.signedIn, url: "Claude Code official login/settings", model: profile.model, error: auth.signedIn ? "" : "No Claude Code login or API credential was detected. Run claude.cmd and complete sign-in." };
      } else if (key === "thirdParty") {
        result = await claudeConnection.testClaudeCompatibility(profile);
        if (!result.claudeCompatible) {
          const chatFallback = await claudeConnection.testConnection({ ...profile, wireApi: "openai_chat_adapter" });
          result = { ...result, adapterAvailable: Boolean(chatFallback.ok), chatFallbackStatus: chatFallback.status, chatFallbackUrl: chatFallback.url, chatFallbackError: chatFallback.error || "", adapterStatus: claudeAdapter.getAdapterStatus() };
        }
      } else {
        result = { ...(await claudeConnection.testConnection(profile)), authMode: "api" };
      }
    }
    if (result?.usage) {
      await store.addUsage(engine, key, { ...result.usage, model: result.model || profile.model, status: "test" });
    }
    await logger.append("connection_test", { engine, profile: key, result });
    return { result, state: await getState() };
  });

  ipcMain.handle("reset:cleanOpenAI", async () => {
    const data = await store.load();
    const engine = getEngineKey(data.activeEngine);
    const engineData = data.engines[engine];
    if (engine === "claude") {
      const configPath = engineData.activeConfigPath || claudeConfig.DEFAULT_CLAUDE_SETTINGS;
      const officialProfile = { ...defaults.engines.claude.profiles.openai, ...(engineData.profiles.openai || {}) };
      await claudeConfig.writeCleanOfficialConfig(configPath, officialProfile.model);
      await claudeAdapter.stopAdapter();
      for (const envName of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL", "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY"]) {
        await deleteUserEnvVar(envName);
      }
      await store.saveActiveEnginePatch("claude", { lastSwitch: { at: new Date().toISOString(), target: "openai", engine: "claude", configPath, cleanReset: true } });
      await logger.append("clean_reset", { engine: "claude", configPath });
    } else {
      const configPath = engineData.activeConfigPath || codexConfig.DEFAULT_CODEX_CONFIG;
      const openaiProfile = { ...defaults.engines.codex.profiles.openai, ...(engineData.profiles.openai || {}) };
      await codexConfig.writeCleanOpenAIConfig(configPath, openaiProfile.model);
      await codexAdapter.stopAdapter();
      for (const envName of ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", engineData.profiles.thirdParty.envKey, "APIVOT_THIRD_PARTY_API_KEY", "CODEX_SWITCHER_THIRD_PARTY_API_KEY", "THIRD_PARTY_API_KEY"].filter(Boolean)) {
        await deleteUserEnvVar(envName);
      }
      await store.saveActiveEnginePatch("codex", { lastSwitch: { at: new Date().toISOString(), target: "openai", engine: "codex", configPath, cleanReset: true } });
      await logger.append("clean_reset", { engine: "codex", configPath });
    }
    return { ok: true, state: await getState() };
  });

  ipcMain.handle("models:fetchThirdParty", async (_event, profileFromUi) => {
    const data = await store.load();
    const engine = getEngineKey(data.activeEngine);
    const service = engine === "claude" ? claudeConnection : codexConnection;
    const profile = { ...data.engines[engine].profiles.thirdParty, ...(profileFromUi || {}) };
    const result = await service.fetchModels(profile);
    const profiles = {
      ...data.engines[engine].profiles,
      thirdParty: {
        ...profile,
        modelOptions: result.models,
        model: result.models.includes(profile.model) ? profile.model : result.models[0] || profile.model
      }
    };
    if (engine === "claude") {
      profiles.thirdParty.targetModel = profiles.thirdParty.model;
    }
    await store.saveActiveEnginePatch(engine, { profiles });
    await logger.append("models_fetched", { engine, provider: "thirdParty", baseUrl: profile.baseUrl, count: result.count, url: result.url });
    return { result, state: await getState() };
  });

  ipcMain.handle("backup:restore", async (_event, id) => {
    const data = await store.load();
    const ctx = getEngineConfig(data.activeEngine);
    const configPath = data.engines[ctx.key].activeConfigPath || ctx.defaultConfigPath;
    const restored = await ctx.config.restoreBackup(id, ctx.backupRoot, configPath);
    await store.saveActiveEnginePatch(ctx.key, { lastSwitch: { at: new Date().toISOString(), target: "restore", engine: ctx.key, configPath, backupId: id } });
    await logger.append("backup_restored", { engine: ctx.key, id, configPath, restored });
    return getState();
  });

  ipcMain.handle("backup:delete", async (_event, id) => {
    const data = await store.load();
    const ctx = getEngineConfig(data.activeEngine);
    await ctx.config.deleteBackup(id, ctx.backupRoot);
    await logger.append("backup_deleted", { engine: ctx.key, id });
    return getState();
  });

  ipcMain.handle("path:open", async (_event, targetPath) => {
    if (!targetPath) return false;
    await shell.openPath(targetPath);
    return true;
  });

  ipcMain.handle("usage:clear", async () => {
    const data = await store.load();
    await store.clearUsage(data.activeEngine);
    await logger.append("usage_cleared", { engine: data.activeEngine });
    return getState();
  });

  ipcMain.handle("logs:clear", async () => {
    await logger.clear();
    return getState();
  });

  ipcMain.handle("chatRecords:list", async () => {
    return chatRecords.listChatRecords();
  });

  ipcMain.handle("chatRecords:delete", async (_event, ids) => {
    const result = await chatRecords.deleteChatRecords(Array.isArray(ids) ? ids : []);
    await logger.append("chat_records_deleted", result);
    return { result, state: await getState(), records: await chatRecords.listChatRecords() };
  });

  ipcMain.handle("settings:closeToTray", async (_event, enabled) => {
    const data = await store.load();
    data.settings.closeToTray = Boolean(enabled);
    await store.save(data);
    storeDataCloseToTray = Boolean(enabled);
    return getState();
  });

  ipcMain.handle("eula:accept", async (_event, version) => {
    const data = await store.load();
    data.eulaAcceptance = { version, acceptedAt: new Date().toISOString() };
    await store.save(data);
    await logger.append("eula_accepted", { version });
    return getState();
  });

  ipcMain.handle("eula:decline", () => {
    app.quit();
    return true;
  });

  ipcMain.handle("codex:listProcesses", async () => {
    const data = await store.load();
    const engine = getEngineKey(data.activeEngine);
    const processes = engine === "claude" ? await claudeProcess.listClaudeProcesses() : await codexProcess.listCodexProcesses();
    await logger.append("process_scan", { engine, count: processes.length });
    return processes;
  });

  ipcMain.handle("codex:stopProcesses", async (_event, ids) => {
    const data = await store.load();
    const engine = getEngineKey(data.activeEngine);
    const stopped = engine === "claude" ? await claudeProcess.stopProcesses(ids) : await codexProcess.stopProcesses(ids);
    await logger.append("process_stop", { engine, stopped });
    return stopped;
  });

  ipcMain.handle("codex:detectLaunch", async () => {
    const result = await detectCodexLaunch();
    await logger.append("codex_launch_detected", result);
    return result;
  });

  ipcMain.handle("codex:launch", async () => {
    try {
      const detection = await detectCodexLaunch();
      if (!detection.canAutoLaunch) return detection;
      const launchEnv = await buildCodexLaunchEnv();
      const cwd = detection.cwd || getLaunchCwd();
      const target = { mode: detection.mode, command: detection.command };
      if (target.mode === "file") {
        startDetachedFile(target.command, { cwd, env: launchEnv });
      } else {
        await startTerminal(quoteCmd(target.command), "Codex", { cwd, env: launchEnv });
      }
      await logger.append("codex_launched", { command: target.command, mode: target.mode, method: detection.method, cwd, injectedEnv: true });
      return { ...detection, ok: true, launched: true, cwd };
    } catch (error) {
      await logger.append("codex_launch_failed", { error: error.message });
      return {
        ok: false,
        canAutoLaunch: false,
        engine: "codex",
        error: error.message,
        manualCommand: "codex",
        manualMessage: 'Codex could not be started automatically. Open a terminal and run "codex" manually, then return to Apivot.'
      };
    }
  });

  ipcMain.handle("claude:detectLaunch", async () => {
    const result = await detectClaudeLaunch();
    await logger.append("claude_launch_detected", result);
    return result;
  });

  ipcMain.handle("claude:launch", async () => {
    try {
      const detection = await detectClaudeLaunch();
      if (!detection.canAutoLaunch) return detection;
      const launchEnv = await buildClaudeLaunchEnv();
      const cwd = detection.cwd || getLaunchCwd();
      await startTerminal(quoteCmd(detection.command), "Claude Code", { cwd, env: launchEnv });
      await logger.append("claude_launched", { command: detection.command, method: detection.method, cwd, injectedEnv: true });
      return { ...detection, ok: true, launched: true, cwd };
    } catch (error) {
      await logger.append("claude_launch_failed", { error: error.message });
      return {
        ok: false,
        canAutoLaunch: false,
        engine: "claude",
        error: error.message,
        manualCommand: "claude.cmd",
        manualMessage: 'Claude Code could not be started automatically. Open a terminal and run "claude.cmd" manually, then return to Apivot.'
      };
    }
  });

  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("toggle-maximize", () => {
    if (!mainWindow) return "normal";
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return "normal";
    }
    mainWindow.maximize();
    return "maximized";
  });

  ipcMain.handle("get-window-state", () => (mainWindow?.isMaximized() ? "maximized" : "normal"));

  ipcMain.handle("window:close", () => {
    if (storeDataCloseToTray) mainWindow?.hide();
    else app.quit();
  });
}

app.whenReady().then(async () => {
  const appDataDir = app.getPath("userData");
  backupRoots = {
    codex: path.join(appDataDir, "codex-backups"),
    claude: path.join(appDataDir, "claude-code-backups")
  };
  stateSnapshotRoots = {
    codex: path.join(appDataDir, "codex-state-snapshots"),
    claude: path.join(appDataDir, "claude-code-state-snapshots")
  };
  store = createStore(appDataDir);
  logger = createLogger(appDataDir);
  wireUsageRecorders();
  const data = await store.load();
  storeDataCloseToTray = Boolean(data.settings?.closeToTray);
  registerHandlers();
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
