import type { Profile, ProfileKey, UsageHistoryEntry } from "../types";

// Pure, presentation-agnostic helpers extracted from AppV30 (T-501).

export function normalizeBaseUrl(value: string) {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean) return "";
  return /\/v\d+$/i.test(clean) ? clean : `${clean}/v1`;
}

export function formatTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function maskSecret(value: string) {
  if (!value) return "—";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 2)}••••••${value.slice(-2)}`;
}

export function groupModels(models: string[]) {
  return {
    GPT: models.filter((item) => /^gpt/i.test(item)),
    Claude: models.filter((item) => /^claude/i.test(item)),
    Other: models.filter((item) => !/^(gpt|claude)/i.test(item))
  };
}

export function profileConfigured(profile: Profile, key: ProfileKey) {
  if (key === "openai" && profile.authMode !== "api") return Boolean(profile.baseUrl && profile.model);
  return Boolean(profile.apiKey && profile.baseUrl && profile.model && (!profile.updateEnv || profile.envKey));
}

export function sameStatusValue(left?: string, right?: string) {
  return String(left || "").replace(/\/+$/, "") === String(right || "").replace(/\/+$/, "");
}

export function formatBytes(value: number) { if (!value) return "0 B"; if (value < 1024) return `${value} B`; return `${(value / 1024).toFixed(1)} KB`; }

export function filterUsage(history: UsageHistoryEntry[], range: "7" | "30" | "all", provider: "all" | "thirdParty") { const days = range === "all" ? Infinity : Number(range); const cutoff = Date.now() - days * 86400000; return history.filter((entry) => (range === "all" || new Date(entry.at).getTime() >= cutoff) && (provider === "all" || entry.profile === provider)); }

export function sumPeriod(history: UsageHistoryEntry[], days: number) { const cutoff = Date.now() - days * 86400000; return history.filter((entry) => new Date(entry.at).getTime() >= cutoff).reduce((sum, entry) => ({ inputTokens: sum.inputTokens + entry.inputTokens, outputTokens: sum.outputTokens + entry.outputTokens, totalTokens: sum.totalTokens + entry.totalTokens }), { inputTokens: 0, outputTokens: 0, totalTokens: 0 }); }
