# Apivot 项目稳定性与 UI 设计优化升级手册

> 适用仓库：`github.com/Sotan-0714/Apivot` ｜ 审查 commit：`03ae755` ｜ 版本：`1.0.1`
> 本手册基于真实源码、Codex 审计资料、运行截图与项目所有者补充说明编写。
> **本次只输出升级方案，不直接修改代码。** 代码标识、文件路径、组件名、变量名均保留原文。
> 执行约定：Codex 一次只执行一个任务（见第十四节任务编号），每个任务完成后程序必须保持可运行、可回滚。

---

## 一、项目现状诊断结论（先读这一节）

**总体判断：项目适合在现有结构上继续迭代，不需要重做，也不建议大规模重构。** 当前代码在"核心安全流程"上的工程质量明显高于一般个人项目，主要欠债集中在 **写入原子性、恢复可靠性、发布脚本副作用、设计 token 缺失、遗留并行文件** 五处，全部可以小幅精修 + 中等升级解决。

逐条结论：

1. **是否适合直接继续迭代：是。** 入口清晰（`main.js` → 引擎专用服务；`main.tsx` → `AppV30.tsx` + `styles-v30.css`），核心切换流程设计正确。
2. **是否需要先做稳定性修复：是，且必须先做。** 配置写入与 store 写入均为非原子写（直接 `fs.writeFile`），`restoreBackup` 不校验备份内容、且写回的是备份元数据里记录的旧路径。这三点直接威胁你最看重的第 2 个核心功能"环境不被污染、可一键恢复"。**在做任何 UI 升级之前必须先处理。**
3. **是否有必须立即处理的高风险问题：有 4 项**（详见第三节 Critical/High）：非原子写入、恢复无校验、切换校验失败不自动回滚、发布脚本成功后不还原 `package.json`。
4. **当前功能是否基本符合需求：是。** 三个核心功能（稳定使用第三方 API + 统计、官方/第三方安全切换、自定义会话记录管理）在代码层面都已实现且有保护机制，不是"只有 UI 没有底层"的空壳。
5. **当前 UI 是否适合在原结构上升级：是。** 已有完整的 颜色 / 圆角 / 明暗 / 引擎主题 token 体系（`styles-v30.css:5–84`），布局模型（侧边栏 + 内容区 + 三步工作流）清晰。**缺的不是结构，而是间距 / 字号 / 控件高度的统一刻度**——这正是你说的"字体规范不标准、卡片大小没规律"的根因。
6. **是否需要局部重构或整体调整：仅需局部。** 把 `AppV30.tsx`（1079 行单文件）按页面拆分、补齐设计 token、清理遗留并行文件即可，无需整体重写。
7. **哪些部分值得保留**（详见第二节）：切换编排顺序、会话保护快照、token 主题体系、设置页行布局、会话删除越界护栏、侧边栏既有约束。
8. **哪些部分不建议继续叠加修改：`styles-v30.css` 与 `AppV30.tsx`。** 这两个文件已出现多处"局部补丁 + `!important` 覆盖 + 重复声明"（如 `.refresh-button` 在 160–161 与 198–199 重复定义、第 225/227/229 行带前导空格的追加块），继续在上面打补丁只会加重欠债，应在 Phase 3/5 做结构化整理后再改。

> 一句话：**底子比看起来好，先补三处数据安全的洞，再统一一套设计刻度，UI 就能从"能用"升到"专业有设计感"，不需要伤筋动骨。**

---

## 二、项目优点与必须保留的部分

以下均为代码核实结论，升级时不得破坏：

| 应保留项 | 证据 | 保留理由 |
| -- | -- | -- |
| 切换编排顺序：读取→**先备份**→快照会话状态→校验兼容→写入→**写后回读校验** | `main.js applyCodexSwitch`；`codexConfigService.js:285–318` | 这是"环境不被污染"的核心保障，先备份后写、写后校验缺一不可 |
| 会话保护快照（auth + 会话状态） | `main.js` 中 `snapshotCodexState` / `snapshotClaudeState` 调用，步骤 "Protect Codex auth and conversation state" | 你明确表示满意、不希望改动 |
| 一键恢复默认（clean official） | `codexConfigService.js:320 writeCleanOpenAIConfig`、`claudeConfigService.js` 对应函数 | 你明确表示满意、不希望改动 |
| 自定义会话记录管理 + 越界删除护栏 | `chatRecordService.js:38–40 isInside`、`272–274` 拒绝删除已知根目录外的文件 | 你明确表示满意；护栏设计稳健，是亮点 |
| 完整设计 token 基础（颜色/明暗/引擎主题/圆角） | `styles-v30.css:5–84` | 升级 UI 的地基，已经存在，只需在其上补刻度 |
| 无障碍基础：`:focus-visible` 焦点环、`prefers-reduced-motion` | `styles-v30.css:92、250–252` | 难得已实现，必须保留 |
| 透明背景图标（mask + currentColor 实现） | `styles-v30.css:127–131`，`src/assets/nav-mask/` | 满足你"图标必须透明背景"的约束，机制正确 |
| 设置页"标题 + 描述 + 右侧控件"行布局 | `styles-v30.css:229 .settings-group/.setting-row`，截图 `08_settings` | 你最满意的页面之一，应作为其它页面的统一模板 |
| 侧边栏既有约束（收起按钮在栏内、选中无蓝色竖条、设置固定左下、收起后图标居中） | `styles-v30.css:107–143`，`.sidebar-bottom{position:absolute;bottom:28px}` | 你明确要求保留，且代码已正确实现（设置项绝对定位、不随右侧内容高度移动） |
| token 用量字段多命名兼容（已修复的统计准确性） | `codexAdapterService.js:161–180`、`claudeAdapterService.js:166–170` | 兼容 `input_tokens/prompt_tokens` 等多种返回，正是 codex 修复的部分 |
| 用量记录上限 500、store 写入串行锁 | `store.js:270 .slice(-500)`、`store.js:211 withWriteLock` | 防止历史无限膨胀与并发写竞争，应保留 |

---

## 三、问题总表

严重程度：Critical / High / Medium / Low。确认状态：Confirmed（已确认）/ Highly likely（高度可能）/ Runtime（需运行验证）/ Subjective（主观设计建议）。

| 编号 | 类型 | 页面/功能 | 当前情况 | 证据 | 影响 | 严重程度 | 状态 | 阶段 |
| -- | -- | -- | -- | -- | -- | -- | -- | -- |
| P-01 | 稳定性风险 | 配置/Store 写入 | 全部使用直接 `fs.writeFile`，非原子写 | `codexConfigService.js:208,223,293,340,355`；`store.js:228` | 崩溃/断电/锁文件时可损坏用户真实 `config.toml` 或应用 store | **Critical** | Confirmed | P1 |
| P-02 | 恢复可靠性 | 备份恢复 | `restoreBackup` 不校验备份内容是否可解析；写回 `meta.originalConfigPath`（备份记录的旧路径）而非当前活动配置路径 | `codexConfigService.js:348–357` | 损坏/异机/路径变化的备份可被直接写入，恢复后处于损坏态或写错位置 | **High** | Confirmed | P1 |
| P-03 | 流程闭环 | 切换失败处理 | `writeConfigForProfile` 先写后校验、校验失败抛错；`switch:apply` catch 仅记日志，不自动回滚到切换前备份 | `codexConfigService.js:293→309`；`main.js switch:apply` catch | 校验失败时配置可能停留在新（坏）状态，需用户手动恢复，与"切换失败不破坏原始配置"要求有差距 | **High** | Confirmed | P1 |
| P-04 | 发布脚本 | 打包 | 成功构建后**未还原** `package.json`/`package-lock.json`（还原只在 catch 中）；`nextVersion()` 在 `outputs/` 为空时回退 `0.1.0` | `scripts/build-portable-versioned.cjs:39、59–68、126–127` | 成功 `npm run dist` 后工作树变脏、版本被错误写成 0.1.0 | **High** | Confirmed | P1 |
| P-05 | 安全依赖 | 依赖 | `npm audit` 报 2 个 high（`electron`、`form-data`） | 审计 `06_BUG_AND_RISK_REGISTER BUG-001` | 打包桌面应用的依赖安全风险 | High | Confirmed | P1 |
| P-06 | 可维护性 | 遗留并行文件 | 多个引擎专用服务有未被引用的"通用版"并行文件 | 引用图：`adapterService.js / authService.js / connectionTest.js / processService.js` 零生效引用；`App.tsx(1324行) / styles.css / src/renderer/` 未被入口引用 | 后续维护者可能误改死文件 | Medium | Confirmed | P5 |
| P-07 | 可维护性 | 近死文件 | `configService.js` 仅被 `logger.js` 引用其中的 `maskSecret`，其余全死 | `logger.js:3`、`configService.js` | 不能直接删，需先迁移 `maskSecret` | Medium | Confirmed | P5 |
| P-08 | 配置正确性 | 一键恢复默认 | `writeCleanOpenAIConfig` 仅删除硬编码 provider 名白名单，含拼写错误 `ccswith`（应为 `ccswitch`） | `codexConfigService.js:332–335` | 用户真实 provider 名不在白名单且不是当前 provider 时，`model_providers` 残留 | Medium | Confirmed | P2 |
| P-09 | 数据安全 | 密钥脱敏 | 长密钥 `maskSecret` 暴露前 6 位 + 后 4 位 | `codexConfigService.js:23` | 截图/日志中泄露过多密钥前缀 | Medium | Confirmed | P2 |
| P-10 | UI 视觉一致性 | 全局样式 | 无间距/字号/控件高度 scale；字重非标准（650/750/800）；半像素字号（11.5/12.5px） | `styles-v30.css` 全文字面量 | 字体规范不统一（你已反馈） | High | Confirmed | P4 |
| P-11 | UI 视觉一致性 | 卡片 | 各类卡片 padding 互不相同 | `.card`24 / `.compact-card`20 24 / `.flow-card`20 24 / `.metric-card`16 18 / `.receipt-card`22 24 / `.setting-row`12 20（`styles-v30.css:185,206,211,227,229`） | 卡片大小没规律（你已反馈） | High | Confirmed | P4 |
| P-12 | 历史修补痕迹 | 全局样式 | `.refresh-button` 重复定义（160–161 与 198–199）；225/227/229 行带前导空格的追加块；`.chat-record-list` max-height 被二次覆盖；`.chat-record-title-row` 用 `display:flex !important` 覆盖 grid；收起态有"JS 类 + @media 980px"两套实现 | `styles-v30.css:160–161,198–199,223→225,243` | 明显的局部补丁与重复规则 | Medium | Confirmed | P4 |
| P-13 | UI 视觉一致性 | EULA 弹窗按钮 | 主按钮硬编码 `#4f46e5/#4338ca`（Codex 紫），不随引擎变色 | `styles-v30.css:235` | Claude（橙）引擎下按钮仍为紫色 | Low | Confirmed | P4 |
| P-14 | UI 文字规范 | 导航/表单 | 中英文混排：`Profile`、`Provider ID`、`Model`、`API key`、`Endpoint`、`Base URL`、`Headers JSON` 为英文，其余中文；且设置里语言已选"简体中文" | 截图 `01/03/04/12` | 文字规范不统一（你已反馈） | Medium | Confirmed | P4 |
| P-15 | 状态反馈 | 顶部状态药丸 | 显示原始值 `third_party`（带下划线），非友好标签 | 截图 `01/04` 顶部药丸 | 专业度略降 | Low | Subjective | P4 |
| P-16 | 交互一致性 | 切换页操作按钮 | 宽屏时按钮浮在时间线右上（`execute-grid` 1fr/260px），与步骤对应关系不清；窄屏变为底部全宽堆叠 | `styles-v30.css:209`，截图 `01` vs `11/12` | 主操作位置随宽度变化，关系不直观 | Medium | Subjective | P3 |
| P-17 | 适配器兼容 | Claude 用量 | 流式 `message_delta` 向客户端回写 `output_tokens:0`；`count_tokens` 端点返回桩值 `input_tokens:1` | `claudeAdapterService.js:366,443` | Claude Code 自身显示的 token 数可能不准（应用自身统计不受影响） | Medium | Runtime | P6 |
| P-18 | 适配器兼容 | 流式用量累计 | 流式中 `usage = eventUsage` 为"最后覆盖"而非累加 | `codexAdapterService.js:258` | 某些按块返回增量 usage 的 provider 可能少计 | Medium | Runtime | P6 |
| P-19 | 测试缺失 | 工程 | `package.json` 无 `test`/`lint` 脚本 | `package.json scripts`（审计 BUG-008） | 核心配置/适配流程无自动回归护栏 | Medium | Confirmed | P0/P5 |
| P-20 | 死代码体积 | 渲染层 | `mockApi.ts` 随生产包发布（含示例假数据），仅靠 `if(window.api)return` 守卫 | `mockApi.ts:86` | 死重量 + 潜在隐患（非安全问题，密钥为假） | Low | Confirmed | P5 |
| P-21 | 无障碍/测试 | EULA 弹窗 | 弹窗"关闭"与窗口关闭可访问名重叠 | 审计 BUG-006，截图 `09` | 自动化/读屏定位歧义 | Low | Confirmed | P4 |
| P-22 | 运行兼容 | 启动检测 | Codex/Claude 启动依赖机器特定安装路径 | `main.js` 启动检测，审计 RISK-010 | 部分安装方式下需手动启动兜底 | High | Runtime | P2/P6 |
| P-23 | 隐私 | 法务文案 | 所有者邮箱 `1300858541@qq.com` 出现在 `package.json` author、EULA、release notes | `package.json`、截图 `09` | 公开仓库中的个人联系方式（如有意为之则无需处理） | Low | 需确认 | — |

---

## 四、逐项基础功能审查

对每个功能给出：目的 / 当前实现 / 是否符合需求 / 是否闭环 / 异常处理 / 问题 / 升级空间 / 涉及文件 / 验收要点。

### 4.1 第三方 API 切换与稳定使用（核心功能 1）
- **目的与需求**：稳定使用第三方 API，含连接测试与用量统计。
- **当前实现**：第三方目标会先做兼容性测试（Responses 失败自动回退 Chat Completions），随后**启动本地适配器**并把 `127.0.0.1` 的本地地址写入 config，由适配器转发并采集用量（`main.js applyCodexSwitch`；`codexAdapterService.js`）。
- **符合需求 / 闭环**：符合；闭环完整（测试→启动适配器→写入→回读→记录）。
- **异常处理**：兼容性失败抛出明确错误并阻止切换；用量字段多命名兼容。
- **当前问题**：流式用量"最后覆盖"可能少计（P-18）；Claude 流式对客户端回写 0（P-17）。
- **升级空间 / 是否建议**：建议（P6）补 per-provider 流式/工具调用测试；不建议改动现有转发主逻辑。
- **涉及文件**：`codexAdapterService.js`、`claudeAdapterService.js`、`codexConnectionTest.js`、`claudeConnectionTest.js`。
- **验收要点**：对 ≥2 个真实 provider 跑非流式 + 流式各一次，应用统计的 input/output/total 与 provider 账单口径一致或仅差最后一帧。

### 4.2 官方 / 第三方安全切换 + 一键恢复（核心功能 2，最高优先级）
- **目的与需求**：随意切换、环境不被污染、被污染可一键恢复。
- **当前实现**：先备份、快照会话、写入、写后回读校验（已确认正确）。
- **符合需求 / 闭环**：主流程符合；但**异常分支未闭环**——校验失败不自动回滚（P-03），写入非原子（P-01），恢复不校验且可能写错路径（P-02）。
- **当前问题**：P-01 / P-02 / P-03 / P-08。
- **升级空间 / 是否建议**：必须补全（P1/P2）。**不建议**改动备份→写入→回读的主顺序。
- **涉及文件**：`codexConfigService.js`、`claudeConfigService.js`、`main.js`、`store.js`。
- **验收要点**：见第十五节验收标准 AC-01～AC-05。

### 4.3 自定义会话记录管理（核心功能 3）
- **目的与需求**：自定义管理官方/第三方聊天记录，可选择性删除而不动配置/登录/备份。
- **当前实现**：列出已知根目录下记录，删除前用 `isInside` 校验越界，越界即抛错拒绝（`chatRecordService.js`）。
- **符合需求 / 闭环**：符合；护栏稳健。**唯一缺口**：`fs.rm(force:true)` 为硬删除、无撤销（`chatRecordService.js:289`）。
- **升级空间 / 是否建议**：可选（P6）增加"软删除/回收"作为**默认关闭的开关**；你满意此功能，默认不改变其行为。
- **涉及文件**：`chatRecordService.js`、`AppV30.tsx` RecordsPage。
- **验收要点**：删除越界路径必须抛错；删除不得触及 backups / 配置 / 登录态。

### 4.4 用量统计
- **当前实现**：四指标卡 + 趋势图 + 最近请求；统计来源为可观测本地请求，已去除 OpenAI 过滤（截图 `07`）。
- **问题**：官方用量不可观测（设计边界，UI 已用提示条说明）；P-17/P-18。
- **建议**：可选增加 per-provider 单价模板；保持"统计≠账单"提示。

### 4.5 连接测试 / 状态 / 启动
- 测试与状态闭环基本完整；**启动检测依赖机器路径**（P-22），需运行验证并提供"手动启动 + 显示命令"兜底（审计已部分实现，建议在 P2 强化提示）。

### 4.6 备份 / 日志 / 设置 / 弹窗（易被忽略项）
- 备份：列表/恢复/删除齐全；恢复缺校验（P-02）。
- 日志：有清除；条目显示原始值（`switch_success` 等），可在 P4 做友好标签。
- 设置：行布局规范，是模板来源。
- EULA 弹窗：关闭名歧义（P-21）、按钮硬编码紫色（P-13）。

---

*（接第五至十七节）*

---

## 五、功能升级建议（补全 / 增强 / 新增，三类分开）

**A. 现有功能补全（缺失即风险，归 P1/P2）**
- 配置/Store 原子写入（缺持久化安全机制）→ P-01。
- 切换失败自动回滚到切换前备份（缺流程闭环）→ P-03。
- 恢复前校验备份可解析、恢复写回当前活动路径（缺校验/缺正确性）→ P-02。
- 一键恢复默认改为"通用清理"而非硬编码白名单（缺正确性）→ P-08。

**B. 现有功能增强（能用但可更可靠，归 P2/P6）**
- 切换前提供 config diff 预览（更明确的状态）。
- per-provider 兼容性诊断与更清晰错误（更可靠的配置验证）。
- 启动方式选择器 + 显示实际命令（更好的兜底反馈）。
- 密钥脱敏收紧为"前 2 后 2"（更安全）→ P-09。

**C. 新增功能建议（基础稳定并验收后才做，归 P6）**

| 新增项 | 用户价值 | 是否必要 | 是否符合定位 | 复杂度 | 稳定性影响 | 推荐优先级 |
| -- | -- | -- | -- | -- | -- | -- |
| Provider 配置模板 | 降低首配门槛 | 中 | 是 | 中 | 低 | 高 |
| Profile 导入/导出 | 多机迁移 | 中 | 是 | 中 | 低（注意脱敏） | 中 |
| 会话记录软删除/回收 | 误删可恢复 | 中 | 是 | 中 | 低 | 中 |
| 首次运行引导 | 新手上手 | 低 | 是 | 中 | 低 | 中 |
| 第三方 API 复用官方插件库 | 你提到的期望 | 低（你已说不强求） | 取决于 provider 能力 | 高 | 中 | 低，先调研 |

> 关于"第三方 API 使用官方所有插件库"：插件库能力由上游 provider 决定，本地适配器无法凭空提供。建议先做一次可行性调研（哪些插件走标准 API、哪些依赖官方私有协议），不要直接排期开发。

---

## 六、UI 信息架构审查

- **导航模型**：左侧栏（品牌 + 引擎切换 + 页面项 + 左下设置）+ 顶部条（标题 + 状态药丸 + 刷新 + 窗口控制）+ 内容区卡片堆叠。结构清晰，符合桌面工具任务模型，**应保留**。
- **页面分组合理**：切换 / 状态 / Profile / 测试 / 备份与日志 / 用量统计 / 设置，与产品任务一一对应。
- **主次操作**：切换页主操作"切换并验证"应是全页视觉重心；当前宽屏下它浮在右上（P-16），与三步流程的视觉关系偏弱，建议在 P3 固定其位置。
- **状态信息**：顶部药丸承载 provider/model/状态，信息密度合理；仅"原始值显示"需友好化（P-15）。
- **改进点**：备份与日志页左列"备份"卡片在记录少时垂直留白过大（截图 `06`），信息架构上可让左右两列高度自适应内容。

## 七、UI 布局审查

- **栅格/容器**：`content-frame` 限宽 `min(100%,1180px)`、切换页 `max-width:900px`、Profile `max-width:920px`、设置 `860px`——**容器限宽策略合理**，宽屏不会拉伸过宽（截图 `12` 已验证）。
- **响应式**：已有 1100px / 980px / max-height:700px 断点。问题是 980px 断点与 JS 收起类**两套收起逻辑并存**（P-12），需在 P3 合并为单一来源。
- **间距**：垂直卡片间距用 `gap:16px` 较统一，但卡片**内部** padding 不统一（P-11）。
- **需运行验证**：超长 model/provider 名、超长 Windows 路径、极小高度窗口、Windows 125%/150% 缩放（审计 `12_RESPONSIVE` 已列清单，本次未独立验证）。

## 八、UI 视觉审查

- **已具备**：完整明暗 + 双引擎主题色、统一圆角 token、透明 mask 图标、focus 环、reduced-motion。视觉气质已是"专业本地工具"而非营销页，方向正确。
- **欠缺（与你的反馈一致）**：
  - 字体：无字号/字重刻度，出现 650/750/800 非常规字重与 11.5/12.5px 半像素（P-10）。
  - 卡片：各类卡片 padding 不一（P-11）。
  - 小控件圆角随手取值：`badge`4px、`go-profile-link`7px、多处 8px，绕过了 `--radius-control:10px`。
  - 局部 `!important` 与重复规则（P-12）。
  - EULA 按钮硬编码紫色（P-13）。

## 九、UI 组件与交互审查

- **组件**：导航项 / 段控 / 状态药丸 / 目标卡 / 检查行 / 步骤时间线 / 表单字段 / 开关 / 备份项 / 日志项 / 会话项 / 指标卡 / 图表 / 弹窗 / 徽章 / 空态 / Toast——种类齐全。
- **状态覆盖**：hover/active/selected/disabled/focus/loading(.spin)/success/warning/error 均有定义，覆盖较好。
- **缺口**：控件高度不统一（button 38 / input 40 / segmented 32 / filter 30 / refresh 28 / toggle 24 / nav 44 / window 36），缺 `--control-h-*` 刻度；EULA 关闭名歧义（P-21）。

---

## 十、推荐 UI 升级方向（主方向，唯一）

> 一句话定位：**"安静的专业工具"——克制、精确、信息优先；用一套统一刻度替代随手数值，让现有结构显得更专业，而不是换一套外观。**

1. **设计关键词**：克制、精确、秩序、稳重。
2. **视觉气质**：浅灰底 + 白色表面 + 单一引擎强调色，弱阴影、细边框，不堆装饰。
3. **信息密度**：中等偏高（桌面工具，不是网页）。
4. **页面结构**：保持 侧边栏 + 顶部条 + 内容卡片，不改。
5. **导航结构**：保持现有，仅做对齐与间距统一。
6. **内容层级**：标题 24 / 卡片标题 16 / 正文 14 / 辅助 12 / 状态 11——固定四到五级，不再出现半像素。
7. **控件风格**：统一三种按钮高度、统一输入高度、统一段控高度（见第十一节刻度）。
8. **状态反馈**：保留 Toast + 内联结果 + 时间线，friendly 化原始值（P-15）。
9. **颜色原则**：语义色只走 token，禁止组件内写死 hex（修 P-13）。
10. **圆角原则**：窗口 32 / 卡片 16 / 内层 12 / 控件 10 / 小徽章 6——**禁止 7px、8px 等随手值**。
11. **卡片原则**：统一卡片内边距刻度（紧凑 16 / 标准 20 / 宽松 24），按内容密度三选一，不再每个卡片各写各的。
12. **图标原则**：保持透明 mask 线性图标，统一线宽，保留主图标不改。
13. **动效原则**：保持现有过渡时长，统一到 120/140/180ms 三档，尊重 reduced-motion。

**保留 / 调整 / 删除 / 重做**
- 保留：整体结构、token 地基、设置页布局、会话/备份交互、侧边栏约束、主图标。
- 调整：全局间距/字号/控件高度统一到刻度；卡片 padding 归档；切换页主操作位置。
- 删除：重复的 `.refresh-button` 规则、`!important` 覆盖、带前导空格的补丁块、写死 hex。
- 重做：仅"切换页执行区按钮布局"一处局部重排（P-16），其余不重做。

---

## 十一、新增 UI 设计规范（可直接指导开发的设计系统）

> 实施方式：**只新增 token 与"映射工具类/变量"，逐页把字面量替换为 token，不改变现有视觉结果**（除非该处本就是要修的 bug）。先加 token、再灰度替换，保证每步可回滚。

### 布局
- 最小窗口：960×640（与现有最小截图一致）。
- 推荐窗口：1280×820。
- 侧栏展开：244px；收起：72px（沿用现值）。
- 顶部区高度：58px（沿用 `content-frame` 行高）。
- 内容最大宽度：常规 1180px，宽屏页 1280px，最大化时全宽 + 左右 clamp(24,3vw,48)px（沿用）。
- 滚动：内容区滚动条 hover/active 才显形（沿用现有实现）。

### 间距刻度（新增 `--space-*`，替换字面量）
`--space-1:4 / --space-2:8 / --space-3:12 / --space-4:16 / --space-5:20 / --space-6:24 / --space-8:32`
- 4：图标与文字、徽章内距。
- 8：紧凑控件间距、表单标签与控件。
- 12：卡片内行间距、检查行内距。
- 16：卡片之间、卡片标题与内容。
- 20/24：卡片内边距（标准/宽松）。
- 32：页面级大分隔（少用）。

### 字体刻度（新增 `--fs-*` / `--fw-*`，消灭半像素与非常规字重）
| 角色 | 字号 | 字重 | 行高 |
| -- | -- | -- | -- |
| 页面标题 | `--fs-title:24` | `--fw-bold:700` | 32 |
| 卡片/区域标题 | `--fs-h2:16` | `--fw-semibold:600` | 24 |
| 正文 | `--fs-body:14` | `--fw-medium:500` | 20 |
| 辅助/说明 | `--fs-sub:12` | `--fw-regular:400` | 18 |
| 状态/徽章 | `--fs-meta:11` | `--fw-semibold:600` | 16 |
| 按钮 | `--fs-body:14`（或 13 紧凑） | `--fw-semibold:600` | — |
> 规则：禁止出现 11.5/12.5px 与 650/750/800 字重；等宽场景统一用 `--font-mono:"Cascadia Mono",Consolas,monospace`。

### 圆角（沿用 + 收口小控件）
窗口 32 / 卡片 16 / 内层 12 / 控件 10 / 徽章 6。**禁止 7、8 等随手值**（统一收敛到上述五档）。

### 色彩（全部已存在，强制只走 token）
背景 `--app-bg` / 表面 `--surface-1/2/3` / 文本 `--text-primary/secondary/tertiary` / 描边 `--stroke-subtle/medium` / 引擎 `--engine-primary*` / 语义 `--success/--warning/--caution/--error` / 焦点 `--focus`。
> 规则：组件 CSS 内**禁止再写 hex**（修 P-13 的 `#4f46e5/#4338ca`、`.engine-dot` 与 980px 断点内的写死色，改引用 token）。

### 控件高度刻度（新增 `--control-h-*`）
`--control-h-sm:28（刷新/紧凑段控）/ --control-h-md:32（段控/筛选）/ --control-h-lg:38（主次按钮）/ --input-h:40 / --nav-h:44`。
- 内边距：按钮 0 15px、输入 0 12px；图标尺寸：常规 16、导航 18、窗口控制 15。
- 禁用样式：`opacity:.45;cursor:not-allowed`（沿用）。
- 聚焦样式：`outline:2px solid var(--focus);outline-offset:2px`（沿用，勿删）。

### 图标
- 来源：`src/assets/nav-mask/`（mask 方式），UI 图标 `src/assets/ui-icons/`。
- 风格：线性、透明背景，统一线宽。
- 主图标（品牌图标）**不改**。
- 禁止：白底方块图标、给图标加不透明背景。

---

## 十二、逐页面 UI 升级方案

> 每页：当前结构 → 问题 → 推荐结构 → 保留/调整/删除 → 验收 → 对应文件。所有页面共用第十一节刻度，以下只列页面特有项。

### 切换页 Switch
- 当前：三步卡（选择目标 / 执行前检查 / 执行与验证）+ `execute-grid 1fr 260px` 右侧按钮列。
- 问题：宽屏主操作浮右上，与时间线对应弱（P-16）；窄屏变底部全宽，行为不一致。
- 推荐：执行区改为"时间线在上、操作按钮固定在该卡底部全宽（主按钮独占一行，次按钮并排）"，宽窄屏一致；主按钮始终是全页视觉重心。
- 保留：三步结构、检查行、回执卡。删除：`execute-grid` 的随宽度浮动。
- 验收：AC-10。对应：`AppV30.tsx` SwitchPage、`styles-v30.css:209`。

### Profile 页
- 问题：标题与字段标签中英混排（P-14）；两列表单在 1100px 以下转单列（已实现）。
- 推荐：统一文案（见 P-14 任务）；字段标签字号统一 `--fs-sub`、字重 `--fw-regular`。
- 保留：段控、两列栅格、密钥字段的眼睛/复制/清除。对应：`AppV30.tsx` ProfilesPage、`styles-v30.css:217`。

### 备份与日志页 Records
- 问题：左列卡片记录少时留白过大；日志条目显示原始值。
- 推荐：左右两列 `align-items:start` 高度随内容自适应（部分已实现）；日志事件名做 friendly 映射（`switch_success`→"切换成功"）。
- 保留：会话记录越界护栏与筛选。对应：`AppV30.tsx` RecordsPage、`styles-v30.css:222–225`。

### 用量统计页 Tokens
- 现状最佳之一，仅做刻度替换；指标卡 padding 归档为"紧凑 16"。对应：`styles-v30.css:227`。

### 设置页 Settings
- 作为模板，几乎不动；仅替换字面量为 token。对应：`styles-v30.css:229`。

### EULA / 弹窗
- 修按钮硬编码色（P-13）→ 改 `var(--brand)`；解决关闭名歧义（P-21）→ 窗口关闭与弹窗关闭使用不同可访问名（如 `aria-label="关闭许可证窗口"` vs 窗口控制 `aria-label="关闭应用"`）。对应：`AppV30.tsx`、`styles-v30.css:234–235`。

---

## 十三、分阶段升级路线

> 强约束：每阶段结束程序可运行、可回滚；UI 改动一律"先加 token 再灰度替换"，不一次性大改。

- **Phase 0 安全基线**：锁定 `v1.0.1` tag；建立回归测试骨架（见 P-19）；备份核心配置；确认 `npm run build:renderer` 与 `tsc --noEmit` 通过；用现有 12 张截图建立 UI 基线。
- **Phase 1 Critical/High 稳定性修复**：P-01 原子写、P-02 恢复校验+正确路径、P-03 切换失败自动回滚、P-04 发布脚本、P-05 依赖。**只碰数据安全，不碰 UI。**
- **Phase 2 功能完整性补全**：P-08 通用清理、P-09 脱敏收紧、P-22 启动兜底提示、切换 diff 预览。
- **Phase 3 UI 结构与布局**：P-16 切换页执行区重排；合并两套收起逻辑；卡片高度自适应。
- **Phase 4 UI 视觉系统**：落地第十一节全部 token；逐页替换字面量；修 P-10～P-15、P-21。
- **Phase 5 代码结构与测试**：拆分 `AppV30.tsx`；清理 P-06/P-07 遗留文件（先迁 `maskSecret`）；移除 P-20 生产 mock；补 `test`/`lint`。
- **Phase 6 可选增强**：P-17/P-18 适配器 per-provider 测试；Provider 模板、导入导出、软删除等（第五节 C 类）。

---

## 十四、详细开发任务清单

> 每个任务可独立交给 Codex 执行一项。工作量：S/M/L。
> 命名约定：项目最终更名为 **Apivot**（包名 `apivot`、appId `local.apivot`、默认新环境变量名 `APIVOT_THIRD_PARTY_API_KEY`）。npm 包名与 GitHub 仓库名均已确认未被占用。

### T-001【P1·M】统一项目名称为 Apivot（含数据/环境兼容迁移）
- 所属阶段：Phase 1（属基线类，建议在 P1 早期完成，避免后续任务在旧名上累积）
- 当前问题：旧项目名称与旧仓库短名易撞车且名不副实（实际同时管 Codex 与 Claude Code）
- 用户影响：直接 find-replace 会改变 appId/productName/env/localStorage/provider 名，导致**老用户数据、环境变量、配置清理全部断裂**
- 证据：`package.json:43-44`（appId/productName）；`store.js:42`、`codexConfigService.js:273`、`main.js:797`（env `CODEX_SWITCHER_THIRD_PARTY_API_KEY`）；`AppV30.tsx:198-204`、`index.html`（localStorage 键）；`codexConfigService.js:256,332-334`（config provider 清理名）；`package.json:75,78,81` + `.github/workflows/build-release.yml`（产物名）
- 推荐方案（分两层处理）：
  - **可直接替换层（显示/文档）**：README、`README_ZH.md`、`SECURITY.md`、`CONTRIBUTING.md`、`GITHUB_UPLOAD_GUIDE.md`、`design-qa.md`、EULA/legal 文案（`eula.ts`、`legalInfo.ts`）、UI 标题、`icon.svg` 内文字、`package.json` 的 `name`/`description`。
  - **兼容迁移层（不可裸替换）**：
    1. `appId` 与 `productName`：若希望老用户无缝升级，**保持 appId 不变**或在主进程首次启动时把旧 userData 目录内容迁移到新目录后再切 productName；macOS 同理。
    2. 环境变量：新默认名（如 `APIVOT_THIRD_PARTY_API_KEY`）与旧名 `CODEX_SWITCHER_THIRD_PARTY_API_KEY` **并存识别**；切换/清理流程在写新名的同时删除旧名（`main.js:797` 的清理列表保留旧名）。
    3. localStorage：读取时按"新键 ?? 旧键"回退，首次写入新键并可删旧键（`AppV30.tsx:198-204`）。
    4. config.toml provider 清理名：新增新名的同时，**保留对旧名 `codex_switcher_adapter`/`third_party`/`ccswitch`/`ccswith` 的删除**（与 T-201 一并处理，修正 `ccswith` 拼写）。
    5. 产物名随 `productName` 自动派生，需同步 `.github/workflows/build-release.yml` 中匹配资产名的正则/字符串。
- 不推荐：全局 `sed` 一把替换所有变体；改 appId 而不迁移 userData。
- 涉及文件：上述全部 + `main.js`、`store.js`、`codexConfigService.js`、`claudeConfigService.js`、`AppV30.tsx`、`index.html`、`package.json`、`.github/workflows/build-release.yml`。
- 是否影响核心逻辑：否（仅命名与迁移）｜配置格式：不变｜数据迁移：**是（userData 目录 + env + localStorage）**｜前置依赖：建议与 T-201 协同。
- 开发步骤：1) 替换显示/文档层；2) 实现 env/localStorage 新旧并存回退；3) 决定 appId 策略并实现 userData 迁移；4) 同步发布产物名；5) 装老版本→装新版本，验证数据不丢。
- 验收：AC-14 ｜回归：升级安装测试（旧→新）、一键恢复默认对旧 provider 名仍生效、老 env key 被清理｜风险：appId 变更导致升级断裂（最高风险，须先决策）｜回滚：恢复旧名字符串 + 关闭迁移逻辑。

### T-101【P1·S】配置与 Store 原子写入
- 所属阶段：Phase 1 ｜ 当前问题：P-01 ｜ 证据：`codexConfigService.js:208,223,293,340,355`；`store.js:228`
- 用户影响：崩溃/断电可损坏真实配置或 store。
- 推荐方案：新增 `atomicWriteFile(path, data)`：写入同目录临时文件 `*.tmp-<pid>-<rand>` → `fsync`（可用时）→ `fs.rename` 覆盖目标。所有写配置/写 store/写备份处改用之。
- 不推荐：引入第三方库 / 改写整套服务结构。
- 涉及文件：新增 `src/main/atomicWrite.js`；改 `codexConfigService.js`、`claudeConfigService.js`、`store.js`。
- 是否影响核心逻辑：否（仅替换写动作）｜配置格式：不变｜数据迁移：不需要｜前置依赖：无。
- 开发步骤：1) 实现 helper；2) 替换全部 `fs.writeFile(<file>...)`；3) 临时文件失败时清理并保留原文件。
- 验收：AC-01 ｜回归：FT-014/016 + 故障注入（写中断）｜风险：rename 跨盘失败（临时文件须同目录）｜回滚：还原各文件 `fs.writeFile`。

### T-102【P1·M】恢复前校验 + 恢复到当前活动路径
- 阶段：P1 ｜ 问题：P-02 ｜ 证据：`codexConfigService.js:348–357`
- 推荐方案：`restoreBackup` 增加：1) 读 backup `config.toml` 后**先 `TOML.parse` 校验可解析**，失败则中止并报错（不写）；2) 恢复目标改为"当前活动配置路径"（由调用方传入），仅当未传入时回退 `meta.originalConfigPath`；3) 写入用 T-101 原子写；4) 写后回读校验解析成功。
- 不推荐：信任备份内容直接覆盖。
- 涉及文件：`codexConfigService.js`、`claudeConfigService.js`、`main.js`（传入当前路径）。
- 核心逻辑：是（恢复语义）｜格式：不变｜迁移：不需要｜前置：T-101。
- 验收：AC-02 ｜回归：损坏备份 fixture、异机路径 fixture ｜风险：旧备份缺字段 → 做好兜底｜回滚：恢复原 `restoreBackup`。

### T-103【P1·M】切换校验失败自动回滚
- 阶段：P1 ｜ 问题：P-03 ｜ 证据：`codexConfigService.js:293→309`、`main.js switch:apply`
- 推荐方案：在 `applyCodexSwitch`/`applyClaudeSwitch` 写入步骤包裹 try：若 `writeConfigForProfile` 抛错，**自动用本次切换前 `backup` 调用恢复**，再向上抛出原始错误并在回执标记"已回滚到切换前配置"。
- 涉及文件：`main.js`。核心逻辑：是｜格式：不变｜前置：T-102（复用安全恢复）。
- 验收：AC-03 ｜回归：注入校验失败（写入非法 profile）应回到切换前｜回滚：移除 try/rollback 包裹。

### T-104【P1·S】发布脚本：成功后还原 + 正确回退版本
- 阶段：P1 ｜ 问题：P-04 ｜ 证据：`build-portable-versioned.cjs:39,59–68,126–127`
- 推荐方案：1) 将 `package.json`/`lock` 的还原移入 `finally`（成功也还原，除非显式 `--bump`）；2) `nextVersion()` 无产物时回退读 `package.json.version` 而非 `0.1.0`。
- 涉及文件：`scripts/build-portable-versioned.cjs`。核心逻辑：否（构建流程）｜格式：不变。
- 验收：AC-04 ｜回归：在一次性克隆中 `npm run dist` 后 `git status` 干净、版本正确｜回滚：还原脚本。

### T-105【P1·M】依赖安全修复
- 阶段：P1 ｜ 问题：P-05 ｜ 推荐：在分支升级 `electron`、`form-data` 到无 advisory 版本，跑 `tsc`/build/适配器冒烟全套后再合并。
- 涉及文件：`package.json`、`package-lock.json`。验收：AC-05（`npm audit` 无 high）｜风险：Electron 大版本行为变化｜回滚：还原 lock。

### T-201【P2·S】一键恢复默认改为通用清理（含修 `ccswith` 拼写）
- 阶段：P2 ｜ 问题：P-08 ｜ 证据：`codexConfigService.js:332–335`
- 推荐方案：清理逻辑改为"删除当前 `model_provider` 对应项 + 任何指向本地适配器(127.0.0.1)的 provider"，不再依赖硬编码白名单；保留对历史脏名（含 `ccswitch`）的兼容删除并修正拼写。
- 验收：AC-06 ｜回归：含自定义 provider 名的 fixture 清理后 `model_providers` 不残留｜回滚：还原函数。

### T-202【P2·S】密钥脱敏收紧为前 2 后 2
- 问题：P-09 ｜ 证据：`codexConfigService.js:23`｜方案：长值改 `slice(0,2)+"***"+slice(-2)`｜验收：截图/日志中不出现 ≥6 位真实前缀。

### T-203【P2·M】启动失败兜底提示强化
- 问题：P-22 ｜ 方案：检测失败时在 UI 明确显示"未找到可靠启动方式 + 建议手动命令"，不报假成功（审计已部分实现，补全文案与状态）｜验收：AC-11。

### T-301【P3·M】切换页执行区按钮重排
- 问题：P-16 ｜ 证据：`styles-v30.css:209`、`AppV30.tsx` SwitchPage
- 方案：执行卡内"时间线在上、操作区在卡底全宽"，主按钮独占一行；移除随宽度浮动的 `execute-grid 1fr 260px`，宽窄屏一致。验收：AC-10。

### T-302【P3·S】合并两套收起逻辑
- 问题：P-12（部分）｜ 证据：`styles-v30.css:104,136–143 与 243`｜方案：以 JS `.sidebar-collapsed` 为唯一来源，980px 断点只触发同一套类，不再重复定义 engine 点样式。验收：收起视觉在"手动收起"与"窄窗"下完全一致。

### T-401【P4·M】落地设计 token（间距/字号/字重/控件高度）
- 问题：P-10 ｜ 方案：在 `:root` 增加第十一节全部 `--space-*/--fs-*/--fw-*/--control-h-*`，本任务只"新增 token + 不改现有视觉"，替换在 T-402 灰度进行。验收：token 存在且 build 通过。

### T-402【P4·L】逐页字面量替换为 token
- 问题：P-10/P-11 ｜ 方案：逐页（settings→tokens→profile→records→switch 顺序，从最稳页开始）把 padding/font-size/font-weight/height 替换为 token；卡片 padding 归并为 16/20/24 三档；消灭 11.5/12.5px 与 650/750/800。每页替换后与 Phase 0 截图比对。验收：AC-07、AC-08｜回滚：逐页 git revert。

### T-403【P4·S】消除重复规则与 `!important`、写死色
- 问题：P-12/P-13 ｜ 证据：`styles-v30.css:160–161/198–199`、`223→225`、`235`｜方案：合并 `.refresh-button`；去掉 `.chat-record-title-row` 的 `!important`（改用更具体选择器）；EULA 按钮与 `.engine-dot`、980px 断点写死 hex 改 token。验收：AC-09。

### T-404【P4·S】文案统一（中英混排）
- 问题：P-14/P-15 ｜ 方案：导航与表单标签统一为中文（或统一保留为公认技术名词，二选一，见第十六节待确认）；状态药丸把 `third_party` 映射为"第三方 API"。验收：单页内不出现中英混排标签。

### T-405【P4·S】EULA 关闭名去歧义
- 问题：P-21 ｜ 方案：弹窗关闭 `aria-label` 与窗口关闭区分。验收：自动化按可访问名查询"关闭"返回唯一控件。

### T-501【P5·L】拆分 `AppV30.tsx`
- 问题：审计技术债 ｜ 方案：按页面拆为 `pages/SwitchPage.tsx` 等 + 共享 `components/`，保持行为不变。验收：`tsc` 通过、各页渲染一致、无行为变化。

### T-502【P5·M】清理遗留并行文件（先迁移再删）
- 问题：P-06/P-07/P-20 ｜ 证据：引用图 ｜ 方案：1) 先把 `configService.js` 的 `maskSecret` 迁到 `src/main/util/mask.js` 并改 `logger.js` 引用；2) 确认零引用后删除 `adapterService.js`、`authService.js`、`connectionTest.js`、`processService.js`、`configService.js`、`App.tsx`、`styles.css`、`src/renderer/`；3) `mockApi` 仅在 dev 引入。**删除前用 `grep -r` 复核零引用。** 验收：build/tsc 通过、应用功能不变。

### T-503【P5·M】补 `test`/`lint` 脚本
- 问题：P-19 ｜ 方案：见第十五节最小自动化套件；加入 `package.json`。验收：`npm test` 可跑核心 config/adapter 用例。

### T-601【P6·M】适配器 per-provider 用量测试与流式累计修正
- 问题：P-17/P-18 ｜ 方案：对真实 provider 跑流式，校正 `codexAdapterService.js:258` 累计策略；评估 Claude SSE `output_tokens` 回写。验收：见 4.1 验收要点。

---

## 十五、验收标准（必须可判断）

- **AC-01**：模拟写入中断（写一半进程退出）后，真实 `config.toml` 仍为切换前的完整可解析内容，不出现半截文件。
- **AC-02**：对一个内容损坏（非法 TOML）的备份执行恢复，操作被拒绝并提示原因，原配置文件**未被改写**；对正常备份恢复后写入的是当前活动配置路径且可解析。
- **AC-03**：构造一个会导致写后校验失败的切换，结束后配置自动回到切换前内容，回执显示"已回滚"。
- **AC-04**：在全新克隆中执行一次成功的 `npm run dist`，结束后 `git status` 干净，且产物文件名版本号等于 `package.json` 版本（非 0.1.0）。
- **AC-05**：`npm audit --audit-level=high` 无 high 及以上条目。
- **AC-06**：导入一个 `model_provider="my_custom"` 的配置并执行一键恢复默认，恢复后 `model_providers` 中无残留自定义项、无 `openai_base_url`、`model_provider` 被移除。
- **AC-07**：全局搜索 `styles-v30.css` 不再出现 `11.5px`、`12.5px`、`font-weight:650/750/800`。
- **AC-08**：所有标准卡片内边距取值仅来自 {16,20,24} 三档。
- **AC-09**：`styles-v30.css` 中除 token 定义区(`:root`)外不出现 `#` 十六进制颜色；`.refresh-button` 只定义一次；无 `!important`（或列明保留项及理由）。
- **AC-10**：切换页主操作按钮在 960 / 1280 / 1600 宽度下位置一致（卡底全宽），且为该页最高视觉权重控件。
- **AC-11**：未检测到可靠启动方式时，UI 显示"请手动启动 + 具体命令"，不显示"启动成功"。
- **AC-12（约束守恒）**：升级后侧栏收起按钮仍在栏内、选中项无蓝色竖条、设置仍固定左下且不随右侧内容高度移动、所有图标透明背景、主图标未改。
- **AC-13（Windows 缩放）**：125% 与 150% 缩放下，切换页/Profile 页无文字裁切、无控件重叠（运行验证）。
- **AC-14（重命名迁移）**：安装旧版并产生 profiles/用量/EULA 状态后，安装新版 `Apivot`，启动后这些数据全部可见（userData 已迁移）；切换第三方后旧环境变量名被清理、不残留；对仅含旧 provider 名的 config 执行一键恢复默认仍清理干净。

---

## 十六、回归测试与回滚

**最小自动化套件（P-19/T-503）**
1. Node 单测：`codexConfigService`/`claudeConfigService` 在临时目录的 写/备份/恢复/清理（含损坏 fixture）。
2. Node 集成：适配器对假上游的 Responses/Chat/Messages 用量采集。
3. Playwright：各页面渲染 + 侧栏收起 + 约束守恒（AC-12）。
4. Electron 冒烟启动。
5. 发布脚本 dry-run + 成功后工作树洁净检查。
6. 发布前敏感字符串扫描（密钥/真实域名）。

**每阶段回归清单**
- 改前：记录当前 commit、跑全套套件、用 12 张基线截图存档。
- 改后：跑全套 + 关键页面截图比对 + `tsc`/build 通过。
- 必测异常：写中断、损坏配置/备份、网络超时、快速重复点击、切换中关闭程序。
- **高风险标红**：任何触及 配置写入 / 备份恢复 / 一键恢复 / 适配器转发 的改动（T-101/102/103/201/601），必须单测 + 手动双验。

**回滚**
- 每个任务对应单一 commit，回滚条件：AC 未达或回归失败；回滚步骤：`git revert <task-commit>`，因 token 为"先加后替换"，UI 任务可逐页回退而不影响其它页。

---

## 十七、暂不建议修改 + 需所有者确认

**暂不建议修改（保持现状）**
- 切换主流程顺序、会话保护快照、一键恢复入口、会话删除护栏（你满意且代码正确）。
- 主品牌图标、设置页布局（你满意）。
- "统计≠账单"的设计边界与官方用量不可观测的说明。
- 不要为极简删除：备份/恢复入口、切换所需状态、手动启动兜底、配置路径显示。

**需所有者确认（影响方向，先回答再排期）**
1. **文案策略（影响 T-404）**：导航/表单标签统一改为全中文，还是统一保留 `Provider ID / Base URL / Model` 等公认技术名词？目前是混排。
2. 是否需要 Linux 打包（影响发布矩阵）。
3. 遗留并行文件是否确认删除（T-502）——已用引用图确认为死代码/近死代码，等你确认即可清理。
4. 官方用量是否永久在 UI 隐藏。
5. 第三方单价模板是否需要 per-provider（影响用量页）。
6. 长密钥脱敏收紧为"前 2 后 2"是否可接受（T-202）。
7. 会话记录"软删除/回收站"是否要做（默认关闭）——你满意现功能，需确认是否额外加。
8. 公开仓库中的所有者邮箱 `1300858541@qq.com` 是否有意公开（P-23）。
9. 第三方 API 复用官方插件库：是否要先排一次可行性调研（你已说不强求）。

> 待确认项回答前，相关任务（尤其 T-404、T-502、T-601）不应开工。
