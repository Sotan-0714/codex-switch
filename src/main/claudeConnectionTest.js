function joinUrl(baseUrl, endpoint) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

const REQUEST_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function modelRank(id) {
  const value = String(id || "").toLowerCase();
  if (value.startsWith("claude") || value === "sonnet" || value === "opus" || value === "haiku") return 0;
  if (value.startsWith("gpt")) return 1;
  return 2;
}

function sortModels(models) {
  return [...new Set((models || []).filter(Boolean))]
    .sort((a, b) => modelRank(a) - modelRank(b) || String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0;
  const totalTokens = usage.total_tokens ?? usage.totalTokens ?? inputTokens + outputTokens;
  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return { inputTokens, outputTokens, totalTokens, requests: 1 };
}

function authHeaders(profile) {
  const headers = { "Content-Type": "application/json", ...(profile.headers || {}) };
  if (profile.authEnvKey === "ANTHROPIC_API_KEY") {
    headers["x-api-key"] = profile.apiKey;
  } else {
    headers.Authorization = `Bearer ${profile.apiKey}`;
  }
  headers["anthropic-version"] = headers["anthropic-version"] || "2023-06-01";
  return headers;
}

function openAiHeaders(profile) {
  return {
    Authorization: `Bearer ${profile.apiKey}`,
    "Content-Type": "application/json",
    ...(profile.headers || {})
  };
}

async function fetchModels(profile) {
  if (!profile?.apiKey) throw new Error("API Key / Auth Token is required.");
  if (!profile?.baseUrl) throw new Error("Base URL is required.");
  const url = joinUrl(profile.baseUrl, "/models");
  const response = await fetchWithTimeout(url, {
    headers: profile.wireApi === "anthropic_messages" ? authHeaders(profile) : openAiHeaders(profile)
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  if (!response.ok) throw new Error(parsed?.error?.message || parsed?.message || text.slice(0, 500) || `HTTP ${response.status}`);
  const models = sortModels((parsed.data || []).map((item) => item.id || item.name || item.model));
  return { ok: true, status: response.status, count: models.length, models, url };
}

async function testAnthropicMessages(profile) {
  if (!profile?.apiKey) throw new Error("API Key / Auth Token is required.");
  if (!profile?.baseUrl) throw new Error("Base URL is required.");
  if (!profile?.model) throw new Error("Model is required.");
  const url = joinUrl(profile.baseUrl, "/messages");
  const started = Date.now();
  let response;
  let text = "";
  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      headers: authHeaders(profile),
      body: JSON.stringify({
        model: profile.model,
        max_tokens: 16,
        messages: [{ role: "user", content: "ping" }]
      })
    });
    text = await response.text();
  } catch (error) {
    return { ok: false, status: 0, error: error.message, baseUrl: profile.baseUrl, model: profile.model, wireApi: "anthropic_messages", url, durationMs: Date.now() - started };
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { message: text.slice(0, 1000) }; }
  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? "" : parsed?.error?.message || parsed?.message || text.slice(0, 1000),
    usage: normalizeUsage(parsed?.usage),
    baseUrl: profile.baseUrl,
    model: profile.model,
    wireApi: "anthropic_messages",
    url,
    durationMs: Date.now() - started
  };
}

async function testOpenAiChat(profile) {
  if (!profile?.apiKey) throw new Error("API Key / Auth Token is required.");
  if (!profile?.baseUrl) throw new Error("Base URL is required.");
  if (!profile?.model) throw new Error("Model is required.");
  const url = joinUrl(profile.baseUrl, "/chat/completions");
  const started = Date.now();
  let response;
  let text = "";
  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      headers: openAiHeaders(profile),
      body: JSON.stringify({
        model: profile.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 16
      })
    });
    text = await response.text();
  } catch (error) {
    return { ok: false, status: 0, error: error.message, baseUrl: profile.baseUrl, model: profile.model, wireApi: "openai_chat", url, durationMs: Date.now() - started };
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { message: text.slice(0, 1000) }; }
  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? "" : parsed?.error?.message || parsed?.message || text.slice(0, 1000),
    usage: normalizeUsage(parsed?.usage),
    baseUrl: profile.baseUrl,
    model: profile.model,
    wireApi: "openai_chat",
    url,
    durationMs: Date.now() - started
  };
}

async function testConnection(profile) {
  if (profile?.wireApi === "anthropic_messages") return testAnthropicMessages(profile);
  return testOpenAiChat(profile);
}

async function testClaudeCompatibility(profile) {
  const messagesResult = await testAnthropicMessages({ ...profile, wireApi: "anthropic_messages" });
  if (messagesResult.ok) {
    return { ...messagesResult, claudeCompatible: true, adapterAvailable: false, compatibilityError: "" };
  }
  const chatFallback = await testOpenAiChat(profile);
  return {
    ...messagesResult,
    claudeCompatible: false,
    compatibilityStatus: messagesResult.status,
    compatibilityUrl: messagesResult.url,
    compatibilityError: messagesResult.error || `Anthropic Messages API returned HTTP ${messagesResult.status}.`,
    adapterAvailable: Boolean(chatFallback.ok),
    chatFallbackStatus: chatFallback.status,
    chatFallbackUrl: chatFallback.url,
    chatFallbackError: chatFallback.error || ""
  };
}

module.exports = { testConnection, testClaudeCompatibility, fetchModels, sortModels, normalizeUsage };
