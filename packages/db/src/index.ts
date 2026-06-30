import { PrismaClient as PrismaClientBase } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const SLOW_QUERY_THRESHOLD_MS = 1000;
const DEFAULT_POOL_SIZE = "5";
const DEFAULT_POOL_TIMEOUT = "20";
const DEFAULT_CONNECT_TIMEOUT = "10";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createAcceleratedPrisma> | undefined;
  prismaShutdownRegistered: boolean | undefined;
};

function isNodeRuntime() {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}

/** Append pool params to DATABASE_URL when not already set (skipped for Prisma Accelerate URLs). */
export function resolveDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL is not set");
  }

  if (base.startsWith("prisma://") || base.startsWith("prisma+postgres://")) {
    return base;
  }

  const url = new URL(base);
  const connectionLimit =
    process.env.DATABASE_CONNECTION_LIMIT ??
    process.env.DATABASE_POOL_SIZE ??
    DEFAULT_POOL_SIZE;
  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT ?? DEFAULT_POOL_TIMEOUT;

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", connectionLimit);
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", poolTimeout);
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", DEFAULT_CONNECT_TIMEOUT);
  }

  return url.toString();
}

const connectionMonitoringExtension = {
  name: "connectionMonitoring",
  query: {
    $allOperations: async ({
      operation,
      model,
      args,
      query,
    }: {
      operation: string;
      model?: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }) => {
      const start = Date.now();
      const result = await query(args);
      const duration = Date.now() - start;

      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(
          `[Prisma] Slow query detected: ${model ?? "unknown"}.${operation} took ${duration}ms`,
        );
      }

      return result;
    },
  },
};

function createAcceleratedPrisma() {
  const client = new PrismaClientBase({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  }).$extends(withAccelerate());

  if (process.env.NODE_ENV === "development") {
    return client.$extends(connectionMonitoringExtension);
  }

  return client;
}

function registerGracefulShutdown(client: PrismaClientBase) {
  if (!isNodeRuntime() || globalForPrisma.prismaShutdownRegistered) {
    return;
  }
  globalForPrisma.prismaShutdownRegistered = true;

  const disconnect = async () => {
    try {
      await client.$disconnect();
    } catch (error) {
      console.error("[Prisma] Failed to disconnect cleanly", error);
    }
  };

  process.once("SIGTERM", disconnect);
  process.once("SIGINT", disconnect);
  process.once("beforeExit", disconnect);
}

const accelerated = globalForPrisma.prisma ?? createAcceleratedPrisma();

registerGracefulShutdown(accelerated as unknown as PrismaClientBase);

/** Runtime client routes queries through Prisma Accelerate (pooling + optional cache). */
export const prisma = accelerated as unknown as PrismaClientBase;

/** Use for `cacheStrategy` on individual queries. */
export type AcceleratedPrisma = typeof accelerated;

export type PrismaClient = PrismaClientBase;

export async function disconnectPrisma() {
  await (accelerated as unknown as PrismaClientBase).$disconnect();
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = accelerated;
}

export * from "@prisma/client";
