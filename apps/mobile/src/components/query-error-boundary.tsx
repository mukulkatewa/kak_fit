import { Ionicons } from "@expo/vector-icons";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, useTheme, useThemedStyles, type Palette } from "../lib/theme";
import { Button } from "./ui";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

function QueryErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        {error?.message || "An unexpected error occurred"}
      </Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  );
}

export class QueryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("QueryErrorBoundary caught error:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <QueryErrorFallback error={this.state.error} onRetry={this.handleRetry} />
      );
    }

    return this.props.children;
  }
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    message: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },
  });
