import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, useTheme, useThemedStyles, type Palette, type ShadowSet } from "../lib/theme";

/**
 * Presentational bottom sheet: dimmed backdrop + bottom-anchored panel.
 * No data logic — wrap feature content as `children`.
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { shadows } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.panel,
            shadows.lg,
            {
              height: Math.round(height * 0.88),
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette, _shadows: ShadowSet) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.text,
      opacity: 0.4,
    },
    panel: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      overflow: "hidden",
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: colors.borderSubtle,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    content: {
      flex: 1,
      minHeight: 0,
    },
  });
