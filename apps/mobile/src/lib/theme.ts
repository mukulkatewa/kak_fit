import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, Platform, type ViewStyle } from "react-native";
import * as SecureStore from "expo-secure-store";

// ─── Palettes ─────────────────────────────────────────────────────────────────

export type Palette = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  border: string;
  borderSubtle: string;
  separator: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentBright: string;
  accentMuted: string;
  accentNeon: string;
  accentDark: string;
  success: string;
  successNeon: string;
  successMuted: string;
  gold: string;
  goldBright: string;
  goldMuted: string;
  danger: string;
  dangerMuted: string;
  glass: string;
  primary: string;
  primaryMuted: string;
  surfaceLight: string;
  onAccent: string;
  onAccentMuted: string;
  onAccentFaint: string;
  carbsColor: string;
  proteinColor: string;
  fatColor: string;
};

/** Warm off-white surfaces with vivid green accent — modern nutrition-app feel. */
export const lightColors: Palette = {
  bg: "#F5F4F0",
  bgElevated: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceHover: "#F0EEE8",
  surfaceActive: "#E8E5DE",
  border: "#E8E5DC",
  borderSubtle: "#F0EDE4",
  separator: "#EDE9E0",
  text: "#1A1A1A",
  textMuted: "#6B6B6B",
  textDim: "#A8A8A8",
  accent: "#3DB54A",
  accentBright: "#45CC54",
  accentMuted: "rgba(61, 181, 74, 0.12)",
  accentNeon: "#3DB54A",
  accentDark: "#2E9438",
  success: "#3DB54A",
  successNeon: "#45CC54",
  successMuted: "rgba(61, 181, 74, 0.12)",
  gold: "#F59E0B",
  goldBright: "#F59E0B",
  goldMuted: "rgba(245, 158, 11, 0.14)",
  danger: "#EF4444",
  dangerMuted: "rgba(239, 68, 68, 0.10)",
  glass: "rgba(255, 255, 255, 0.97)",
  primary: "#3DB54A",
  primaryMuted: "rgba(61, 181, 74, 0.12)",
  surfaceLight: "#F5F4F0",
  onAccent: "#FFFFFF",
  onAccentMuted: "rgba(255, 255, 255, 0.82)",
  onAccentFaint: "rgba(255, 255, 255, 0.28)",
  carbsColor: "#6C7AE0",
  proteinColor: "#F06292",
  fatColor: "#FFB300",
};

/** Dark mode — Hevy-style: near-black surfaces with a vivid blue accent. */
export const darkColors: Palette = {
  bg: "#0A0B0D",
  bgElevated: "#121419",
  surface: "#16181D",
  surfaceHover: "#20242B",
  surfaceActive: "#2A2F38",
  border: "#272B33",
  borderSubtle: "#1C2026",
  separator: "#20242B",
  text: "#F4F6F8",
  textMuted: "#9BA3AE",
  textDim: "#697079",
  accent: "#2F6FED",
  accentBright: "#4D86FF",
  accentMuted: "rgba(47, 111, 237, 0.18)",
  accentNeon: "#4D86FF",
  accentDark: "#2457C4",
  success: "#34C759",
  successNeon: "#4ADE80",
  successMuted: "rgba(52, 199, 89, 0.16)",
  gold: "#F5B53C",
  goldBright: "#FFC95A",
  goldMuted: "rgba(245, 181, 60, 0.18)",
  danger: "#FF5A5A",
  dangerMuted: "rgba(255, 90, 90, 0.16)",
  glass: "rgba(18, 20, 25, 0.96)",
  primary: "#2F6FED",
  primaryMuted: "rgba(47, 111, 237, 0.18)",
  surfaceLight: "#16181D",
  onAccent: "#FFFFFF",
  onAccentMuted: "rgba(255, 255, 255, 0.86)",
  onAccentFaint: "rgba(255, 255, 255, 0.26)",
  carbsColor: "#818CF8",
  proteinColor: "#F472B6",
  fatColor: "#FBBF24",
};

/**
 * Backward-compatible static export. Defaults to the light palette so any
 * component that still imports `colors` directly keeps working. Themed
 * components should read colors from `useTheme()` / `useThemedStyles()`.
 */
export const colors: Palette = lightColors;

// ─── Scales ─────────────────────────────────────────────────────────────────

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

/** Soft elevations. RN-web maps shadow* to box-shadow. */
const lightCardShadow = Platform.select<ViewStyle>({
  web: { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.07)" },
  default: {
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
})!;

const darkCardShadow = Platform.select<ViewStyle>({
  web: { boxShadow: "0 6px 18px rgba(15, 27, 42, 0.06)" },
  default: {
    shadowColor: "#0F1B2A",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
})!;

export const shadows = {
  card: lightCardShadow,
  glow: Platform.select<ViewStyle>({
    web: { boxShadow: "0 10px 24px rgba(61, 181, 74, 0.28)" },
    default: {
      shadowColor: "#3DB54A",
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
  })!,
  goldGlow: Platform.select<ViewStyle>({ web: {}, default: {} })!,
};

export const darkShadows = {
  ...shadows,
  card: darkCardShadow,
  glow: Platform.select<ViewStyle>({
    web: { boxShadow: "0 10px 24px rgba(47, 111, 237, 0.28)" },
    default: {
      shadowColor: "#2F6FED",
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
  })!,
};

export type ShadowSet = typeof shadows;

// ─── Theme context ────────────────────────────────────────────────────────────

export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "kak_fit_theme";

type ThemeContextValue = {
  colors: Palette;
  shadows: ShadowSet;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  shadows,
  mode: "system",
  isDark: false,
  setMode: () => {},
  toggle: () => {},
});

async function readStoredMode(): Promise<ThemeMode | null> {
  try {
    if (Platform.OS === "web") {
      return (globalThis.localStorage?.getItem(THEME_KEY) as ThemeMode) ?? null;
    }
    return (await SecureStore.getItemAsync(THEME_KEY)) as ThemeMode | null;
  } catch {
    return null;
  }
}

async function writeStoredMode(mode: ThemeMode): Promise<void> {
  try {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(THEME_KEY, mode);
      return;
    }
    await SecureStore.setItemAsync(THEME_KEY, mode);
  } catch {
    // ignore persistence errors
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() ?? "light");

  useEffect(() => {
    readStoredMode().then((stored) => {
      if (stored) setModeState(stored);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? "light");
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void writeStoredMode(next);
  }, []);

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  const palette = isDark ? darkColors : lightColors;
  const shadowSet = isDark ? darkShadows : shadows;

  const toggle = useCallback(() => {
    setMode(isDark ? "light" : "dark");
  }, [isDark, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: palette, shadows: shadowSet, mode, isDark, setMode, toggle }),
    [palette, shadowSet, mode, isDark, setMode, toggle],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Build a StyleSheet from the active palette, memoized per palette. */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const { colors: active } = useTheme();
  return useMemo(() => factory(active), [active, factory]);
}
