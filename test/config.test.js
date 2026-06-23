const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const TOML = require("@iarna/toml");

const { atomicWriteFile } = require("../src/main/atomicWrite");
const codex = require("../src/main/codexConfigService");
const claude = require("../src/main/claudeConfigService");
const { maskSecret } = require("../src/main/util/mask");

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// --- atomicWrite (T-101 / AC-01) ---

test("atomicWriteFile writes content and leaves no temp files", async () => {
  const dir = tmp("aw-");
  const f = path.join(dir, "config.toml");
  await atomicWriteFile(f, "a = 1\n");
  assert.equal(fs.readFileSync(f, "utf8"), "a = 1\n");
  assert.equal(fs.readdirSync(dir).filter((n) => n.includes(".tmp-")).length, 0);
});

test("atomicWriteFile failure leaves the original file intact (AC-01)", async () => {
  const dir = tmp("aw-");
  const f = path.join(dir, "config.toml");
  await atomicWriteFile(f, "good = true\n");
  await assert.rejects(() => atomicWriteFile(path.join(dir, "missing-subdir", "x.toml"), "z"));
  assert.equal(fs.readFileSync(f, "utf8"), "good = true\n");
});

// --- codex write + verify (core switch write) ---

test("codex writeConfigForProfile writes a third-party provider and verifies", async () => {
  const dir = tmp("cx-");
  const cfg = path.join(dir, "config.toml");
  const profile = { name: "P", providerId: "third_party", baseUrl: "https://api.example.com/v1", model: "gpt-5.5", wireApi: "responses", apiKey: "sk-test-key", envKey: "APIVOT_THIRD_PARTY_API_KEY", updateEnv: false };
  const result = await codex.writeConfigForProfile(cfg, profile, "thirdParty");
  assert.equal(result.after.provider, "third_party");
  const parsed = TOML.parse(fs.readFileSync(cfg, "utf8"));
  assert.equal(parsed.model, "gpt-5.5");
  assert.equal(parsed.model_providers.third_party.base_url, "https://api.example.com/v1");
});

// --- codex restore (T-102 / AC-02) ---

test("codex restoreBackup writes to the active path and validates (AC-02)", async () => {
  const dir = tmp("cx-");
  const active = path.join(dir, "active", "config.toml");
  fs.mkdirSync(path.dirname(active), { recursive: true });
  fs.writeFileSync(active, 'model = "original"\n');
  const backupRoot = path.join(dir, "backups");
  fs.mkdirSync(path.join(backupRoot, "b1"), { recursive: true });
  fs.writeFileSync(path.join(backupRoot, "b1", "config.toml"), 'model = "from-backup"\n');
  fs.writeFileSync(path.join(backupRoot, "b1", "meta.json"), JSON.stringify({ id: "b1", originalConfigPath: "Z:/stale/config.toml" }));
  const meta = await codex.restoreBackup("b1", backupRoot, active);
  assert.equal(meta.restoredTo, active);
  assert.match(fs.readFileSync(active, "utf8"), /from-backup/);
  assert.equal(fs.existsSync("Z:/stale/config.toml"), false);
});

test("codex restoreBackup rejects a corrupted backup and keeps the original (AC-02)", async () => {
  const dir = tmp("cx-");
  const active = path.join(dir, "config.toml");
  fs.writeFileSync(active, 'model = "original"\n');
  const backupRoot = path.join(dir, "backups");
  fs.mkdirSync(path.join(backupRoot, "bad"), { recursive: true });
  fs.writeFileSync(path.join(backupRoot, "bad", "config.toml"), "this = = not valid ][");
  fs.writeFileSync(path.join(backupRoot, "bad", "meta.json"), JSON.stringify({ id: "bad", originalConfigPath: active }));
  await assert.rejects(() => codex.restoreBackup("bad", backupRoot, active), /corrupted/);
  assert.equal(fs.readFileSync(active, "utf8"), 'model = "original"\n');
});

// --- codex clean default generic cleanup (T-201 / AC-06) ---

test("codex writeCleanOpenAIConfig removes custom + adapter providers (AC-06)", async () => {
  const dir = tmp("cx-");
  const cfg = path.join(dir, "config.toml");
  fs.writeFileSync(cfg, TOML.stringify({
    model: "x",
    model_provider: "my_custom",
    openai_base_url: "https://example.com/v1",
    model_providers: {
      my_custom: { name: "Mine", base_url: "https://example.com/v1" },
      apivot_codex_adapter: { name: "Adapter", base_url: "http://127.0.0.1:17641/v1" },
      keepme: { name: "Real", base_url: "https://other.example.com/v1" }
    }
  }));
  await codex.writeCleanOpenAIConfig(cfg, "gpt-5.5");
  const after = TOML.parse(fs.readFileSync(cfg, "utf8"));
  assert.equal(after.model_provider, undefined);
  assert.equal(after.openai_base_url, undefined);
  assert.equal(after.model_providers.my_custom, undefined);
  assert.equal(after.model_providers.apivot_codex_adapter, undefined);
  assert.ok(after.model_providers.keepme, "unrelated real provider is preserved");
});

// --- claude restore validation (T-102) ---

test("claude restoreBackup rejects corrupted JSON and keeps the original", async () => {
  const dir = tmp("cl-");
  const active = path.join(dir, "settings.json");
  fs.writeFileSync(active, '{"model":"sonnet"}\n');
  const backupRoot = path.join(dir, "backups");
  fs.mkdirSync(path.join(backupRoot, "bad"), { recursive: true });
  fs.writeFileSync(path.join(backupRoot, "bad", "settings.json"), "{not valid json");
  fs.writeFileSync(path.join(backupRoot, "bad", "meta.json"), JSON.stringify({ id: "bad", originalConfigPath: active }));
  await assert.rejects(() => claude.restoreBackup("bad", backupRoot, active), /corrupted/);
  assert.equal(fs.readFileSync(active, "utf8"), '{"model":"sonnet"}\n');
});

// --- maskSecret (T-202) ---

test("maskSecret exposes at most 2 leading chars (T-202)", () => {
  assert.equal(maskSecret("sk-proj-ABCDEF1234567890"), "sk***90");
  assert.equal(maskSecret("12345678"), "***");
  assert.equal(maskSecret(""), "");
});
