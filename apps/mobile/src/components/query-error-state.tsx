import { StyleSheet, Text, View } from "react-native";
import { Button } from "./ui";
import { spacing, typography, useThemedStyles, type Palette, type ShadowSet } from "../lib/theme";

type QueryErrorStateProps = {
  message?: string;
  onRetry: () => void;
};

export function QueryErrorState({
  message = "Couldn't load data. Check your connection.",
  onRetry,
}: QueryErrorStateProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{message}</Text>
      <Button label="Retry" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
    text: { ...typography.body, color: colors.danger, fontWeight: "600", textAlign: "center" },
  });
