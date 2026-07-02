-- Composite cursor index for workout history pagination ordered by finishedAt DESC, id DESC.
CREATE INDEX IF NOT EXISTS "Workout_userId_finishedAt_id_idx"
  ON "Workout"("userId", "finishedAt" DESC, "id" DESC);
