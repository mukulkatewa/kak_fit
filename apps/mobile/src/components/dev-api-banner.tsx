import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "../lib/api-client";
import { checkApiReachable } from "../lib/check-api";

export function DevApiBanner() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [apiUrl, setApiUrl] = useState("");

  useEffect(() => {
    if (!__DEV__) return;

    const url = getApiUrl();
    setApiUrl(url);
    void checkApiReachable().then((ok) => {
      if (!ok) setVisible(true);
    });
  }, []);

  if (!__DEV__ || !visible) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.text}>
        ⚠️ Cannot reach API at {apiUrl}. Check EXPO_PUBLIC_API_URL in .env
      </Text>
      <Pressable onPress={() => setVisible(false)} hitSlop={8} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color="#92400E" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  text: { flex: 1, color: "#92400E", fontSize: 13, fontWeight: "600", lineHeight: 18 },
});
