import { Platform, type ViewStyle } from "react-native";

/** Hevy-inspired palette — pure dark, iOS blue accent, flat surfaces */
export const colors = {
  bg: "#000000",
  bgElevated: "#1c1c1e",
  surface: "#1c1c1e",
  surfaceHover: "#2c2c2e",
  surfaceActive: "#3a3a3c",
  border: "#38383a",
  borderSubtle: "#2c2c2e",
  separator: "#38383a",
  text: "#ffffff",
  textMuted: "#8e8e93",
  textDim: "#636366",
  accent: "#0a84ff",
  accentBright: "#409cff",
  accentMuted: "rgba(10, 132, 255, 0.15)",
  accentNeon: "#0a84ff",
  success: "#30d158",
  successNeon: "#30d158",
  successMuted: "rgba(48, 209, 88, 0.12)",
  gold: "#ffd60a",
  goldBright: "#ffd60a",
  goldMuted: "rgba(255, 214, 10, 0.12)",
  danger: "#ff453a",
  dangerMuted: "rgba(255, 69, 58, 0.12)",
  glass: "rgba(28, 28, 30, 0.95)",
  primary: "#0a84ff",
  primaryMuted: "rgba(10, 132, 255, 0.15)",
  surfaceLight: "#2c2c2e",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
};

export const typography = {
  display: { fontSize: 34, fontWeight: "700" as const, letterSpacing: 0.37 },
  h1: { fontSize: 22, fontWeight: "600" as const, letterSpacing: -0.2 },
  h2: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  label: { fontSize: 11, fontWeight: "500" as const, letterSpacing: 0 },
  mono: { fontSize: 15, fontWeight: "600" as const, fontVariant: ["tabular-nums"] as const },
};

export const shadows = {
  card: Platform.select<ViewStyle>({ web: {}, default: {} })!,
  glow: Platform.select<ViewStyle>({ web: {}, default: {} })!,
  goldGlow: Platform.select<ViewStyle>({ web: {}, default: {} })!,
};
