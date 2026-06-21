import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import { colors } from "../../src/lib/theme";

/** Green & white tab bar: Home, Workout, Meals, Profile */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: "Workout",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "barbell" : "barbell-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Meals",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
          ),
        }}
      />
      {/* Hidden — opened from deep links / dashboard grid */}
      <Tabs.Screen name="exercises" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 84,
    paddingBottom: 28,
    paddingTop: 6,
    elevation: 0,
  },
  tabLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});
