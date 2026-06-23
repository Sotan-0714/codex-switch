export const EULA_VERSION = "MIT-1.0";

export type EulaLanguage = "zh" | "en";

export const eulaContent = {
  zh: {
    title: "Apivot MIT 许可证",
    updated: "适用于版本 1.0.1",
    intro: "Apivot 使用 MIT License 开源。你可以使用、复制、修改、合并、发布、分发、再授权或销售本软件副本，但必须保留版权声明和许可声明。",
    sections: [
      ["版权声明", "Copyright (c) 2026 Hardcopia。"],
      ["授权范围", "任何获得本软件及相关文档副本的人，都可以免费处理本软件，包括使用、复制、修改、合并、发布、分发、再授权或销售本软件副本。"],
      ["保留声明", "上述版权声明和许可声明必须包含在本软件的所有副本或主要部分中。"],
      ["第三方依赖", "第三方开源依赖仍受其各自许可证约束。完整依赖声明见 legal/THIRD_PARTY_NOTICES.md。"],
      ["无担保", "本软件按“原样”提供，不附带任何明示或默示担保，包括但不限于适销性、特定用途适用性和不侵权担保。"]
    ],
    acknowledge: "我已阅读并同意 Apivot MIT 许可证。",
    accept: "同意并继续",
    decline: "拒绝并退出",
    close: "关闭",
    contact: "Copyright (c) 2026 Hardcopia · 1300858541@qq.com"
  },
  en: {
    title: "Apivot MIT License",
    updated: "Applies to version 1.0.1",
    intro: "Apivot is released under the MIT License. You may use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, subject to the license notice being preserved.",
    sections: [
      ["Copyright", "Copyright (c) 2026 Hardcopia."],
      ["Permission", "Permission is granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the software without restriction."],
      ["Notice retention", "The copyright notice and permission notice must be included in all copies or substantial portions of the software."],
      ["Third-party dependencies", "Third-party open-source dependencies remain governed by their own licenses. See legal/THIRD_PARTY_NOTICES.md for complete notices."],
      ["No warranty", "The software is provided as is, without warranty of any kind, express or implied."]
    ],
    acknowledge: "I have read and agree to the Apivot MIT License.",
    accept: "Accept and Continue",
    decline: "Decline and Exit",
    close: "Close",
    contact: "Copyright (c) 2026 Hardcopia · 1300858541@qq.com"
  }
} as const;
