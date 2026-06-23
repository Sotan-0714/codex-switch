# Apivot 给 Claude Code 的最终验证交接说明

日期：2026-06-22

目的：Codex 已补齐剩余可自动化事项，并生成可重复执行的验证脚本。请 Claude Code 基于当前仓库重新验证，不要只依据聊天记录判断。

## 一、Codex 已完成的事项

### 1. Vite 浏览器预览 P0 防回归

新增脚本：

- `scripts/qa-vite-smoke.cjs`
- npm 命令：`npm run qa:vite`

覆盖内容：

- 启动真实 Vite dev server
- 使用 Playwright 打开浏览器预览
- 等待 `.app-shell` 渲染
- 首次运行时自动处理 EULA
- 验证 Apivot 品牌、切换页、Profile 页
- 验证侧边栏折叠/展开
- 捕获并失败化 console warning/error
- 截图输出到 `outputs/qa/vite-smoke/`

这个脚本专门防止之前的空白页问题复发：DEV 浏览器预览中 `window.api` 尚未安装时，`AppV30` 启动 effect 调用 `getWindowState()` 导致崩溃。

### 2. Electron 产品路径冒烟测试

新增脚本：

- `scripts/qa-electron-smoke.cjs`
- npm 命令：`npm run qa:electron`

覆盖内容：

- 以独立临时 `APIVOT_USER_DATA_DIR` 启动 Electron
- 首次运行时处理 EULA
- 验证默认页面渲染
- 验证侧边栏折叠/展开
- 验证 Profile 页面
- 验证 Settings 入口和页面
- 将窗口缩放到最小支持尺寸 `980x720`
- 捕获并失败化 renderer console warning/error
- 截图输出到 `outputs/qa/electron-smoke/`

说明：这个脚本能验证源码态 Electron 产品路径，但不能替代真实双击便携版和安装器的人工验收。

### 3. Codex 第三方 API token usage 回归测试

已扩展：

- `test/adapter.test.js`

新增覆盖：

- Codex 本地 adapter 代理非流式 Chat Completions 时记录 usage
- Codex 本地 adapter 代理流式 Chat Completions 时记录 usage

测试方式：

- 在测试中启动本地 mock upstream provider
- 启动真实 `codexAdapterService`
- 调用本地 adapter 的 `/v1/responses`
- 断言 usage recorder 收到规范化后的 token 统计

这证明 Apivot 可观测的 Codex 第三方 adapter 路径已经有自动化保护。它不能证明所有真实服务商都会以相同 SSE 结构返回 usage。

### 4. 综合 QA 命令

新增：

- `npm run qa:all`

执行顺序：

1. `npm run test`
2. `npm run typecheck`
3. `npm run build:renderer`
4. `npm run qa:vite`
5. `npm run qa:electron`

## 二、Codex 已执行并通过的命令

请 Claude Code 重新执行以下命令复核：

```powershell
npm run qa:all
npm audit --audit-level=high
npm run dist:preview
npm run dist:win
```

Codex 本次执行结果：

- `npm run qa:all`：通过
- `node --test`：14/14 通过
- `tsc --noEmit`：通过
- `vite build`：通过
- `qa:vite`：通过
- `qa:electron`：通过
- `npm audit --audit-level=high`：`found 0 vulnerabilities`
- `npm run dist:preview`：输出 `Next portable version 1.0.2`
- `npm run dist:win`：成功生成 Windows 便携版和安装程序

已生成产物：

- `dist/Apivot-Portable-1.0.1-x64.exe`
- `dist/Apivot-Setup-1.0.1-x64.exe`
- `dist/Apivot-Setup-1.0.1-x64.exe.blockmap`

已生成截图：

- `outputs/qa/vite-smoke/`
- `outputs/qa/electron-smoke/`

## 三、仍需 Claude Code 或项目所有者真实环境验证的事项

以下事项不能只靠本地 mock 或 Playwright 源码态验证得出最终结论。

### R1. Windows 真实 GUI / 缩放 / 安装卸载验收

状态：需要真实运行环境验证。

请验证：

1. 双击 `dist/Apivot-Portable-1.0.1-x64.exe` 能正常启动
2. 首次运行 EULA 流程正常
3. 安装 `dist/Apivot-Setup-1.0.1-x64.exe` 后能正常启动
4. 安装版卸载流程正常
5. Codex 和 Claude 工作区切换正常
6. 所有导航入口可访问
7. 侧边栏展开和收起稳定
8. 左下角 Settings 固定、不随右侧内容移动
9. 最小化、最大化、还原、关闭行为正常
10. Windows 100%、125%、150% 显示缩放下无明显遮挡、错位、圆角异常

注意：Codex 尝试用 Playwright `_electron.launch` 直接接管便携版 exe，但 portable wrapper 等待 Electron 窗口超时。不要把该尝试视为包后启动已自动通过。包后启动必须通过真实双击/安装验收。

### R2. 真实第三方 provider 的 SSE usage 样本

状态：需要真实 provider 样本。

新增测试已经证明：当 provider 返回常见 OpenAI-compatible usage 字段时，Codex 本地 adapter 会记录 token 用量。

但真实 provider 可能存在以下差异：

- 只在最后一帧返回 `usage`
- 返回 `response.usage`
- 返回 `delta.usage`
- 返回累计 usage
- 返回增量 usage
- 完全不返回 usage

请 Claude Code 或项目所有者采样以下真实请求，并在提交前脱敏 API Key：

1. Codex 第三方非流式 `/chat/completions`
2. Codex 第三方流式 `/chat/completions`
3. Codex 第三方非流式 `/responses`
4. Codex 第三方流式 `/responses`
5. Claude Gateway 经 Chat Completions adapter 的流式请求

在没有真实样本前，不建议继续改 usage 累计策略，避免把主流 provider 的正确行为改坏。

### R3. Codex / Claude Code 启动检测

状态：依赖用户本机安装方式。

请验证：

1. Codex 可自动检测时，Apivot 能启动 Codex
2. Codex 不可自动检测时，Apivot 显示手动启动提示
3. Claude Code 可自动检测时，Apivot 能启动 Claude Code
4. Claude Code 不可自动检测时，Apivot 显示手动启动提示
5. 启动时注入的环境变量与当前 active profile 一致

## 四、Claude Code 需要重点检查的文件

新增或修改文件：

- `package.json`
- `test/adapter.test.js`
- `scripts/qa-vite-smoke.cjs`
- `scripts/qa-electron-smoke.cjs`
- `docs/CODEX_FINAL_QA_HANDOFF.md`
- `docs/CLAUDE_VERIFY_HANDOFF_ZH.md`

不要提交：

- `.claude/`
- `settings.json`

除非确认 `outputs/qa/` 截图需要作为测试证据进入仓库，否则不建议提交 QA 输出截图。

## 五、敏感信息检查

Codex 已检查本次新增文件中没有写入真实 API Key 或真实第三方 API 地址。Claude Code 复核时仍需再次扫描：

```powershell
Select-String -Path package.json,test\adapter.test.js,scripts\*.cjs,docs\*.md -Pattern 'sk-|api\.cgltgcg|cgltgcg|FITmz'
```

预期：无结果。

## 六、建议 Claude Code 的结论格式

请 Claude Code 返回：

1. `npm run qa:all` 是否通过
2. `npm audit --audit-level=high` 是否通过
3. `npm run dist:preview` 是否通过
4. `npm run dist:win` 是否通过
5. 便携版真实双击启动是否通过
6. 安装程序安装/启动/卸载是否通过
7. Windows 100%、125%、150% 缩放是否通过
8. 是否采集到真实 provider SSE usage 样本
9. 是否确认没有敏感信息进入仓库
10. 是否可以提交当前变更
