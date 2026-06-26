import { PrismaClient as PrismaClientBase } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createAcceleratedPrisma> | undefined;
};

function createAcceleratedPrisma() {
  return new PrismaClientBase({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends(withAccelerate());
}

const accelerated = globalForPrisma.prisma ?? createAcceleratedPrisma();

/** Runtime client routes queries through Prisma Accelerate (pooling + optional cache). */
export const prisma = accelerated as unknown as PrismaClientBase;

/** Use for `cacheStrategy` on individual queries. */
export type AcceleratedPrisma = typeof accelerated;

export type PrismaClient = PrismaClientBase;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = accelerated;
}

export * from "@prisma/client";
