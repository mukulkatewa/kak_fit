import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../src/lib/auth-context";
import { useThemedStyles, type Palette } from "../src/lib/theme";

/** OAuth deep-link landing — forwards to the main app after the browser closes. */
export default function LoginCallbackScreen() {
  const router = useRouter();
  const { isAuthenticated, refresh } = useAuth();
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    void refresh().then((hasSession) => {
      if (hasSession || isAuthenticated) {
        router.replace("/(tabs)");
      } else {
        router.replace("/login");
      }
    });
  }, [isAuthenticated, refresh, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },
  });
