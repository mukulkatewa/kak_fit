-- Runtime query indexes for production latency.
CREATE INDEX IF NOT EXISTS "ExerciseMuscle_muscleId_idx" ON "ExerciseMuscle"("muscleId");
CREATE INDEX IF NOT EXISTS "ExerciseMuscle_exerciseId_isPrimary_idx" ON "ExerciseMuscle"("exerciseId", "isPrimary");
CREATE INDEX IF NOT EXISTS "ExerciseEquipment_equipmentId_idx" ON "ExerciseEquipment"("equipmentId");
CREATE INDEX IF NOT EXISTS "RoutineFolder_userId_idx" ON "RoutineFolder"("userId");
CREATE INDEX IF NOT EXISTS "RoutineExercise_exerciseId_idx" ON "RoutineExercise"("exerciseId");
CREATE INDEX IF NOT EXISTS "Like_workoutId_idx" ON "Like"("workoutId");
CREATE INDEX IF NOT EXISTS "Comment_workoutId_idx" ON "Comment"("workoutId");
CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId");
CREATE INDEX IF NOT EXISTS "Media_workoutId_idx" ON "Media"("workoutId");
CREATE INDEX IF NOT EXISTS "Food_isCustom_userId_updatedAt_idx" ON "Food"("isCustom", "userId", "updatedAt");
