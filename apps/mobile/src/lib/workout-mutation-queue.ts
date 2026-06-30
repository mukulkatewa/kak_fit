import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppRouter } from "@kak-fit/api/router";
import type { inferRouterInputs } from "@trpc/server";
import {
  addSetToWorkout,
  applySetPatchToWorkout,
  createOptimisticAddedSet,
  patchSetInWorkout,
  removeSetFromWorkout,
  type ActiveWorkout,
  type SetUpdatePatch,
  type WorkoutSet,
} from "./active-workout-cache";
import { createTRPCClient } from "./trpc";
import { isNetworkError } from "./offline-workouts";

type WorkoutRouterInputs = inferRouterInputs<AppRouter>["workout"];

export type UpdateSetInput = WorkoutRouterInputs["updateSet"];
export type AddSetInput = WorkoutRouterInputs["addSet"];
export type DeleteSetInput = WorkoutRouterInputs["deleteSet"];

export type SetMutationType = "updateSet" | "addSet" | "deleteSet";

type QueuedSetMutation =
  | {
      id: string;
      type: "updateSet";
      variables: UpdateSetInput;
      baseVersion: number;
      retryCount: number;
      createdAt: number;
    }
  | {
      id: string;
      type: "addSet";
      variables: AddSetInput;
      optimisticSetId: string;
      baseVersion: number;
      retryCount: number;
      createdAt: number;
    }
  | {
      id: string;
      type: "deleteSet";
      variables: DeleteSetInput;
      baseVersion: number;
      retryCount: number;
      createdAt: number;
    };

type PersistedQueueState = {
  workoutId: string | null;
  version: number;
  mutations: QueuedSetMutation[];
  optimisticIdMap: Record<string, string>;
};

export type WorkoutMutationQueueState = {
  pendingCount: number;
  isProcessing: boolean;
  isReplaying: boolean;
  isReady: boolean;
  lastError: string | null;
};

export type WorkoutMutationExecutors = {
  updateSet: (input: UpdateSetInput) => Promise<WorkoutSet>;
  addSet: (input: AddSetInput) => Promise<WorkoutSet>;
  deleteSet: (input: DeleteSetInput) => Promise<{ success: boolean }>;
  fetchActiveWorkout?: () => Promise<ActiveWorkout | null>;
};

export type WorkoutMutationQueueOptions = {
  workoutId: string | null;
  getWorkout: () => ActiveWorkout | null | undefined;
  setWorkout: (
    updater: (current: ActiveWorkout | null | undefined) => ActiveWorkout | null | undefined,
  ) => void;
  executors?: WorkoutMutationExecutors;
  onStateChange?: (state: WorkoutMutationQueueState) => void;
  onError?: (message: string) => void;
};

const STORAGE_KEY = "@kak_fit/workout_set_mutation_queue";
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

function createMutationId() {
  return `mut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not found/i.test(message);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(retryCount: number) {
  return Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS);
}

function resolveSetId(id: string, optimisticIdMap: Record<string, string>) {
  return optimisticIdMap[id] ?? id;
}

function resolveWorkoutExerciseId(id: string, optimisticIdMap: Record<string, string>) {
  return optimisticIdMap[id] ?? id;
}

function findSet(workout: ActiveWorkout | null | undefined, setId: string) {
  if (!workout) return null;
  for (const exercise of workout.exercises) {
    const set = exercise.sets.find((item) => item.id === setId);
    if (set) return set;
  }
  return null;
}

function mergeUpdateSetInput(
  workout: ActiveWorkout | null | undefined,
  variables: UpdateSetInput,
  optimisticIdMap: Record<string, string>,
): UpdateSetInput {
  const resolvedSetId = resolveSetId(variables.setId, optimisticIdMap);
  const { setId: _ignored, ...patch } = variables;
  const currentSet = findSet(workout, resolvedSetId) ?? findSet(workout, variables.setId);
  if (!currentSet) {
    return { ...variables, setId: resolvedSetId };
  }

  const merged: SetUpdatePatch = {};
  if (patch.weight !== undefined) merged.weight = patch.weight;
  if (patch.reps !== undefined) merged.reps = patch.reps;
  if (patch.duration !== undefined) merged.duration = patch.duration;
  if (patch.notes !== undefined) merged.notes = patch.notes;
  if (patch.setType !== undefined) merged.setType = patch.setType;
  if (patch.isCompleted !== undefined) merged.isCompleted = patch.isCompleted;
  if (patch.rpe !== undefined) merged.rpe = patch.rpe;

  return { setId: resolvedSetId, ...merged };
}

export class WorkoutMutationQueue {
  private version = 0;
  private mutations: QueuedSetMutation[] = [];
  private optimisticIdMap: Record<string, string> = {};
  private workoutId: string | null;
  private getWorkout: WorkoutMutationQueueOptions["getWorkout"];
  private setWorkout: WorkoutMutationQueueOptions["setWorkout"];
  private executors: WorkoutMutationExecutors;
  private onStateChange?: WorkoutMutationQueueOptions["onStateChange"];
  private onError?: WorkoutMutationQueueOptions["onError"];

  private processing = false;
  private replaying = false;
  private ready = false;
  private lastError: string | null = null;
  private replayPromise: Promise<void> | null = null;
  private processTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(options: WorkoutMutationQueueOptions) {
    this.workoutId = options.workoutId;
    this.getWorkout = options.getWorkout;
    this.setWorkout = options.setWorkout;
    this.onStateChange = options.onStateChange;
    this.onError = options.onError;

    const client = createTRPCClient();
    this.executors = options.executors ?? {
      updateSet: (input) => client.workout.updateSet.mutate(input),
      addSet: (input) => client.workout.addSet.mutate(input),
      deleteSet: (input) => client.workout.deleteSet.mutate(input),
      fetchActiveWorkout: async () => {
        const workout = await client.workout.active.query();
        return workout ?? null;
      },
    };
  }

  getState(): WorkoutMutationQueueState {
    return {
      pendingCount: this.mutations.length,
      isProcessing: this.processing,
      isReplaying: this.replaying,
      isReady: this.ready,
      lastError: this.lastError,
    };
  }

  private emitState() {
    this.onStateChange?.(this.getState());
  }

  private setLastError(message: string | null) {
    this.lastError = message;
    this.emitState();
  }

  async initialize(): Promise<void> {
    this.ready = false;
    this.emitState();
    await this.loadFromStorage();
    this.replaying = this.mutations.length > 0;
    this.emitState();

    this.replayPromise = this.processQueue();
    await this.replayPromise;
    this.replaying = false;
    this.ready = true;
    this.replayPromise = null;
    this.emitState();
  }

  destroy() {
    this.destroyed = true;
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
  }

  async waitUntilReady(): Promise<void> {
    if (this.ready) return;
    if (this.replayPromise) {
      await this.replayPromise;
    }
  }

  async enqueueUpdateSet(variables: UpdateSetInput): Promise<void> {
    await this.waitUntilReady();
    const baseVersion = this.version;
    const resolvedSetId = resolveSetId(variables.setId, this.optimisticIdMap);
    const resolvedVariables = resolvedSetId === variables.setId ? variables : { ...variables, setId: resolvedSetId };

    this.setWorkout((current) => {
      if (!current) return current;
      const { setId, ...patch } = resolvedVariables;
      return applySetPatchToWorkout(current, setId, patch);
    });

    this.mutations.push({
      id: createMutationId(),
      type: "updateSet",
      variables: resolvedVariables,
      baseVersion,
      retryCount: 0,
      createdAt: Date.now(),
    });
    await this.persist();
    this.emitState();
    void this.processQueue();
  }

  async enqueueAddSet(variables: AddSetInput): Promise<void> {
    await this.waitUntilReady();
    const baseVersion = this.version;
    const resolvedExerciseId = resolveWorkoutExerciseId(variables.workoutExerciseId, this.optimisticIdMap);
    const resolvedVariables =
      resolvedExerciseId === variables.workoutExerciseId
        ? variables
        : { workoutExerciseId: resolvedExerciseId };

    const workout = this.getWorkout();
    const optimisticSet =
      workout != null ? createOptimisticAddedSet(workout, resolvedExerciseId) : null;

    if (optimisticSet) {
      this.setWorkout((current) => {
        if (!current) return current;
        return addSetToWorkout(current, resolvedExerciseId, optimisticSet);
      });
    }

    this.mutations.push({
      id: createMutationId(),
      type: "addSet",
      variables: resolvedVariables,
      optimisticSetId: optimisticSet?.id ?? createMutationId(),
      baseVersion,
      retryCount: 0,
      createdAt: Date.now(),
    });
    await this.persist();
    this.emitState();
    void this.processQueue();
  }

  async enqueueDeleteSet(variables: DeleteSetInput): Promise<void> {
    await this.waitUntilReady();
    const baseVersion = this.version;
    const resolvedSetId = resolveSetId(variables.setId, this.optimisticIdMap);
    const resolvedVariables = resolvedSetId === variables.setId ? variables : { setId: resolvedSetId };

    this.setWorkout((current) => {
      if (!current) return current;
      return removeSetFromWorkout(current, resolvedVariables.setId);
    });

    this.mutations.push({
      id: createMutationId(),
      type: "deleteSet",
      variables: resolvedVariables,
      baseVersion,
      retryCount: 0,
      createdAt: Date.now(),
    });
    await this.persist();
    this.emitState();
    void this.processQueue();
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedQueueState;
      if (!parsed || typeof parsed.version !== "number" || !Array.isArray(parsed.mutations)) {
        return;
      }
      if (parsed.workoutId && this.workoutId && parsed.workoutId !== this.workoutId) {
        return;
      }
      this.version = parsed.version;
      this.mutations = parsed.mutations;
      this.optimisticIdMap = parsed.optimisticIdMap ?? {};
    } catch (error) {
      console.error("Failed to load workout mutation queue", error);
    }
  }

  private async persist(): Promise<void> {
    const payload: PersistedQueueState = {
      workoutId: this.workoutId,
      version: this.version,
      mutations: this.mutations,
      optimisticIdMap: this.optimisticIdMap,
    };
    try {
      if (this.mutations.length === 0) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
    } catch (error) {
      console.error("Failed to persist workout mutation queue", error);
    }
  }

  private async refreshWorkoutFromServer(): Promise<ActiveWorkout | null> {
    const fetchActive = this.executors.fetchActiveWorkout;
    if (!fetchActive) return this.getWorkout() ?? null;
    const workout = await fetchActive();
    if (workout) {
      this.setWorkout(() => workout);
      this.version += 1;
    }
    return workout;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.destroyed) return;
    this.processing = true;
    this.emitState();

    try {
      while (this.mutations.length > 0 && !this.destroyed) {
        const mutation = this.mutations[0]!;
        const hasConflict = this.version > mutation.baseVersion;

        if (hasConflict) {
          await this.refreshWorkoutFromServer();
        }

        try {
          await this.executeMutation(mutation, hasConflict);
          this.mutations.shift();
          this.version += 1;
          this.setLastError(null);
          await this.persist();
          this.emitState();
        } catch (error) {
          if (isNetworkError(error)) {
            const nextRetryCount = mutation.retryCount + 1;
            if (nextRetryCount > MAX_RETRIES) {
              this.mutations.shift();
              const message = "Couldn't save your set changes. Check your connection and try again.";
              this.setLastError(message);
              this.onError?.(message);
              await this.refreshWorkoutFromServer();
              await this.persist();
              this.emitState();
              break;
            }

            this.mutations[0] = { ...mutation, retryCount: nextRetryCount };
            await this.persist();
            this.emitState();

            const delay = backoffDelay(nextRetryCount - 1);
            await sleep(delay);
            continue;
          }

          if (mutation.type === "deleteSet" && isNotFoundError(error)) {
            this.mutations.shift();
            this.version += 1;
            await this.persist();
            this.emitState();
            continue;
          }

          this.mutations.shift();
          const message =
            error instanceof Error ? error.message : "Something went wrong saving your workout.";
          this.setLastError(message);
          this.onError?.(message);
          await this.refreshWorkoutFromServer();
          await this.persist();
          this.emitState();
          break;
        }
      }
    } finally {
      this.processing = false;
      this.emitState();
    }
  }

  private async executeMutation(mutation: QueuedSetMutation, hadConflict: boolean): Promise<void> {
    switch (mutation.type) {
      case "updateSet": {
        const input = hadConflict
          ? mergeUpdateSetInput(this.getWorkout(), mutation.variables, this.optimisticIdMap)
          : mutation.variables;
        const updatedSet = await this.executors.updateSet(input);
        this.setWorkout((current) => {
          if (!current) return current;
          return patchSetInWorkout(current, updatedSet);
        });
        return;
      }
      case "addSet": {
        const input = {
          workoutExerciseId: resolveWorkoutExerciseId(
            mutation.variables.workoutExerciseId,
            this.optimisticIdMap,
          ),
        };
        const newSet = await this.executors.addSet(input);
        this.optimisticIdMap[mutation.optimisticSetId] = newSet.id;
        this.setWorkout((current) => {
          if (!current) return current;
          const withoutOptimistic = removeSetFromWorkout(current, mutation.optimisticSetId);
          return addSetToWorkout(withoutOptimistic, input.workoutExerciseId, newSet);
        });
        return;
      }
      case "deleteSet": {
        const input = {
          setId: resolveSetId(mutation.variables.setId, this.optimisticIdMap),
        };
        if (!findSet(this.getWorkout(), input.setId) && input.setId.startsWith("offline-set-")) {
          return;
        }
        await this.executors.deleteSet(input);
        this.setWorkout((current) => {
          if (!current) return current;
          return removeSetFromWorkout(current, input.setId);
        });
        return;
      }
      default:
        throw new Error(`Unknown mutation type: ${(mutation as QueuedSetMutation).type}`);
    }
  }

  scheduleProcess(delayMs = 0) {
    if (this.processTimer) clearTimeout(this.processTimer);
    this.processTimer = setTimeout(() => {
      this.processTimer = null;
      void this.processQueue();
    }, delayMs);
  }
}

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

    const queue = new WorkoutMutationQueue({
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
