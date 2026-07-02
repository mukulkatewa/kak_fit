-- CreateIndex
CREATE INDEX "RoutineSet_routineExerciseId_setNumber_idx" ON "RoutineSet"("routineExerciseId", "setNumber");

-- Partial index for active workout lookup (finishedAt IS NULL)
CREATE INDEX "Workout_userId_active_idx" ON "Workout"("userId") WHERE "finishedAt" IS NULL;
