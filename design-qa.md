# Apivot v3.0 Design QA

## Source

- Specification: `Codex_Switch_UI优化方案_v3.0最终合并版.docx`
- Target: Windows 11 Electron portable desktop application
- Themes: light, dark, follow system
- Languages: Simplified Chinese and English

## Visual checks

- 1280 x 800 light and dark: passed
- 960 x 640 light and dark: passed
- Maximized light and dark: passed
- 125% DPI Token Usage light and dark: passed
- 150% DPI Profile light and dark: passed
- Window control and effective-status overlap: none
- Normal window radius: 32px
- Maximized window radius and shadow: 0px / none
- Body scrolling: locked; page/card scrolling remains local
- Sidebar settings action: visible in all tested layouts
- Console errors: none

## Interaction checks

- Unsaved Profile cancel and discard flows: passed
- Headers JSON inline validation and disabled save: passed
- Dangerous reset confirmation and Escape dismissal: passed
- Switch backup, write, reread verification, and receipt: passed
- Backup and structured event log rendering: passed
- Token chart and range/provider filters: passed
- Theme and default startup page persistence: passed
- Test user data isolation: passed

## Specification coverage

- Persistent effective configuration status: implemented
- Three-stage switch workflow and durable receipt: implemented
- Separate reset danger zone: implemented
- Status source priority and environment conflict display: implemented
- Tabbed Profile editor with normalized endpoint preview: implemented
- Four-layer connection diagnostics: implemented
- Combined backup and event log workspace: implemented
- Token scope notice, totals, chart, filters, and request history: implemented
- Grouped settings for appearance, language, behavior, and local data: implemented
- Versioned portable packaging with SHA-256 and release notes: implemented

final result: passed
