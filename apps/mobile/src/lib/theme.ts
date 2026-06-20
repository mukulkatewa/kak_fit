import { Platform, type ViewStyle } from "react-native";

export const colors = {
  // Backgrounds — clean near-black, Hevy-style
  bg: "#0a0a0c",
  bgElevated: "#101014",
  surface: "#16161b",
  surfaceHover: "#1f1f26",
  surfaceActive: "#26262f",
  // Borders
  border: "#26262e",
  borderSubtle: "#1c1c22",
  // Text
  text: "#fafafa",
  textMuted: "#9b9ba6",
  textDim: "#5f5f6b",
  // Accent — electric blue
  accent: "#3b82f6",
  accentBright: "#60a5fa",
  accentMuted: "rgba(59, 130, 246, 0.14)",
  accentNeon: "#38bdf8",
  // Success — neon green
  success: "#22c55e",
  successNeon: "#4ade80",
  successMuted: "rgba(34, 197, 94, 0.13)",
  // PR gold
  gold: "#fbbf24",
  goldBright: "#fcd34d",
  goldMuted: "rgba(251, 191, 36, 0.14)",
  // Danger
  danger: "#f43f5e",
  dangerMuted: "rgba(244, 63, 94, 0.13)",
  // Glass
  glass: "rgba(22, 22, 27, 0.7)",
  // Legacy aliases (kept for back-compat)
  primary: "#3b82f6",
  primaryMuted: "rgba(59, 130, 246, 0.14)",
  surfaceLight: "#26262e",
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
};

export const typography = {
  display: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.6 },
  h1: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: "700" as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "600" as const },
  label: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8 },
  mono: { fontSize: 13, fontWeight: "700" as const, fontVariant: ["tabular-nums"] as const },
};

function nativeShadow(color: string, opacity: number, radius: number, height = 4): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: 6,
  };
}

export const shadows = {
  card: Platform.select<ViewStyle>({
    web: { boxShadow: "0 6px 20px rgba(0,0,0,0.35)" },
    default: nativeShadow("#000", 0.35, 16, 6),
  })!,
  glow: Platform.select<ViewStyle>({
    web: { boxShadow: "0 0 24px rgba(59,130,246,0.35)" },
    default: nativeShadow("#3b82f6", 0.35, 20, 0),
  })!,
  goldGlow: Platform.select<ViewStyle>({
    web: { boxShadow: "0 0 24px rgba(251,191,36,0.3)" },
    default: nativeShadow("#fbbf24", 0.3, 20, 0),
  })!,
};
