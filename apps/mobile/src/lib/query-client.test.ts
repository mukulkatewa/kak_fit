import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TRPCClientError } from "@trpc/client";
import { createQueryClient } from "./query-client";

describe("query client request safety", () => {
  it("does not repeat a write when its response is lost", async () => {
    const client = createQueryClient();
    let writes = 0;
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => {
        writes += 1;
        throw new TypeError("Network request failed after the server saved the record");
      },
      retryDelay: 0,
    });
    try {
      await assert.rejects(mutation.execute(undefined), /Network request failed/);
      assert.equal(writes, 1);
    } finally { client.clear(); }
  });

  it("shares cached queries when filter keys have a different property order", async () => {
    const client = createQueryClient();
    let reads = 0;
    const queryFn = async () => { reads += 1; return ["Bench Press"]; };
    try {
      const first = await client.fetchQuery({ queryKey: ["exercises", { muscle: "chest", limit: 20 }], queryFn });
      const second = await client.fetchQuery({ queryKey: ["exercises", { limit: 20, muscle: "chest" }], queryFn });
      assert.deepEqual(second, first);
      assert.equal(reads, 1);
    } finally { client.clear(); }
  });

  it("does not retry authorization, validation, or rate-limit errors", async () => {
    const client = createQueryClient();
    try {
      for (const httpStatus of [400, 401, 403, 404, 429]) {
        let reads = 0;
        const error = Object.assign(new TRPCClientError("Request rejected"), { data: { httpStatus } });
        await assert.rejects(client.fetchQuery({
          queryKey: ["rejected", httpStatus],
          queryFn: async () => { reads += 1; throw error; },
          retryDelay: 0,
        }));
        assert.equal(reads, 1);
      }
    } finally { client.clear(); }
  });

  it("allows one retry for a transient server read failure", async () => {
    const client = createQueryClient();
    let reads = 0;
    try {
      const result = await client.fetchQuery({
        queryKey: ["temporary-server-failure"],
        queryFn: async () => {
          reads += 1;
          if (reads === 1) throw Object.assign(new TRPCClientError("Unavailable"), { data: { httpStatus: 503 } });
          return "recovered";
        },
        retryDelay: 0,
      });
      assert.equal(result, "recovered");
      assert.equal(reads, 2);
    } finally { client.clear(); }
  });
});
