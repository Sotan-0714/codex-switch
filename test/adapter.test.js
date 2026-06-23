const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const codexAdapter = require("../src/main/codexAdapterService");
const { extractUsage, normalizeUsage } = codexAdapter;

// Usage extraction must tolerate the many provider field namings (T-601 /
// preserved multi-naming compatibility). These are pure and provider-agnostic;
// the streaming accumulation strategy (P-18) and Claude SSE output_tokens
// (P-17) remain runtime-verification items and are intentionally not changed.

test("extractUsage finds usage on common payload shapes", () => {
  assert.deepEqual(extractUsage({ usage: { input_tokens: 1 } }), { input_tokens: 1 });
  assert.deepEqual(extractUsage({ response: { usage: { prompt_tokens: 2 } } }), { prompt_tokens: 2 });
  assert.deepEqual(extractUsage({ delta: { usage: { output_tokens: 3 } } }), { output_tokens: 3 });
  assert.deepEqual(extractUsage({ message: { usage: { total_tokens: 4 } } }), { total_tokens: 4 });
  assert.equal(extractUsage(null), null);
  assert.equal(extractUsage({ nothing: true }), null);
});

test("normalizeUsage maps OpenAI Responses field names", () => {
  const u = normalizeUsage({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
  assert.deepEqual(u, { inputTokens: 10, outputTokens: 5, totalTokens: 15, requests: 1 });
});

test("normalizeUsage maps Chat Completions field names", () => {
  const u = normalizeUsage({ prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 });
  assert.deepEqual(u, { inputTokens: 7, outputTokens: 3, totalTokens: 10, requests: 1 });
});

test("normalizeUsage derives total when missing and tolerates camelCase", () => {
  const u = normalizeUsage({ inputTokens: 4, outputTokens: 6 });
  assert.equal(u.inputTokens, 4);
  assert.equal(u.outputTokens, 6);
  assert.equal(u.totalTokens, 10);
});

function createMockChatServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    text: await response.text()
  };
}

async function waitForUsage(records, count = 1) {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    if (records.length >= count) return records;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return records;
}

test("codex local adapter records third-party usage for non-stream chat completions", async (t) => {
  const upstream = await createMockChatServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat/completions");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl_mock",
      model: "mock-model",
      choices: [{ message: { role: "assistant", content: "pong" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }
    }));
  });
  t.after(async () => {
    await codexAdapter.stopAdapter();
    await upstream.close();
    codexAdapter.setUsageRecorder(null);
  });

  const records = [];
  codexAdapter.setUsageRecorder((usage) => records.push(usage));
  const status = await codexAdapter.startAdapter({
    providerId: "third_party",
    apiKey: "test-key",
    baseUrl: upstream.baseUrl,
    model: "mock-model",
    wireApi: "chat_completions"
  });

  const result = await postJson(`${status.baseUrl}/responses`, {
    model: "mock-model",
    input: "ping"
  });

  assert.equal(result.status, 200);
  await waitForUsage(records);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    inputTokens: 11,
    outputTokens: 7,
    totalTokens: 18,
    requests: 1,
    model: "mock-model",
    status: "ok"
  });
});

test("codex local adapter records third-party usage for streamed chat completions", async (t) => {
  const upstream = await createMockChatServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat/completions");
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "po" } }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "ng" } }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 13, completion_tokens: 5, total_tokens: 18 } })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });
  t.after(async () => {
    await codexAdapter.stopAdapter();
    await upstream.close();
    codexAdapter.setUsageRecorder(null);
  });

  const records = [];
  codexAdapter.setUsageRecorder((usage) => records.push(usage));
  const status = await codexAdapter.startAdapter({
    providerId: "third_party",
    apiKey: "test-key",
    baseUrl: upstream.baseUrl,
    model: "mock-model",
    wireApi: "chat_completions"
  });

  const result = await postJson(`${status.baseUrl}/responses`, {
    model: "mock-model",
    input: "ping",
    stream: true
  });

  assert.equal(result.status, 200);
  assert.match(result.text, /response\.completed/);
  await waitForUsage(records);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    inputTokens: 13,
    outputTokens: 5,
    totalTokens: 18,
    requests: 1,
    model: "mock-model",
    status: "ok"
  });
});
