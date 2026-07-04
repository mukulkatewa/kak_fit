import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActiveWorkout } from "./active-workout-cache";
import {
  buildWorkoutNotificationText,
  buildWorkoutWidgetSummary,
  findNextIncompleteSet,
  formatWidgetElapsedDuration,
} from "./workout-live-widget-state";

const workout = {
  id: "workout-1",
  name: "Push Strength",
  notes: null,
  startedAt: new Date("2026-07-03T10:00:00.000Z"),
  finishedAt: null,
  exercises: [
    {
      id: "we-1",
      workoutId: "workout-1",
      exerciseId: "ex-1",
      order: 0,
      notes: null,
      restSeconds: null,
      supersetGroup: null,
      exercise: { id: "ex-1", name: "Bench Press", imageUrl: null, media: [] },
      sets: [
        {
          id: "set-1",
          workoutExerciseId: "we-1",
          setNumber: 1,
          weight: 80,
          reps: 8,
          duration: null,
          rpe: null,
          notes: null,
          setType: "NORMAL",
          isCompleted: true,
        },
        {
          id: "set-2",
          workoutExerciseId: "we-1",
          setNumber: 2,
          weight: 80,
          reps: 8,
          duration: null,
          rpe: null,
          notes: null,
          setType: "NORMAL",
          isCompleted: false,
        },
      ],
    },
    {
      id: "we-2",
      workoutId: "workout-1",
      exerciseId: "ex-2",
      order: 1,
      notes: null,
      restSeconds: null,
      supersetGroup: null,
      exercise: { id: "ex-2", name: "Cable Fly", imageUrl: null, media: [] },
      sets: [
        {
          id: "set-3",
          workoutExerciseId: "we-2",
          setNumber: 1,
          weight: 20,
          reps: 12,
          duration: null,
          rpe: null,
          notes: null,
          setType: "NORMAL",
          isCompleted: false,
        },
      ],
    },
  ],
  previousSets: {},
} as unknown as ActiveWorkout;

describe("workout live widget state", () => {
  it("formats short elapsed durations", () => {
    assert.equal(formatWidgetElapsedDuration(9), "9s");
    assert.equal(formatWidgetElapsedDuration(125), "2m");
    assert.equal(formatWidgetElapsedDuration(3900), "1h 5m");
  });

  it("finds the first incomplete set in exercise order", () => {
    assert.deepEqual(findNextIncompleteSet(workout), {
      setId: "set-2",
      exerciseId: "ex-1",
      exerciseName: "Bench Press",
      shortExerciseName: "Bench Press",
      setNumber: 2,
      weight: 80,
      reps: 8,
      setLabel: "Set 2 • 80kg × 8 reps",
    });
  });

  it("builds compact notification copy without extra API data", () => {
    const summary = buildWorkoutWidgetSummary(workout, new Date("2026-07-03T10:12:00.000Z").getTime());
    assert.equal(summary.elapsedLabel, "12m");
    assert.equal(summary.progressLabel, "1/3 sets");
    assert.equal(summary.currentExerciseName, "Bench Press");
    assert.equal(summary.isComplete, false);

    assert.deepEqual(buildWorkoutNotificationText(summary), {
      title: "Push Strength • 12m",
      body: "Bench Press — Set 2 • 80kg × 8 reps • 1/3 sets",
    });
  });
});
