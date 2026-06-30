import { Alert, Platform } from "react-native";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@kak-fit/api/router";

type TrpcError = TRPCClientErrorLike<AppRouter>;

/** Parse numeric input; treats empty string as undefined but allows 0. */
export function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function alertOnWeb(title: string, message: string) {
  if (typeof window !== "undefined") {
    window.alert(`${title}\n\n${message}`);
  }
}

function confirmWorkoutConflictOnWeb(
  onContinue: () => void,
  onDiscard?: () => void | Promise<void>,
) {
  if (typeof window === "undefined") return;

  const resume = window.confirm(
    "Workout in progress\n\nYou already have an unfinished workout. Press OK to resume it, or Cancel for more options.",
  );
  if (resume) {
    onContinue();
    return;
  }

  if (onDiscard) {
    const discard = window.confirm(
      "Discard current workout?\n\nThis will permanently delete your active workout and start a new one.",
    );
    if (discard) {
      void Promise.resolve(onDiscard()).catch((e: unknown) => {
        alertOnWeb(
          "Couldn't discard workout",
          e instanceof Error ? e.message : "Please try again.",
        );
      });
    }
  }
}

/**
 * Handle a "workout in progress" (409) conflict. Always offers to resume the
 * active workout; when `onDiscard` is provided it also offers to discard the
 * active workout so the user is never stuck.
 */
export function alertWorkoutConflict(
  error: TrpcError,
  onContinue: () => void,
  onDiscard?: () => void | Promise<void>,
) {
  if (error.data?.code !== "CONFLICT") {
    if (Platform.OS === "web") {
      alertOnWeb("Something went wrong", error.message);
      return;
    }
    Alert.alert("Something went wrong", error.message);
    return;
  }

  if (Platform.OS === "web") {
    confirmWorkoutConflictOnWeb(onContinue, onDiscard);
    return;
  }

  const buttons = [
    { text: "Resume", onPress: onContinue },
    ...(onDiscard
      ? [{
          text: "Discard & start new",
          style: "destructive" as const,
          onPress: () => {
            void Promise.resolve(onDiscard()).catch((e: unknown) => {
              Alert.alert(
                "Couldn't discard workout",
                e instanceof Error ? e.message : "Please try again.",
              );
            });
          },
        }]
      : []),
    { text: "Cancel", style: "cancel" as const },
  ];

  Alert.alert("Workout in progress", "You already have an unfinished workout.", buttons);
}
