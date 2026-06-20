export const colors = {
  bg: "#050508",
  bgElevated: "#0c0c10",
  surface: "#141418",
  surfaceHover: "#1c1c22",
  border: "#2a2a32",
  borderSubtle: "#1f1f26",
  text: "#f4f4f5",
  textMuted: "#a1a1aa",
  textDim: "#71717a",
  accent: "#3b82f6",
  accentMuted: "rgba(59, 130, 246, 0.15)",
  accentNeon: "#22d3ee",
  success: "#22c55e",
  successNeon: "#4ade80",
  successMuted: "rgba(34, 197, 94, 0.12)",
  gold: "#fbbf24",
  goldMuted: "rgba(251, 191, 36, 0.15)",
  danger: "#ef4444",
  dangerMuted: "rgba(239, 68, 68, 0.12)",
  glass: "rgba(20, 20, 24, 0.72)",
  // Legacy aliases
  primary: "#3b82f6",
  primaryMuted: "rgba(59, 130, 246, 0.15)",
  surfaceLight: "#2a2a32",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const typography = {
  display: { fontSize: 32, fontWeight: "800" as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: "700" as const },
  h2: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  mono: { fontSize: 13, fontWeight: "600" as const, fontVariant: ["tabular-nums"] as const },
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
};
