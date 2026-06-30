-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "completedSetCount" INTEGER,
ADD COLUMN "totalVolume" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "MealItem_foodId_idx" ON "MealItem"("foodId");

-- CreateIndex
CREATE INDEX "MealItem_mealId_idx" ON "MealItem"("mealId");

-- CreateIndex
CREATE INDEX "Food_isCustom_userId_idx" ON "Food"("isCustom", "userId");

-- CreateIndex
CREATE INDEX "Routine_userId_folderId_idx" ON "Routine"("userId", "folderId");
