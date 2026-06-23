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
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function modelRank(id) {
  const value = String(id || "").toLowerCase();
  if (value.startsWith("gpt")) return 0;
  if (value.startsWith("claude") || value.startsWith("claue")) return 1;
  return 2;
}

function sortModels(models) {
  return [...new Set((models || []).filter(Boolean))]
    .sort((a, b) => modelRank(a) - modelRank(b) || String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }));
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function extractUsage(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.usage || payload.response?.usage || payload.delta?.usage || payload.message?.usage || null;
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = firstNumber(usage.input_tokens, usage.prompt_tokens, usage.inputTokens, usage.promptTokens);
  const outputTokens = firstNumber(usage.output_tokens, usage.completion_tokens, usage.outputTokens, usage.completionTokens);
  const totalTokens = firstNumber(usage.total_tokens, usage.totalTokens, usage.total, inputTokens + outputTokens);
  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return { inputTokens, outputTokens, totalTokens, requests: 1 };
}

async function fetchModels(profile) {
  if (!profile?.apiKey) throw new Error("API Key is required.");
  if (!profile?.baseUrl) throw new Error("Base URL is required.");

  const url = joinUrl(profile.baseUrl, "/models");
  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
      ...(profile.headers || {})
    }
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    throw new Error(parsed?.error?.message || parsed?.message || text.slice(0, 500) || `HTTP ${response.status}`);
  }

  const models = sortModels((parsed.data || []).map((item) => item.id || item.name));
  return {
    ok: true,
    status: response.status,
    count: models.length,
    models,
    url
  };
}

async function testConnection(profile) {
  if (!profile?.apiKey) throw new Error("API Key is required.");
  if (!profile?.baseUrl) throw new Error("Base URL is required.");
  if (!profile?.model) throw new Error("Model is required.");

  const wireApi = profile.wireApi || "responses";
  const isChat = wireApi === "chat_completions" || wireApi === "chat";
  const url = joinUrl(profile.baseUrl, isChat ? "/chat/completions" : "/responses");
  const headers = {
    Authorization: `Bearer ${profile.apiKey}`,
    "Content-Type": "application/json",
    ...(profile.headers || {})
  };
  const body = isChat
    ? {
        model: profile.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 16
      }
    : {
        model: profile.model,
        input: "ping",
        max_output_tokens: 16
      };

  const started = Date.now();
  let response;
  let text = "";
  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    text = await response.text();
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
      baseUrl: profile.baseUrl,
      model: profile.model,
      wireApi,
      url,
      durationMs: Date.now() - started
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 1000);
  }

  return {
    ok: response.ok,
    status: response.status,
    error: response.ok ? "" : parsed?.error?.message || parsed?.message || text.slice(0, 1000),
    usage: normalizeUsage(extractUsage(parsed)),
    baseUrl: profile.baseUrl,
    model: profile.model,
    wireApi,
    url,
    durationMs: Date.now() - started
  };
}

async function testCodexCompatibility(profile) {
  if (profile?.wireApi === "responses") {
    const result = await testConnection(profile);
    return { ...result, codexCompatible: Boolean(result.ok), compatibilityError: result.ok ? "" : result.error || `Responses API returned HTTP ${result.status}.` };
  }
  const endpointResult = await testConnection(profile);
  const responsesResult = await testConnection({ ...profile, wireApi: "responses" });
  return {
    ...endpointResult,
    codexCompatible: Boolean(responsesResult.ok),
    compatibilityStatus: responsesResult.status,
    compatibilityUrl: responsesResult.url,
    compatibilityError: responsesResult.ok ? "" : `The selected endpoint is reachable, but current Codex requires the Responses API. ${responsesResult.error || `HTTP ${responsesResult.status}`}`
  };
}

module.exports = { testConnection, testCodexCompatibility, fetchModels, sortModels, normalizeUsage };
