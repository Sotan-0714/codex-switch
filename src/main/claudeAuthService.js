const fs = require("fs/promises");
const path = require("path");
const os = require("os");

function getClaudeStateFile() {
  return path.join(os.homedir(), ".claude.json");
}

function getClaudeSettingsFile() {
  return path.join(os.homedir(), ".claude", "settings.json");
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function getClaudeAuthStatus() {
  const state = await readJson(getClaudeStateFile());
  const settings = await readJson(getClaudeSettingsFile());
  const env = settings?.env || {};
  const hasApiKeySession = Boolean(env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY);
  const hasAuthToken = Boolean(env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN);
  const hasState = Boolean(state);
  return {
    mode: hasAuthToken ? "auth-token" : hasApiKeySession ? "api-key" : hasState ? "claude-account" : "unknown",
    signedIn: hasAuthToken || hasApiKeySession || hasState,
    hasChatGptSession: false,
    hasApiKeySession,
    hasClaudeSession: hasState,
    source: hasState ? ".claude.json" : hasApiKeySession || hasAuthToken ? "settings/env" : "none"
  };
}

module.exports = { getClaudeAuthStatus, getClaudeStateFile, getClaudeSettingsFile };
