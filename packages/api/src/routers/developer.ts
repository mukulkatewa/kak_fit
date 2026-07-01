import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateApiKey, invalidateApiAuthCache } from "../public-api/auth";
import { resolvePublicApiBaseUrl } from "../lib/public-api-base-url";
import { protectedProcedure, router } from "../trpc";

function requireDeveloperAccess(tier: string) {
  if (process.env.DEVELOPER_API_REQUIRE_PRO === "true" && tier !== "PRO") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Developer API requires Kak Fit Pro",
    });
  }
}

export const developerRouter = router({
  listKeys: protectedProcedure.query(async ({ ctx }) => {
    requireDeveloperAccess(ctx.user.subscriptionTier);
    return ctx.prisma.apiKey.findMany({
      where: { userId: ctx.user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }),

  createKey: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(60).default("Default") }))
    .mutation(async ({ ctx, input }) => {
      requireDeveloperAccess(ctx.user.subscriptionTier);

      const activeCount = await ctx.prisma.apiKey.count({
        where: { userId: ctx.user.id, revokedAt: null },
      });
      if (activeCount >= 5) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum 5 active API keys",
        });
      }

      const { rawKey, prefix, hash } = generateApiKey();
      const record = await ctx.prisma.apiKey.create({
        data: {
          userId: ctx.user.id,
          name: input.name.trim(),
          keyPrefix: prefix,
          keyHash: hash,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          createdAt: true,
        },
      });

      return { ...record, apiKey: rawKey };
    }),

  revokeKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireDeveloperAccess(ctx.user.subscriptionTier);
      const key = await ctx.prisma.apiKey.findFirst({
        where: { id: input.id, userId: ctx.user.id, revokedAt: null },
      });
      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }
      await ctx.prisma.apiKey.update({
        where: { id: key.id },
        data: { revokedAt: new Date() },
      });
      invalidateApiAuthCache(key.keyHash);
      return { success: true };
    }),

  docsUrl: protectedProcedure.query(() => ({
    baseUrl: resolvePublicApiBaseUrl(),
    docsPath: "/api/v1/docs",
    authHeader: "api-key",
  })),
});
