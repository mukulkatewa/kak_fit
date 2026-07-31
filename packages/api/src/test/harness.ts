/**
 * Integration test harness — calls real tRPC procedures against a real Postgres.
 *
 * These tests catch the class of bug that manual tapping never finds and that
 * matters most once coaches can read client data: ownership and permission
 * leaks. A unit test can't tell you that `coachA` can read `clientB`'s meal log.
 * This can.
 *
 * Run with `pnpm test:integration` (see packages/api/package.json), which points
 * DATABASE_URL at a throwaway database. The guard below refuses to run against
 * anything that isn't obviously a test database.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@kak-fit/db";
import type { User } from "@kak-fit/db";
import { appRouter } from "../index";
import type { TRPCContext } from "../trpc";
import { resetRateLimits } from "../lib/rate-limiter";

/**
 * Refuses to touch a database whose name doesn't look like a test database.
 * Without this, a stray `pnpm test` wipes your dev data.
 */
function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run integration tests via `pnpm test:integration`.",
    );
  }

  const dbName = url.split("/").pop()?.split("?")[0] ?? "";
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run integration tests against database "${dbName}". ` +
        `The database name must contain "test". Run \`pnpm test:integration\` instead.`,
    );
  }
}

assertTestDatabase();

export type TestUser = User;

/** Creates an isolated user. Every test gets its own so tests never collide. */
export async function createTestUser(overrides: Partial<User> = {}): Promise<TestUser> {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `test-${id}@kakfit.test`,
      name: overrides.name ?? "Test User",
      emailVerified: true,
      ...overrides,
    },
  });
}

/**
 * A tRPC caller authenticated as `user`. Pass `null` to exercise the
 * signed-out path (expects UNAUTHORIZED from protectedProcedure).
 */
export function callerFor(user: TestUser | null) {
  const ctx: TRPCContext = {
    prisma,
    user,
    sessionToken: user ? `test-session-${user.id}` : null,
  };
  return appRouter.createCaller(ctx);
}

/** Creates a user and returns them alongside an authenticated caller. */
export async function createAuthedCaller(overrides: Partial<User> = {}) {
  const user = await createTestUser(overrides);
  return { user, caller: callerFor(user) };
}

/**
 * Deletes users created by the harness and their cascading rows.
 * Call from an `after()` hook so a failing test still cleans up.
 */
export async function deleteTestUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/**
 * protectedProcedure allows 60 calls/min/user. A test that loops past that
 * would fail with TOO_MANY_REQUESTS for reasons unrelated to what it asserts.
 */
export function resetRateLimiting(): void {
  resetRateLimits();
}

/** Asserts that `fn` rejects with a specific tRPC error code. */
export async function expectTRPCError(
  fn: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (actual !== code) {
      throw new Error(`Expected tRPC error "${code}" but got "${actual ?? "unknown"}"`);
    }
    return;
  }
  throw new Error(`Expected tRPC error "${code}" but the call succeeded`);
}

export { prisma };
