/**
 * Cross-user data isolation.
 *
 * This is the test file that matters most for the coaching platform. Once a
 * coach can read client data, every "can X see Y?" question becomes a money and
 * trust question. These tests pin the current behaviour so that adding the
 * coach layer can't silently widen access.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  createAuthedCaller,
  callerFor,
  deleteTestUsers,
  expectTRPCError,
  resetRateLimiting,
} from "./harness";

const createdUserIds: string[] = [];

async function makeUser(name: string) {
  const { user, caller } = await createAuthedCaller({ name });
  createdUserIds.push(user.id);
  return { user, caller };
}

describe("auth boundary", () => {
  beforeEach(() => resetRateLimiting());

  it("rejects protected procedures when signed out", async () => {
    const anon = callerFor(null);
    await expectTRPCError(() => anon.bodyMeasurement.list(), "UNAUTHORIZED");
  });

  it("allows public procedures when signed out", async () => {
    const anon = callerFor(null);
    const health = await anon.health();
    assert.equal(health.status, "ok");
  });
});

describe("body measurements are scoped to their owner", () => {
  beforeEach(() => resetRateLimiting());

  it("never returns another user's measurements", async () => {
    const alice = await makeUser("Alice");
    const bob = await makeUser("Bob");

    await alice.caller.bodyMeasurement.create({ weight: 72.5 });

    const aliceRows = await alice.caller.bodyMeasurement.list();
    const bobRows = await bob.caller.bodyMeasurement.list();

    assert.equal(aliceRows.length, 1);
    assert.equal(aliceRows[0]!.weight, 72.5);
    assert.equal(bobRows.length, 0, "Bob must not see Alice's measurements");
  });

  it("requires at least one field", async () => {
    const alice = await makeUser("Alice");
    await expectTRPCError(() => alice.caller.bodyMeasurement.create({}), "BAD_REQUEST");
  });
});

describe("workouts are scoped to their owner", () => {
  beforeEach(() => resetRateLimiting());

  it("hides another user's workout behind NOT_FOUND", async () => {
    const alice = await makeUser("Alice");
    const bob = await makeUser("Bob");

    const workout = await alice.caller.workout.startEmpty({ name: "Push Day" });

    const ownView = await alice.caller.workout.getById({ id: workout.id });
    assert.equal(ownView.id, workout.id);

    await expectTRPCError(
      () => bob.caller.workout.getById({ id: workout.id }),
      "NOT_FOUND",
    );
  });

  it("keeps active workouts separate per user", async () => {
    const alice = await makeUser("Alice");
    const bob = await makeUser("Bob");

    await alice.caller.workout.startEmpty({ name: "Leg Day" });

    const aliceActive = await alice.caller.workout.active();
    const bobActive = await bob.caller.workout.active();

    assert.ok(aliceActive, "Alice should have an active workout");
    assert.equal(bobActive, null, "Bob must not inherit Alice's active workout");
  });
});

after(async () => {
  await deleteTestUsers(createdUserIds);
});

// `before` is declared last only so the file reads top-down; node:test hoists it.
before(() => resetRateLimiting());
