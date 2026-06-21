import { Platform, type ViewStyle } from "react-native";

/** Kak Fit palette — clean green & white, light surfaces, vivid grass-green accent */
export const colors = {
  bg: "#FFFFFF",
  bgElevated: "#FFFFFF",
  surface: "#F4F6F9",
  surfaceHover: "#EAEEF2",
  surfaceActive: "#E1E6EB",
  border: "#E5E9ED",
  borderSubtle: "#EEF1F4",
  separator: "#EBEEF1",
  text: "#0F1B2A",
  textMuted: "#5C6B7A",
  textDim: "#9AA6B2",
  accent: "#1EA64C",
  accentBright: "#27C25C",
  accentMuted: "rgba(30, 166, 76, 0.12)",
  accentNeon: "#1EA64C",
  accentDark: "#178A3E",
  success: "#1EA64C",
  successNeon: "#27C25C",
  successMuted: "rgba(30, 166, 76, 0.12)",
  gold: "#F59E0B",
  goldBright: "#F59E0B",
  goldMuted: "rgba(245, 158, 11, 0.14)",
  danger: "#EF4444",
  dangerMuted: "rgba(239, 68, 68, 0.10)",
  glass: "rgba(255, 255, 255, 0.96)",
  primary: "#1EA64C",
  primaryMuted: "rgba(30, 166, 76, 0.12)",
  surfaceLight: "#F4F6F9",
  // On-green tones (text/lines drawn over the green hero surfaces)
  onAccent: "#FFFFFF",
  onAccentMuted: "rgba(255, 255, 255, 0.82)",
  onAccentFaint: "rgba(255, 255, 255, 0.28)",
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
  lg: 14,
  xl: 20,
  full: 999,
};

export const typography = {
  display: { fontSize: 34, fontWeight: "800" as const, letterSpacing: 0.2 },
  h1: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.2 },
  h2: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  label: { fontSize: 11, fontWeight: "500" as const, letterSpacing: 0 },
  mono: { fontSize: 15, fontWeight: "600" as const, fontVariant: ["tabular-nums"] as const },
};

/** Soft, light-mode elevations. RN-web maps shadow* to box-shadow. */
export const shadows = {
  card: Platform.select<ViewStyle>({
    web: {
      boxShadow: "0 6px 18px rgba(15, 27, 42, 0.06)",
    },
    default: {
      shadowColor: "#0F1B2A",
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  })!,
  glow: Platform.select<ViewStyle>({
    web: {
      boxShadow: "0 10px 24px rgba(30, 166, 76, 0.28)",
    },
    default: {
      shadowColor: "#1EA64C",
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
  })!,
  goldGlow: Platform.select<ViewStyle>({ web: {}, default: {} })!,
};
