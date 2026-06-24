import { useEffect } from "react";
import { trpc, authMeQueryOptions } from "./trpc";
import { useRestTimer } from "./rest-timer";
import type { WeightUnit } from "./units";

export function useUserPreferences() {
  const { data: me } = trpc.auth.me.useQuery(undefined, authMeQueryOptions);
  const setDefault = useRestTimer((s) => s.setDefault);

  useEffect(() => {
    if (me?.defaultRestSeconds) setDefault(me.defaultRestSeconds);
  }, [me?.defaultRestSeconds, setDefault]);

  return {
    weightUnit: (me?.weightUnit ?? "KG") as WeightUnit,
    defaultRestSeconds: me?.defaultRestSeconds ?? 90,
  };
}
