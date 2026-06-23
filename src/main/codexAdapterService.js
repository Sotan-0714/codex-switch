const http = require("http");

const DEFAULT_PORT = 17641;

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
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => part?.text || part?.input_text || part?.output_text || "")
    .filter(Boolean)
    .join("\n");
}

function responsesInputToMessages(body) {
  const messages = [];
  if (body.instructions) messages.push({ role: "system", content: String(body.instructions) });
  const input = body.input;
  if (typeof input === "string") {
    messages.push({ role: "user", content: input });
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "function_call_output") {
        messages.push({ role: "tool", tool_call_id: item.call_id, content: typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "") });
        continue;
      }
      const role = item.role === "assistant" || item.role === "system" || item.role === "developer" ? item.role : "user";
      const content = textFromContent(item.content);
      if (content) messages.push({ role: role === "developer" ? "system" : role, content });
    }
  }
  return messages.length ? messages : [{ role: "user", content: "ping" }];
}

function responsesToolsToChatTools(tools) {
  return (tools || [])
    .filter((tool) => tool?.type === "function" && tool.name)
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.parameters || tool.input_schema || { type: "object", properties: {} },
        strict: tool.strict
      }
    }));
}

function chatBodyFromResponses(body) {
  const chat = {
    model: body.model || activeProfile.model,
    messages: responsesInputToMessages(body),
    stream: Boolean(body.stream),
    temperature: body.temperature,
    top_p: body.top_p
  };
  const maxTokens = body.max_output_tokens || body.max_tokens;
  if (maxTokens) chat.max_tokens = maxTokens;
  const tools = responsesToolsToChatTools(body.tools);
  if (tools.length) {
    chat.tools = tools;
    if (body.tool_choice) chat.tool_choice = body.tool_choice;
  }
  for (const key of Object.keys(chat)) {
    if (chat[key] === undefined || chat[key] === null) delete chat[key];
  }
  return chat;
}

function responseObjectFromChat(parsed, model) {
  const choice = parsed?.choices?.[0] || {};
  const message = choice.message || {};
  const output = [];
  const content = typeof message.content === "string" ? message.content : "";
  if (content) {
    output.push({
      id: `msg_${Date.now()}`,
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text: content, annotations: [] }]
    });
  }
  for (const call of message.tool_calls || []) {
    output.push({
      id: call.id || `fc_${Date.now()}`,
      type: "function_call",
      status: "completed",
      call_id: call.id || `call_${Date.now()}`,
      name: call.function?.name || "",
      arguments: call.function?.arguments || "{}"
    });
  }
  return {
    id: `resp_${Date.now()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    model: parsed.model || model,
    output,
    usage: parsed.usage || null
  };
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
  const inputTokens = firstNumber(
    usage?.input_tokens,
    usage?.prompt_tokens,
    usage?.inputTokens,
    usage?.promptTokens
  );
  const outputTokens = firstNumber(
    usage?.output_tokens,
    usage?.completion_tokens,
    usage?.outputTokens,
    usage?.completionTokens
  );
  const totalTokens = firstNumber(
    usage?.total_tokens,
    usage?.totalTokens,
    usage?.total,
    inputTokens + outputTokens
  );
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

async function fetchResponses(body) {
  const url = `${trimBaseUrl(activeProfile.baseUrl)}/responses`;
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

function writeSse(res, event) {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function responsesBodyFromRequest(body) {
  const next = { ...(body || {}) };
  if (!next.model) next.model = activeProfile.model;
  return next;
}

async function handleResponsesProxyStream(res, response, model) {
  res.writeHead(response.status, {
    "Content-Type": response.headers.get("content-type") || "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    res.write(text);
    res.end();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let usage = null;
  for await (const chunk of response.body) {
    const text = decoder.decode(chunk, { stream: true });
    res.write(text);
    buffer += text;
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const dataLines = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
      for (const data of dataLines) {
        if (!data || data === "[DONE]") continue;
        let parsed;
        try { parsed = JSON.parse(data); } catch { continue; }
        const eventUsage = extractUsage(parsed);
        if (eventUsage) usage = eventUsage;
      }
    }
  }
  res.end();
  lastError = "";
  recordUsage(usage, model);
}

async function handleStream(res, response, model) {
  res.writeHead(response.status, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    writeSse(res, { type: "error", error: { message: text || `HTTP ${response.status}` } });
    res.end();
    return;
  }

  const responseId = `resp_${Date.now()}`;
  const messageId = `msg_${Date.now()}`;
  let fullText = "";
  const toolCalls = new Map();
  writeSse(res, { type: "response.created", response: { id: responseId, object: "response", status: "in_progress", model, output: [] } });

  const decoder = new TextDecoder();
  let buffer = "";
  let usage = null;
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
        const eventUsage = extractUsage(parsed);
        if (eventUsage) usage = eventUsage;
        const delta = parsed.choices?.[0]?.delta || {};
        if (delta.content) {
          fullText += delta.content;
          writeSse(res, { type: "response.output_text.delta", item_id: messageId, output_index: 0, content_index: 0, delta: delta.content });
        }
        for (const call of delta.tool_calls || []) {
          const key = String(call.index ?? 0);
          const existing = toolCalls.get(key) || { id: call.id || `call_${key}_${Date.now()}`, name: "", arguments: "" };
          if (call.id) existing.id = call.id;
          if (call.function?.name) existing.name += call.function.name;
          if (call.function?.arguments) {
            existing.arguments += call.function.arguments;
            writeSse(res, { type: "response.function_call_arguments.delta", item_id: existing.id, output_index: Number(key), delta: call.function.arguments });
          }
          toolCalls.set(key, existing);
        }
      }
    }
  }

  if (fullText) {
    writeSse(res, { type: "response.output_text.done", item_id: messageId, output_index: 0, content_index: 0, text: fullText });
    writeSse(res, {
      type: "response.output_item.done",
      output_index: 0,
      item: { id: messageId, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: fullText, annotations: [] }] }
    });
  }
  let outputIndex = fullText ? 1 : 0;
  for (const call of toolCalls.values()) {
    const item = { id: call.id, type: "function_call", status: "completed", call_id: call.id, name: call.name, arguments: call.arguments || "{}" };
    writeSse(res, { type: "response.function_call_arguments.done", item_id: call.id, output_index: outputIndex, arguments: item.arguments });
    writeSse(res, { type: "response.output_item.done", output_index: outputIndex, item });
    outputIndex += 1;
  }
  const output = [];
  if (fullText) output.push({ id: messageId, type: "message", status: "completed", role: "assistant", content: [{ type: "output_text", text: fullText, annotations: [] }] });
  for (const call of toolCalls.values()) output.push({ id: call.id, type: "function_call", status: "completed", call_id: call.id, name: call.name, arguments: call.arguments || "{}" });
  writeSse(res, { type: "response.completed", response: { id: responseId, object: "response", status: "completed", model, output } });
  res.write("data: [DONE]\n\n");
  res.end();
  lastError = "";
  recordUsage(usage, model);
}

async function handleResponses(req, res) {
  requestCount += 1;
  if (!activeProfile) return jsonResponse(res, 503, { error: { message: "Local adapter is not configured." } });
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    lastError = error.message;
    return jsonResponse(res, 400, { error: { message: error.message } });
  }
  if (activeProfile.wireApi === "responses") {
    const responsesBody = responsesBodyFromRequest(body);
    let response;
    try {
      response = await fetchResponses(responsesBody);
    } catch (error) {
      lastError = error.message;
      return jsonResponse(res, 502, { error: { message: error.message } });
    }
    if (responsesBody.stream) return handleResponsesProxyStream(res, response, responsesBody.model);
    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { error: { message: text } }; }
    if (!response.ok) {
      lastError = parsed?.error?.message || text.slice(0, 500);
      return jsonResponse(res, response.status, parsed);
    }
    lastError = "";
    recordUsage(extractUsage(parsed), responsesBody.model);
    return jsonResponse(res, response.status, parsed);
  }

  const chatBody = chatBodyFromResponses(body);
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
  recordUsage(extractUsage(parsed), chatBody.model);
  return jsonResponse(res, 200, responseObjectFromChat(parsed, chatBody.model));
}

async function handleModels(_req, res) {
  if (!activeProfile) return jsonResponse(res, 503, { error: { message: "Local adapter is not configured." } });
  const url = `${trimBaseUrl(activeProfile.baseUrl)}/models`;
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${activeProfile.apiKey}`, ...(activeProfile.headers || {}) } });
    res.writeHead(response.status, { "Content-Type": response.headers.get("content-type") || "application/json" });
    res.end(await response.text());
  } catch (error) {
    lastError = error.message;
    jsonResponse(res, 502, { error: { message: error.message } });
  }
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${activePort}`);
    if (req.method === "GET" && url.pathname === "/v1/models") return handleModels(req, res);
    if (req.method === "POST" && url.pathname === "/v1/responses") return handleResponses(req, res);
    if (req.method === "GET" && url.pathname === "/health") return jsonResponse(res, 200, { ok: true, profile: activeProfile?.providerId || "", requestCount, lastError });
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
    baseUrl: `http://127.0.0.1:${activePort}/v1`,
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

module.exports = { startAdapter, stopAdapter, getAdapterStatus, setUsageRecorder, DEFAULT_PORT, extractUsage, normalizeUsage };
