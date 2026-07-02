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

/** Dark mode — Hevy-style: pure black bg, iOS system dark grays, vivid blue accent. */
export const darkColors: Palette = {
  bg: "#000000",
  bgElevated: "#1C1C1E",
  surface: "#1C1C1E",
  surfaceHover: "#2C2C2E",
  surfaceActive: "#3A3A3C",
  border: "#2C2C2E",
  borderSubtle: "#2C2C2E",
  separator: "#38383A",
  text: "#FFFFFF",
  textMuted: "#8E8E93",
  textDim: "#636366",
  accent: "#0A84FF",
  accentBright: "#409CFF",
  accentMuted: "rgba(10, 132, 255, 0.18)",
  accentNeon: "#409CFF",
  accentDark: "#0060DF",
  success: "#30D158",
  successNeon: "#34C759",
  successMuted: "rgba(48, 209, 88, 0.16)",
  gold: "#F5B53C",
  goldBright: "#FFC95A",
  goldMuted: "rgba(245, 181, 60, 0.18)",
  danger: "#FF453A",
  dangerMuted: "rgba(255, 69, 58, 0.16)",
  glass: "rgba(0, 0, 0, 0.96)",
  primary: "#0A84FF",
  primaryMuted: "rgba(10, 132, 255, 0.18)",
  surfaceLight: "#1C1C1E",
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
  // Page-level titles
  h1: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800" as const,
    letterSpacing: 0,
  },
  // Section titles
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700" as const,
    letterSpacing: 0,
  },
  // Card/component titles
  h3: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700" as const,
    letterSpacing: 0,
  },
  // Body text
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  // Secondary body text
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  // Captions and metadata
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },
  // Small labels
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
  // Button text
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700" as const,
    letterSpacing: 0,
  },
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
  web: { boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)" },
  default: {
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    web: { boxShadow: "0 10px 24px rgba(10, 132, 255, 0.28)" },
    default: {
      shadowColor: "#0A84FF",
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
