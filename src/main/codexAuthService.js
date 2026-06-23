const fs = require("fs/promises");
const path = require("path");
const os = require("os");

function getAuthFile() {
  return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "auth.json");
}

async function getOpenAIAuthStatus() {
  try {
    const parsed = JSON.parse(await fs.readFile(getAuthFile(), "utf8"));
    const mode = parsed.auth_mode === "chatgpt" ? "chatgpt" : parsed.OPENAI_API_KEY ? "api" : parsed.auth_mode || "unknown";
    return {
      mode,
      signedIn: mode === "chatgpt" ? Boolean(parsed.tokens) : mode === "api" ? Boolean(parsed.OPENAI_API_KEY) : false,
      hasChatGptSession: Boolean(parsed.tokens),
      hasApiKeySession: Boolean(parsed.OPENAI_API_KEY),
      source: "auth.json"
    };
  } catch {
    return {
      mode: "unknown",
      signedIn: false,
      hasChatGptSession: false,
      hasApiKeySession: false,
      source: "none"
    };
  }
}

module.exports = { getOpenAIAuthStatus, getAuthFile };
