-- Create ExerciseMedia table for locally-hosted exercise images and videos.
-- Media URLs from external providers such as Wger must not be read at runtime.
CREATE TABLE "ExerciseMedia" (
  "id" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "type" "MediaType" NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "originalUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "width" INTEGER,
  "height" INTEGER,
  "duration" INTEGER,
  "fileSize" INTEGER,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExerciseMedia_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExerciseMedia"
  ADD CONSTRAINT "ExerciseMedia_exerciseId_fkey"
  FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ExerciseMedia_exerciseId_originalUrl_key" ON "ExerciseMedia"("exerciseId", "originalUrl");
CREATE INDEX "ExerciseMedia_exerciseId_type_displayOrder_idx" ON "ExerciseMedia"("exerciseId", "type", "displayOrder");
CREATE INDEX "ExerciseMedia_source_idx" ON "ExerciseMedia"("source");
