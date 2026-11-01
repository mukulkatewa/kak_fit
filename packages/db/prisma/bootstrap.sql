-- Apply after db:push on a fresh project dedicated to Kak Fit.
-- The backend's PostgreSQL role owns the tables and enforces user access via
-- tRPC/Better Auth. Block direct anon/authenticated Data API access with RLS.
DO $$
DECLARE app_table record;
BEGIN
  FOR app_table IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table.tablename);
  END LOOP;
END $$;

-- Partial indexes are not represented by this project's Prisma 6 schema.
CREATE INDEX IF NOT EXISTS "Workout_userId_active_idx"
  ON "Workout"("userId") WHERE "finishedAt" IS NULL;
