-- Daily exercise reminder email preferences and idempotency marker.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "exerciseReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "exerciseReminderLastSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_exerciseReminderEnabled_exerciseReminderLastSentAt_idx"
  ON "User"("exerciseReminderEnabled", "exerciseReminderLastSentAt");
