# Apivot 使用说明

便携版 / 安装版 1.0.1 快速指南。

## 项目优势

Apivot 使用一个本地桌面程序同时管理 Codex 和 Claude Code。它区分官方登录与第三方 API 模式，通过本地适配器处理接口转换，并提供前置检查、自动备份、恢复预览、启动检测、状态验证、用量统计和分类聊天记录清理。

## 安装

从 GitHub Releases 下载对应平台版本：

- Windows 安装版：`Apivot-Setup-1.0.1-x64.exe`
- Windows 便携版：`Apivot-Portable-1.0.1-x64.exe`
- macOS Apple Silicon：`Apivot-Setup-1.0.1-arm64.dmg`
- macOS Intel：`Apivot-Setup-1.0.1-x64.dmg`

## macOS 打包

macOS DMG/ZIP 需要在 GitHub Actions macOS runner 或真实 macOS 机器上构建。Windows 无法可靠生成最终 macOS 安装包。

## 用量统计

Codex 与 Claude Code 的第三方 API 切换会在需要时写入本地适配器地址，以便记录可观测请求的 token usage。用量统计来自 Apivot 可观测的请求，例如本地适配器流量，以及返回 `usage` 的连接测试；它不等同于官方服务商账单。

## 聊天记录

记录页支持按 Codex、Claude 或全部筛选。Codex 记录会在可识别时标注 OpenAI 官方、第三方 API 或未知来源。

## 许可证

Apivot 使用 MIT License 开源。
