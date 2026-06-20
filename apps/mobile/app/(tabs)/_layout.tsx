import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../../src/lib/theme";

type TabIcon = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  color,
  focused,
}: {
  name: TabIcon;
  color: string;
  focused: boolean;
}) {
  return (
    <Ionicons name={name} size={22} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentNeon,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} focused />,
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: "Train",
          tabBarIcon: ({ color }) => <TabIcon name="barbell" color={color} focused />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: "Moves",
          tabBarIcon: ({ color }) => <TabIcon name="fitness" color={color} focused />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Meals",
          tabBarIcon: ({ color }) => <TabIcon name="nutrition" color={color} focused />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color} focused />,
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}
