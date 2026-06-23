export const TOKENS = {
  BG_STAGE: "#202020",
  BG_WINDOW: "#EDEDF0",
  BG_SIDEBAR: "#E6E7EA",
  BG_WORKSPACE: "#F6F6F8",
  BG_CARD: "#FFFFFF",
  BG_CARD_SOFT: "#F7F8FA",
  TEXT_PRIMARY: "#191A20",
  TEXT_SECONDARY: "#606674",
  TEXT_MUTED: "#8D92A0",
  ACCENT: "#2F2CCF",
  SUCCESS: "#107C41",
  WARNING: "#B86E00",
  DANGER: "#C42B1C",
  BORDER_SUBTLE: "rgba(20,24,32,.06)"
} as const;

export const motion = {
  page: { duration: 0.18, ease: "easeOut" },
  card: { duration: 0.22, ease: "easeOut" }
} as const;
