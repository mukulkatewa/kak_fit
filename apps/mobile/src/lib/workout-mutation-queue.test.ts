import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { describe, it } from "node:test";
import type { ActiveWorkout } from "./active-workout-cache";
import { WorkoutMutationQueue, type WorkoutMutationQueueOptions } from "./workout-mutation-queue-core";

function createWorkout() {
  return {
    id: "workout-1", name: "Push A", notes: null,
    startedAt: new Date("2026-11-01T10:00:00Z"), finishedAt: null,
    exercises: [{
      id: "we-1", workoutId: "workout-1", exerciseId: "ex-1", order: 0,
      notes: null, restSeconds: null, supersetGroup: null,
      exercise: { id: "ex-1", name: "Bench Press", imageUrl: null, media: [] },
      sets: [{
        id: "set-1", workoutExerciseId: "we-1", setNumber: 1,
        weight: 40, reps: 8, duration: null, rpe: null, notes: null,
        setType: "NORMAL", isCompleted: false,
      }],
    }],
    previousSets: {},
  } as unknown as ActiveWorkout;
}

function createStorage() {
  const records = new Map<string, string>();
  return {
    records,
    getItem: async (key: string) => records.get(key) ?? null,
    setItem: async (key: string, value: string) => { records.set(key, value); },
    removeItem: async (key: string) => { records.delete(key); },
  };
}

async function waitForIdle(queue: WorkoutMutationQueue) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!queue.getState().isProcessing) return;
    await setImmediate();
  }
  assert.fail("Workout queue did not become idle");
}

function createHarness(storage = createStorage(), options: Partial<WorkoutMutationQueueOptions> = {}) {
  let workout = createWorkout();
  const queue = new WorkoutMutationQueue({
    workoutId: workout.id,
    storage,
    getWorkout: () => workout,
    setWorkout: (update) => { workout = update(workout) ?? workout; },
    waitBeforeRetry: async () => {},
    executors: {
      updateSet: async ({ setId: _setId, ...patch }) => ({ ...workout.exercises[0]!.sets[0]!, ...patch }),
      addSet: async () => ({ ...workout.exercises[0]!.sets[0]!, id: "server-set-2", setNumber: 2 }),
      deleteSet: async () => ({ success: true }),
    },
    ...options,
  });
  return { queue, storage, getWorkout: () => workout };
}

describe("persisted workout set queue", () => {
  it("retains an edit and its optimistic value when network retries are exhausted", async () => {
    let attempts = 0;
    const harness = createHarness(undefined, {
      executors: {
        updateSet: async () => { attempts += 1; throw new TypeError("Network request failed"); },
        addSet: async () => { throw new Error("Unexpected add"); },
        deleteSet: async () => { throw new Error("Unexpected delete"); },
      },
    });
    try {
      await harness.queue.initialize();
      await harness.queue.enqueueUpdateSet({ setId: "set-1", reps: 12 });
      await waitForIdle(harness.queue);
      assert.equal(attempts, 6);
      assert.equal(harness.queue.getState().pendingCount, 1);
      assert.match(harness.queue.getState().lastError!, /saved on this device/);
      assert.equal(harness.getWorkout().exercises[0]!.sets[0]!.reps, 12);
      const saved = JSON.parse([...harness.storage.records.values()][0]!);
      assert.equal(saved.mutations[0].variables.reps, 12);
    } finally { harness.queue.destroy(); }
  });

  it("restores a pending edit after restart and removes it only after a successful sync", async () => {
    const storage = createStorage();
    const offline = createHarness(storage, {
      executors: {
        updateSet: async () => { throw new TypeError("Network request failed"); },
        addSet: async () => { throw new Error("Unexpected add"); },
        deleteSet: async () => { throw new Error("Unexpected delete"); },
      },
    });
    await offline.queue.initialize();
    await offline.queue.enqueueUpdateSet({ setId: "set-1", weight: 55, reps: 10 });
    await waitForIdle(offline.queue);
    offline.queue.destroy();

    const restored = createHarness(storage);
    try {
      await restored.queue.initialize();
      assert.equal(restored.queue.getState().pendingCount, 0);
      assert.equal(restored.getWorkout().exercises[0]!.sets[0]!.weight, 55);
      assert.equal(restored.getWorkout().exercises[0]!.sets[0]!.reps, 10);
      assert.equal(storage.records.size, 0);
    } finally { restored.queue.destroy(); }
  });

  it("replaces an optimistic added set with the server ID", async () => {
    const harness = createHarness();
    try {
      await harness.queue.initialize();
      await harness.queue.enqueueAddSet({ workoutExerciseId: "we-1" });
      await waitForIdle(harness.queue);
      assert.deepEqual(harness.getWorkout().exercises[0]!.sets.map((set) => set.id), ["set-1", "server-set-2"]);
      assert.equal(harness.queue.getState().pendingCount, 0);
    } finally { harness.queue.destroy(); }
  });

  it("does not replay another workout's pending mutations", async () => {
    const storage = createStorage();
    storage.records.set("@kak_fit/workout_set_mutation_queue", JSON.stringify({
      workoutId: "another-workout", version: 0, optimisticIdMap: {},
      mutations: [{ type: "updateSet", variables: { setId: "foreign-set", reps: 99 } }],
    }));
    const harness = createHarness(storage);
    try {
      await harness.queue.initialize();
      assert.equal(harness.queue.getState().pendingCount, 0);
      assert.equal(harness.getWorkout().exercises[0]!.sets[0]!.reps, 8);
      assert.equal(storage.records.size, 1);
    } finally { harness.queue.destroy(); }
  });
});
