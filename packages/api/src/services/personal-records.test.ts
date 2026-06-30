import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIncrementalCandidates,
  computeBestRecords,
  needsFullPersonalRecordRecalc,
  type CompletedSet,
} from "./personal-records";

function makeSet(
  id: string,
  weight: number | null,
  reps: number | null,
  duration: number | null = null,
): CompletedSet {
  return { id, weight, reps, duration };
}

describe("computeBestRecords", () => {
  it("finds bests in a single pass", () => {
    const sets = [
      makeSet("a", 100, 5),
      makeSet("b", 120, 3),
      makeSet("c", 80, 12),
    ];

    const best = computeBestRecords(sets);
    assert.equal(best.MAX_WEIGHT.value, 120);
    assert.equal(best.MAX_WEIGHT.setId, "b");
    assert.equal(best.MAX_REPS.value, 12);
    assert.equal(best.MAX_REPS.setId, "c");
    assert.equal(best.MAX_VOLUME.value, 960);
    assert.equal(best.MAX_VOLUME.setId, "c");
  });

  it("handles empty input", () => {
    const best = computeBestRecords([]);
    assert.equal(best.MAX_WEIGHT.value, 0);
    assert.equal(best.MAX_REPS.value, 0);
  });
});

describe("buildIncrementalCandidates", () => {
  it("only returns types that beat current bests", () => {
    const current = new Map<import("@kak-fit/db").PersonalRecordType, number>([
      ["MAX_WEIGHT", 100],
      ["MAX_REPS", 10],
      ["MAX_VOLUME", 900],
      ["MAX_DURATION", 60],
      ["ESTIMATED_1RM", 130],
    ]);

    const candidates = buildIncrementalCandidates(makeSet("new", 105, 8), current);
    assert.deepEqual(
      candidates.map((c) => c.type).sort(),
      ["ESTIMATED_1RM", "MAX_WEIGHT"].sort(),
    );
  });

  it("returns nothing when set does not beat any record", () => {
    const current = new Map<import("@kak-fit/db").PersonalRecordType, number>([
      ["MAX_WEIGHT", 200],
      ["MAX_REPS", 20],
      ["MAX_VOLUME", 1000],
      ["MAX_DURATION", 600],
      ["ESTIMATED_1RM", 250],
    ]);
    const candidates = buildIncrementalCandidates(makeSet("new", 100, 5), current);
    assert.equal(candidates.length, 0);
  });
});

describe("needsFullPersonalRecordRecalc", () => {
  it("requires full recalc when completion is removed", () => {
    assert.equal(
      needsFullPersonalRecordRecalc(
        { weight: 100, reps: 5, duration: null, isCompleted: true },
        { weight: 100, reps: 5, duration: null, isCompleted: false },
      ),
      true,
    );
  });

  it("allows incremental path when a set is newly completed", () => {
    assert.equal(
      needsFullPersonalRecordRecalc(
        { weight: 100, reps: 5, duration: null, isCompleted: false },
        { weight: 100, reps: 5, duration: null, isCompleted: true },
      ),
      false,
    );
  });

  it("requires full recalc when a metric decreases", () => {
    assert.equal(
      needsFullPersonalRecordRecalc(
        { weight: 100, reps: 5, duration: null, isCompleted: true },
        { weight: 90, reps: 5, duration: null, isCompleted: true },
      ),
      true,
    );
  });
});

describe("computeBestRecords performance", () => {
  it("scans 10k sets in under 50ms", () => {
    const sets: CompletedSet[] = Array.from({ length: 10_000 }, (_, index) =>
      makeSet(`set-${index}`, 50 + (index % 200), 1 + (index % 15)),
    );

    const start = performance.now();
    const best = computeBestRecords(sets);
    const duration = performance.now() - start;

    assert.ok(best.MAX_WEIGHT.value > 0);
    assert.ok(duration < 50, `expected <50ms, got ${duration.toFixed(2)}ms`);
  });
});
