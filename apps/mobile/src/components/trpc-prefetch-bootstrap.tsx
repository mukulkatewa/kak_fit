import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { trpc } from "../lib/trpc";

/** Prefetch data for likely next screens after sign-in. */
export function TrpcPrefetchBootstrap() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isAuthenticated) return;

    void utils.workout.history.prefetch({ limit: 20 });
    void utils.exercise.list.prefetch({ limit: 50 });
    void utils.routine.list.prefetch();
  }, [isAuthenticated, utils]);

  return null;
}
