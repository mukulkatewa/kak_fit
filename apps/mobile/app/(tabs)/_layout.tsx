import { Tabs } from "expo-router";
import type { FC } from "react";
import { BeakerIcon as BeakerOutline } from "react-native-heroicons/outline";
import { FireIcon as FireOutline } from "react-native-heroicons/outline";
import { HomeIcon as HomeOutline } from "react-native-heroicons/outline";
import { UserCircleIcon as UserCircleOutline } from "react-native-heroicons/outline";
import { BeakerIcon as BeakerSolid } from "react-native-heroicons/solid";
import { FireIcon as FireSolid } from "react-native-heroicons/solid";
import { HomeIcon as HomeSolid } from "react-native-heroicons/solid";
import { UserCircleIcon as UserCircleSolid } from "react-native-heroicons/solid";
import { Platform, StyleSheet } from "react-native";
import { TabIcon } from "../../src/components/tab-icon";
import { useTabBarLayout } from "../../src/lib/layout-constants";
import { useTheme } from "../../src/lib/theme";

function makeTabIcon(
  IconOutline: FC<{ color?: string; size?: number }>,
  IconSolid: FC<{ color?: string; size?: number }>,
) {
  return ({
    color,
    focused,
    size = 24,
  }: {
    color: string;
    focused: boolean;
    size?: number;
  }) => (
    <TabIcon
      focused={focused}
      color={color}
      size={size}
      IconOutline={IconOutline}
      IconSolid={IconSolid}
    />
  );
}

/** Green & white tab bar: Home, Workout, Meals, Profile */
export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const tabBar = useTabBarLayout();
  const tabBarStyle = {
    backgroundColor: isDark ? "rgba(0,0,0,0.85)" : "rgba(245,244,240,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: tabBar.bottomPadding,
    height: tabBar.height,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: isDark ? 0.35 : 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "none",
        tabBarStyle,
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIcon,
        tabBarLabelPosition: "below-icon",
        sceneStyle: { flex: 1, backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: makeTabIcon(HomeOutline, HomeSolid),
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: "Workout",
          tabBarIcon: makeTabIcon(FireOutline, FireSolid),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Meals",
          tabBarIcon: makeTabIcon(BeakerOutline, BeakerSolid),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: makeTabIcon(UserCircleOutline, UserCircleSolid),
        }}
      />
      {/* Hidden — opened from deep links / dashboard grid */}
      <Tabs.Screen name="exercises" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { paddingVertical: 4 },
  tabIcon: { width: 24, height: 24 },
  tabLabel: { fontSize: 11, lineHeight: 16, fontWeight: "600", marginTop: 4, includeFontPadding: false },
});
