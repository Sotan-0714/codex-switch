import { MotionConfig, AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  ClipboardCopy,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileClock,
  FileDiff,
  FolderOpen,
  Info,
  KeyRound,
  Loader2,
  Minus,
  MoreHorizontal,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Wifi,
  X,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import brandIcon from "@assets/icon-64.png";
import profileNavIcon from "@assets/nav-mask/profile.svg";
import recordsNavIcon from "@assets/nav-mask/records.svg";
import settingsNavIcon from "@assets/nav-mask/settings.svg";
import statusNavIcon from "@assets/nav-mask/status.svg";
import switchNavIcon from "@assets/nav-mask/switch.svg";
import testNavIcon from "@assets/nav-mask/test.svg";
import tokensNavIcon from "@assets/nav-mask/tokens.svg";
import profileNavFlatIcon from "@assets/nav-mask/flat/profile.svg";
import recordsNavFlatIcon from "@assets/nav-mask/flat/records.svg";
import settingsNavFlatIcon from "@assets/nav-mask/flat/settings.svg";
import statusNavFlatIcon from "@assets/nav-mask/flat/status.svg";
import switchNavFlatIcon from "@assets/nav-mask/flat/switch.svg";
import testNavFlatIcon from "@assets/nav-mask/flat/test.svg";
import tokensNavFlatIcon from "@assets/nav-mask/flat/tokens.svg";
import { EULA_VERSION, eulaContent } from "./eula";
import { legalInfo, type LegalView } from "./legalInfo";
import { Badge, Card, CodeLine, EmptyState, Field, KeyValueRow, Metric, SectionHeading, SettingRow, SettingsGroup, Toast, Toggle } from "./components/common";
import { filterUsage, formatBytes, formatTime, groupModels, maskSecret, normalizeBaseUrl, profileConfigured, sameStatusValue, sumPeriod } from "./lib/helpers";
import type { AppState, ChatRecord, ConnectionResult, Profile, ProfileKey, TabKey, UsageHistoryEntry } from "./types";

type Lang = "zh" | "en";
type Engine = "codex" | "claude";
type StepState = "idle" | "running" | "done" | "error";
type StatusKind = "verified" | "unverified" | "pending" | "conflict" | "unknown";
type DialogState = null | {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  secondaryLabel?: string;
  onSecondary?: () => void | Promise<void>;
};

const navItems = [
  { key: "switch" as TabKey, active: switchNavIcon, inactive: switchNavFlatIcon, zh: "切换", en: "Switch" },
  { key: "status" as TabKey, active: statusNavIcon, inactive: statusNavFlatIcon, zh: "状态", en: "Status" },
  { key: "profiles" as TabKey, active: profileNavIcon, inactive: profileNavFlatIcon, zh: "配置档案", en: "Profile" },
  { key: "test" as TabKey, active: testNavIcon, inactive: testNavFlatIcon, zh: "测试", en: "Test" },
  { key: "records" as TabKey, active: recordsNavIcon, inactive: recordsNavFlatIcon, zh: "备份与日志", en: "Backups & Logs" },
  { key: "tokens" as TabKey, active: tokensNavIcon, inactive: tokensNavFlatIcon, zh: "用量统计", en: "Usage Stats" }
];

const text = {
  zh: {
    switch: "切换操作", status: "状态", profiles: "配置档案", test: "连接诊断", records: "备份与日志", tokens: "用量统计", settings: "设置",
    refresh: "刷新", official: "OpenAI 官方", third: "第三方 API", verified: "已验证", unverified: "未验证", pending: "待重启", conflict: "有冲突", unknown: "未识别",
    save: "保存 Profile", discard: "放弃修改", cancel: "取消", copy: "复制", copied: "已复制", openFolder: "打开文件夹",
    switchVerify: "切换并验证", testCurrent: "测试当前生效配置", resetOpenAI: "恢复 OpenAI 默认配置", dangerZone: "危险操作",
    noConflict: "未检测到环境变量冲突", useCurrentValues: "使用界面当前值", clear: "清除", restore: "恢复", delete: "删除",
    noBackups: "暂无备份", noLogs: "暂无日志", noUsage: "暂无 Token 使用记录", all: "全部", today: "今日", week: "本周", month: "本月",
    estimated: "估算", input: "输入", output: "输出", total: "总量", requests: "请求", language: "语言", appearance: "外观",
    behavior: "行为", securityData: "安全与数据", followSystem: "跟随系统", dark: "深色", light: "浅色", startPage: "默认启动页面",
    closeTray: "关闭时最小化到托盘", promptTest: "切换后提示测试", localData: "本地数据目录", clearUsage: "清除用量统计"
  },
  en: {
    switch: "Switch", status: "Status", profiles: "Profile", test: "Connection Diagnostics", records: "Backups & Logs", tokens: "Usage Stats", settings: "Settings",
    refresh: "Refresh", official: "OpenAI Official", third: "Third-party API", verified: "Verified", unverified: "Not verified", pending: "Restart required", conflict: "Conflict", unknown: "Unknown",
    save: "Save Profile", discard: "Discard changes", cancel: "Cancel", copy: "Copy", copied: "Copied", openFolder: "Open folder",
    switchVerify: "Switch and verify", testCurrent: "Test effective configuration", resetOpenAI: "Restore OpenAI defaults", dangerZone: "Danger zone",
    noConflict: "No environment variable conflicts detected", useCurrentValues: "Uses current UI values", clear: "Clear", restore: "Restore", delete: "Delete",
    noBackups: "No backups yet", noLogs: "No logs yet", noUsage: "No token usage yet", all: "All", today: "Today", week: "This week", month: "This month",
    estimated: "Estimated", input: "Input", output: "Output", total: "Total", requests: "Requests", language: "Language", appearance: "Appearance",
    behavior: "Behavior", securityData: "Security & data", followSystem: "Follow system", dark: "Dark", light: "Light", startPage: "Default start page",
    closeTray: "Minimize to tray on close", promptTest: "Prompt to test after switching", localData: "Local data directory", clearUsage: "Clear token statistics"
  }
};

const emptyProfile: Profile = {
  providerId: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  modelOptions: [],
  compatible: true,
  wireApi: "responses",
  envKey: "",
  updateEnv: false,
  headers: {}
};

const switchSteps = [
  { key: "backup", zh: "创建切换前备份", en: "Create pre-switch backup" },
  { key: "session", zh: "保护会话状态", en: "Protect session state" },
  { key: "write", zh: "写入配置文件", en: "Write configuration" },
  { key: "reread", zh: "重新读取配置", en: "Re-read configuration" },
  { key: "compare", zh: "对比写入前后差异", en: "Compare before and after" },
  { key: "process", zh: "检查 Codex 进程是否重载", en: "Check Codex process reload" }
];

function getSwitchSteps(engine: Engine, target: ProfileKey = "thirdParty") {
  if (engine === "claude") {
    const base = [
      { key: "backup", zh: "创建切换前备份", en: "Create pre-switch backup" },
      { key: "session", zh: "保护 Claude Code 轻量状态", en: "Protect Claude Code lightweight state" },
      { key: "write", zh: "写入 settings.json", en: "Write settings.json" },
      { key: "reread", zh: "重新读取配置", en: "Re-read configuration" },
      { key: "compare", zh: "对比写入前后差异", en: "Compare before and after" },
      { key: "process", zh: "检查 Claude Code 进程是否重载", en: "Check Claude Code process reload" }
    ];
    return target === "thirdParty" ? [...base, { key: "gateway", zh: "按需启动 Messages Gateway", en: "Start Messages Gateway if needed" }] : base;
  }
  return switchSteps;
}

function profileSwitchReady(profile: Profile, key: ProfileKey, auth?: AppState["auth"], engine: Engine = "codex") {
  if (!profileConfigured(profile, key)) return false;
  if (key === "openai" && profile.authMode !== "api") return engine === "claude" ? true : Boolean(auth?.hasChatGptSession);
  if (key === "thirdParty") return true;
  return true;
}

function lastSwitchStillVerified(state: AppState | null, activeEngine: Engine) {
  const last = state?.data.lastSwitch;
  const current = state?.config.status;
  if (!last?.success || last.engine !== activeEngine || !last.status || !current) return false;
  return sameStatusValue(last.status.baseUrl, current.baseUrl)
    && sameStatusValue(last.status.model, current.model)
    && sameStatusValue(last.status.provider, current.provider)
    && sameStatusValue(last.status.configPath, current.configPath);
}

export default function AppV30() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeEngine, setActiveEngineState] = useState<Engine>((localStorage.getItem("apivot-engine") as Engine) || "codex");
  const [profiles, setProfiles] = useState<Record<ProfileKey, Profile>>({ openai: emptyProfile, thirdParty: emptyProfile });
  const [savedProfiles, setSavedProfiles] = useState<Record<ProfileKey, Profile>>({ openai: emptyProfile, thirdParty: emptyProfile });
  const [headersDraft, setHeadersDraft] = useState<Record<ProfileKey, string>>({ openai: "{}", thirdParty: "{}" });
  const [tab, setTabState] = useState<TabKey>((localStorage.getItem("apivot-v30-default-page") as TabKey) || "switch");
  const [lang, setLang] = useState<Lang>((localStorage.getItem("apivot-v30-lang") as Lang) || "zh");
  const [appearance, setAppearance] = useState(localStorage.getItem("apivot-v30-appearance") || "system");
  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<ProfileKey>("thirdParty");
  const [profileTab, setProfileTab] = useState<ProfileKey>("openai");
  const [testProfile, setTestProfile] = useState<ProfileKey>("openai");
  const [testResults, setTestResults] = useState<Partial<Record<ProfileKey, ConnectionResult>>>({});
  const [output, setOutput] = useState("");
  const [stepStates, setStepStates] = useState<StepState[]>(getSwitchSteps(activeEngine).map(() => "idle"));
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof window.api.applySwitch>>["receipt"] | null>(null);
  const [switchError, setSwitchError] = useState("");
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const [closeToTray, setCloseToTray] = useState(localStorage.getItem("apivot-v30-close-tray") === "true");
  const [promptTest, setPromptTest] = useState(localStorage.getItem("apivot-v30-prompt-test") !== "false");
  const [defaultPage, setDefaultPage] = useState(localStorage.getItem("apivot-v30-default-page") || "switch");
  const [tokenPrice, setTokenPrice] = useState(Number(localStorage.getItem("apivot-v30-token-price") || "0"));
  const [eulaOpen, setEulaOpen] = useState(false);
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const c = text[lang];
  const activeSwitchSteps = useMemo(() => getSwitchSteps(activeEngine, selectedTarget), [activeEngine, selectedTarget]);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const profilesDirty = JSON.stringify(profiles) !== JSON.stringify(savedProfiles);
  const headersError = useMemo(() => {
    try {
      JSON.parse(headersDraft[profileTab] || "{}");
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  }, [headersDraft, profileTab]);

  async function refresh(syncProfiles = true) {
    try {
      const next = await window.api.getState();
      setState(next);
      const nextEngine = (next.data.activeEngine || "codex") as Engine;
      setActiveEngineState(nextEngine);
      document.documentElement.setAttribute("data-engine", nextEngine);
      if (syncProfiles) {
        setProfiles(next.data.profiles);
        setSavedProfiles(next.data.profiles);
        setHeadersDraft({
          openai: JSON.stringify(next.data.profiles.openai.headers || {}, null, 2),
          thirdParty: JSON.stringify(next.data.profiles.thirdParty.headers || {}, null, 2)
        });
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), true);
    }
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (tab !== "tokens") return;
    refresh(false);
    const timer = window.setInterval(() => refresh(false), 5000);
    return () => window.clearInterval(timer);
  }, [tab, activeEngine]);
  useEffect(() => {
    document.documentElement.setAttribute("data-engine", activeEngine);
    localStorage.setItem("apivot-engine", activeEngine);
  }, [activeEngine]);
  useEffect(() => {
    setStepStates(activeSwitchSteps.map(() => "idle"));
  }, [activeSwitchSteps]);
  useEffect(() => {
    window.api.getWindowState().then((value) => setIsMaximized(value === "maximized"));
    return window.api.onWindowState((value) => setIsMaximized(value === "maximized"));
  }, []);
  useEffect(() => {
    // Single source of truth for sidebar collapse: narrow windows collapse via
    // the same .sidebar-collapsed class as the manual toggle (no separate CSS
    // collapse implementation in the 980px breakpoint).
    const mq = window.matchMedia("(max-width: 980px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    localStorage.setItem("apivot-v30-tab", tab);
    localStorage.setItem("apivot-v30-lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [tab, lang]);
  useEffect(() => {
    localStorage.setItem("apivot-v30-appearance", appearance);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = appearance === "system" ? (media.matches ? "dark" : "light") : appearance; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);
  useEffect(() => { window.api.setCloseToTray(closeToTray); localStorage.setItem("apivot-v30-close-tray", String(closeToTray)); }, [closeToTray]);
  useEffect(() => { localStorage.setItem("apivot-v30-prompt-test", String(promptTest)); }, [promptTest]);
  useEffect(() => { localStorage.setItem("apivot-v30-default-page", defaultPage); }, [defaultPage]);
  useEffect(() => { localStorage.setItem("apivot-v30-token-price", String(tokenPrice)); }, [tokenPrice]);
  useEffect(() => {
    const scrollables = Array.from(document.querySelectorAll<HTMLElement>(".page, .record-list, .event-list, .chat-record-list"));
    const cleanups = scrollables.map((node) => {
      let hideTimer = 0;
      const showTemporarily = () => {
        node.classList.add("is-scroll-active");
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => node.classList.remove("is-scroll-active"), 800);
      };
      const revealNearEdge = (event: PointerEvent) => {
        const rect = node.getBoundingClientRect();
        node.classList.toggle("is-scroll-edge-hover", rect.right - event.clientX <= 18);
      };
      const hideEdge = () => node.classList.remove("is-scroll-edge-hover");
      node.addEventListener("scroll", showTemporarily, { passive: true });
      node.addEventListener("pointermove", revealNearEdge, { passive: true });
      node.addEventListener("pointerleave", hideEdge);
      return () => {
        window.clearTimeout(hideTimer);
        node.removeEventListener("scroll", showTemporarily);
        node.removeEventListener("pointermove", revealNearEdge);
        node.removeEventListener("pointerleave", hideEdge);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [tab, state?.backups?.length, state?.logs?.length]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string, error = false) { setToast({ message, error }); }

  function requestTab(next: TabKey) {
    if (next === tab) return;
    if (tab === "profiles" && profilesDirty) {
      setPendingTab(next);
      setDialog({
        title: lang === "zh" ? "保存 Profile 修改？" : "Save profile changes?",
        description: lang === "zh" ? "当前 Profile 有未保存的修改。请选择保存、放弃或取消。" : "The current profile has unsaved changes. Save, discard, or cancel.",
        confirmLabel: c.save,
        onConfirm: async () => { await saveProfiles(); setDialog(null); setTabState(next); setPendingTab(null); },
        secondaryLabel: c.discard,
        onSecondary: () => { setProfiles(savedProfiles); setDialog(null); setTabState(next); setPendingTab(null); }
      });
      return;
    }
    setTabState(next);
  }

  async function switchEngine(engine: Engine) {
    if (engine === activeEngine) return;
    if (profilesDirty) {
      setDialog({
        title: lang === "zh" ? "保存 Profile 修改？" : "Save profile changes?",
        description: lang === "zh" ? "切换工作区前需要处理当前 Profile 的未保存修改。" : "Handle the current unsaved profile changes before switching workspace.",
        confirmLabel: c.save,
        onConfirm: async () => {
          await saveProfiles();
          setDialog(null);
          const next = await window.api.setActiveEngine(engine);
          setState(next);
          setProfiles(next.data.profiles);
          setSavedProfiles(next.data.profiles);
          setActiveEngineState(engine);
        },
        secondaryLabel: c.discard,
        onSecondary: async () => {
          setDialog(null);
          setProfiles(savedProfiles);
          const next = await window.api.setActiveEngine(engine);
          setState(next);
          setProfiles(next.data.profiles);
          setSavedProfiles(next.data.profiles);
          setActiveEngineState(engine);
        }
      });
      return;
    }
    const next = await window.api.setActiveEngine(engine);
    setState(next);
    setProfiles(next.data.profiles);
    setSavedProfiles(next.data.profiles);
    setHeadersDraft({
      openai: JSON.stringify(next.data.profiles.openai.headers || {}, null, 2),
      thirdParty: JSON.stringify(next.data.profiles.thirdParty.headers || {}, null, 2)
    });
    setActiveEngineState(engine);
    setSelectedTarget("thirdParty");
    setProfileTab("openai");
    setTestProfile("openai");
    setReceipt(null);
    setSwitchError("");
  }

  async function saveProfiles() {
    if (headersError) return;
    const next = await window.api.saveProfiles(profiles);
    setState(next);
    setProfiles(next.data.profiles);
    setSavedProfiles(next.data.profiles);
    showToast(lang === "zh" ? "已保存 Profile" : "Profile saved");
  }

  async function runSwitch() {
    const profile = profiles[selectedTarget];
    if (!profileSwitchReady(profile, selectedTarget, state?.auth, activeEngine)) {
      const message = selectedTarget === "openai" && profile.authMode !== "api" && !state?.auth.hasChatGptSession && activeEngine === "codex"
        ? (lang === "zh" ? "未检测到 Codex 的 ChatGPT 登录，请先在 Codex 中登录。" : "No Codex ChatGPT login was detected.")
        : selectedTarget === "thirdParty" && profile.wireApi !== "responses" && activeEngine === "codex"
          ? (lang === "zh" ? "当前 Codex 会通过本地适配器尝试兼容 Chat Completions，请先保存并测试 Profile。" : "Codex will try the local adapter fallback for Chat Completions. Save and test the profile first.")
          : (lang === "zh" ? "目标 Profile 缺少必要配置。" : "The target profile is incomplete.");
      setSwitchError(message);
      return;
    }
    setBusy(true);
    setSwitchError("");
    setReceipt(null);
    setStepStates(activeSwitchSteps.map(() => "idle"));
    let active = true;
    const timers: number[] = [];
    activeSwitchSteps.forEach((_, index) => {
      timers.push(window.setTimeout(() => {
        if (!active) return;
        setStepStates((current) => current.map((value, item) => item < index ? "done" : item === index ? "running" : value));
      }, index * 260));
    });
    try {
      await window.api.saveProfiles(profiles);
      const result = await window.api.applySwitch(selectedTarget);
      active = false;
      timers.forEach(window.clearTimeout);
      setState(result.state);
      setSavedProfiles(result.state.data.profiles);
      setStepStates(activeSwitchSteps.map(() => result.ok ? "done" : "error"));
      setReceipt(result.receipt || null);
      setSwitchError(result.ok ? "" : (result.error || "Switch failed"));
      setOutput(JSON.stringify(result, null, 2));
      showToast(result.ok ? (lang === "zh" ? `已切换到 ${selectedTarget === "openai" ? "OpenAI" : "第三方 API"} 配置` : "Configuration switched") : `${lang === "zh" ? "切换失败" : "Switch failed"}: ${result.error}`, !result.ok);
      window.setTimeout(() => resultHeadingRef.current?.focus(), 80);
    } catch (error) {
      active = false;
      timers.forEach(window.clearTimeout);
      const message = error instanceof Error ? error.message : String(error);
      setSwitchError(message);
      setStepStates((current) => current.map((value) => value === "running" ? "error" : value));
      showToast(`${lang === "zh" ? "切换失败" : "Switch failed"}: ${message}`, true);
    } finally {
      setBusy(false);
    }
  }

  async function testConnection(key: ProfileKey) {
    setBusy(true);
    setTestProfile(key);
    setTestResults((current) => ({ ...current, [key]: undefined }));
    try {
      await window.api.saveProfiles(profiles);
      const result = await window.api.testConnection(key);
      setState(result.state);
      setTestResults((current) => ({ ...current, [key]: result.result }));
      setOutput(JSON.stringify(result.result, null, 2));
      const success = key === "thirdParty"
        ? Boolean((result.result.ok && result.result.codexCompatible !== false && result.result.claudeCompatible !== false) || result.result.adapterAvailable)
        : Boolean(result.result.ok);
      showToast(success ? (key === "openai" && profiles.openai.authMode !== "api" ? (activeEngine === "claude" ? (lang === "zh" ? "Claude Code 官方路径可用" : "Official Claude Code path is available") : (lang === "zh" ? "Codex 官方登录可用" : "Official Codex login is available")) : (lang === "zh" ? "连接与兼容性测试成功" : "Connection and compatibility test succeeded")) : `${lang === "zh" ? "测试未通过" : "Test did not pass"}: ${result.result.compatibilityError || result.result.error || result.result.status || "Unknown error"}`, !success);
    } finally {
      setBusy(false);
    }
  }

  async function launchActiveEngine() {
    setLaunchBusy(true);
    try {
      const detection = activeEngine === "claude" ? await window.api.detectClaudeCodeLaunch() : await window.api.detectCodexLaunch();
      if (!detection.canAutoLaunch) {
        const checked = detection.checked?.length ? `\n${lang === "zh" ? "已检查" : "Checked"}: ${detection.checked.join(", ")}` : "";
        const cmd = detection.manualCommand ? `\n${lang === "zh" ? "手动命令" : "Manual command"}: ${detection.manualCommand}` : "";
        showToast(`${detection.manualMessage || detection.error || (lang === "zh" ? "未检测到可自动启动方式，请手动启动客户端" : "No automatic launch method was detected. Start the client manually.")}${cmd}${checked}`, true);
        return;
      }
      const launchMethod = detection.method ? `${detection.method}${detection.command ? `: ${detection.command}` : ""}` : detection.command || "";
      if (launchMethod) {
        showToast(lang === "zh" ? `检测到启动方式：${launchMethod}` : `Launch method detected: ${launchMethod}`);
      }
      const result = activeEngine === "claude" ? await window.api.launchClaudeCode() : await window.api.launchCodex();
      const failCmd = result.manualCommand ? `\n${lang === "zh" ? "手动命令" : "Manual command"}: ${result.manualCommand}` : "";
      showToast(result.ok
        ? activeEngine === "claude"
          ? (lang === "zh" ? "Claude Code 已启动" : "Claude Code launched")
          : (lang === "zh" ? "Codex 已启动" : "Codex launched")
        : `${result.manualMessage || result.error || (lang === "zh" ? "启动失败，请手动启动客户端" : "Launch failed. Start the client manually.")}${failCmd}`, !result.ok);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), true);
    } finally {
      setLaunchBusy(false);
    }
  }

  async function fetchModels() {
    setBusy(true);
    try {
      const result = await window.api.fetchThirdPartyModels(profiles.thirdParty);
      setState(result.state);
      setProfiles(result.state.data.profiles);
      showToast(lang === "zh" ? `已获取 ${result.result.count} 个模型` : `Fetched ${result.result.count} models`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(false);
    }
  }

  const conflicts = state?.config.status.envConflicts || [];
  const activeProfile: ProfileKey = state?.config.status.mode === "third-party" ? "thirdParty" : "openai";
  const lastSwitchAt = state?.data.lastSwitch?.at ? Date.parse(state.data.lastSwitch.at) : 0;
  const recentTest = state?.logs.find((entry) => {
    const details = entry.details as { engine?: Engine; profile?: ProfileKey; result?: { ok?: boolean; codexCompatible?: boolean; claudeCompatible?: boolean; adapterAvailable?: boolean } };
    return entry.type === "connection_test" && details.engine === activeEngine && details.profile === activeProfile && details.result?.ok && (details.result?.codexCompatible !== false && details.result?.claudeCompatible !== false || details.result?.adapterAvailable) && Date.parse(entry.at) >= lastSwitchAt;
  });
  const switchVerified = lastSwitchStillVerified(state, activeEngine);
  const statusKind: StatusKind = !state?.config.ok ? "unknown" : conflicts.length ? "conflict" : recentTest || switchVerified ? "verified" : state.data.lastSwitch?.success ? "pending" : "unverified";
  const statusLabel = c[statusKind];
  const providerName = state?.config.status.provider || state?.config.status.mode || "—";
  const officialLabel = activeEngine === "claude" ? "Claude Code" : "OpenAI";
  const providerLabel = state?.config.status.mode === "third-party" || state?.config.status.mode === "local-adapter" ? c.third : state?.config.status.mode === "openai" || state?.config.status.mode === "official" ? officialLabel : providerName;
  const pageTitle = c[tab as keyof typeof c] || c.switch;
  const widePage = tab === "tokens" || tab === "records";
  const eulaRequired = Boolean(state && state.data.eulaAcceptance?.version !== EULA_VERSION);

  return (
    <MotionConfig reducedMotion="user">
      <div className={`app-shell ${collapsed || narrow ? "sidebar-collapsed" : ""} ${isMaximized ? "is-maximized" : ""}`} data-maximized={isMaximized ? "true" : "false"}>
        <Sidebar collapsed={collapsed || narrow} locked={narrow} setCollapsed={setCollapsed} tab={tab} requestTab={requestTab} lang={lang} activeEngine={activeEngine} setActiveEngine={switchEngine} />
        <main className="main-stage">
          <div className={`content-frame ${widePage ? "content-frame-wide" : ""}`}>
            <TopBar
              title={pageTitle}
              kind={statusKind}
              label={statusLabel}
              provider={providerLabel}
              model={state?.config.status.model || "—"}
              source={state?.config.status.activeEnvKey || (state?.config.status.configPath ? (lang === "zh" ? "配置文件" : "Config file") : "—")}
              conflicts={conflicts.length}
              verifiedAt={recentTest?.at || (switchVerified ? state?.data.lastSwitch?.at : undefined)}
              busy={busy}
              refresh={() => refresh(false)}
              openStatus={() => requestTab("status")}
              lang={lang}
            />
            <section className="workspace">
              <AnimatePresence mode="wait">
                <motion.div key={tab} className="page" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .15, ease: "easeOut" }}>
                  {tab === "switch" && <SwitchPage lang={lang} engine={activeEngine} state={state} profiles={profiles} selected={selectedTarget} setSelected={setSelectedTarget} steps={stepStates} busy={busy} launchBusy={launchBusy} runSwitch={runSwitch} launchEngine={launchActiveEngine} goProfile={(key) => { setProfileTab(key); requestTab("profiles"); }} receipt={receipt} error={switchError} resultHeadingRef={resultHeadingRef} openTest={() => { setTestProfile(selectedTarget); requestTab("test"); }} requestReset={() => setDialog({ title: activeEngine === "claude" ? (lang === "zh" ? "恢复 Claude Code 官方配置？" : "Restore Claude Code official settings?") : (lang === "zh" ? "恢复 OpenAI 默认配置？" : "Restore OpenAI defaults?"), description: activeEngine === "claude" ? (lang === "zh" ? "此操作会覆盖当前 Claude Code 配置，执行前会自动创建备份。" : "This overwrites the current Claude Code settings and creates a backup first.") : (lang === "zh" ? "此操作会覆盖当前 Codex API 配置，执行前会自动创建备份。" : "This overwrites the current Codex API configuration and creates a backup first."), confirmLabel: activeEngine === "claude" ? (lang === "zh" ? "恢复 Claude Code 官方配置" : "Restore Claude Code official settings") : c.resetOpenAI, danger: true, onConfirm: async () => { setDialog(null); const result = await window.api.resetCleanOpenAI(); setState(result.state); showToast(activeEngine === "claude" ? (lang === "zh" ? "已恢复 Claude Code 官方配置" : "Claude Code official settings restored") : (lang === "zh" ? "已恢复 OpenAI 默认配置" : "OpenAI defaults restored")); } })} />}
                  {tab === "status" && <StatusPage lang={lang} state={state} refresh={() => refresh(false)} showToast={showToast} />}
                  {tab === "profiles" && <ProfilesPage lang={lang} engine={activeEngine} active={profileTab} setActive={setProfileTab} profiles={profiles} setProfiles={setProfiles} headersDraft={headersDraft} setHeadersDraft={setHeadersDraft} headersError={headersError} dirty={profilesDirty} saveProfiles={saveProfiles} fetchModels={fetchModels} busy={busy} showToast={showToast} auth={state?.auth} />}
                  {tab === "test" && <TestPage lang={lang} engine={activeEngine} profileKey={testProfile} setProfileKey={setTestProfile} profiles={profiles} result={testResults[testProfile] || null} busy={busy} testConnection={testConnection} showToast={showToast} />}
                  {tab === "records" && <RecordsPage lang={lang} state={state} setState={setState} showToast={showToast} requestConfirm={setDialog} />}
                  {tab === "tokens" && <TokensPage lang={lang} state={state} tokenPrice={tokenPrice} setTokenPrice={setTokenPrice} />}
                  {tab === "settings" && <SettingsPage lang={lang} setLang={setLang} appearance={appearance} setAppearance={setAppearance} defaultPage={defaultPage} setDefaultPage={setDefaultPage} closeToTray={closeToTray} setCloseToTray={setCloseToTray} promptTest={promptTest} setPromptTest={setPromptTest} state={state} showToast={showToast} requestConfirm={setDialog} setState={setState} openEula={() => setEulaOpen(true)} openLegal={setLegalView} />}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
        </main>
        <WindowControls isMaximized={isMaximized} />
        {toast && <Toast message={toast.message} error={toast.error} />}
        {dialog && <ConfirmDialog dialog={dialog} close={() => { setDialog(null); setPendingTab(null); }} />}
        {(eulaRequired || eulaOpen) && <EulaDialog lang={lang} required={eulaRequired} acceptedAt={state?.data.eulaAcceptance?.acceptedAt} close={() => setEulaOpen(false)} accept={async () => { setState(await window.api.acceptEula(EULA_VERSION)); setEulaOpen(false); }} decline={() => window.api.declineEula()} />}
        {legalView && <LegalInfoDialog lang={lang} view={legalView} close={() => setLegalView(null)} />}
      </div>
    </MotionConfig>
  );
}

function Sidebar({ collapsed, locked, setCollapsed, tab, requestTab, lang, activeEngine, setActiveEngine }: { collapsed: boolean; locked: boolean; setCollapsed: (value: boolean) => void; tab: TabKey; requestTab: (tab: TabKey) => void; lang: Lang; activeEngine: Engine; setActiveEngine: (engine: Engine) => void }) {
  const c = text[lang];
  const renderItem = (item: typeof navItems[number] | { key: "settings"; active: string; inactive: string; zh: string; en: string }) => {
    const selected = tab === item.key;
    const label = lang === "zh" ? item.zh : item.en;
    return (
      <button key={item.key} className={`nav-item ${selected ? "is-active" : ""}`} onClick={() => requestTab(item.key)} aria-current={selected ? "page" : undefined} aria-label={label} title={collapsed ? label : undefined}>
        <span className="nav-icon" data-icon-style={selected ? "linear" : "flat"} style={{ "--nav-icon-url": `url("${selected ? item.active : item.inactive}")` } as CSSProperties} />
        <span className="nav-label">{label}</span>
        {collapsed && <span className="nav-tooltip">{label}</span>}
      </button>
    );
  };
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <img src={brandIcon} alt="" className="brand-icon" />
        <strong className="brand-name">Apivot</strong>
        {!collapsed && !locked && <button className="icon-button compact" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar"><ChevronDown className="rotate-90" /></button>}
      </div>
      <EngineSwitcher collapsed={collapsed} activeEngine={activeEngine} setActiveEngine={setActiveEngine} lang={lang} />
      <nav className="nav-list" aria-label="Main navigation">{navItems.map(renderItem)}</nav>
      <div className="sidebar-bottom">
        {collapsed && !locked && <button className="icon-button compact expand-button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar"><ChevronDown className="-rotate-90" /></button>}
        {renderItem({ key: "settings", active: settingsNavIcon, inactive: settingsNavFlatIcon, zh: c.settings, en: c.settings })}
      </div>
    </aside>
  );
}

function EngineSwitcher({ collapsed, activeEngine, setActiveEngine, lang }: { collapsed: boolean; activeEngine: Engine; setActiveEngine: (engine: Engine) => void; lang: Lang }) {
  if (collapsed) {
    return (
      <div className="engine-switcher-collapsed" role="tablist" aria-label={lang === "zh" ? "工作区" : "Workspace"}>
        {(["codex", "claude"] as Engine[]).map((engine) => (
          <button
            key={engine}
            type="button"
            role="tab"
            aria-label={engine === "codex" ? "Codex" : "Claude Code"}
            aria-selected={activeEngine === engine}
            data-engine={engine}
            className={`engine-dot ${activeEngine === engine ? "active" : "inactive"}`}
            onClick={() => setActiveEngine(engine)}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="engine-switcher" role="tablist" aria-label={lang === "zh" ? "工作区" : "Workspace"}>
      <button type="button" role="tab" aria-selected={activeEngine === "codex"} data-engine="codex" className={`engine-btn ${activeEngine === "codex" ? "active" : ""}`} onClick={() => setActiveEngine("codex")}>Codex</button>
      <button type="button" role="tab" aria-selected={activeEngine === "claude"} data-engine="claude" className={`engine-btn ${activeEngine === "claude" ? "active" : ""}`} onClick={() => setActiveEngine("claude")}>Claude</button>
    </div>
  );
}

function TopBar({ title, kind, label, provider, model, source, conflicts, verifiedAt, busy, refresh, openStatus, lang }: { title: string; kind: StatusKind; label: string; provider: string; model: string; source: string; conflicts: number; verifiedAt?: string; busy: boolean; refresh: () => void; openStatus: () => void; lang: Lang }) {
  const c = text[lang];
  const statusText = conflicts ? `${conflicts} ${c.conflict}` : label;
  const statusDetails = [provider, model, source, statusText, verifiedAt ? formatTime(verifiedAt) : ""].filter(Boolean).join(" · ");
  return (
    <header className="topbar drag-region">
      <h1>{title}</h1>
      <button className={`effective-status no-drag status-${kind}`} onClick={openStatus} title={statusDetails} aria-label={`${lang === "zh" ? "当前配置" : "Current configuration"}: ${statusDetails}`}>
        <span className="status-dot" />
        <strong>{provider}</strong>
        <span>{model}</span>
        <span className="status-separator" />
        <span>{statusText}</span>
      </button>
      <div className="topbar-actions no-drag">
        <button className="secondary-button refresh-button" onClick={refresh} disabled={busy} title="Ctrl+R">
          {busy ? <Loader2 className="spin" /> : <RefreshCw />}{c.refresh}
        </button>
      </div>
    </header>
  );
}

function WindowControls({ isMaximized }: { isMaximized: boolean }) {
  return (
    <div className="window-controls no-drag">
      <button className="window-button" onClick={() => window.api.minimizeWindow()} aria-label="Minimize"><Minus /></button>
      <button className="window-button" onClick={() => window.api.toggleMaximize()} aria-label={isMaximized ? "Restore" : "Maximize"}>{isMaximized ? <Copy /> : <Square />}</button>
      <button className="window-button close" onClick={() => window.api.closeWindow()} aria-label="Close app"><X /></button>
    </div>
  );
}

function SwitchPage({ lang, engine, state, profiles, selected, setSelected, steps, busy, launchBusy, runSwitch, launchEngine, goProfile, receipt, error, resultHeadingRef, openTest, requestReset }: { lang: Lang; engine: Engine; state: AppState | null; profiles: Record<ProfileKey, Profile>; selected: ProfileKey; setSelected: (key: ProfileKey) => void; steps: StepState[]; busy: boolean; launchBusy: boolean; runSwitch: () => void; launchEngine: () => void; goProfile: (key: ProfileKey) => void; receipt: Awaited<ReturnType<typeof window.api.applySwitch>>["receipt"] | null; error: string; resultHeadingRef: React.RefObject<HTMLHeadingElement | null>; openTest: () => void; requestReset: () => void }) {
  const c = text[lang];
  const profile = profiles[selected];
  const conflicts = state?.config.status.envConflicts || [];
  const targetReady = profileSwitchReady(profile, selected, state?.auth, engine);
  const visibleSteps = getSwitchSteps(engine, selected);
  const officialDisplay = engine === "claude" ? (lang === "zh" ? "Claude Code 官方" : "Claude Code Official") : c.official;
  const checks = [
    { label: lang === "zh" ? "目标配置与认证" : "Target configuration and auth", ok: targetReady, severity: targetReady ? "ok" : "error", detail: targetReady ? (selected === "openai" && profile.authMode !== "api" ? (engine === "claude" ? (lang === "zh" ? "使用 Claude Code 官方路径" : "Uses Claude Code official path") : (lang === "zh" ? "使用现有 ChatGPT 登录" : "Uses existing ChatGPT login")) : (lang === "zh" ? "完整" : "Complete")) : (lang === "zh" ? "缺少配置或登录" : "Missing configuration or login") },
    { label: lang === "zh" ? "配置文件路径" : "Configuration path", ok: Boolean(state?.config.status.configPath), severity: state?.config.status.configPath ? "ok" : "error", detail: state?.config.status.configPath || "—" },
    { label: lang === "zh" ? "环境变量冲突" : "Environment conflicts", ok: !conflicts.length, severity: conflicts.length ? "warning" : "ok", detail: conflicts.length ? `${conflicts.length} ${c.conflict}` : c.noConflict }
  ];
  return (
    <div className="switch-flow page-content" data-page="switch">
      <section className="flow-card">
        <SectionHeading number="1" title={lang === "zh" ? "选择目标" : "Choose target"} description={lang === "zh" ? "确认即将写入的 Profile。" : "Confirm the profile that will be written."} />
        <div className="target-grid">
          {(["openai", "thirdParty"] as ProfileKey[]).map((key) => {
            const item = profiles[key];
            const active = selected === key;
            const complete = profileSwitchReady(item, key, state?.auth, engine);
            return (
              <div key={key} role="button" tabIndex={0} className={`target-card ${active ? "is-selected" : ""} ${!complete ? "is-incomplete" : ""}`} onClick={() => setSelected(key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(key); }}>
                <div className="target-card-top"><strong>{key === "openai" ? officialDisplay : c.third}</strong><Badge tone={complete ? "success" : "warning"}>{complete ? (lang === "zh" ? "可用" : "Ready") : (lang === "zh" ? "待完善" : "Incomplete")}</Badge></div>
                <CodeLine>{item.baseUrl || "Base URL not set"}</CodeLine>
                <div className="target-meta"><span>{item.model || "Model not set"}</span><span>{key === "openai" && item.authMode !== "api" ? (engine === "claude" ? "Official" : "ChatGPT") : item.wireApi}</span>{!complete && <button type="button" className="go-profile-link" onClick={(event) => { event.stopPropagation(); goProfile(key); }}>{lang === "zh" ? "去配置 →" : "Configure →"}</button>}</div>
                <span className={`radio-mark ${active ? "checked" : ""}`}>{active && <Check />}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flow-card">
        <SectionHeading number="2" title={lang === "zh" ? "执行前检查" : "Preflight checks"} description={checks.every((item) => item.ok) ? (lang === "zh" ? "检查通过，可执行切换。" : "Checks passed. Ready to switch.") : (lang === "zh" ? "请先处理异常项。" : "Resolve the issues below first.")} />
        <div className="check-list">
          {checks.map((item) => <div className={`check-row ${item.severity}`} key={item.label}>{item.severity === "ok" ? <CheckCircle2 /> : item.severity === "error" ? <XCircle /> : <AlertTriangle />}<div><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}
        </div>
      </section>

      <section className="flow-card execute-card">
        <SectionHeading number="3" title={lang === "zh" ? "执行与验证" : "Execute and verify"} description={lang === "zh" ? "系统会备份、写入、重读并核对结果。" : "The app backs up, writes, re-reads, and verifies the result."} />
        <div className="execute-grid">
          <div className="step-list">
            {visibleSteps.map((step, index) => <SwitchStep key={step.key} label={lang === "zh" ? step.zh : step.en} state={steps[index]} last={index === visibleSteps.length - 1} />)}
          </div>
          <div className="execute-actions">
            <button className="primary-button" onClick={runSwitch} disabled={busy || !targetReady}>{busy ? <Loader2 className="spin" /> : <Play />}{c.switchVerify}</button>
            <button className="secondary-button" onClick={openTest}><Wifi />{lang === "zh" ? "测试目标连接" : "Test target connection"}</button>
            <button className="secondary-button" onClick={launchEngine} disabled={!receipt || launchBusy}>{launchBusy ? <Loader2 className="spin" /> : <Play />}{launchBusy ? (lang === "zh" ? "启动中..." : "Launching...") : engine === "claude" ? (lang === "zh" ? "启动 Claude Code" : "Launch Claude Code") : (lang === "zh" ? "启动 Codex" : "Launch Codex")}</button>
          </div>
        </div>
      </section>

      {selected === "thirdParty" && <div className="scope-note warning-note"><AlertTriangle /><span>{lang === "zh" ? "第三方原生接口不可用时，Apivot 会尝试启动当前工作区需要的本地适配器。请保持 Apivot 运行；已有官方会话记录会保留，但不强行混用同一个对话状态。" : "If native compatibility is unavailable, Apivot can start the local adapter required by the current workspace. Keep Apivot running; official conversations are preserved but not forced into the same provider state."}</span></div>}

      {(receipt || error) && <ResultReceipt lang={lang} receipt={receipt} error={error} resultHeadingRef={resultHeadingRef} openTest={openTest} />}

      <section className="danger-zone">
        <div><strong>{c.dangerZone}</strong><span>{lang === "zh" ? "仅在第三方配置污染官方环境时使用。执行前会自动备份。" : "Use only when third-party settings have polluted the official environment. A backup is created first."}</span></div>
        <button className="danger-button" onClick={requestReset}><RotateCcw />{engine === "claude" ? (lang === "zh" ? "恢复 Claude Code 官方配置" : "Restore Claude Code official settings") : c.resetOpenAI}</button>
      </section>
    </div>
  );
}

function SwitchStep({ label, state, last }: { label: string; state: StepState; last: boolean }) {
  return <div className={`switch-step state-${state}`}><div className="step-track"><motion.span animate={state === "done" ? { scale: [0.8, 1] } : { scale: 1 }}>{state === "done" ? <Check /> : state === "error" ? <X /> : state === "running" ? <Loader2 className="spin" /> : <Circle />}</motion.span>{!last && <i />}</div><strong>{label}</strong><small>{state === "done" ? "Done" : state === "running" ? "Running" : state === "error" ? "Failed" : "Pending"}</small></div>;
}

function ResultReceipt({ lang, receipt, error, resultHeadingRef, openTest }: { lang: Lang; receipt: Awaited<ReturnType<typeof window.api.applySwitch>>["receipt"] | null; error: string; resultHeadingRef: React.RefObject<HTMLHeadingElement | null>; openTest: () => void }) {
  const anyReceipt = receipt as Record<string, string | boolean | undefined> | null;
  const rows = receipt ? [
    [lang === "zh" ? "实际写入文件" : "Written file", String(anyReceipt?.configPath || anyReceipt?.file || "—")],
    [lang === "zh" ? "切换前 Base URL" : "Previous Base URL", String(anyReceipt?.beforeBaseUrl || anyReceipt?.beforeUrl || "—")],
    [lang === "zh" ? "切换后 Base URL" : "New Base URL", String(anyReceipt?.afterBaseUrl || anyReceipt?.afterUrl || anyReceipt?.anthropicUrl || "—")],
    [lang === "zh" ? "模型" : "Model", String(anyReceipt?.visibleModel ? `${anyReceipt.visibleModel} → ${anyReceipt.realModel || "—"}` : `${anyReceipt?.beforeModel || "—"} → ${anyReceipt?.afterModel || "—"}`)],
    [lang === "zh" ? "备份编号" : "Backup ID", receipt.backupId],
    [lang === "zh" ? "会话快照" : "Session snapshot", String(anyReceipt?.codexStateSnapshotId || anyReceipt?.claudeStateSnapshotId || "—")],
    [lang === "zh" ? "环境变量" : "Environment", receipt.envAction],
    [lang === "zh" ? "是否需要重启" : "Restart required", anyReceipt?.restartRequired || anyReceipt?.needRestart ? (lang === "zh" ? "是" : "Yes") : (lang === "zh" ? "否" : "No")]
  ] : [];
  return (
    <motion.section className={`receipt-card ${error ? "has-error" : ""}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .2 }}>
      <div className="receipt-heading">{error ? <XCircle /> : <ClipboardCheck />}<div><h2 ref={resultHeadingRef} tabIndex={-1}>{error ? (lang === "zh" ? "切换失败" : "Switch failed") : (lang === "zh" ? "切换回执" : "Switch receipt")}</h2><p>{error || (lang === "zh" ? "配置已写入并重新读取验证。" : "The configuration was written and verified by re-reading it.")}</p></div></div>
      {receipt && <div className="receipt-grid">{rows.map(([label, value]) => <KeyValueRow key={label} label={label} value={value} copy />)}</div>}
      <div className="receipt-actions"><button className="secondary-button" onClick={openTest}><Wifi />{text[lang].testCurrent}</button></div>
    </motion.section>
  );
}

function StatusPage({ lang, state, refresh, showToast }: { lang: Lang; state: AppState | null; refresh: () => void; showToast: (message: string, error?: boolean) => void }) {
  const c = text[lang];
  const status = state?.config.status;
  const rows = [
    [lang === "zh" ? "模式" : "Mode", status?.mode || "—"],
    [lang === "zh" ? "提供方" : "Provider", status?.provider || "—"],
    [lang === "zh" ? "服务地址" : "Base URL", status?.baseUrl || "—"],
    [lang === "zh" ? "模型" : "Model", status?.model || "—"],
    [lang === "zh" ? "端点" : "Endpoint", status?.wireApi || "—"],
    [lang === "zh" ? "配置路径" : "Config path", status?.configPath || "—"],
    [lang === "zh" ? "本地数据" : "Local data", state?.paths.appDataDir || "—"]
  ];
  const sourceSteps = [lang === "zh" ? "进程环境变量" : "Process env", lang === "zh" ? "用户环境变量" : "User env", lang === "zh" ? "项目配置" : "Project config", lang === "zh" ? "用户配置" : "User config"];
  const hit = status?.activeEnvKey ? 0 : 3;
  return (
    <div className="two-column-page status-page">
      <Card title={lang === "zh" ? "实际生效配置" : "Effective configuration"} icon={<ShieldCheck />}>
        <div className="key-value-list">{rows.map(([label, value], index) => <KeyValueRow key={label} label={label} value={value} copy={index >= 2} open={label.includes("路径") || label.includes("path") || label.includes("数据")} showToast={showToast} />)}</div>
        <div className="inline-actions"><button className="secondary-button" onClick={refresh}><RefreshCw />{c.refresh}</button><button className="secondary-button" onClick={async () => { const next = await window.api.selectConfig(); setTimeout(refresh, 0); showToast(lang === "zh" ? "已更新配置路径" : "Configuration path updated"); }}><FolderOpen />{lang === "zh" ? "选择配置文件" : "Choose config file"}</button></div>
      </Card>
      <div className="stacked-column">
        <Card title={lang === "zh" ? "配置来源优先级" : "Configuration source priority"} icon={<Database />} compact>
          <div className="source-priority">{sourceSteps.map((item, index) => <div className={index === hit ? "is-hit" : ""} key={item}><span>{index + 1}</span><strong>{item}</strong>{index === hit && <Badge tone="accent">{lang === "zh" ? "当前命中" : "Active"}</Badge>}</div>)}</div>
        </Card>
        <Card title={lang === "zh" ? "环境变量冲突" : "Environment conflicts"} icon={<AlertTriangle />}>
          {status?.envConflicts?.length ? <div className="conflict-list">{status.envConflicts.map((item) => <div className="conflict-card" key={item.key}><div className="conflict-title"><AlertTriangle /><strong>{item.key}</strong><Badge tone="caution">{c.conflict}</Badge></div><KeyValueRow label={lang === "zh" ? "检测值" : "Detected value"} value={item.value} copy showToast={showToast} /><KeyValueRow label={lang === "zh" ? "配置值" : "Config value"} value={item.conflictsWith || status.baseUrl} /><KeyValueRow label={lang === "zh" ? "当前优先使用" : "Current priority"} value={item.priorityNote || (lang === "zh" ? "环境变量" : "Environment variable")} /><KeyValueRow label={lang === "zh" ? "修复命令" : "Fix command"} value={item.fixCommand || `setx ${item.key} ""`} copy showToast={showToast} /></div>)}</div> : <EmptyState icon={<CheckCircle2 />} title={c.noConflict} description={lang === "zh" ? "当前读取结果与配置文件一致。" : "The current values match the configuration file."} />}
        </Card>
      </div>
    </div>
  );
}

function ProfilesPage({ lang, engine, active, setActive, profiles, setProfiles, headersDraft, setHeadersDraft, headersError, dirty, saveProfiles, fetchModels, busy, showToast, auth }: { lang: Lang; engine: Engine; active: ProfileKey; setActive: (key: ProfileKey) => void; profiles: Record<ProfileKey, Profile>; setProfiles: (profiles: Record<ProfileKey, Profile>) => void; headersDraft: Record<ProfileKey, string>; setHeadersDraft: (value: Record<ProfileKey, string>) => void; headersError: string; dirty: boolean; saveProfiles: () => void; fetchModels: () => void; busy: boolean; showToast: (message: string, error?: boolean) => void; auth?: AppState["auth"] }) {
  const c = text[lang];
  const profile = profiles[active];
  const update = (next: Partial<Profile>) => setProfiles({ ...profiles, [active]: { ...profile, ...next } });
  const updateModel = (model: string) => update(engine === "claude" && active === "thirdParty" ? { model, targetModel: model } : { model });
  const complete = profileConfigured(profile, active);
  const normalized = normalizeBaseUrl(profile.baseUrl);
  const requestPath = profile.wireApi === "responses" ? "responses" : profile.wireApi === "openai_chat_adapter" ? "chat/completions → /v1/messages" : "chat/completions";
  const officialDisplay = engine === "claude" ? (lang === "zh" ? "Claude Code 官方" : "Claude Code Official") : c.official;
  return (
    <div className="profile-page">
      <div className="segmented profile-segmented"><button className={active === "openai" ? "active" : ""} onClick={() => setActive("openai")}>{officialDisplay}</button><button className={active === "thirdParty" ? "active" : ""} onClick={() => setActive("thirdParty")}>{c.third}</button></div>
      <Card title={active === "openai" ? officialDisplay : c.third} icon={<KeyRound />} headerRight={<div className="profile-status"><Badge tone={complete ? "success" : "warning"}>{complete ? (lang === "zh" ? "已配置" : "Configured") : (lang === "zh" ? "未配置" : "Not configured")}</Badge><span>{dirty ? (lang === "zh" ? "有未保存修改" : "Unsaved changes") : (lang === "zh" ? "已保存" : "Saved")}</span></div>}>
        <div className="profile-form">
          <Field label={lang === "zh" ? "提供方 ID" : "Provider ID"}><input className="input mono" value={profile.providerId} disabled={active === "openai"} onChange={(event) => update({ providerId: event.target.value })} /></Field>
          <Field label={lang === "zh" ? "模型" : "Model"}><ModelPicker profile={profile} onChange={updateModel} lang={lang} /></Field>
          {active === "openai" && <Field label={lang === "zh" ? "认证方式" : "Authentication method"}><select className="input" value={profile.authMode || "chatgpt"} onChange={(event) => update({ authMode: event.target.value as "chatgpt" | "api", updateEnv: event.target.value === "api" })}><option value="chatgpt">{engine === "claude" ? (lang === "zh" ? "Claude Code 官方登录路径" : "Claude Code official login path") : (lang === "zh" ? "Codex 已登录的 ChatGPT 账号" : "Existing Codex ChatGPT login")}</option><option value="api">{engine === "claude" ? "Anthropic API Key / Auth Token" : "OpenAI Platform API Key"}</option></select></Field>}
          {active === "openai" && profile.authMode !== "api" ? <>
            <Field label={lang === "zh" ? "登录状态" : "Login status"}><div className={`auth-status ${(engine === "claude" ? auth?.signedIn : auth?.hasChatGptSession) ? "ok" : "error"}`}>{engine === "claude" ? (auth?.signedIn ? <CheckCircle2 /> : <AlertTriangle />) : (auth?.hasChatGptSession ? <CheckCircle2 /> : <AlertTriangle />)}<span>{engine === "claude" ? (auth?.signedIn ? (lang === "zh" ? "已检测到 Claude Code 官方状态" : "Claude Code official state detected") : (lang === "zh" ? "未检测到 Claude Code 登录，启动后可按官方流程登录" : "No Claude Code login detected; launch Claude Code and sign in normally")) : (auth?.hasChatGptSession ? (lang === "zh" ? "已检测到 ChatGPT 登录，无需 API Key" : "ChatGPT login detected; no API key required") : (lang === "zh" ? "未检测到登录，请先打开 Codex 登录" : "No login detected; sign in from Codex first"))}</span></div></Field>
            <Field label={lang === "zh" ? "服务地址" : "Base URL"} wide><input className="input mono" value={engine === "claude" ? "https://api.anthropic.com" : "https://api.openai.com/v1"} readOnly /></Field>
          </> : <>
            <Field label={lang === "zh" ? "密钥" : "API key"}><SecretField value={profile.apiKey} onChange={(apiKey) => update({ apiKey })} showToast={showToast} lang={lang} /></Field>
            <Field label={lang === "zh" ? "端点" : "Endpoint"}><select className="input" value={profile.wireApi} onChange={(event) => update({ wireApi: event.target.value })}>{engine === "claude" ? <><option value="openai_chat_adapter">{lang === "zh" ? "Chat Completions 适配器" : "Chat Completions Adapter"}</option><option value="anthropic_messages">Anthropic Messages API</option></> : <><option value="responses">Responses API</option>{active === "thirdParty" && <option value="chat_completions">{lang === "zh" ? "Chat Completions（适配器回退）" : "Chat Completions (adapter fallback)"}</option>}</>}</select></Field>
            <Field label={lang === "zh" ? "服务地址" : "Base URL"} wide><input className="input mono" value={profile.baseUrl} onChange={(event) => update({ baseUrl: event.target.value })} /><div className="field-preview"><span>{lang === "zh" ? "规范化" : "Normalized"}: {normalized || "—"}</span><span>{lang === "zh" ? "最终请求" : "Request"}: {normalized ? `${normalized}/${requestPath}` : "—"}</span></div></Field>
            <Field label={lang === "zh" ? "环境变量" : "Environment variable"}><input className="input mono" value={profile.envKey} onChange={(event) => update({ envKey: event.target.value })} /></Field>
            <Field label={lang === "zh" ? "写入行为" : "Write behavior"}><Toggle checked={Boolean(profile.updateEnv)} onChange={(value) => update({ updateEnv: value })} label={lang === "zh" ? "切换时写入用户环境变量" : "Write user environment variable during switch"} /></Field>
          </>}
          {active === "thirdParty" && <Field label={lang === "zh" ? "请求头 JSON" : "Headers JSON"} wide><textarea className={`input textarea mono ${headersError ? "has-error" : ""}`} value={headersDraft[active]} onChange={(event) => { const value = event.target.value; setHeadersDraft({ ...headersDraft, [active]: value }); try { update({ headers: JSON.parse(value || "{}") }); } catch { /* keep invalid draft visible */ } }} />{headersError && <div className="field-error"><AlertTriangle />{headersError}</div>}</Field>}
        </div>
        {engine === "codex" && active === "thirdParty" && profile.wireApi !== "responses" && <div className="notice-strip warning-note"><AlertTriangle /><span>{lang === "zh" ? "该服务将通过本地适配器兼容 Chat Completions，并记录可观测的 token usage。" : "This service will use the local adapter for Chat Completions compatibility and observable token usage."}</span></div>}
        {engine === "claude" && active === "thirdParty" && <div className="scope-note"><Info /><span>{lang === "zh" ? `Claude Code 内部显示 ${profile.claudeFacingModel || "claude-opus-4-8"}；本地适配器实际转发到 ${profile.targetModel || profile.model || "未选择模型"}。保存并执行切换后，新启动的 Claude Code 才会使用该目标模型。` : `Claude Code sees ${profile.claudeFacingModel || "claude-opus-4-8"}; the local adapter forwards to ${profile.targetModel || profile.model || "no model selected"}. Save and switch, then launch a new Claude Code session for it to take effect.`}</span></div>}
        <div className="form-actions"><button className="secondary-button" onClick={fetchModels} disabled={busy || active !== "thirdParty"}><Download />{lang === "zh" ? "刷新模型列表" : "Refresh models"}</button><button className="primary-button" onClick={saveProfiles} disabled={!dirty || Boolean(headersError)}><Save />{c.save}</button></div>
      </Card>
    </div>
  );
}

function ModelPicker({ profile, onChange, lang }: { profile: Profile; onChange: (value: string) => void; lang: Lang }) {
  const [query, setQuery] = useState("");
  const options = (profile.modelOptions || []).filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  const groups = groupModels(options);
  if (!profile.modelOptions?.length) return <input className="input mono" value={profile.model} onChange={(event) => onChange(event.target.value)} />;
  return <div className="model-picker"><div className="input-with-icon"><Search /><input className="input" placeholder={lang === "zh" ? "搜索模型" : "Search models"} value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="input mono" value={profile.model} onChange={(event) => onChange(event.target.value)}>{Object.entries(groups).map(([group, items]) => items.length ? <optgroup key={group} label={group}>{items.map((item) => <option key={item}>{item}</option>)}</optgroup> : null)}</select></div>;
}

function SecretField({ value, onChange, showToast, lang }: { value: string; onChange: (value: string) => void; showToast: (message: string) => void; lang: Lang }) {
  const [visible, setVisible] = useState(false);
  return <div className="secret-field"><input className="input mono" value={visible ? value : maskSecret(value)} readOnly={!visible} onChange={(event) => onChange(event.target.value)} /><div className="field-icon-actions"><button onClick={() => setVisible(!visible)} aria-label={visible ? "Hide API key" : "Show API key"}>{visible ? <EyeOff /> : <Eye />}</button><button onClick={async () => { await navigator.clipboard.writeText(value); showToast(lang === "zh" ? "已复制 API Key" : "API key copied"); }} aria-label="Copy API key"><Copy /></button><button onClick={() => onChange("")} aria-label="Clear API key"><X /></button></div></div>;
}

function TestPage({ lang, engine, profileKey, setProfileKey, profiles, result, busy, testConnection, showToast }: { lang: Lang; engine: Engine; profileKey: ProfileKey; setProfileKey: (key: ProfileKey) => void; profiles: Record<ProfileKey, Profile>; result: ConnectionResult | null; busy: boolean; testConnection: (key: ProfileKey) => void; showToast: (message: string) => void }) {
  const c = text[lang];
  const profile = profiles[profileKey];
  const chatGptAuth = profileKey === "openai" && profile.authMode !== "api";
  const officialDisplay = engine === "claude" ? (lang === "zh" ? "Claude Code 官方" : "Claude Code Official") : c.official;
  const diagnostics = chatGptAuth ? [
    { label: lang === "zh" ? "ChatGPT 登录" : "ChatGPT login", ok: result ? Boolean(result.ok) : undefined },
    { label: lang === "zh" ? "无需 API Key" : "No API key required", ok: result ? result.authMode === "chatgpt" : undefined },
    { label: lang === "zh" ? "官方 Provider" : "Official provider", ok: result ? Boolean(engine === "claude" ? result.claudeCompatible ?? result.ok : result.codexCompatible ?? result.ok) : undefined },
    { label: lang === "zh" ? "本地会话保留" : "Local sessions preserved", ok: result ? true : undefined }
  ] : [
    { label: "DNS / Connection", ok: result ? result.status !== 0 && !/dns|connect|fetch/i.test(result.error || "") : undefined },
    { label: lang === "zh" ? "鉴权" : "Authentication", ok: result ? result.status !== 401 && result.status !== 403 : undefined },
    { label: lang === "zh" ? "模型可用" : "Model availability", ok: result ? Boolean(result.adapterAvailable) || result.status !== 404 : undefined },
    { label: profileKey === "thirdParty" ? (engine === "claude" ? (lang === "zh" ? "Claude Code 可用路径" : "Claude Code usable path") : (lang === "zh" ? "Codex 可用路径" : "Codex usable path")) : (lang === "zh" ? "请求格式" : "Request format"), ok: result ? profileKey === "thirdParty" ? Boolean(result.codexCompatible || result.claudeCompatible || result.adapterAvailable) : Boolean(result.ok) || ![400, 422].includes(Number(result.status)) : undefined }
  ];
  const overallOk = profileKey === "thirdParty"
    ? Boolean((result?.ok && result?.codexCompatible !== false && result?.claudeCompatible !== false) || result?.adapterAvailable)
    : Boolean(result?.ok);
  const diagnosticText = JSON.stringify({ profile: profileKey, baseUrl: profile.baseUrl, endpoint: profile.wireApi, model: profile.model, headers: Object.keys(profile.headers || {}), result: result ? { ...result, apiKey: undefined } : null }, null, 2);
  return (
    <div className="test-page two-column-page">
      <Card title={lang === "zh" ? "测试配置" : "Test configuration"} icon={<Wifi />}>
        <div className="segmented"><button className={profileKey === "openai" ? "active" : ""} onClick={() => setProfileKey("openai")}>{officialDisplay}</button><button className={profileKey === "thirdParty" ? "active" : ""} onClick={() => setProfileKey("thirdParty")}>{c.third}</button></div>
        <div className={`notice-strip ${profileKey === "thirdParty" ? "warning-note" : ""}`}>{profileKey === "thirdParty" ? <AlertTriangle /> : <Info />}<span>{profileKey === "thirdParty" ? (engine === "claude" ? (lang === "zh" ? "接口返回成功不等于 Claude Code 可用；程序会额外检查 Anthropic Messages 或本地适配能力。" : "Endpoint success does not guarantee Claude Code compatibility; Anthropic Messages or local adapter support is checked separately.") : (lang === "zh" ? "接口返回成功不等于 Codex 桌面端可用；程序会额外检查 Responses API。" : "Endpoint success does not guarantee Codex compatibility; the Responses API is checked separately.")) : chatGptAuth ? (engine === "claude" ? (lang === "zh" ? "检查 Claude Code 官方登录路径，不会调用第三方 API，也不需要 API Key。" : "Checks the official Claude Code login path without calling third-party APIs or requiring an API key.") : (lang === "zh" ? "检查 Codex 已保存的 ChatGPT 登录，不会调用 OpenAI API，也不需要 API Key。" : "Checks the saved Codex ChatGPT login without calling the API or requiring an API key.")) : c.useCurrentValues}</span></div>
        <div className="key-value-list compact-list"><KeyValueRow label={chatGptAuth ? (lang === "zh" ? "认证方式" : "Authentication") : (lang === "zh" ? "服务地址" : "Base URL")} value={chatGptAuth ? (engine === "claude" ? "Claude Code" : "ChatGPT") : profile.baseUrl} /><KeyValueRow label={lang === "zh" ? "端点" : "Endpoint"} value={chatGptAuth ? (engine === "claude" ? (lang === "zh" ? "Claude Code 官方登录路径" : "Official Claude Code login path") : (lang === "zh" ? "Codex 官方登录会话" : "Official Codex session")) : profile.wireApi} /><KeyValueRow label={lang === "zh" ? "模型" : "Model"} value={profile.model} /><KeyValueRow label={chatGptAuth ? (lang === "zh" ? "API Key" : "API key") : (lang === "zh" ? "请求头" : "Headers")} value={chatGptAuth ? (lang === "zh" ? "不需要" : "Not required") : String(Object.keys(profile.headers || {}).length)} /></div>
        <button className="primary-button full-width" onClick={() => testConnection(profileKey)} disabled={busy || !profileConfigured(profile, profileKey)}>{busy ? <Loader2 className="spin" /> : <Wifi />}{chatGptAuth ? (lang === "zh" ? "检查官方登录" : "Check official login") : (lang === "zh" ? "测试连接与兼容性" : "Test connection and compatibility")}</button>
      </Card>
      <Card title={lang === "zh" ? "诊断结果" : "Diagnostics"} icon={<ClipboardCheck />} headerRight={result && <button className="icon-text-button" onClick={async () => { await navigator.clipboard.writeText(diagnosticText); showToast(lang === "zh" ? "已复制诊断信息" : "Diagnostics copied"); }}><ClipboardCopy />{c.copy}</button>}>
        {result ? <><div className="diagnostic-list">{diagnostics.map((item) => <div key={item.label} className={item.ok ? "ok" : "error"}>{item.ok ? <CheckCircle2 /> : <XCircle />}<strong>{item.label}</strong></div>)}</div><div className={`result-message ${overallOk ? "ok" : "error"}`}><strong>{overallOk ? chatGptAuth ? (lang === "zh" ? "官方登录可用" : "Official login is available") : result.adapterAvailable && result.codexCompatible === false ? (lang === "zh" ? "可通过本地适配器供 Codex 使用" : "Usable through the local adapter") : (lang === "zh" ? "接口与 Codex 兼容性通过" : "Endpoint and Codex compatibility passed") : result.ok && profileKey === "thirdParty" ? (lang === "zh" ? "接口可访问，但 Codex 不兼容" : "Endpoint works, but Codex is incompatible") : (lang === "zh" ? "检查失败" : "Check failed")}</strong><span>{chatGptAuth ? result.url : `HTTP ${result.status || "—"} · ${result.url || profile.baseUrl}`}</span>{result.adapterAvailable && <span>{lang === "zh" ? `本地适配器将把 Codex /responses 转发到 ${result.chatFallbackUrl || "第三方 /chat/completions"}` : `The local adapter will translate Codex /responses to ${result.chatFallbackUrl || "third-party /chat/completions"}`}</span>}{result.error && <span>{result.error}</span>}{result.compatibilityError && !result.adapterAvailable && <span>{result.compatibilityError}</span>}</div></> : <EmptyState icon={<Wifi />} title={lang === "zh" ? "等待测试" : "Waiting for a test"} description={lang === "zh" ? "官方模式检查登录状态；第三方模式同时检查接口与 Responses API 兼容性。" : "Official mode checks login state; third-party mode checks endpoint and Responses API compatibility."} />}
      </Card>
    </div>
  );
}

function RecordsPage({ lang, state, setState, showToast, requestConfirm }: { lang: Lang; state: AppState | null; setState: (state: AppState) => void; showToast: (message: string, error?: boolean) => void; requestConfirm: (dialog: DialogState) => void }) {
  const c = text[lang];
  const [filter, setFilter] = useState("all");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [chatRecords, setChatRecords] = useState<ChatRecord[]>([]);
  const [selectedChatRecords, setSelectedChatRecords] = useState<string[]>([]);
  const [chatRecordsBusy, setChatRecordsBusy] = useState(false);
  const [chatEngineFilter, setChatEngineFilter] = useState<"all" | "codex" | "claude">("all");
  const [codexSourceFilter, setCodexSourceFilter] = useState<"all" | "official" | "thirdParty" | "unknown">("all");
  const visibleChatRecords = useMemo(() => chatRecords.filter((record) => {
    if (chatEngineFilter !== "all" && record.engine !== chatEngineFilter) return false;
    if (record.engine === "codex" && codexSourceFilter !== "all" && (record.codexSource || "unknown") !== codexSourceFilter) return false;
    return true;
  }), [chatRecords, chatEngineFilter, codexSourceFilter]);
  const visibleChatRecordIds = useMemo(() => visibleChatRecords.map((record) => record.id), [visibleChatRecords]);
  const visibleIdSet = useMemo(() => new Set(visibleChatRecordIds), [visibleChatRecordIds]);
  const allVisibleSelected = Boolean(visibleChatRecords.length) && visibleChatRecords.every((record) => selectedChatRecords.includes(record.id));
  const sourceText = (record: ChatRecord) => record.codexSourceLabel || (record.codexSource === "official" ? "OpenAI 官方" : record.codexSource === "thirdParty" ? "第三方 API" : "未知来源");
  const sourceTone = (record: ChatRecord): "success" | "warning" | "caution" => record.codexSource === "official" ? "success" : record.codexSource === "thirdParty" ? "warning" : "caution";
  const logs = (state?.logs || []).filter((entry) => filter === "all" || (filter === "error" ? /fail|error/i.test(entry.type) : entry.type.includes(filter)));
  const copyLogs = async () => { await navigator.clipboard.writeText(JSON.stringify(logs, null, 2)); showToast(lang === "zh" ? "已复制日志" : "Logs copied"); };
  const refreshChatRecords = async () => {
    setChatRecordsBusy(true);
    try {
      const records = await window.api.listChatRecords();
      setChatRecords(records);
      setSelectedChatRecords((current) => current.filter((id) => records.some((record) => record.id === id)));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), true);
    } finally {
      setChatRecordsBusy(false);
    }
  };
  useEffect(() => { refreshChatRecords(); }, []);
  const toggleChatRecord = (id: string) => setSelectedChatRecords((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectVisibleChatRecords = () => setSelectedChatRecords((current) => allVisibleSelected ? current.filter((id) => !visibleIdSet.has(id)) : Array.from(new Set([...current, ...visibleChatRecordIds])));
  const clearVisibleChatRecords = () => setSelectedChatRecords((current) => current.filter((id) => !visibleIdSet.has(id)));
  const deleteSelectedChatRecords = () => requestConfirm({
    title: lang === "zh" ? "删除选中的聊天记录？" : "Delete selected chat records?",
    description: lang === "zh" ? `将删除 ${selectedChatRecords.length} 条本机会话/历史文件，不会删除配置、登录或备份。` : `This deletes ${selectedChatRecords.length} local session/history files. Config, login state, and backups are kept.`,
    confirmLabel: c.delete,
    danger: true,
    onConfirm: async () => {
      const result = await window.api.deleteChatRecords(selectedChatRecords);
      setState(result.state);
      setChatRecords(result.records);
      setSelectedChatRecords([]);
      requestConfirm(null);
      showToast(lang === "zh" ? `已删除 ${result.result.deleted.length} 条聊天记录` : `${result.result.deleted.length} chat records deleted`, Boolean(result.result.skipped.length));
    }
  });
  return (
    <div className="records-page two-column-page">
      <Card title={c.noBackups.replace("暂无", "").replace("No ", "").replace(" yet", "") || (lang === "zh" ? "备份" : "Backups")} icon={<FolderOpen />}>
        <div className="record-list">{state?.backups?.length ? state.backups.map((backup) => <div className={`backup-item ${selectedBackup === backup.id ? "is-selected" : ""}`} key={backup.id}><button className="backup-summary" onClick={() => setSelectedBackup(selectedBackup === backup.id ? null : backup.id)}><div><strong>{formatTime(backup.createdAt)}</strong><CodeLine>{backup.originalConfigPath || "—"}</CodeLine><span>{backup.originalMode || "—"} · {backup.originalModel || "—"} · {formatBytes(backup.fileSize || 0)}</span></div><ChevronDown className={selectedBackup === backup.id ? "rotate-180" : ""} /></button>{selectedBackup === backup.id && <div className="backup-detail"><h3><FileDiff />{lang === "zh" ? "恢复差异预览" : "Restore diff preview"}</h3><KeyValueRow label={lang === "zh" ? "提供方" : "Provider"} value={`${state.config.status.provider || "—"} → ${backup.originalMode || "—"}`} /><KeyValueRow label={lang === "zh" ? "服务地址" : "Base URL"} value={`${state.config.status.baseUrl || "—"} → ${backup.originalBaseUrl || "—"}`} /><KeyValueRow label={lang === "zh" ? "模型" : "Model"} value={`${state.config.status.model || "—"} → ${backup.originalModel || "—"}`} /><div className="inline-actions"><button className="secondary-button" onClick={() => requestConfirm({ title: lang === "zh" ? "恢复此备份？" : "Restore this backup?", description: lang === "zh" ? "当前配置会被该备份覆盖。" : "The current configuration will be replaced by this backup.", confirmLabel: c.restore, onConfirm: async () => { setState(await window.api.restoreBackup(backup.id)); requestConfirm(null); showToast(lang === "zh" ? "备份已恢复" : "Backup restored"); } })}><RotateCcw />{c.restore}</button><button className="danger-button" onClick={() => requestConfirm({ title: lang === "zh" ? "删除此备份？" : "Delete this backup?", description: backup.id, confirmLabel: c.delete, danger: true, onConfirm: async () => { setState(await window.api.deleteBackup(backup.id)); requestConfirm(null); showToast(lang === "zh" ? "备份已删除" : "Backup deleted"); } })}><Trash2 />{c.delete}</button></div></div>}</div>) : <EmptyState icon={<FolderOpen />} title={c.noBackups} description={lang === "zh" ? "每次切换前创建的备份会显示在这里。" : "Backups created before each switch will appear here."} />}</div>
      </Card>
      <Card title={lang === "zh" ? "日志" : "Logs"} icon={<FileClock />} headerRight={<div className="record-tools"><button className="icon-text-button" onClick={copyLogs}><Copy />{c.copy}</button><button className="icon-text-button" onClick={() => requestConfirm({ title: lang === "zh" ? "清空日志？" : "Clear logs?", description: lang === "zh" ? "此操作无法撤销。" : "This cannot be undone.", confirmLabel: c.clear, danger: true, onConfirm: async () => { setState(await window.api.clearLogs()); requestConfirm(null); showToast(lang === "zh" ? "日志已清空" : "Logs cleared"); } })}><Trash2 />{c.clear}</button></div>}>
        <div className="filter-row">{[["all", c.all], ["switch", lang === "zh" ? "切换" : "Switch"], ["connection", lang === "zh" ? "测试" : "Test"], ["backup", lang === "zh" ? "恢复" : "Restore"], ["error", lang === "zh" ? "错误" : "Errors"]].map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <div className="event-list">{logs.length ? logs.map((entry, index) => <button className="event-item" key={`${entry.at}-${index}`} onClick={() => setExpandedLog(expandedLog === index ? null : index)}><div className="event-summary"><span className={`event-dot ${/fail|error/i.test(entry.type) ? "error" : "success"}`} /><time>{formatTime(entry.at)}</time><strong>{entry.type}</strong><Badge tone={/fail|error/i.test(entry.type) ? "error" : "success"}>{/fail|error/i.test(entry.type) ? "Error" : "OK"}</Badge><ChevronDown className={expandedLog === index ? "rotate-180" : ""} /></div>{expandedLog === index && <pre>{JSON.stringify(entry.details, null, 2)}</pre>}</button>) : <EmptyState icon={<FileClock />} title={c.noLogs} description={lang === "zh" ? "切换、测试和恢复记录会显示在这里。" : "Switch, test, and restore events will appear here."} />}</div>
      </Card>
      <section className="card chat-record-card">
        <header className="card-header">
          <div><span className="card-icon"><FileText /></span><h2>{lang === "zh" ? "聊天记录" : "Chat records"}</h2></div>
          <div className="record-tools">
            <button className="icon-text-button" onClick={refreshChatRecords} disabled={chatRecordsBusy}><RefreshCw className={chatRecordsBusy ? "spin" : ""} />{c.refresh}</button>
            <button className="danger-button" onClick={deleteSelectedChatRecords} disabled={!selectedChatRecords.length}><Trash2 />{c.delete}</button>
          </div>
        </header>
        <div className="card-content">
          <div className="scope-note"><Info /><span>{lang === "zh" ? "可选择删除 Codex 与 Claude Code 的本机会话/历史文件；配置、登录状态和备份不会被删除。" : "Select local Codex and Claude Code session/history files to delete. Config, login state, and backups are not removed."}</span></div>
          <div className="chat-record-toolbar">
            <div className="segmented compact-segmented chat-record-filter">
              {[
                ["all", lang === "zh" ? "全部" : "All"],
                ["codex", "Codex"],
                ["claude", "Claude"]
              ].map(([key, label]) => <button key={key} className={chatEngineFilter === key ? "active" : ""} onClick={() => setChatEngineFilter(key as "all" | "codex" | "claude")}>{label}</button>)}
            </div>
            {chatEngineFilter !== "claude" && <div className="segmented compact-segmented chat-record-filter">
              {[
                ["all", lang === "zh" ? "全部来源" : "All sources"],
                ["official", lang === "zh" ? "官方" : "Official"],
                ["thirdParty", lang === "zh" ? "第三方 API" : "Third-party API"],
                ["unknown", lang === "zh" ? "未知" : "Unknown"]
              ].map(([key, label]) => <button key={key} className={codexSourceFilter === key ? "active" : ""} onClick={() => setCodexSourceFilter(key as "all" | "official" | "thirdParty" | "unknown")}>{label}</button>)}
            </div>}
            <button className="secondary-button" onClick={selectVisibleChatRecords} disabled={!visibleChatRecords.length}>{allVisibleSelected ? (lang === "zh" ? "取消当前筛选" : "Unselect visible") : (lang === "zh" ? "选择当前筛选" : "Select visible")}</button>
            <button className="secondary-button" onClick={clearVisibleChatRecords} disabled={!selectedChatRecords.some((id) => visibleIdSet.has(id))}>{lang === "zh" ? "清除当前筛选" : "Clear visible"}</button>
            <span>{lang === "zh" ? `已选择 ${selectedChatRecords.length} / 当前 ${visibleChatRecords.length} / 全部 ${chatRecords.length}` : `${selectedChatRecords.length} selected / ${visibleChatRecords.length} visible / ${chatRecords.length} total`}</span>
          </div>
          <div className="chat-record-list">
            {visibleChatRecords.length ? visibleChatRecords.map((record) => <label className="chat-record-item" key={record.id}>
              <input type="checkbox" checked={selectedChatRecords.includes(record.id)} onChange={() => toggleChatRecord(record.id)} />
              <div>
                <div className="chat-record-title-row">
                  <strong>{record.title || record.label}</strong>
                  <span className="chat-record-badges">
                    <Badge tone={record.engine === "codex" ? "accent" : "caution"}>{record.engine === "codex" ? "Codex" : "Claude"}</Badge>
                    {record.engine === "codex" && <Badge tone={sourceTone(record)}>{sourceText(record)}</Badge>}
                  </span>
                </div>
                <span>{record.engine === "codex" ? "Codex" : "Claude Code"} · {record.kind} · {record.subtitle || formatTime(record.lastMessageAt || record.modifiedAt)}</span>
                {record.preview && <p>{record.preview}</p>}
                <CodeLine>{record.codexThreadName || record.label}</CodeLine>
                <span>{formatTime(record.modifiedAt)} · {formatBytes(record.size)}</span>
              </div>
            </label>) : <EmptyState icon={<FileText />} title={chatRecords.length ? (lang === "zh" ? "当前筛选无记录" : "No records in this filter") : (lang === "zh" ? "暂无可删除聊天记录" : "No chat records found")} description={chatRecords.length ? (lang === "zh" ? "切换上方分类或来源筛选可以查看其他记录。" : "Change the engine or source filter to view other records.") : (lang === "zh" ? "没有发现 Codex 或 Claude Code 的本机会话/历史文件。" : "No local Codex or Claude Code session/history files were found.")} />}
          </div>
        </div>
      </section>
    </div>
  );
}

function TokensPage({ lang, state, tokenPrice, setTokenPrice }: { lang: Lang; state: AppState | null; tokenPrice: number; setTokenPrice: (value: number) => void }) {
  const c = text[lang];
  const [range, setRange] = useState<"7" | "30" | "all">("30");
  const [provider, setProvider] = useState<"all" | "thirdParty">("all");
  const [metric, setMetric] = useState<"total" | "input" | "output">("total");
  const history = useMemo(() => filterUsage(state?.data.usageHistory || [], range, provider), [state, range, provider]);
  const today = sumPeriod(history, 1);
  const week = sumPeriod(history, 7);
  const month = sumPeriod(history, 30);
  const estimate = (month.totalTokens / 1000) * tokenPrice;
  return (
    <div className="tokens-page">
      <div className="scope-note"><Info />{lang === "zh" ? "统计来自本程序可观测请求，不等同于服务商账单。" : "Statistics come from requests observable by this app and may not match provider billing."}</div>
      <div className="metric-grid"><Metric title={c.today} value={today.totalTokens} /><Metric title={c.week} value={week.totalTokens} /><Metric title={c.month} value={month.totalTokens} /><Metric title={lang === "zh" ? "预估费用" : "Estimated cost"} value={`$${estimate.toFixed(4)}`} badge={c.estimated} /></div>
      <div className="token-toolbar"><div className="segmented compact-segmented"><button className={range === "7" ? "active" : ""} onClick={() => setRange("7")}>7 {lang === "zh" ? "天" : "days"}</button><button className={range === "30" ? "active" : ""} onClick={() => setRange("30")}>30 {lang === "zh" ? "天" : "days"}</button><button className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>{c.all}</button></div><div className="segmented compact-segmented"><button className={provider === "all" ? "active" : ""} onClick={() => setProvider("all")}>{c.all}</button><button className={provider === "thirdParty" ? "active" : ""} onClick={() => setProvider("thirdParty")}>{c.third}</button></div><label className="price-input"><span>{lang === "zh" ? "单价 $/1K" : "Price $/1K"}</span><input type="number" min="0" step="0.001" value={tokenPrice} onChange={(event) => setTokenPrice(Number(event.target.value))} /></label></div>
      <Card title={lang === "zh" ? "消耗趋势" : "Usage trend"} icon={<Database />} headerRight={<div className="segmented compact-segmented"><button className={metric === "total" ? "active" : ""} onClick={() => setMetric("total")}>{c.total}</button><button className={metric === "input" ? "active" : ""} onClick={() => setMetric("input")}>{c.input}</button><button className={metric === "output" ? "active" : ""} onClick={() => setMetric("output")}>{c.output}</button></div>}>
        <TokenChart history={history} metric={metric} lang={lang} />
      </Card>
      <Card title={lang === "zh" ? "最近请求" : "Recent requests"} icon={<Clock3 />} compact>
        {history.length ? <div className="usage-table"><div className="usage-head"><span>{lang === "zh" ? "时间" : "Time"}</span><span>{lang === "zh" ? "模型" : "Model"}</span><span>{c.input}</span><span>{c.output}</span><span>{c.total}</span><span>{lang === "zh" ? "状态" : "Status"}</span></div>{[...history].reverse().slice(0, 8).map((entry, index) => <div className="usage-row" key={`${entry.at}-${index}`}><span>{formatTime(entry.at)}</span><span>{entry.model || state?.data.profiles[entry.profile].model || "—"}</span><span>{entry.inputTokens.toLocaleString()}</span><span>{entry.outputTokens.toLocaleString()}</span><strong>{entry.totalTokens.toLocaleString()}</strong><Badge tone="success">OK</Badge></div>)}</div> : <EmptyState icon={<Database />} title={c.noUsage} description={lang === "zh" ? "运行返回 usage 的连接测试后会生成统计。" : "Run a connection test that returns usage to create statistics."} />}
      </Card>
    </div>
  );
}

function TokenChart({ history, metric, lang }: { history: UsageHistoryEntry[]; metric: "total" | "input" | "output"; lang: Lang }) {
  const [hover, setHover] = useState<number | null>(null);
  const daily = useMemo(() => {
    const map = new Map<string, { input: number; output: number; total: number }>();
    history.forEach((entry) => { const day = entry.at.slice(0, 10); const current = map.get(day) || { input: 0, output: 0, total: 0 }; current.input += entry.inputTokens; current.output += entry.outputTokens; current.total += entry.totalTokens; map.set(day, current); });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [history]);
  if (!daily.length) return <EmptyState icon={<Database />} title={text[lang].noUsage} description={lang === "zh" ? "图表会在产生 Token 记录后显示。" : "The chart appears after token usage is recorded."} />;
  const width = 900, height = 260, left = 58, right = 24, top = 28, bottom = 38;
  const values = daily.map(([, value]) => value[metric]);
  const max = Math.max(...values, 1);
  const step = daily.length > 1 ? (width - left - right) / (daily.length - 1) : 0;
  const points = daily.map(([day, value], index) => ({ day, value: value[metric], x: daily.length === 1 ? width / 2 : left + index * step, y: top + (1 - value[metric] / max) * (height - top - bottom) }));
  const peak = points.reduce((best, item) => item.value > best.value ? item : best, points[0]);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === "zh" ? "用量统计趋势" : "Usage trend"}>{[0, .25, .5, .75, 1].map((ratio) => { const y = top + ratio * (height - top - bottom); const label = Math.round(max * (1 - ratio)); return <g key={ratio}><line x1={left} y1={y} x2={width - right} y2={y} className="chart-grid" /><text x={left - 10} y={y + 4} textAnchor="end" className="chart-label">{label.toLocaleString()}</text></g>; })}<polyline points={line} className="chart-line" /><line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="chart-axis" />{points.map((point, index) => <g key={point.day} tabIndex={0} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}><circle cx={point.x} cy={point.y} r="5" className="chart-point" /><text x={point.x} y={height - 12} textAnchor="middle" className="chart-label">{point.day.slice(5)}</text></g>)}<text x={peak.x} y={Math.max(16, peak.y - 12)} textAnchor="middle" className="chart-peak">{peak.value.toLocaleString()}</text>{hover !== null && <g><rect x={Math.min(points[hover].x + 10, width - 190)} y={Math.max(8, points[hover].y - 50)} width="180" height="38" rx="10" className="chart-tooltip" /><text x={Math.min(points[hover].x + 22, width - 178)} y={Math.max(32, points[hover].y - 26)} className="chart-label">{points[hover].day} · {points[hover].value.toLocaleString()}</text></g>}</svg><p className="chart-summary">{lang === "zh" ? `共记录 ${history.length} 次请求；峰值为 ${peak.day} 的 ${peak.value.toLocaleString()} tokens。` : `${history.length} requests recorded; peak usage was ${peak.value.toLocaleString()} tokens on ${peak.day}.`}</p></div>;
}

function SettingsPage({ lang, setLang, appearance, setAppearance, defaultPage, setDefaultPage, closeToTray, setCloseToTray, promptTest, setPromptTest, state, showToast, requestConfirm, setState, openEula, openLegal }: { lang: Lang; setLang: (lang: Lang) => void; appearance: string; setAppearance: (value: string) => void; defaultPage: string; setDefaultPage: (value: string) => void; closeToTray: boolean; setCloseToTray: (value: boolean) => void; promptTest: boolean; setPromptTest: (value: boolean) => void; state: AppState | null; showToast: (message: string) => void; requestConfirm: (dialog: DialogState) => void; setState: (state: AppState) => void; openEula: () => void; openLegal: (view: LegalView) => void }) {
  const c = text[lang];
  const viewLabel = lang === "zh" ? "查看" : "View";
  return <div className="settings-page"><SettingsGroup title={lang === "zh" ? "通用" : "General"}><SettingRow label={c.language} description={lang === "zh" ? "界面语言" : "Interface language"}><select className="input compact-input" value={lang} onChange={(event) => setLang(event.target.value as Lang)}><option value="zh">简体中文</option><option value="en">English</option></select></SettingRow><SettingRow label={c.appearance} description={lang === "zh" ? "主题会实时跟随系统变化" : "Theme follows system changes in real time"}><select className="input compact-input" value={appearance} onChange={(event) => setAppearance(event.target.value)}><option value="system">{c.followSystem}</option><option value="dark">{c.dark}</option><option value="light">{c.light}</option></select></SettingRow></SettingsGroup><SettingsGroup title={c.behavior}><SettingRow label={c.startPage} description={lang === "zh" ? "下次启动时默认打开" : "Page opened by default on next launch"}><select className="input compact-input" value={defaultPage} onChange={(event) => setDefaultPage(event.target.value)}>{navItems.map((item) => <option key={item.key} value={item.key}>{lang === "zh" ? item.zh : item.en}</option>)}</select></SettingRow><SettingRow label={c.closeTray} description={lang === "zh" ? "点击关闭按钮时保持程序在托盘运行" : "Keep the app running in the tray when closing"}><Toggle checked={closeToTray} onChange={setCloseToTray} ariaLabel={c.closeTray} /></SettingRow><SettingRow label={c.promptTest} description={lang === "zh" ? "切换完成后显示连接测试入口" : "Show a connection test action after switching"}><Toggle checked={promptTest} onChange={setPromptTest} ariaLabel={c.promptTest} /></SettingRow></SettingsGroup><SettingsGroup title={c.securityData}><SettingRow label={c.localData} description={state?.paths.appDataDir || "—"}><button className="secondary-button" onClick={async () => { await window.api.openPath(state?.paths.appDataDir || ""); showToast(lang === "zh" ? "已打开本地数据目录" : "Local data directory opened"); }}><FolderOpen />{c.openFolder}</button></SettingRow><SettingRow label={lang === "zh" ? "最终用户许可协议" : "End User License Agreement"} description={`Copyright © 2026 Hardcopia · EULA ${EULA_VERSION}`}><button className="secondary-button" onClick={openEula}><FileText />{viewLabel}</button></SettingRow><SettingRow label={lang === "zh" ? "隐私政策" : "Privacy Policy"} description={lang === "zh" ? "本地数据、网络请求与删除方式" : "Local data, network requests, and deletion"}><button className="secondary-button" onClick={() => openLegal("privacy")}><ShieldCheck />{viewLabel}</button></SettingRow><SettingRow label={lang === "zh" ? "第三方依赖许可" : "Third-Party Licenses"} description={lang === "zh" ? "开源组件版权与许可证" : "Open-source component notices"}><button className="secondary-button" onClick={() => openLegal("thirdParty")}><FileText />{viewLabel}</button></SettingRow><SettingRow label={lang === "zh" ? "使用说明" : "User Guide"} description={lang === "zh" ? "配置、测试、切换和故障排查" : "Configure, test, switch, and troubleshoot"}><button className="secondary-button" onClick={() => openLegal("guide")}><Info />{viewLabel}</button></SettingRow><SettingRow label={c.clearUsage} description={lang === "zh" ? "仅清除本程序的本地统计，不影响服务商账单" : "Clears only local app statistics, not provider billing"}><button className="danger-button" onClick={() => requestConfirm({ title: `${c.clearUsage}?`, description: lang === "zh" ? "此操作无法撤销。" : "This cannot be undone.", confirmLabel: c.clear, danger: true, onConfirm: async () => { setState(await window.api.clearUsage()); requestConfirm(null); showToast(lang === "zh" ? "用量统计已清除" : "Usage statistics cleared"); } })}><Trash2 />{c.clear}</button></SettingRow></SettingsGroup></div>;
}

function ConfirmDialog({ dialog, close }: { dialog: NonNullable<DialogState>; close: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelLabel = document.documentElement.lang.startsWith("zh") ? "取消" : "Cancel";
  useEffect(() => { confirmRef.current?.focus(); const handler = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [close]);
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-icon"><AlertTriangle /></div><h2 id="dialog-title">{dialog.title}</h2><p>{dialog.description}</p><div className="dialog-actions"><button className="secondary-button" onClick={close}>{cancelLabel}</button>{dialog.secondaryLabel && <button className="secondary-button" onClick={dialog.onSecondary}>{dialog.secondaryLabel}</button>}<button ref={confirmRef} className={dialog.danger ? "danger-solid-button" : "primary-button"} onClick={dialog.onConfirm}>{dialog.confirmLabel}</button></div></div></div>;
}

function EulaDialog({ lang, required, acceptedAt, close, accept, decline }: { lang: Lang; required: boolean; acceptedAt?: string; close: () => void; accept: () => Promise<void>; decline: () => Promise<void> }) {
  const copy = eulaContent[lang];
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const acceptRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!required) acceptRef.current?.focus(); }, [required]);
  return <div className="dialog-backdrop eula-backdrop"><section className="dialog eula-dialog" role="dialog" aria-modal="true" aria-labelledby="eula-title"><header className="eula-header"><div className="dialog-icon eula-icon"><ShieldCheck /></div><div><span>EULA {EULA_VERSION}</span><h2 id="eula-title">{copy.title}</h2><p>{copy.updated}</p></div></header><div className="eula-scroll" tabIndex={0}><p className="eula-intro">{copy.intro}</p>{copy.sections.map(([title, body]) => <section key={title}><h3>{title}</h3><p>{body}</p></section>)}<p className="eula-contact">{copy.contact}</p></div>{required ? <label className="eula-acknowledge"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span>{copy.acknowledge}</span></label> : <p className="eula-accepted">{acceptedAt ? (lang === "zh" ? `本机已于 ${formatTime(acceptedAt)} 接受此版本。` : `Accepted on this device at ${formatTime(acceptedAt)}.`) : ""}</p>}<footer className="dialog-actions eula-actions">{required ? <><button className="secondary-button" onClick={decline}>{copy.decline}</button><button ref={acceptRef} className="primary-button" disabled={!checked || busy} onClick={async () => { setBusy(true); try { await accept(); } finally { setBusy(false); } }}>{busy && <Loader2 className="spin" />}{copy.accept}</button></> : <button ref={acceptRef} className="primary-button" onClick={close} aria-label={lang === "zh" ? "关闭许可证窗口" : "Close license window"}>{copy.close}</button>}</footer></section></div>;
}

function LegalInfoDialog({ lang, view, close }: { lang: Lang; view: LegalView; close: () => void }) {
  const copy = legalInfo[lang][view];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); const handler = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [close]);
  return <div className="dialog-backdrop eula-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="dialog eula-dialog legal-info-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-info-title"><header className="eula-header"><div className="dialog-icon eula-icon"><FileText /></div><div><span>Hardcopia</span><h2 id="legal-info-title">{copy.title}</h2><p>{copy.meta}</p></div></header><div className="eula-scroll" tabIndex={0}>{copy.sections.map(([title, body]) => <section key={title}><h3>{title}</h3><p>{body}</p></section>)}<p className="eula-contact">Copyright © 2026 Hardcopia · 1300858541@qq.com</p></div><footer className="dialog-actions eula-actions"><button ref={closeRef} className="primary-button" onClick={close} aria-label={lang === "zh" ? "关闭法律信息窗口" : "Close legal info window"}>{lang === "zh" ? "关闭" : "Close"}</button></footer></section></div>;
}

