const http = require("http");

const DEFAULT_PORT = 17642;

let server = null;
let activeProfile = null;
let activePort = DEFAULT_PORT;
let startedAt = "";
let requestCount = 0;
let lastError = "";
let usageRecorder = null;

function trimBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function textFromAnthropicContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (part?.type === "text") return part.text || "";
    if (part?.type === "tool_result") return typeof part.content === "string" ? part.content : JSON.stringify(part.content ?? "");
    return part?.text || "";
  }).filter(Boolean).join("\n");
}

function contentPartToToolResult(part) {
  const content = typeof part.content === "string" ? part.content : JSON.stringify(part.content ?? "");
  return {
    role: "tool",
    tool_call_id: part.tool_use_id || part.id || "",
    content
  };
}

function anthropicMessageToChatMessages(item) {
  const role = item.role === "assistant" ? "assistant" : "user";
  if (!Array.isArray(item.content)) {
    const content = textFromAnthropicContent(item.content);
    return content ? [{ role, content }] : [];
  }

  if (role === "assistant") {
    const text = item.content.filter((part) => part?.type === "text").map((part) => part.text || "").filter(Boolean).join("\n");
    const toolCalls = item.content.filter((part) => part?.type === "tool_use" && part.name).map((part) => ({
      id: part.id || `toolu_${Date.now()}`,
      type: "function",
      function: {
        name: part.name,
        arguments: JSON.stringify(part.input || {})
      }
    }));
    if (!text && !toolCalls.length) return [];
    return [{
      role: "assistant",
      content: text || null,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {})
    }];
  }

  const messages = [];
  const text = item.content.filter((part) => part?.type === "text").map((part) => part.text || "").filter(Boolean).join("\n");
  if (text) messages.push({ role: "user", content: text });
  for (const part of item.content.filter((part) => part?.type === "tool_result")) {
    messages.push(contentPartToToolResult(part));
  }
  return messages;
}

function anthropicMessagesToChat(body) {
  const messages = [];
  if (body.system) {
    messages.push({ role: "system", content: typeof body.system === "string" ? body.system : textFromAnthropicContent(body.system) });
  }
  for (const item of body.messages || []) {
    messages.push(...anthropicMessageToChatMessages(item));
  }
  return {
    model: activeProfile.targetModel || activeProfile.model || body.model,
    messages: messages.length ? messages : [{ role: "user", content: "ping" }],
    stream: Boolean(body.stream),
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    top_p: body.top_p
  };
}

function anthropicToolsToChatTools(tools) {
  return (tools || []).filter((tool) => tool?.name).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.input_schema || { type: "object", properties: {} }
    }
  }));
}

function chatBodyFromAnthropic(body) {
  const chat = anthropicMessagesToChat(body);
  const tools = anthropicToolsToChatTools(body.tools);
  if (tools.length) chat.tools = tools;
  for (const key of Object.keys(chat)) {
    if (chat[key] === undefined || chat[key] === null) delete chat[key];
  }
  return chat;
}

function anthropicMessageFromChat(parsed, model) {
  const choice = parsed?.choices?.[0] || {};
  const message = choice.message || {};
  const content = [];
  if (typeof message.content === "string" && message.content) {
    content.push({ type: "text", text: message.content });
  }
  for (const call of message.tool_calls || []) {
    content.push({
      type: "tool_use",
      id: call.id || `toolu_${Date.now()}`,
      name: call.function?.name || "",
      input: safeJson(call.function?.arguments || "{}")
    });
  }
  return {
    id: `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: parsed.model || model,
    content,
    stop_reason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: parsed?.usage?.prompt_tokens || parsed?.usage?.input_tokens || 0,
      output_tokens: parsed?.usage?.completion_tokens || parsed?.usage?.output_tokens || 0
    }
  };
}

function normalizeUsage(usage) {
  const inputTokens = Number(usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.inputTokens ?? 0) || 0;
  const outputTokens = Number(usage?.output_tokens ?? usage?.completion_tokens ?? usage?.outputTokens ?? 0) || 0;
  const totalTokens = Number(usage?.total_tokens ?? usage?.totalTokens ?? inputTokens + outputTokens) || 0;
  return { inputTokens, outputTokens, totalTokens, requests: 1 };
}

function recordUsage(usage, model, status = "ok") {
  const normalized = normalizeUsage(usage);
  if (!normalized.totalTokens && !normalized.inputTokens && !normalized.outputTokens) {
    normalized.requests = 1;
  }
  if (!usageRecorder) return;
  Promise.resolve(usageRecorder({ ...normalized, model, status })).catch(() => {});
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return {}; }
}

async function fetchChatCompletion(body) {
  const url = `${trimBaseUrl(activeProfile.baseUrl)}/chat/completions`;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${activeProfile.apiKey}`,
      "Content-Type": "application/json",
      ...(activeProfile.headers || {})
    },
    body: JSON.stringify(body)
  });
}

async function handleMessages(req, res) {
  requestCount += 1;
  if (!activeProfile) return jsonResponse(res, 503, { error: { message: "Local adapter is not configured." } });
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    lastError = error.message;
    return jsonResponse(res, 400, { error: { message: error.message } });
  }
  const chatBody = chatBodyFromAnthropic(body);
  let response;
  try {
    response = await fetchChatCompletion(chatBody);
  } catch (error) {
    lastError = error.message;
    return jsonResponse(res, 502, { error: { message: error.message } });
  }
  if (chatBody.stream) return handleStream(res, response, chatBody.model);
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { error: { message: text } }; }
  if (!response.ok) {
    lastError = parsed?.error?.message || text.slice(0, 500);
    return jsonResponse(res, response.status, parsed);
  }
  lastError = "";
  recordUsage(parsed.usage, chatBody.model);
  return jsonResponse(res, 200, anthropicMessageFromChat(parsed, chatBody.model));
}

function writeAnthropicSse(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function handleStream(res, response, model) {
  res.writeHead(response.status, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    lastError = text || `HTTP ${response.status}`;
    writeAnthropicSse(res, "error", { type: "error", error: { type: "api_error", message: lastError } });
    res.end();
    return;
  }

  const message = {
    id: `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model,
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 }
  };
  writeAnthropicSse(res, "message_start", { type: "message_start", message });

  const decoder = new TextDecoder();
  let buffer = "";
  let nextIndex = 0;
  let textIndex = -1;
  let textBlockOpen = false;
  let finishReason = "";
  let usage = null;
  const toolBlocks = new Map();

  const ensureTextBlock = () => {
    if (textBlockOpen) return;
    textIndex = nextIndex;
    nextIndex += 1;
    textBlockOpen = true;
    writeAnthropicSse(res, "content_block_start", { type: "content_block_start", index: textIndex, content_block: { type: "text", text: "" } });
  };

  const ensureToolBlock = (key) => {
    if (!toolBlocks.has(key)) {
      toolBlocks.set(key, {
        index: nextIndex,
        id: `toolu_${Date.now()}_${key}`,
        name: "",
        started: false,
        pendingArguments: []
      });
      nextIndex += 1;
    }
    return toolBlocks.get(key);
  };

  const maybeStartToolBlock = (tool) => {
    if (tool.started || !tool.name) return;
    tool.started = true;
    writeAnthropicSse(res, "content_block_start", {
      type: "content_block_start",
      index: tool.index,
      content_block: { type: "tool_use", id: tool.id, name: tool.name, input: {} }
    });
    for (const partial of tool.pendingArguments) {
      writeAnthropicSse(res, "content_block_delta", {
        type: "content_block_delta",
        index: tool.index,
        delta: { type: "input_json_delta", partial_json: partial }
      });
    }
    tool.pendingArguments = [];
  };

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const dataLines = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
      for (const data of dataLines) {
        if (!data || data === "[DONE]") continue;
        let parsed;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (parsed.usage) usage = parsed.usage;
        const choice = parsed.choices?.[0] || {};
        const delta = choice.delta || {};
        if (choice.finish_reason) finishReason = choice.finish_reason;
        if (delta.content) {
          ensureTextBlock();
          writeAnthropicSse(res, "content_block_delta", { type: "content_block_delta", index: textIndex, delta: { type: "text_delta", text: delta.content } });
        }
        for (const call of delta.tool_calls || []) {
          const key = Number.isInteger(call.index) ? call.index : toolBlocks.size;
          const tool = ensureToolBlock(key);
          if (call.id) tool.id = call.id;
          if (call.function?.name) tool.name = call.function.name;
          maybeStartToolBlock(tool);
          if (call.function?.arguments) {
            if (tool.started) {
              writeAnthropicSse(res, "content_block_delta", {
                type: "content_block_delta",
                index: tool.index,
                delta: { type: "input_json_delta", partial_json: call.function.arguments }
              });
            } else {
              tool.pendingArguments.push(call.function.arguments);
            }
          }
        }
      }
    }
  }

  if (textBlockOpen) {
    writeAnthropicSse(res, "content_block_stop", { type: "content_block_stop", index: textIndex });
  }
  let toolUseCount = 0;
  for (const tool of toolBlocks.values()) {
    maybeStartToolBlock(tool);
    if (tool.started) {
      toolUseCount += 1;
      writeAnthropicSse(res, "content_block_stop", { type: "content_block_stop", index: tool.index });
    }
  }
  if (!textBlockOpen && !toolUseCount) {
    ensureTextBlock();
    writeAnthropicSse(res, "content_block_stop", { type: "content_block_stop", index: textIndex });
  }
  const stopReason = toolUseCount || finishReason === "tool_calls" ? "tool_use" : (finishReason === "length" ? "max_tokens" : "end_turn");
  writeAnthropicSse(res, "message_delta", { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 0 } });
  writeAnthropicSse(res, "message_stop", { type: "message_stop" });
  lastError = "";
  res.end();
  recordUsage(usage, model);
}

async function handleModels(_req, res) {
  if (!activeProfile) return jsonResponse(res, 503, { error: { message: "Local adapter is not configured." } });
  const url = `${trimBaseUrl(activeProfile.baseUrl)}/models`;
  const modelIds = new Set();
  if (activeProfile.model) modelIds.add(activeProfile.model);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${activeProfile.apiKey}`, ...(activeProfile.headers || {}) } });
    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    if (parsed?.data) {
      for (const item of parsed.data) {
        const id = item.id || item.name || item.model;
        if (id) modelIds.add(id);
      }
      const data = Array.from(modelIds).map((id) => ({
          type: "model",
          id,
          display_name: id,
          created_at: "2026-01-01T00:00:00Z"
        }));
      return jsonResponse(res, response.status, {
        data,
        has_more: false,
        first_id: data[0]?.id || null,
        last_id: data[data.length - 1]?.id || null
      });
    }
    if (modelIds.size) {
      const data = Array.from(modelIds).map((id) => ({
        type: "model",
        id,
        display_name: id,
        created_at: "2026-01-01T00:00:00Z"
      }));
      return jsonResponse(res, 200, {
        data,
        has_more: false,
        first_id: data[0]?.id || null,
        last_id: data[data.length - 1]?.id || null
      });
    }
    res.writeHead(response.status, { "Content-Type": response.headers.get("content-type") || "application/json" });
    res.end(text);
  } catch (error) {
    lastError = error.message;
    if (modelIds.size) {
      const data = Array.from(modelIds).map((id) => ({
        type: "model",
        id,
        display_name: id,
        created_at: "2026-01-01T00:00:00Z"
      }));
      return jsonResponse(res, 200, {
        data,
        has_more: false,
        first_id: data[0]?.id || null,
        last_id: data[data.length - 1]?.id || null
      });
    }
    return jsonResponse(res, 502, { error: { message: error.message } });
  }
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${activePort}`);
    if (req.method === "GET" && url.pathname === "/v1/models") return handleModels(req, res);
    if (req.method === "POST" && url.pathname === "/v1/messages") return handleMessages(req, res);
    if (req.method === "POST" && url.pathname === "/v1/messages/count_tokens") {
      return jsonResponse(res, 200, { input_tokens: 1 });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return jsonResponse(res, 200, { ok: true, profile: activeProfile?.providerId || "", requestCount, lastError });
    }
    return jsonResponse(res, 404, { error: { message: `Unsupported adapter route: ${req.method} ${url.pathname}` } });
  });
}

async function startAdapter(profile, port = DEFAULT_PORT) {
  const nextPort = Number(port) || DEFAULT_PORT;
  if (server?.listening && activePort !== nextPort) {
    await stopAdapter();
  }
  activeProfile = JSON.parse(JSON.stringify(profile || {}));
  activePort = nextPort;
  if (server?.listening) return getAdapterStatus();
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(activePort, "127.0.0.1", () => {
      server.off("error", reject);
      startedAt = new Date().toISOString();
      resolve();
    });
  });
  return getAdapterStatus();
}

async function stopAdapter() {
  if (!server) return getAdapterStatus();
  await new Promise((resolve) => server.close(resolve));
  server = null;
  activeProfile = null;
  startedAt = "";
  return getAdapterStatus();
}

function getAdapterStatus() {
  return {
    running: Boolean(server?.listening),
    port: activePort,
    baseUrl: `http://127.0.0.1:${activePort}`,
    targetBaseUrl: activeProfile?.baseUrl || "",
    model: activeProfile?.model || "",
    startedAt,
    requestCount,
    lastError
  };
}

function setUsageRecorder(recorder) {
  usageRecorder = typeof recorder === "function" ? recorder : null;
}

module.exports = { startAdapter, stopAdapter, getAdapterStatus, setUsageRecorder, DEFAULT_PORT };
