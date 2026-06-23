const colors = {
  BG_STAGE: "var(--color-stage)",
  BG_WINDOW: "var(--color-window)",
  BG_SIDEBAR: "var(--color-sidebar)",
  BG_WORKSPACE: "var(--color-workspace)",
  BG_CARD: "var(--color-card)",
  BG_CARD_SOFT: "var(--color-card-soft)",
  TEXT_PRIMARY: "var(--color-text-primary)",
  TEXT_SECONDARY: "var(--color-text-secondary)",
  TEXT_MUTED: "var(--color-text-muted)",
  ACCENT: "var(--color-accent)",
  SUCCESS: "var(--color-success)",
  WARNING: "var(--color-warning)",
  DANGER: "var(--color-danger)",
  BORDER_SUBTLE: "var(--color-border-subtle)",
  stage: "var(--color-stage)",
  window: "var(--color-window)",
  sidebar: "var(--color-sidebar)",
  workspace: "var(--color-workspace)",
  card: "var(--color-card)",
  cardSoft: "var(--color-card-soft)",
  primaryText: "var(--color-text-primary)",
  secondaryText: "var(--color-text-secondary)",
  mutedText: "var(--color-text-muted)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  subtleBorder: "var(--color-border-subtle)"
};

module.exports = {
  theme: {
    colors,
    fontFamily: {
      ui: ["Segoe UI Variable", "Segoe UI", "Microsoft YaHei UI", "system-ui", "sans-serif"],
      mono: ["Cascadia Mono", "Consolas", "monospace"]
    },
    borderRadius: {
      app: "32px",
      workspace: "12px",
      cardLarge: "16px",
      cardSmall: "12px",
      control: "10px",
      input: "10px"
    },
    boxShadow: {
      card: "0 18px 45px rgba(20,24,32,.08)",
      soft: "0 8px 22px rgba(20,24,32,.06)"
    }
  }
};
