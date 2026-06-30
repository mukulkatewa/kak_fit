import type { Prisma } from "@kak-fit/db";
import { dedupeExercisesByName } from "../lib/exercise-name";

export const exerciseListInclude = {
  category: { select: { id: true, name: true } },
  muscles: {
    where: { isPrimary: true },
    take: 1,
    include: { muscle: { select: { id: true, name: true } } },
  },
  equipment: {
    take: 3,
    include: { equipment: { select: { id: true, name: true } } },
  },
} as const;

export const exerciseDetailInclude = {
  category: { select: { id: true, name: true } },
  muscles: {
    include: { muscle: { select: { id: true, name: true } } },
    orderBy: { isPrimary: "desc" as const },
  },
  equipment: {
    include: { equipment: { select: { id: true, name: true } } },
  },
} as const;

export type ExerciseListItem = Prisma.ExerciseGetPayload<{ include: typeof exerciseListInclude }>;

export function globalExerciseWhere(userId: string): Prisma.ExerciseWhereInput {
  return {
    OR: [{ isCustom: false }, { isCustom: true, userId }],
  };
}

/**
 * List catalog exercises with deduplication by normalized name.
 * Prefers Wger rows (images/instructions) and merges Hevy metadata via hevyId on same row.
 */
export async function listCatalogExercises(
  prisma: Prisma.TransactionClient | import("@kak-fit/db").PrismaClient,
  options: {
    userId: string;
    search?: string;
    muscleId?: string;
    categoryId?: string;
    customOnly?: boolean;
    cursor?: string;
    limit: number;
  },
): Promise<ExerciseListItem[]> {
  const where: Prisma.ExerciseWhereInput = {
    ...globalExerciseWhere(options.userId),
    ...(options.search
      ? { name: { contains: options.search, mode: "insensitive" } }
      : {}),
    ...(options.customOnly ? { isCustom: true, userId: options.userId } : {}),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.muscleId ? { muscles: { some: { muscleId: options.muscleId } } } : {}),
  };

  const fetchSize = Math.min(options.limit * 4, 200);

  const rows = await prisma.exercise.findMany({
    where,
    include: exerciseListInclude,
    orderBy: { name: "asc" },
    take: fetchSize,
    ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
  });

  const deduped = dedupeExercisesByName(rows);
  return deduped.slice(0, options.limit);
}
