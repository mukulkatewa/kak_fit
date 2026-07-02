import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { deleteImage, isStorageConfigured, uploadImage } from "../services/storage";

export const progressPhotoRouter = router({
  storageEnabled: protectedProcedure.query(() => ({ enabled: isStorageConfigured() })),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(60).default(30),
        workoutId: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.progressPhoto.findMany({
        where: {
          userId: ctx.user.id,
          ...(input?.workoutId ? { workoutId: input.workoutId } : {}),
        },
        orderBy: { takenAt: "desc" },
        take: input?.limit ?? 30,
      });
    }),

  upload: protectedProcedure
    .input(
      z.object({
        base64: z.string().min(1),
        contentType: z.string().default("image/jpeg"),
        note: z.string().max(200).optional(),
        weight: z.number().positive().optional(),
        workoutId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Photo storage is not configured on the server.",
        });
      }

      if (input.workoutId) {
        const workout = await ctx.prisma.workout.findFirst({
          where: { id: input.workoutId, userId: ctx.user.id },
          select: { id: true },
        });
        if (!workout) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Workout not found" });
        }
      }

      const { url, path } = await uploadImage(ctx.user.id, input.base64, input.contentType);
      return ctx.prisma.progressPhoto.create({
        data: {
          userId: ctx.user.id,
          url,
          path,
          note: input.note,
          weight: input.weight,
          workoutId: input.workoutId ?? null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const photo = await ctx.prisma.progressPhoto.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found" });
      await deleteImage(photo.path);
      await ctx.prisma.progressPhoto.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
