import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme";

/** Non-blocking indicator while the session token is being renewed. */
export function TokenRefreshBadge() {
  const { isRefreshing } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (!isRefreshing) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.badge, { top: insets.top + 8, backgroundColor: colors.bgElevated, borderColor: colors.border }]}
    >
      <ActivityIndicator color={colors.accent} size="small" />
      <Text style={[styles.text, { color: colors.textMuted }]}>Renewing session</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: 12,
    zIndex: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  text: { fontSize: 11, fontWeight: "600" },
});
