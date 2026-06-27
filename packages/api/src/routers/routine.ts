import type { AcceleratedPrisma, PrismaClient } from "@kak-fit/db";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const setInput = z.object({
  setNumber: z.number().int().positive(),
  targetWeight: z.number().optional(),
  targetReps: z.number().int().optional(),
  targetDuration: z.number().int().optional(),
  setType: z.enum(["NORMAL", "WARMUP", "DROP", "FAILURE"]).optional(),
});

const routineExerciseInput = z.object({
  exerciseId: z.string(),
  order: z.number().int().nonnegative(),
  restSeconds: z.number().int().optional(),
  notes: z.string().optional(),
  supersetGroup: z.number().int().nullable().optional(),
  sets: z.array(setInput).min(1),
});

const importProgramInput = z.object({
  programTitle: z.string().min(2).max(120),
  routines: z.array(
    z.object({
      name: z.string().min(1).max(100),
      exerciseNames: z.array(z.string().min(1)).min(1).max(20),
    }),
  ).min(1).max(20),
  setCount: z.number().int().min(1).max(8).default(3),
  targetReps: z.number().int().min(1).max(100).default(10),
});

type ResolvedExercise = { id: string; name: string };

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

async function resolveTemplateExercises(
  prisma: PrismaClient,
  userId: string,
  names: string[],
) {
  const normalized = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  if (normalized.length === 0) return new Map<string, ResolvedExercise>();

  const candidates = await prisma.exercise.findMany({
    where: {
      OR: [{ isCustom: false }, { isCustom: true, userId }],
      AND: { OR: normalized.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
    },
    select: { id: true, name: true },
  });

  const exactByLower = new Map(candidates.map((candidate) => [normalizeName(candidate.name), candidate]));
  const unresolved = normalized.filter((name) => !exactByLower.has(normalizeName(name)));

  const fuzzy = unresolved.length > 0
    ? await prisma.exercise.findMany({
        where: {
          OR: [{ isCustom: false }, { isCustom: true, userId }],
          AND: { OR: unresolved.map((name) => ({ name: { contains: name, mode: "insensitive" as const } })) },
        },
        select: { id: true, name: true },
      })
    : [];

  const resolved = new Map<string, ResolvedExercise>();
  for (const name of normalized) {
    const lower = normalizeName(name);
    const exact = exactByLower.get(lower);
    const match =
      exact ??
      fuzzy.find((candidate) => normalizeName(candidate.name).includes(lower)) ??
      fuzzy.find((candidate) => lower.includes(normalizeName(candidate.name)));
    if (match) resolved.set(name, match);
  }

  return resolved;
}

const routineListSummaryInclude = {
  exercises: {
    orderBy: { order: "asc" as const },
    select: {
      id: true,
      order: true,
      exercise: { select: { id: true, name: true, imageUrl: true } },
    },
  },
} as const;

const routineListFullInclude = {
  exercises: {
    orderBy: { order: "asc" as const },
    select: {
      id: true,
      order: true,
      restSeconds: true,
      notes: true,
      supersetGroup: true,
      exercise: { select: { id: true, name: true, imageUrl: true } },
      sets: {
        orderBy: { setNumber: "asc" as const },
        select: {
          id: true,
          setNumber: true,
          targetWeight: true,
          targetReps: true,
          targetDuration: true,
          setType: true,
        },
      },
    },
  },
} as const;

const routineDetailInclude = {
  folder: true,
  ...routineListFullInclude,
} as const;

function shareUrl(token: string) {
  return `kakfit://routine/share/${token}`;
}

function newShareToken() {
  return randomBytes(9).toString("base64url");
}

export const routineRouter = router({
  importProgram: protectedProcedure
    .input(importProgramInput)
    .mutation(async ({ ctx, input }) => {
      const allNames = input.routines.flatMap((routine) => routine.exerciseNames);
      const resolved = await resolveTemplateExercises(ctx.prisma, ctx.user.id, allNames);
      const programName = input.programTitle.replace(/\s*\([^)]*\)\s*/g, "").trim() || input.programTitle.trim();
      const missing = Array.from(new Set(allNames.filter((name) => !resolved.has(name))));

      const created = await ctx.prisma.$transaction(async (tx) => {
        const routines = [];
        let saved = 0;
        let skipped = 0;

        for (const template of input.routines) {
          const routineName = `${programName} · ${template.name}`;
          const existing = await tx.routine.findFirst({
            where: { userId: ctx.user.id, name: routineName },
            include: routineListFullInclude,
          });

          if (existing) {
            routines.push(existing);
            skipped += 1;
            continue;
          }

          const exercises = template.exerciseNames
            .map((name) => resolved.get(name))
            .filter((exercise): exercise is ResolvedExercise => Boolean(exercise));

          if (exercises.length === 0) continue;

          routines.push(
            await tx.routine.create({
              data: {
                userId: ctx.user.id,
                name: routineName,
                notes: `Imported from ${input.programTitle}`,
                exercises: {
                  create: exercises.map((exercise, index) => ({
                    exerciseId: exercise.id,
                    order: index,
                    sets: {
                      create: Array.from({ length: input.setCount }, (_, setIndex) => ({
                        setNumber: setIndex + 1,
                        targetReps: input.targetReps,
                      })),
                    },
                  })),
                },
              },
              include: routineListFullInclude,
            }),
          );
          saved += 1;
        }
        return { routines, saved, skipped };
      });

      return {
        saved: created.saved,
        skipped: created.skipped,
        routines: created.routines,
        missingExerciseNames: missing,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return (ctx.prisma as unknown as AcceleratedPrisma).routine.findMany({
      where: { userId: ctx.user.id },
      include: routineListSummaryInclude,
      orderBy: { updatedAt: "desc" },
    });
  }),

  folders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.routineFolder.findMany({
      where: { userId: ctx.user.id },
      include: { routines: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: routineDetailInclude,
      });

      if (!routine) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      return routine;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        notes: z.string().optional(),
        folderId: z.string().optional(),
        exercises: z.array(routineExerciseInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.routine.create({
        data: {
          userId: ctx.user.id,
          name: input.name.trim(),
          notes: input.notes,
          folderId: input.folderId,
          exercises: {
            create: input.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              supersetGroup: ex.supersetGroup ?? null,
              sets: {
                create: ex.sets,
              },
            })),
          },
        },
        include: routineListFullInclude,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(100),
        notes: z.string().optional(),
        folderId: z.string().nullable().optional(),
        exercises: z.array(routineExerciseInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      // Replace the exercise tree wholesale (simplest correct edit).
      return ctx.prisma.$transaction(async (tx) => {
        await tx.routineExercise.deleteMany({ where: { routineId: input.id } });
        return tx.routine.update({
          where: { id: input.id },
          data: {
            name: input.name.trim(),
            notes: input.notes,
            ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
              exercises: {
              create: input.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                order: ex.order,
                restSeconds: ex.restSeconds,
                notes: ex.notes,
                supersetGroup: ex.supersetGroup ?? null,
                sets: { create: ex.sets },
              })),
            },
          },
          include: routineListFullInclude,
        });
      });
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          exercises: { include: { sets: true } },
        },
      });

      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      return ctx.prisma.routine.create({
        data: {
          userId: ctx.user.id,
          name: `${source.name} (Copy)`,
          notes: source.notes,
          folderId: source.folderId,
          exercises: {
            create: source.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              supersetGroup: ex.supersetGroup ?? null,
              sets: {
                create: ex.sets.map((set) => ({
                  setNumber: set.setNumber,
                  targetWeight: set.targetWeight,
                  targetReps: set.targetReps,
                  targetDuration: set.targetDuration,
                  setType: set.setType,
                })),
              },
            })),
          },
        },
        include: routineListFullInclude,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });

      if (!routine) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      await ctx.prisma.routine.delete({ where: { id: input.id } });
      return { success: true };
    }),

  createFolder: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.routineFolder.create({
        data: { userId: ctx.user.id, name: input.name.trim() },
      });
    }),

  renameFolder: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.routineFolder.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      return ctx.prisma.routineFolder.update({
        where: { id: input.id },
        data: { name: input.name.trim() },
      });
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.routineFolder.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      // Routines keep existing; their folderId is set null (schema onDelete: SetNull).
      await ctx.prisma.routineFolder.delete({ where: { id: input.id } });
      return { success: true };
    }),

  setFolder: protectedProcedure
    .input(z.object({ routineId: z.string(), folderId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.routineId, userId: ctx.user.id },
        select: { id: true },
      });
      if (!routine) throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      if (input.folderId) {
        const folder = await ctx.prisma.routineFolder.findFirst({
          where: { id: input.folderId, userId: ctx.user.id },
          select: { id: true },
        });
        if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      }
      return ctx.prisma.routine.update({
        where: { id: input.routineId },
        data: { folderId: input.folderId },
      });
    }),

  /** Enable sharing and return a deep-link URL for this routine. */
  share: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true, shareToken: true, name: true },
      });
      if (!routine) throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });

      const token =
        routine.shareToken ??
        (
          await ctx.prisma.routine.update({
            where: { id: routine.id },
            data: { shareToken: newShareToken() },
            select: { shareToken: true },
          })
        ).shareToken!;

      return { token, url: shareUrl(token), name: routine.name };
    }),

  /** Preview a shared routine (any authenticated user). */
  previewShare: protectedProcedure
    .input(z.object({ token: z.string().min(8) }))
    .query(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { shareToken: input.token },
        include: {
          user: { select: { name: true } },
          exercises: {
            orderBy: { order: "asc" },
            include: {
              exercise: { select: { name: true } },
              sets: { orderBy: { setNumber: "asc" } },
            },
          },
        },
      });
      if (!routine) throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      return {
        id: routine.id,
        name: routine.name,
        authorName: routine.user.name,
        exerciseCount: routine.exercises.length,
        exercises: routine.exercises.map((ex) => ({
          name: ex.exercise.name,
          setCount: ex.sets.length,
        })),
        isOwn: routine.userId === ctx.user.id,
      };
    }),

  /** Copy a shared routine into the current user's library. */
  importShare: protectedProcedure
    .input(z.object({ token: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.routine.findFirst({
        where: { shareToken: input.token },
        include: { exercises: { include: { sets: true }, orderBy: { order: "asc" } } },
      });
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });

      return ctx.prisma.routine.create({
        data: {
          userId: ctx.user.id,
          name: source.userId === ctx.user.id ? `${source.name} (Copy)` : source.name,
          notes: source.notes,
          exercises: {
            create: source.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              supersetGroup: ex.supersetGroup ?? null,
              sets: {
                create: ex.sets.map((set) => ({
                  setNumber: set.setNumber,
                  targetWeight: set.targetWeight,
                  targetReps: set.targetReps,
                  targetDuration: set.targetDuration,
                  setType: set.setType,
                })),
              },
            })),
          },
        },
        include: routineListFullInclude,
      });
    }),
});
