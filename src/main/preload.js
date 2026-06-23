const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getState: () => ipcRenderer.invoke("state:get"),
  setActiveEngine: (engine) => ipcRenderer.invoke("engine:setActive", engine),
  selectConfig: () => ipcRenderer.invoke("config:select"),
  setConfigPath: (path) => ipcRenderer.invoke("config:setPath", path),
  saveProfiles: (profiles) => ipcRenderer.invoke("profiles:save", profiles),
  resetProfile: (key) => ipcRenderer.invoke("profiles:reset", key),
  applySwitch: (target) => ipcRenderer.invoke("switch:apply", target),
  testConnection: (key) => ipcRenderer.invoke("test:connection", key),
  fetchThirdPartyModels: (profile) => ipcRenderer.invoke("models:fetchThirdParty", profile),
  resetCleanOpenAI: () => ipcRenderer.invoke("reset:cleanOpenAI"),
  restoreBackup: (id) => ipcRenderer.invoke("backup:restore", id),
  deleteBackup: (id) => ipcRenderer.invoke("backup:delete", id),
  openPath: (targetPath) => ipcRenderer.invoke("path:open", targetPath),
  clearUsage: () => ipcRenderer.invoke("usage:clear"),
  clearLogs: () => ipcRenderer.invoke("logs:clear"),
  listChatRecords: () => ipcRenderer.invoke("chatRecords:list"),
  deleteChatRecords: (ids) => ipcRenderer.invoke("chatRecords:delete", ids),
  setCloseToTray: (enabled) => ipcRenderer.invoke("settings:closeToTray", enabled),
  acceptEula: (version) => ipcRenderer.invoke("eula:accept", version),
  declineEula: () => ipcRenderer.invoke("eula:decline"),
  listCodexProcesses: () => ipcRenderer.invoke("codex:listProcesses"),
  stopCodexProcesses: (ids) => ipcRenderer.invoke("codex:stopProcesses", ids),
  detectCodexLaunch: () => ipcRenderer.invoke("codex:detectLaunch"),
  launchCodex: () => ipcRenderer.invoke("codex:launch"),
  detectClaudeCodeLaunch: () => ipcRenderer.invoke("claude:detectLaunch"),
  launchClaudeCode: () => ipcRenderer.invoke("claude:launch"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("toggle-maximize"),
  getWindowState: () => ipcRenderer.invoke("get-window-state"),
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("window:state", listener);
    return () => ipcRenderer.removeListener("window:state", listener);
  },
  closeWindow: () => ipcRenderer.invoke("window:close")
});
