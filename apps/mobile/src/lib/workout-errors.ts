import { Alert } from "react-native";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@kak-fit/api/router";

type TrpcError = TRPCClientErrorLike<AppRouter>;

export function alertWorkoutConflict(
  error: TrpcError,
  onContinue: () => void,
) {
  if (error.data?.code !== "CONFLICT") {
    Alert.alert("Error", error.message);
    return;
  }

  Alert.alert(
    "Workout in progress",
    "Finish or discard your current workout before starting a new one.",
    [
      { text: "Continue workout", onPress: onContinue },
      { text: "Cancel", style: "cancel" },
    ],
  );
}
