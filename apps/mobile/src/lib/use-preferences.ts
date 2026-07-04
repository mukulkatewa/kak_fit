import { useEffect } from "react";
import { trpc, authMeQueryOptions } from "./trpc";
import { useRestTimer } from "./rest-timer";
import { useAuth } from "./auth-context";
import type { WeightUnit } from "./units";

export function useUserPreferences() {
  const { isAuthenticated } = useAuth();
  const { data: me } = trpc.auth.me.useQuery(undefined, {
    ...authMeQueryOptions,
    enabled: isAuthenticated,
  });
  const setDefault = useRestTimer((s) => s.setDefault);

  useEffect(() => {
    if (me?.defaultRestSeconds != null) setDefault(me.defaultRestSeconds);
  }, [me?.defaultRestSeconds, setDefault]);

  return {
    weightUnit: (me?.weightUnit ?? "KG") as WeightUnit,
    defaultRestSeconds: me?.defaultRestSeconds != null ? me.defaultRestSeconds : 90,
  };
}
