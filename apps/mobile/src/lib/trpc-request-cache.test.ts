import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  dedupedFetch,
  getTrpcRequestStats,
  resetTrpcRequestStats,
} from "./trpc-request-cache";

describe("dedupedFetch", () => {
  beforeEach(() => {
    resetTrpcRequestStats();
  });

  it("deduplicates parallel GET requests with the same key", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response("ok");
    };

    const url = "https://api.example.com/trpc/a,b?batch=1";
    const options = { method: "GET" as const };

    const [a, b] = await Promise.all([
      dedupedFetch(url, options, fetchImpl),
      dedupedFetch(url, options, fetchImpl),
    ]);

    assert.equal(calls, 1);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(getTrpcRequestStats().deduped, 1);
  });

  it("does not deduplicate POST requests", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response("ok");
    };

    const url = "https://api.example.com/trpc/mutate";
    const options = { method: "POST" as const, body: "{}" };

    await Promise.all([
      dedupedFetch(url, options, fetchImpl),
      dedupedFetch(url, options, fetchImpl),
    ]);

    assert.equal(calls, 2);
    assert.equal(getTrpcRequestStats().deduped, 0);
  });
});
