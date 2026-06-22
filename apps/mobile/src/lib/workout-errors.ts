import { Alert } from "react-native";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@kak-fit/api/router";

type TrpcError = TRPCClientErrorLike<AppRouter>;

/**
 * Handle a "workout in progress" (409) conflict. Always offers to resume the
 * active workout; when `onDiscard` is provided it also offers to discard the
 * active workout so the user is never stuck.
 */
export function alertWorkoutConflict(
  error: TrpcError,
  onContinue: () => void,
  onDiscard?: () => void,
) {
  if (error.data?.code !== "CONFLICT") {
    Alert.alert("Something went wrong", error.message);
    return;
  }

  const buttons = [
    { text: "Resume", onPress: onContinue },
    ...(onDiscard
      ? [{ text: "Discard & start new", style: "destructive" as const, onPress: onDiscard }]
      : []),
    { text: "Cancel", style: "cancel" as const },
  ];

  Alert.alert("Workout in progress", "You already have an unfinished workout.", buttons);
}
