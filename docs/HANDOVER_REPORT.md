# 项目优化实施完成交接报告

> 依据《项目稳定性与 UI 设计优化升级手册》(`docs/UPGRADE_MANUAL.md`) 实施。本报告供独立验收人 / Codex 复核。报告中凡无法在实施环境(无 GUI 桌面交互、无真实第三方 provider)验证的项,一律标 **Not executed / Unknown**,不臆测。
>
> 生成时间:2026-06-22 ｜ 对应 Commit:`9a83138` ｜ 本报告初版生成时未修改任何代码。

---

## 复核后修复记录(Codex 复核 → Claude 修复,2026-06-22)

Codex 独立复核(《Apivot_Codex复核测试与继续修复交接_2026-06-22.md》)确认代码/构建层通过,并提出 P0~P4。本次按 Codex 顺序处理了 **P0**:

**P0 — Vite 浏览器开发预览空白(Confirmed,High)→ 已修复并验证**
- **根因**:本回归由 T-502 引入——`mockApi` 改为动态 `import()` 后,浏览器开发预览下 `window.api` 在 `AppV30` 启动 effect(`getWindowState`)执行时仍为 `undefined`,导致整页空白。Electron 生产不受影响(preload 注入真实 `window.api`,且 `import.meta.env.DEV` 为 false)。
- **修复**:`src/renderer-react/src/main.tsx` 改为 `bootstrap()`——DEV 且无 `window.api` 时先 `await import("./mockApi")` 安装,再 `createRoot().render()`。生产路径不变(不引 mock、立即渲染)。
- **验证**:`npx tsc --noEmit` ✓、`npm run build:renderer` ✓、`npm test` 12/12 ✓;并用 Vite dev(127.0.0.1:5195)实跑——页面正常渲染(侧栏 + 切换操作页可见)、控制台无 warn/error、`getWindowState` 报错消失。
- **Commit**:见下方 git 记录(main.tsx 修复)。

**P1~P4 现状**(本次未做,按 Codex 建议保留为后续):
- P1 浏览器 Playwright UI smoke:未补(需 E2E 脚本)。
- P2 真实 Windows GUI 验收:未做(无桌面交互环境)。
- P3 T-601 流式 usage:**未动**——Codex 同样建议先采集真实 provider SSE 样本再定策略,不盲改(与本报告第十一/十二节一致)。
- P4 T-501 逐页拆分:未做(非发布阻塞)。

> 因此发布阻塞项从「Vite 预览空白 + GUI 未验」缩减为「Windows GUI/缩放/安装包未验 + T-601 待采样」。Electron 成品冒烟(Codex 实测)已通过。

---

## 一、基本信息

| 项 | 值 |
|---|---|
| 项目名称 | Apivot |
| 优化前 Commit | `03ae755` (`Match release asset filenames`) |
| 优化后 Commit (HEAD) | `9a83138` |
| 当前分支 | `main` |
| 提交数 | 22 commits(20 个任务 + 1 文档 + 1 notices 刷新)|
| 开始 / 完成日期 | 2026-06-21 → 2026-06-22(据克隆与提交时间)|
| 技术栈 | Electron 42.4.1 + React 18 + Vite 8 + TypeScript 6;主进程 Node CommonJS;`@iarna/toml`;electron-builder 26 |
| 是否升级依赖 | **是**:electron `^37.2.6`→`^42.4.1`;新增 `form-data ^4.0.6` override |
| 是否修改配置格式 | **否**(config.toml / settings.json / profiles.json 结构不变)|
| 是否修改用户数据结构 | **否**(store schema 不变;仅默认 env 名/provider id/localStorage 键改名)|
| 是否数据迁移 | **否**(所有者确认无老用户 → 干净改名,未写迁移逻辑)|
| 是否改构建/发布流程 | **是**:`build-portable-versioned.cjs`(finally 还原 + 版本回退)、workflow 资产名、产物名 `Apivot-Portable-*` |
| 变更规模 | 55 文件,+1326 / −5669 行 |

---

## 二、实施范围总结

### 1. 基础功能稳定性
- **原子写入**:新增 `src/main/atomicWrite.js`(临时文件→fsync→rename),config/settings/store/备份所有写入改用之(P-01)。
- **恢复可靠性**:`restoreBackup` 写前校验可解析(损坏即拒绝)、写到当前活动路径、写后回读(P-02)。
- **切换回滚**:切换写入失败自动恢复切换前备份并标记 `rolledBack`(P-03)。
- **一键恢复默认**:改为通用清理(删活动 provider + 任何 127.0.0.1 适配器 provider),修 `ccswith` 拼写(P-08)。
- **敏感信息**:`maskSecret` 收紧为前2后2(P-09)。
- **启动兜底**:检测/启动失败返回 `manualCommand` + 文案,绝不假报成功(P-22)。
- **测试**:新增 `test/config.test.js` + `test/adapter.test.js`(12 用例,node:test),`npm test`/`npm run typecheck` 脚本(P-19)。
- 未处理:连续点击/异步竞态护栏未新增(原代码已有 store 写锁;UI 层防抖未做)。

### 2. 功能完整性
- 切换异常分支闭环(写失败回滚)——从「未闭环」变为闭环。
- 启动失败从「可能假成功」变为「明确手动命令提示」。
- **新增功能**:仅测试脚本与设计 token(均在手册范围内)。未新增手册 C 类功能(Provider 模板/导入导出/软删除等)。

### 3. UI 布局升级
- 切换页执行区:`execute-grid 1fr/260px` → 单列堆叠 + 操作区卡底全宽,主按钮独占一行(P-16)。
- 侧边栏收起:JS `matchMedia(980px)` 单一来源,删除 980px 媒体查询内重复的收起/engine-dot 实现(P-12 部分)。
- 顶部/内容/设置入口/滚动/最小窗口/最大化:**未改动**(手册要求保留,沿用原实现)。
- Windows 缩放适配:**未做专门改动**,且未运行验证。

### 4. UI 视觉升级
- 新增 `--space-*/--fs-*/--fw-*/--control-h-*/--radius-badge/--font-mono` token(P-10)。
- 逐字面量替换:消灭 `11.5/12.5px` 与 `font-weight:650/750/800`;卡片 padding 收敛到 {16,20,24}(P-10/P-11)。
- 去重复 `.refresh-button`、去组件级 `!important`(仅保留 reduced-motion)、组件内 hex 全部移入 `:root` token,EULA 按钮改 `var(--brand)` 随引擎变色(P-12/P-13)。
- 文案随语言切换(消除单页中英混排)、状态药丸 `third_party`→友好标签(P-14/P-15)。
- 颜色/明暗/双引擎主题/focus 环/reduced-motion:沿用,未破坏。

---

## 三、原任务完成度追踪矩阵

| 编号 | 名称 | 原验收 | 实际实施 | 涉及文件 | 状态 | 自检 | 证据 |
|---|---|---|---|---|---|---|---|
| T-001 | 改名 Apivot | AC-14 | 干净改名(无老用户):包名/appId/productName/env/provider id/localStorage/UI/legal/icon/docs;保留 codex 标识与仓库 URL | package.json, main.js, store.js, 两 configService, AppV30, index.html, workflow, legal/* | **Completed**(AC-14 不适用) | build+package+grep 通过 | commit `3e5de26`;`npm run dist` 产物 `Apivot-Portable-1.0.1-x64.exe` |
| T-101 | 原子写入 | AC-01 | atomicWriteFile + 全替换 | atomicWrite.js, codex/claudeConfigService, store.js | **Completed** | 单测含写失败保原文件 | `1b38f57`;test/config.test.js |
| T-102 | 恢复校验+活动路径 | AC-02 | 解析校验/活动路径/回读 | codex/claudeConfigService, main.js | **Completed** | 单测(损坏拒绝+活动路径) | `f404cbb`;config.test.js |
| T-103 | 切换失败回滚 | AC-03 | writeWithRollback 包裹写入 | main.js | **Completed**(端到端 runtime 待人工双验) | 组合逻辑单测;**未跑完整 switch:apply IPC** | `54e4ea6` |
| T-104 | 发布脚本还原+版本 | AC-04 | finally 还原 + 版本回退 | build-portable-versioned.cjs | **Completed** | **实跑 `npm run dist` 成功,树干净,版本 1.0.1** | `d752ffc`;outputs/ 产物 |
| T-105 | 依赖安全 | AC-05 | electron 42.4.1 + form-data override | package.json, lock | **Completed**(GUI 行为待 runtime 验) | `npm audit` 0 high;electron 二进制 v42.4.1 | `f27cf18` |
| T-201 | 通用清理+ccswith | AC-06 | localhost provider 通用清理 | codexConfigService.js | **Completed** | 单测 AC-06 | `9aa031e` |
| T-202 | 脱敏前2后2 | 截图/日志无≥6位前缀 | maskSecret 全改 | 两 configService, util/mask, AppV30 | **Completed**(所有者已确认) | 单测 + 输出 `sk***yz` | `69add04` |
| T-203 | 启动兜底强化 | AC-11 | manualCommand + 文案 | main.js, AppV30, types.ts | **Completed**(UI runtime 未验) | 代码审查 | `4dc62c2` |
| T-301 | 执行区重排 | AC-10 | 卡底全宽,宽窄一致 | styles-v30.css | **Completed**(三宽度像素位 GUI 未验) | 无 width 依赖规则(代码推理) | `48165bf` |
| T-302 | 合并收起逻辑 | 手动/窄窗一致 | JS matchMedia 单源 | AppV30, styles-v30.css | **Completed**(视觉一致性 GUI 未验) | 代码审查 | `78c1219` |
| T-401 | 加 token | token 存在且 build 通过 | :root 新增全部刻度 | styles-v30.css | **Completed** | build 通过 | `bc58c7e` |
| T-402 | 字面量→token | AC-07/AC-08 | 半像素/异常字重清零;卡片 padding {16,20,24} | styles-v30.css | **Completed** | grep 0 命中 | `e6e31ac` |
| T-403 | 去重/!important/hex | AC-09 | 合并/去 important/hex 入 token | styles-v30.css | **Completed**(保留 reduced-motion important,已注明) | grep 验证 | `70cda84` |
| T-404 | 文案统一 | 单页无中英混排 | 标签随语言;药丸友好化 | AppV30.tsx | **Completed with deviation**(文案策略由实施者按默认取「随语言本地化」,所有者未明确选;非逐字符全量审计) | 代码审查 | `0487c97` |
| T-405 | EULA 关闭名去歧义 | 可访问名唯一 | 三处 close 不同 aria | AppV30.tsx | **Completed**(自动化按名查询 GUI 未验) | 代码审查 | `7c9816d` |
| T-501 | 拆分 AppV30 | tsc 通过/各页渲染一致 | **仅抽出 shared components + helpers;页面体未拆** | components/common.tsx, lib/helpers.ts, AppV30 | **Completed with deviation / Partially** | tsc+build+test 通过;**未按 pages/ 逐页拆** | `3921eed`;AppV30 1092→1032 行 |
| T-502 | 清理死文件 | build/tsc 通过,功能不变 | 迁 maskSecret;删 8 文件;mock 仅 dev | util/mask.js, logger.js, main.tsx + 删除 | **Completed** | grep 零引用;prod 包无 mock | `4d12bf2` |
| T-503 | test/lint 脚本 | npm test 可跑 | node:test 套件 + 脚本 | test/*, package.json | **Completed**(用 typecheck 代 lint,未引 eslint) | 12 用例通过 | `166b954` |
| T-601 | 适配器用量 | 见 4.1(真实 provider 流式) | **仅导出+单测 extractUsage/normalizeUsage;P-17/P-18 行为未改** | codexAdapterService.js, test/adapter.test.js | **Partially completed** | 多命名单测;**累计策略/Claude SSE 未动** | `6b46532` |

> 状态取值:Completed / Completed with deviation / Partially completed / Not completed / Removed after evaluation / Unable to verify。本矩阵无 Not completed、无 Removed、无 Unable to verify;但多个 Completed 项的 runtime/GUI 侧面为 Not executed(见下)。

---

## 四、需求符合度矩阵

| # | 用户需求 | 当前实现 | 完全符合 | 差异 | 证据 | 需继续 |
|---|---|---|---|---|---|---|
| R1 | 稳定使用第三方 API+统计 | 适配器转发+多命名用量采集(已加单测) | 部分 | 流式累计 P-18 未校准、Claude 回写 P-17 未改 | adapter.test.js | 是(真实 provider 校准)|
| R2 | 官方/第三方安全切换、不污染、可一键恢复 | 备份→快照→写→回读→失败回滚;通用清理 | **代码层符合** | 端到端 runtime 未人工双验 | config.test.js, 代码 | 是(Windows 实测)|
| R3 | 自定义会话记录管理+越界护栏 | **未改动**(沿用,护栏保留) | 是 | — | chatRecordService 未变 | 否 |
| R4 | 官方 Codex 配置正确工作 | 逻辑保留+原子写 | Unknown(GUI 未跑)| — | — | 是 |
| R5 | 第三方 API 配置正确工作 | 同上 | Unknown(GUI 未跑)| — | — | 是 |
| R6 | 切换失败保护原配置 | 自动回滚到切换前备份 | 代码符合 | runtime 未注入真实失败 | `54e4ea6` | 是 |
| R7 | 重启后状态正确 | store 原子写+读回 | Unknown(GUI 未跑)| — | — | 是 |
| R8 | 错误提示准确 | 回滚提示/启动手动命令/恢复拒绝原因 | 代码符合 | UI runtime 未验 | 代码 | 是 |
| R9 | UI 简约专业有设计感 | token 化+卡片归档+去补丁 | 部分(主观)| 需所有者审美确认+GUI 比对 | styles-v30.css | 是 |
| R10 | UI 升级保留必要功能/状态 | 侧栏约束/设置入口/主图标/会话/备份全保留 | 是(代码层)| GUI 未逐项截图核对 | 代码 | 是(AC-12 截图)|

---

## 五、修改文件清单

> 完整 55 文件见 `git diff --name-status 03ae755..HEAD`。下表为关键项。

| 文件 | 类型 | 目的 | 主要变更 | 影响功能 | 风险 |
|---|---|---|---|---|---|
| `src/main/atomicWrite.js` | Added | 原子写 | temp→fsync→rename | **文件写入(核心)** | 高 |
| `src/main/codexConfigService.js` | Modified | 原子写/恢复校验/通用清理/脱敏/改名 | restoreBackup、writeCleanOpenAIConfig 等 | **配置读写/恢复(核心)** | 高 |
| `src/main/claudeConfigService.js` | Modified | 同上 + APIVOT_WIRE_API | restoreBackup 等 | **配置读写(核心)** | 高 |
| `src/main/store.js` | Modified | 原子写 + env 改名 | save() 原子化 | **状态管理(核心)** | 高 |
| `src/main/main.js` | Modified | 回滚/启动兜底/改名/恢复传活动路径 | writeWithRollback 等 | **切换编排/IPC(核心)** | 高 |
| `src/main/codexAdapterService.js` | Modified | 导出用量函数 | 仅 export 增量 | **API 用量** | 中 |
| `src/main/logger.js` | Modified | maskSecret 迁移引用 | require 改 util/mask | 日志脱敏 | 中 |
| `src/main/util/mask.js` | Added | maskSecret 落位 | — | 安全相关 | 中 |
| `src/renderer-react/src/AppV30.tsx` | Modified | 收起单源/文案/aria/抽组件/改名 | 多处 | UI 入口 | 中 |
| `src/renderer-react/src/styles-v30.css` | Modified | token/字面量/去重/hex | 全局 | **UI 全局样式/设计变量** | 中 |
| `src/renderer-react/src/components/common.tsx` | Added | 抽共享组件 | — | UI 组件 | 低 |
| `src/renderer-react/src/lib/helpers.ts` | Added | 抽纯函数 | — | UI 辅助 | 低 |
| `src/renderer-react/src/main.tsx` | Modified | mock 仅 dev | 动态 import | 渲染入口 | 中 |
| `src/renderer-react/src/types.ts` | Modified | LaunchDetection 加 manualCommand | — | 类型 | 低 |
| `package.json` / `package-lock.json` | Modified | electron 42 + override + 改名 + 脚本 | — | **构建配置/依赖** | 高 |
| `scripts/build-portable-versioned.cjs` | Modified | finally 还原+版本回退+改名 | — | **发布流程** | 中 |
| `scripts/generate-third-party-notices.cjs` | Modified | 改名文案 | — | 发布流程 | 低 |
| `.github/workflows/build-release.yml` | Modified | 资产名改名 | — | 发布流程 | 低 |
| `src/main/{adapter,auth,connectionTest,process,config}Service.js` | Deleted | 死文件清理 | — | 无(零引用)| 低 |
| `src/renderer-react/src/{App.tsx,styles.css}` | Deleted | 死文件清理 | — | 无 | 低 |
| `src/renderer/{index.html,renderer.js,styles.css}` | Deleted | 旧渲染目录清理 | — | 无 | 低 |
| `test/config.test.js`, `test/adapter.test.js` | Added | 回归护栏 | — | 测试 | 低 |
| `legal/*`, `README*`, `CONTRIBUTING.md`, `SECURITY.md`, `GITHUB_UPLOAD_GUIDE.md`, `design-qa.md`, `eula.ts`, `legalInfo.ts`, `icon.svg` | Modified | 改名文案 | — | 文档/法务 | 低 |
| `CLAUDE.md`, `docs/UPGRADE_MANUAL.md` | Added | 执行约定/升级总纲 | — | 文档 | 低 |

> 数据迁移代码:**无**(决策:无老用户)。路由:N/A(单页 tab,未改)。

---

## 六、关键实现说明(高风险改动)

**配置写入(P-01)**:原 `fs.writeFile` 直写 → 现 `atomicWriteFile`(同目录 temp→fsync→rename)。采用原因:崩溃/断电不留半截文件;同目录确保 rename 原子(跨盘风险规避)。与方案一致,无折中。副作用:极小概率残留 `.tmp-*`(失败路径已清理)。回滚:`git revert 1b38f57`。

**恢复(P-02)**:原直接覆写 `meta.originalConfigPath` 且不校验 → 现先 `TOML.parse`/`JSON.parse` 校验、写当前活动路径(调用方传入)、原子写、回读。一致。副作用:旧备份若缺字段仍回退 originalConfigPath(已兜底)。回滚:`git revert f404cbb`。

**回滚(P-03)**:原 catch 仅记日志 → 现 `writeWithRollback` 失败即恢复切换前备份并抛错带 `rolledBack`。**折中**:仅在单元层验证组合逻辑,未注入真实 IPC 切换失败做端到端。回滚:`git revert 54e4ea6`。

**敏感信息(P-09)**:前6后4 → 前2后2(≤8 返回 `***` / 渲染层 `••••••••`)。所有者已确认。回滚:`git revert 69add04`。

**改名(T-001)**:**保留** 引擎标识 `codex`/`claude`;GitHub 仓库 URL 已更新为 `Sotan-0714/Apivot`;旧 env/provider 名仅留在清理列表(防御)。一致。副作用:若曾有人手动设旧 env `CODEX_SWITCHER_THIRD_PARTY_API_KEY`,清理列表仍会删除——安全。回滚:`git revert 3e5de26`。

**UI 全局(P-10~13)**:先加 token 再灰度替换;`!important` 仅保留 `prefers-reduced-motion`(无障碍必需,AC-09 允许列明)。一致。回滚:逐 commit revert。

**侧栏收起(P-12)**:JS `matchMedia` 为唯一来源,窄窗与手动收起共用 `.sidebar-collapsed`;窄窗时隐藏收起按钮避免死按钮。**轻微偏差**:原方案未指定 narrow 时按钮处理,做了隐藏。回滚:`git revert 78c1219`。

**Windows 缩放**:**未做专门适配,未验证**。

---

## 七、UI 设计交接

### 1. 布局(沿用现值,本次未改)
最小窗口 980×720(`main.js` BrowserWindow);推荐 1280×820;侧栏展开 244px / 收起 72px(`styles-v30.css` `.app-shell`);顶部区 58px(`.content-frame`);内容限宽 1180/1280px,最大化 `clamp(24,3vw,48)px`;滚动条 hover/active 才显形;设置入口 `.sidebar-bottom{position:absolute;bottom:28px}`(左下固定);最大化去圆角。**均未改动,GUI 未截图核对。**

### 2. 设计变量(最终实际,见 `styles-v30.css :root`)
- 颜色:`--app-bg/--surface-1..3/--text-primary..tertiary/--stroke-subtle..medium/--engine-primary*/--success/--warning/--caution/--error/--focus` + 新增 `--engine-codex #4f46e5`/`--engine-claude #da7756`/`--window-close #c42b1c`。
- 字号 `--fs-title:24 / --fs-h2:16 / --fs-body:14 / --fs-sub:12 / --fs-meta:11`;字重 `--fw-regular:400/--fw-medium:500/--fw-semibold:600/--fw-bold:700`。
- 间距 `--space-1:4 … --space-8:32`;圆角窗口32/卡片16/内层12/控件10/徽章6;控件高 `--control-h-sm:28/md:32/lg:38/--input-h:40/--nav-h:44`;等宽 `--font-mono`。
- 边框 `1px var(--stroke-*)`;阴影 `--window-shadow`,`--card-shadow:none`;动效 120/140/180ms(沿用)。

### 3. 组件状态(代码层支持,GUI 未逐态截图)
导航项:default/hover/selected(`.is-active`,无蓝竖条)/focus-visible;按钮:default/hover/active/disabled(opacity .45)/loading(`.spin`);输入框:default/hover/focus/disabled/error(`.has-error`);开关:on/off;卡片:标准/compact;弹窗:EULA/Confirm/Legal;Toast:success/error(role alert/status)。Pressed/Focus 等存在定义。

### 4. 设计约束完成情况(**代码层证据,均缺 GUI 截图**)
| 约束 | 状态 | 证据 |
|---|---|---|
| 收起按钮在栏内 | 代码满足(未改原结构) | `.sidebar-bottom` / Sidebar JSX |
| 选中无蓝色竖条 | 满足 | `.nav-item.is-active` 无 ::before 竖条 |
| 左下设置入口稳定 | 满足(绝对定位) | `.sidebar-bottom{position:absolute}` |
| 右侧内容增多不影响入口 | 满足(绝对定位) | 同上 |
| 无多余刷新按钮 | 满足(去重 `.refresh-button`) | `70cda84` |
| 图标透明背景 | 满足(mask 机制保留) | `.nav-icon` mask;icon.svg 仅改 aria |
| 状态区无意义小横杠 | 未专门处理 | Unknown |
| 顶部状态/刷新协调 | 未改动 | 沿用 |
| 未因极简删功能 | 满足 | 备份/恢复/会话/启动入口均在 |
| 最小/正常/最大化正常 | **Not executed(GUI)** | — |

> **全部 UI 约束缺截图证据(实施环境无法截图),需所有者/Codex 在 GUI 内逐项核对。**

---

## 八、测试执行报告

| 命令 | 用途 | 结果 | 警告/错误 | 环境 |
|---|---|---|---|---|
| `npm install` | 装依赖 | Passed | 5 条 deprecated 警告 | win32, Node 24.14 |
| `npx tsc --noEmit` | 类型检查 | **Passed**(每任务后均跑)| 无 | 同上 |
| `npm run build:renderer` | 构建渲染层 | **Passed** | 无 | 同上 |
| `npm test` (`node --test`) | 单测 | **Passed (12/12)** | 无 | 同上 |
| `npm audit --audit-level=high` | 安全审计 | **Passed (0 high)** | — | 同上 |
| `npm run dist` | 打包便携版 | **Passed**(生成 `Apivot-Portable-1.0.1-x64.exe`,SHA 已出,树干净)| signtool 自签名 | 同上 |
| Lint(eslint) | 代码风格 | **Not executed**(未引 eslint,以 typecheck 替代)| — | — |
| 集成/E2E(Playwright)| UI 渲染 | **Not executed** | — | — |
| 应用启动 / 安装包人工测试 | GUI 行为 | **Not executed**(实施环境无桌面交互)| — | — |

---

## 九、功能测试结果

| # | 功能 | 结果 | 证据/说明 |
|---|---|---|---|
| F1 | 原子写中断保原文件 | **Passed** | config.test.js |
| F2 | 损坏备份恢复被拒、原配置不变(codex+claude) | **Passed** | config.test.js |
| F3 | 好备份恢复到活动路径 | **Passed** | config.test.js |
| F4 | 通用清理移除自定义/适配器 provider(AC-06) | **Passed** | config.test.js |
| F5 | 切换失败回滚(组合逻辑) | **Partially passed**(单元层,非完整 IPC) | 服务层测试 |
| F6 | 用量多命名提取 | **Passed** | adapter.test.js |
| F7 | maskSecret 前2后2 | **Passed** | config.test.js |
| F8 | `npm run dist` 后树干净/版本正确(AC-04) | **Passed** | 实跑 dist |
| F9~F30 | 首启/重启/官方读取/第三方读取/双向切换/保存/备份/恢复/无效URL/无效Key/网络不可用/文件不存在/损坏/无权限/被占用/连点/快切/写中途关程序/状态刷新/页面切换/导航展开收起/设置入口/100·125·150%缩放 | **Not executed** | **无 GUI 运行环境;须 Windows 人工执行** |

---

## 十、截图与视觉对比

**未产出任何截图。** 实施环境无法启动 GUI 截屏。手册要求的优化前/后、各页、各状态、最小/正常/最大化、125%/150% 缩放对比图 **全部缺失**,需所有者在 Windows 运行 `outputs\Apivot-Portable-1.0.1-x64.exe`(commit `9a83138`)后补齐,并与原 12 张基线截图比对。

---

## 十一、未完成 / 部分完成内容

| 任务 | 状态 | 未完成部分 | 原因 | 影响 | 推荐后续 |
|---|---|---|---|---|---|
| T-601 | Partially | P-18 流式累计策略、P-17 Claude SSE `output_tokens` 回写未改 | provider 相关,盲改会破坏主流 provider 累计;手册标 Runtime | Claude Code 自显 token 可能不准(应用统计不受影响) | 真实 provider 流式抓样本后校准 |
| T-501 | With deviation | 页面体未按 `pages/*.tsx` 拆分(仅抽 shared 组件+helpers) | 无 GUI runtime,逐页拆 import churn 大、回归不可验,守「不得破坏」 | 维护性改善有限 | 有 GUI 验证条件后逐页拆 |
| T-404 | With deviation | 文案策略所有者未选;非逐字符全量审计 | 待确认项被「不再询问」覆盖,取默认「随语言」 | 个别深层字符串可能漏 | 所有者确认策略并全量扫 |
| T-103/T-203/T-301/T-302/T-405 | Completed 但缺 runtime | GUI/E2E 行为未人工验 | 无桌面交互环境 | 视觉/交互可能有偏差 | Windows 人工双验 |
| 全部 UI 截图与缩放 | Not executed | AC-12/AC-13 视觉证据 | 同上 | 验收证据缺口 | Windows 截图核对 |
| eslint | 放弃 | 未引入 | 避免新增依赖/审计面 | 无风格门禁 | 可作 Phase 6 跟进 |

---

## 十二、与原方案的偏差

| 原方案 | 实际 | 原因 | 经所有者确认 | 影响需求 | 影响验收 | 建议保留 |
|---|---|---|---|---|---|---|
| T-501 按 `pages/SwitchPage.tsx` 等逐页拆 | 仅抽 `components/common.tsx`+`lib/helpers.ts` | 无 runtime 验证,降回归风险 | 否(自主决策)| 否 | 是(AC「各页渲染一致」仅 build/tsc 层达成)| 是(基础已立)|
| T-601 校正累计策略 | 仅导出+单测,不改行为 | provider 相关,盲改有回归风险 | 否 | 部分(P-17/18 仍在)| 是 | 是 |
| T-404 二选一文案策略 | 默认「随语言本地化」 | 「不再询问」指令 + AC 要求不混排 | 否(默认决策)| 否 | 否 | 待所有者确认 |
| T-302 窄窗收起 | 额外隐藏收起按钮 | 避免死按钮 | 否 | 否 | 否 | 是 |
| `maskSecret` 渲染层阈值 | 主进程 `≤8→***`,渲染层 `≤8→••••••••` | 视觉占位 | 部分(脱敏强度已确认)| 否 | 否 | 是 |

> **重大偏差(未经确认):T-501 缩范围、T-601 不改行为。** 二者均为「降低不可验证的回归风险」而主动收敛,需所有者裁定是否接受或后续补做。

---

## 十三、当前已知问题

| # | 描述 | 严重 | 复现 | 影响范围 | 规避 | 修复方向 |
|---|---|---|---|---|---|---|
| K1 | P-18 流式用量「最后覆盖」对增量型 provider 可能少计 | 中 | 真实增量 usage provider 流式 | 用量统计准确性 | 以非流式为准 | 真实样本后定累计策略 |
| K2 | P-17 Claude 流式回写 `output_tokens:0`、count_tokens 桩值 | 中 | Claude third-party 流式 | Claude Code 自显 token | 看应用内统计 | 评估 SSE 回写 |
| K3 | 所有 GUI/缩放行为未运行验证 | 中 | 启动 app | 切换/恢复/渲染/缩放 | Windows 人工测 | 跑 F9~F30 + 截图 |
| K4 | T-103 回滚仅单元层验证 | 中 | 注入真实切换写失败 | 切换安全 | — | runtime 注入双验 |
| K5 | 公开仓库所有者邮箱 `1300858541@qq.com` 仍存于 legal/eula/package author(P-23)| 低 | 看 legal 文件 | 隐私 | — | 所有者确认是否脱敏 |
| K6 | electron 37→42 大版本,packaged app 运行行为未 GUI 验 | 中 | 运行 exe | 全局 | — | Windows 冒烟 |

> 不声称「项目已无问题」。以上为已知残留。

---

## 十四、Codex 重点验收清单

1. **最高风险**:`atomicWrite.js`、两 configService 的 restore/clean、`main.js writeWithRollback`、store 原子写——核心数据安全路径。
2. **最需独立复测**:官方↔第三方双向真实切换、切换失败回滚、一键恢复默认对自定义 provider、备份恢复到活动路径。
3. **易误判**:T-501(代码已动 ≠ 完成「逐页拆」)、T-601(已加测试 ≠ 已修 P-17/18)、所有「Completed 但缺 runtime」项。
4. **UI 状态未充分验证**:全部——hover/pressed/focus/loading/empty、明暗、双引擎色、EULA 按钮变色、收起态一致性,均无截图。
5. **依赖特殊环境**:F9~F30、125%/150% 缩放、安装包运行——需 Windows 桌面。
6. **可能回归**:electron 42 大版本;改名后 env/provider/localStorage 键(老配置兼容);文案本地化是否漏字符串。
7. **与原方案偏差**:T-501 缩范围、T-601 不改行为、T-404 默认策略(详见第十二节)。
8. **仅所有者可判**:UI「简约专业有设计感」审美;文案中英策略;邮箱是否公开(P-23)。

---

## 十五、最终完成度声明

> 口径:以手册 20 个编号任务 + 14 条 AC 为基数。「完成」=达到该任务自动可验的验收;runtime/GUI 项单列。

| 维度 | 已完成 | 部分 | 未完成 | 未验证 | 说明 |
|---|---|---|---|---|---|
| 基础功能稳定性 | 5/5 (T-101~105) | 0 | 0 | T-103/105 runtime | Phase 1 五任务代码达成,审计/打包实测 |
| 功能需求符合度 | R2代码/R3保留 | R1 | 0 | R4/R5/R7 GUI | 核心闭环代码完成,运行待验 |
| 功能完整性 | T-201,202,203 (3/3) | 0 | 0 | T-203 UI | Phase 2 完成 |
| UI 布局 | T-301,302 (2/2) | 0 | 0 | 缩放/GUI | 代码达成 |
| UI 视觉 | T-401~405 (5/5) | T-404偏差 | 0 | GUI 比对 | AC-07/08/09 grep 达成 |
| 响应式/Windows 缩放 | 0 | 0 | 0 专门项 | **全部(AC-13)** | 未做专门适配且未验 |
| 测试/回归覆盖 | T-503 + 12 用例 | T-601 | 0 | E2E/GUI | 主进程核心有单测;UI/E2E 无 |
| 构建/发布 | T-104 + 实打包 | 0 | 0 | 安装运行 | AC-04 实测通过 |

**计数(20 任务)**:Completed 15 · Completed with deviation 3(T-404/T-501,及 T-601 视角)· Partially 1(T-601)· Not completed 0 · Removed 0 · Unable to verify 0(但约 9 项的 runtime/GUI 侧面为 Not executed)。

**AC(14 条)**:自动达成 8(AC-01,02,04,05,06,07,08,09)· 代码达成待 runtime 4(AC-03,10,11,12)· 未执行 1(AC-13)· 不适用 1(AC-14 无老用户)。

**结论**:
- **是否建议发布**:**暂不建议直接发布**。代码与打包就绪,但**零 GUI/缩放运行验证**、T-103 端到端未双验、electron 42 大版本未冒烟——发布前必须在 Windows 跑通 F9~F30 + 125%/150% 缩放 + 真实切换/恢复。
- **是否建议进入正式验收**:**可进入验收(代码/构建层)**,但验收人须在 Windows 补齐运行测试与截图后才能签收 UI/功能项。
- **阻塞发布的问题**:K3(GUI 未验)、K4(回滚未端到端验)、K6(electron 42 未冒烟);K1/K2 不阻塞(应用自身统计不受影响)。
- **需所有者/Codex 重点确认**:T-501/T-601 偏差是否接受;T-404 文案策略;P-23 邮箱;以及全部 UI 审美与缩放表现。

— 报告完。本报告生成时未修改任何代码。
