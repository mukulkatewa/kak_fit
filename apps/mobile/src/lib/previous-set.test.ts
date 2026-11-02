import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickPreviousForSet, type PreviousExerciseSession } from "./previous-set";

const session: PreviousExerciseSession = {
  workoutName: "Push A",
  finishedAt: new Date("2026-11-01T10:00:00Z"),
  sets: [
    { setNumber: 1, weight: 40, reps: 10, duration: null },
    { setNumber: 3, weight: 50, reps: 8, duration: null },
  ],
};

describe("previous set matching", () => {
  it("matches the actual set number, including gaps", () => {
    assert.equal(pickPreviousForSet(session, 3), session.sets[1]);
  });
  it("does not show another set's performance for a missing or new set", () => {
    assert.equal(pickPreviousForSet(session, 2), null);
    assert.equal(pickPreviousForSet(session, 5), null);
  });
  it("handles an exercise without previous performance", () => {
    assert.equal(pickPreviousForSet(null, 1), null);
    assert.equal(pickPreviousForSet({ ...session, sets: [] }, 1), null);
  });
});
