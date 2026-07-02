import type { PrismaClient } from "@kak-fit/db";

export async function findInaccessibleExerciseIds(
  prisma: PrismaClient,
  userId: string,
  exerciseIds: string[],
) {
  const uniqueIds = Array.from(new Set(exerciseIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const accessible = await prisma.exercise.findMany({
    where: {
      id: { in: uniqueIds },
      OR: [{ isCustom: false }, { isCustom: true, userId }],
    },
    select: { id: true },
  });

  const accessibleIds = new Set(accessible.map((exercise) => exercise.id));
  return uniqueIds.filter((id) => !accessibleIds.has(id));
}
