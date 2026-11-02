import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveWorkout } from "./active-workout-cache";
import { createTRPCClient } from "./trpc";
import {
  WorkoutMutationQueue,
  type WorkoutMutationQueueState,
  type UpdateSetInput,
  type AddSetInput,
  type DeleteSetInput,
} from "./workout-mutation-queue-core";

export function useWorkoutSetMutationQueue(options: {
  workoutId: string | null | undefined;
  getWorkout: () => ActiveWorkout | null | undefined;
  setWorkout: (
    updater: (current: ActiveWorkout | null | undefined) => ActiveWorkout | null | undefined,
  ) => void;
  onError?: (message: string) => void;
}) {
  const [queueState, setQueueState] = useState<WorkoutMutationQueueState>({
    pendingCount: 0,
    isProcessing: false,
    isReplaying: false,
    isReady: false,
    lastError: null,
  });

  const queueRef = useRef<WorkoutMutationQueue | null>(null);
  const onErrorRef = useRef(options.onError);
  const getWorkoutRef = useRef(options.getWorkout);
  const setWorkoutRef = useRef(options.setWorkout);
  onErrorRef.current = options.onError;
  getWorkoutRef.current = options.getWorkout;
  setWorkoutRef.current = options.setWorkout;

  useEffect(() => {
    const workoutId = options.workoutId ?? null;
    if (!workoutId) {
      queueRef.current?.destroy();
      queueRef.current = null;
      setQueueState({
        pendingCount: 0,
        isProcessing: false,
        isReplaying: false,
        isReady: true,
        lastError: null,
      });
      return;
    }

    const client = createTRPCClient();
    const queue = new WorkoutMutationQueue({
      storage: AsyncStorage,
      executors: {
        updateSet: (input) => client.workout.updateSet.mutate(input),
        addSet: (input) => client.workout.addSet.mutate(input),
        deleteSet: (input) => client.workout.deleteSet.mutate(input),
        fetchActiveWorkout: () => client.workout.active.query(),
      },
      workoutId,
      getWorkout: () => getWorkoutRef.current(),
      setWorkout: (updater) => setWorkoutRef.current(updater),
      onStateChange: setQueueState,
      onError: (message) => onErrorRef.current?.(message),
    });
    queueRef.current = queue;
    void queue.initialize();

    return () => {
      queue.destroy();
      if (queueRef.current === queue) {
        queueRef.current = null;
      }
    };
  }, [options.workoutId]);

  const updateSet = useCallback((variables: UpdateSetInput) => {
    void queueRef.current?.enqueueUpdateSet(variables);
  }, []);

  const addSet = useCallback((variables: AddSetInput) => {
    void queueRef.current?.enqueueAddSet(variables);
  }, []);

  const deleteSet = useCallback((variables: DeleteSetInput) => {
    void queueRef.current?.enqueueDeleteSet(variables);
  }, []);

  const retrySync = useCallback(() => {
    queueRef.current?.scheduleProcess(0);
  }, []);

  return {
    updateSet,
    addSet,
    deleteSet,
    retrySync,
    ...queueState,
  };
}
