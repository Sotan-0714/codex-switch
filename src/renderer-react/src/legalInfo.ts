export type LegalView = "privacy" | "thirdParty" | "guide";

export const legalInfo = {
  zh: {
    privacy: {
      title: "Apivot 隐私政策",
      meta: "适用于 Apivot 1.0.1",
      sections: [
        ["本地处理", "Apivot 是本地优先的桌面软件，不提供账号系统、广告、遥测、分析统计或 Hardcopia 云同步。Profile、API Key、Base URL、模型、Headers、配置路径、日志、备份、用量统计、聊天记录选择状态和许可接受记录默认保存在本机。"],
        ["网络请求", "只有在你刷新模型、测试连接、启动客户端或运行本地适配器时，程序才会向界面中显示的端点发送请求。本地适配器仅监听 127.0.0.1。"],
        ["用量统计", "用量统计仅来自 Apivot 可观测的请求，例如本地适配器流量，以及返回 usage 的连接测试；它不等同于官方服务商账单。"],
        ["聊天记录", "记录页只读取 Codex 和 Claude Code 的本机会话/历史文件，用于显示、筛选和选择性删除。删除聊天记录不会删除配置、登录状态或备份。"],
        ["第三方服务", "你选择的 API 服务商可能会根据其自身政策处理请求内容。Hardcopia 不会通过本软件收集或出售你的本地应用数据。"]
      ]
    },
    thirdParty: {
      title: "第三方依赖许可证",
      meta: "适用于 Apivot 1.0.1",
      sections: [
        ["产品许可证", "Apivot 使用 MIT License 开源。"],
        ["核心依赖", "Electron、React、React DOM、Framer Motion、Lucide React、@iarna/toml、Vite、TypeScript、Tailwind CSS 及相关构建工具均按各自许可证使用。"],
        ["服务商与商标", "OpenAI、Codex、Anthropic、Claude、Claude Code 等名称、商标与服务归其各自权利人所有。本软件并非由这些第三方赞助、认可或官方发布。"]
      ]
    },
    guide: {
      title: "Apivot 使用说明",
      meta: "便携版 / 安装版 1.0.1 快速指南",
      sections: [
        ["项目优势", "一个本地桌面工具同时管理 Codex 和 Claude Code；区分官方登录与第三方 API；通过本地适配器处理接口转换；提供前置检查、自动备份、恢复预览、启动检测、状态验证、用量统计和分类聊天记录清理。"],
        ["安装方式", "可从 GitHub Releases 下载 Windows 安装版、Windows 便携版、macOS Apple Silicon DMG 和 macOS Intel DMG。"],
        ["Mac 打包", "macOS DMG/ZIP 需要在 GitHub Actions macOS runner 或真实 macOS 机器上构建；Windows 无法可靠生成最终 macOS 安装包。"],
        ["用量统计", "Codex 与 Claude Code 的第三方 API 切换会优先写入本地适配器地址，以便记录可观测请求的 token usage。官方登录直连请求不作为官方账单统计。"],
        ["聊天记录", "记录页支持按 Codex、Claude 或全部筛选；Codex 记录会在可识别时标注 OpenAI 官方、第三方 API 或未知来源。"]
      ]
    }
  },
  en: {
    privacy: {
      title: "Apivot Privacy Policy",
      meta: "Applies to Apivot 1.0.1",
      sections: [
        ["Local processing", "Apivot is local-first desktop software with no account system, advertising, telemetry, analytics, or Hardcopia cloud sync. Profiles, API keys, base URLs, models, headers, configuration paths, logs, backups, usage statistics, chat-record selection state, and license acceptance records are stored locally by default."],
        ["Network requests", "The app sends requests only when you refresh models, test a connection, launch a client, or run the local adapter. Requests go to the endpoint shown in the interface. The local adapter listens only on 127.0.0.1."],
        ["Usage statistics", "Usage statistics come only from requests Apivot can observe, such as local adapter traffic and connection tests that return usage. They are not official provider billing records."],
        ["Chat records", "The Records page reads local Codex and Claude Code session/history files only for display, filtering, and selective deletion. Deleting chat records does not remove configuration, login state, or backups."],
        ["Third-party services", "Your chosen API provider may process request content under its own policies. Hardcopia does not collect or sell your local app data through this software."]
      ]
    },
    thirdParty: {
      title: "Third-Party License Notices",
      meta: "For Apivot 1.0.1",
      sections: [
        ["Product license", "Apivot is released under the MIT License."],
        ["Core dependencies", "Electron, React, React DOM, Framer Motion, Lucide React, @iarna/toml, Vite, TypeScript, Tailwind CSS, and related build tools are used under their respective licenses."],
        ["Providers and trademarks", "OpenAI, Codex, Anthropic, Claude, Claude Code, and related names, marks, and services belong to their respective owners. This app is not sponsored, endorsed, or officially released by those third parties."]
      ]
    },
    guide: {
      title: "Apivot User Guide",
      meta: "Portable / setup 1.0.1 quick guide",
      sections: [
        ["Advantages", "One local desktop tool manages both Codex and Claude Code, separates official login from third-party API mode, translates incompatible API routes through local adapters, and provides preflight checks, backups, restore previews, launch detection, status verification, usage stats, and categorized chat cleanup."],
        ["Installation", "Download Windows setup, Windows portable, macOS Apple Silicon DMG, or macOS Intel DMG from GitHub Releases."],
        ["Mac packaging", "macOS DMG/ZIP builds require GitHub Actions macOS runners or a real macOS machine. Windows cannot reliably produce final Mac installers locally."],
        ["Usage statistics", "Third-party API switching for Codex and Claude Code writes local adapter endpoints when needed so observable token usage can be recorded. Official-login direct traffic is not treated as provider billing statistics."],
        ["Chat records", "The Records page filters by Codex, Claude, or all records. Codex records are marked as OpenAI official, third-party API, or unknown when metadata is available."]
      ]
    }
  }
} as const;
