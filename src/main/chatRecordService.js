const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const CODEX_HOME = path.join(os.homedir(), ".codex");
const CLAUDE_HOME = path.join(os.homedir(), ".claude");

const ROOTS = {
  codexSessions: path.join(CODEX_HOME, "sessions"),
  claudeProjects: path.join(CLAUDE_HOME, "projects"),
  claudeSessions: path.join(CLAUDE_HOME, "sessions")
};

const EXACT_FILES = [
  { engine: "codex", kind: "index", file: path.join(CODEX_HOME, "session_index.jsonl"), label: "Codex session index" },
  { engine: "claude", kind: "history", file: path.join(CLAUDE_HOME, "history.jsonl"), label: "Claude Code prompt history" }
];

let codexThreadIndexCache = null;

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function toId(engine, file) {
  return Buffer.from(`${engine}\n${path.resolve(file)}`).toString("base64url");
}

function normalize(target) {
  return path.resolve(target);
}

function isInside(child, parent) {
  const relative = path.relative(normalize(parent), normalize(child));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function fileMeta(engine, kind, file, labelRoot) {
  const stat = await fs.stat(file);
  if (!stat.isFile()) return null;
  const label = labelRoot ? path.relative(labelRoot, file) : path.basename(file);
  const summary = await summarizeRecord(engine, kind, file).catch(() => ({}));
  return {
    id: toId(engine, file),
    engine,
    kind,
    path: normalize(file),
    label,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    ...summary
  };
}

async function loadCodexThreadIndex() {
  if (codexThreadIndexCache) return codexThreadIndexCache;
  const index = new Map();
  const file = path.join(CODEX_HOME, "session_index.jsonl");
  try {
    const raw = await fs.readFile(file, "utf8");
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      try {
        const item = JSON.parse(line);
        if (item.id && item.thread_name) {
          index.set(item.id, {
            threadName: cleanText(item.thread_name, 120),
            updatedAt: item.updated_at || ""
          });
        }
      } catch {
        // Ignore broken index rows.
      }
    }
  } catch {
    // Index is optional.
  }
  codexThreadIndexCache = index;
  return index;
}

function cleanText(value, max = 180) {
  let source = String(value || "");
  const requestMarker = source.match(/(?:My request for Codex:|My request for [^:\n]+:)/i);
  if (requestMarker?.index !== undefined) {
    source = source.slice(requestMarker.index + requestMarker[0].length);
  }
  const text = source
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^<environment_context>|^<permissions instructions>|^\[Request interrupted/i.test(text)) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function textFromContent(content) {
  if (typeof content === "string") return cleanText(content);
  if (!Array.isArray(content)) return "";
  return cleanText(content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      if (typeof part.text === "string") return part.text;
      if (typeof part.content === "string") return part.content;
      return "";
    })
    .filter(Boolean)
    .join(" "));
}

function codexSourceFromProvider(provider) {
  const value = String(provider || "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "openai" || value.includes("openai")) return "official";
  return "thirdParty";
}

function codexSourceLabel(source) {
  if (source === "official") return "OpenAI 官方";
  if (source === "thirdParty") return "第三方 API";
  return "未知来源";
}

async function summarizeRecord(engine, kind, file) {
  if (!file.endsWith(".jsonl")) return {};
  const raw = await fs.readFile(file, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const summary = {
    title: "",
    subtitle: "",
    preview: "",
    firstUserText: "",
    lastUserText: "",
    lastAssistantText: "",
    lastMessageAt: "",
    cwd: "",
    model: "",
    provider: "",
    sessionId: ""
  };

  for (const line of lines) {
    let item;
    try {
      item = JSON.parse(line);
    } catch {
      continue;
    }
    if (engine === "codex") summarizeCodexLine(summary, item);
    else summarizeClaudeLine(summary, item);
  }

  if (engine === "codex" && summary.sessionId) {
    const thread = (await loadCodexThreadIndex()).get(summary.sessionId);
    if (thread?.threadName) {
      summary.title = thread.threadName;
      summary.codexThreadName = thread.threadName;
      if (thread.updatedAt && !summary.lastMessageAt) summary.lastMessageAt = thread.updatedAt;
    }
  }

  if (engine === "codex") {
    summary.codexSource = codexSourceFromProvider(summary.provider);
    summary.codexSourceLabel = codexSourceLabel(summary.codexSource);
  }

  const firstLooksLikeFileDrop = /[A-Z]:\\|\/mnt\/|^"[^"]+\.(md|docx|png|jpg|jsonl)"/i.test(summary.firstUserText || "") && (summary.firstUserText || "").length > 90;
  summary.title = summary.title || (firstLooksLikeFileDrop ? summary.lastUserText : summary.firstUserText) || summary.lastUserText || path.basename(file);
  const parts = [
    summary.cwd ? path.basename(summary.cwd) || summary.cwd : "",
    summary.model || summary.provider || "",
    summary.lastMessageAt ? new Date(summary.lastMessageAt).toLocaleString() : ""
  ].filter(Boolean);
  summary.subtitle = parts.join(" · ");
  summary.preview = summary.lastAssistantText || summary.lastUserText || summary.preview || "";
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => Boolean(value)));
}

function noteUser(summary, text, at) {
  const clean = cleanText(text);
  if (!clean) return;
  if (!summary.firstUserText) summary.firstUserText = clean;
  summary.lastUserText = clean;
  if (at) summary.lastMessageAt = at;
}

function noteAssistant(summary, text, at) {
  const clean = cleanText(text);
  if (!clean) return;
  summary.lastAssistantText = clean;
  if (at) summary.lastMessageAt = at;
}

function summarizeCodexLine(summary, item) {
  const payload = item.payload || {};
  const at = item.timestamp || payload.timestamp || "";
  if (item.type === "session_meta") {
    summary.sessionId = payload.id || summary.sessionId;
    summary.cwd = payload.cwd || summary.cwd;
    summary.provider = payload.model_provider || summary.provider;
    return;
  }
  if (item.type === "event_msg" && payload.type === "user_message") {
    noteUser(summary, payload.message, at);
    return;
  }
  if (item.type === "event_msg" && payload.type === "agent_message") {
    noteAssistant(summary, payload.message, at);
    return;
  }
  if (item.type === "response_item" && payload.type === "message") {
    const text = textFromContent(payload.content);
    if (payload.role === "user") noteUser(summary, text, at);
    if (payload.role === "assistant") noteAssistant(summary, text, at);
  }
}

function summarizeClaudeLine(summary, item) {
  const at = item.timestamp || "";
  if (item.type === "ai-title" && item.aiTitle) {
    summary.title = cleanText(item.aiTitle, 80);
    return;
  }
  if (item.cwd) summary.cwd = item.cwd;
  if (item.sessionId) summary.sessionId = item.sessionId;
  if (item.type === "user") {
    noteUser(summary, textFromContent(item.message?.content), at);
    return;
  }
  if (item.type === "assistant") {
    if (item.message?.model) summary.model = item.message.model;
    noteAssistant(summary, textFromContent(item.message?.content), at);
  }
}

async function walkFiles(root, engine, kind) {
  if (!(await exists(root))) return [];
  const records = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const meta = await fileMeta(engine, kind, full, root).catch(() => null);
        if (meta) records.push(meta);
      }
    }
  }
  return records;
}

async function listChatRecords() {
  const records = [];
  records.push(...await walkFiles(ROOTS.codexSessions, "codex", "session"));
  records.push(...await walkFiles(ROOTS.claudeProjects, "claude", "project"));
  records.push(...await walkFiles(ROOTS.claudeSessions, "claude", "session"));

  return records.sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
}

function assertDeletable(record) {
  if (!record?.path) throw new Error("Record path is missing.");
  const target = normalize(record.path);
  const exact = EXACT_FILES.some((item) => normalize(item.file) === target);
  const insideRoot = Object.values(ROOTS).some((root) => isInside(target, root));
  if (!exact && !insideRoot) {
    throw new Error(`Refusing to delete outside known chat-history roots: ${target}`);
  }
  return target;
}

async function deleteChatRecords(ids) {
  const wanted = new Set(ids);
  const available = await listChatRecords();
  const deleted = [];
  const skipped = [];

  for (const record of available) {
    if (!wanted.has(record.id)) continue;
    try {
      const target = assertDeletable(record);
      await fs.rm(target, { force: true });
      deleted.push({ id: record.id, engine: record.engine, kind: record.kind, path: target, size: record.size });
    } catch (error) {
      skipped.push({ id: record.id, path: record.path, error: error.message });
    }
  }

  for (const id of wanted) {
    if (!available.some((record) => record.id === id)) {
      skipped.push({ id, error: "Record no longer exists or is not deletable." });
    }
  }

  return { deleted, skipped };
}

module.exports = { listChatRecords, deleteChatRecords };
