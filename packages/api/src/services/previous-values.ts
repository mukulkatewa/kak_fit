import type { PrismaClient } from "@kak-fit/db";

export async function getPreviousExercisePerformance(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
) {
  const lastWorkout = await prisma.workout.findFirst({
    where: {
      userId,
      finishedAt: { not: null },
      exercises: { some: { exerciseId } },
    },
    orderBy: { finishedAt: "desc" },
    include: {
      exercises: {
        where: { exerciseId },
        include: {
          sets: {
            where: { isCompleted: true },
            orderBy: { setNumber: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const lastSet = lastWorkout?.exercises[0]?.sets[0];
  if (!lastSet || !lastWorkout) return null;

  return {
    weight: lastSet.weight,
    reps: lastSet.reps,
    duration: lastSet.duration,
    finishedAt: lastWorkout.finishedAt,
    workoutName: lastWorkout.name,
  };
}
