# 项目背景与升级约定（Claude Code 自动读取）

本项目名称为 **Apivot**。它是一个本地桌面工具（Electron + React/Vite），
用于在官方与第三方 API 之间安全切换 Codex 与 Claude Code 的配置，含备份/恢复、本地适配器、用量统计、会话记录管理。

源码仓库（公开）：https://github.com/Sotan-0714/Apivot  （默认分支 main，审查基线 commit 03ae755）

## 初始化（本机只有发布包、没有源码时）
1. 在当前空文件夹克隆源码：`git clone https://github.com/Sotan-0714/Apivot.git .`
   - 若本机无 git：从 https://codeload.github.com/Sotan-0714/Apivot/zip/refs/heads/main 下载 zip 并解压到当前目录。
2. 安装依赖：`npm install`
3. 确认基线可用：`npm run build:renderer` 与 `npx tsc --noEmit` 均通过。

## 执行升级时必须遵循
1. 升级总纲是 `docs/UPGRADE_MANUAL.md`，是唯一权威来源（它已吸收并修正了早期的 Codex 审计资料，如有冲突以本手册为准）。所有改动按其中第十三节的分阶段路线推进，**一次只做一个任务**（任务编号 T-001、T-101…）。
2. 每个任务：先给方案和受影响文件清单 → 实现 → 跑 `npm run build:renderer` 与 `npx tsc --noEmit` 确认没坏 → 用一个独立 git commit 记录（commit message 含任务编号），保证可回滚。
3. 一个任务做完接着下一个，不必每步都等人；但遇到 build/tsc 失败、或手册标注"需所有者确认 / 需运行验证"的点，停下来询问。
4. **不得破坏**手册第二节"必须保留"项，尤其是：
   - 切换主流程顺序：读取 → 先备份 → 快照会话状态 → 校验 → 写入 → 写后回读校验。
   - 会话保护、一键恢复默认、会话记录越界删除护栏。
   - 侧边栏约束：收起按钮在栏内、选中项无蓝色竖条、设置固定左下且不随右侧内容高度移动、图标透明背景、主品牌图标不改。
5. UI 升级一律"先加设计 token、再逐页灰度替换字面量"，不改变现有视觉结果（除非该处本就是要修的 bug）。
6. **改名任务 T-001 暂缓**：它涉及 appId / userData 目录迁移，取决于是否已有老用户安装过旧版。开始 T-001 前必须先问所有者"是否已有用户安装过旧版"，再据答案收敛为单一方案。

## 常用命令
- 装依赖：`npm install`
- 构建渲染层：`npm run build:renderer`
- 类型检查：`npx tsc --noEmit`
- 依赖安全审计：`npm audit --audit-level=high`
- 入口：主进程 `src/main/main.js`；渲染入口 `src/renderer-react/src/main.tsx` → `AppV30.tsx` + `styles-v30.css`

## 当前阶段
从 Phase 1（数据安全）开始：T-101 原子写入 → T-102 恢复校验 → T-103 切换失败回滚 → T-104 发布脚本 → T-105 依赖升级（最后做，升级后重新 build+tsc）。
Phase 1 全部通过后停下来汇总，等所有者确认再进入 Phase 2。
