/** Cache freshness by resource; queries remain reusable across mounted screens. */
export const queryStaleTime = {
  default: 30 * 1000,
  authMe: 5 * 60 * 1000,
  authStats: 5 * 60 * 1000,
  workoutActive: 10 * 1000,
  weeklyVolume: 5 * 60 * 1000,
  workoutHistory: 2 * 60 * 1000,
  routineList: 2 * 60 * 1000,
  progress: 3 * 60 * 1000,
  progressStreak: 5 * 60 * 1000,
  exerciseDetail: 10 * 60 * 1000,
  previousPerformance: 2 * 60 * 1000,
  nutritionDaily: 30 * 1000,
  nutritionMeals: 30 * 1000,
  nutritionTargets: 10 * 60 * 1000,
  authToken: 60 * 1000,
} as const;

export const defaultQueryClientOptions = {
  queries: {
    staleTime: queryStaleTime.default,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    structuralSharing: true,
    networkMode: "online" as const,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  },
} as const;

export const authMeQueryOptions = { staleTime: queryStaleTime.authMe } as const;
