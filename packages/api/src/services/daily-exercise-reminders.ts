import { Resend } from "resend";
import { Prisma, type PrismaClient } from "@kak-fit/db";
import { DailyExerciseReminderEmail } from "../emails/daily-exercise-reminder";

type ReminderUser = {
  id: string;
  name: string;
  email: string;
  exerciseReminderLastSentAt: Date | null;
};

type ReminderStats = {
  workoutCount: number;
  lastWorkoutName: string | null;
  lastWorkoutDate: string | null;
};

export type SendDailyExerciseReminderOptions = {
  limit?: number;
  dryRun?: boolean;
  concurrency?: number;
  now?: Date;
};

export type SendDailyExerciseReminderReport = {
  candidates: number;
  skippedWorkedOutToday: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  errors: Array<{ userId: string; email: string; message: string }>;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getAppUrl() {
  return (
    process.env.EXERCISE_REMINDER_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "kakfit://"
  );
}

function formatDate(date: Date | null | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]!);
    }
  });
  await Promise.all(workers);
}

async function loadReminderUsers(
  prisma: PrismaClient,
  since: Date,
  limit: number,
): Promise<ReminderUser[]> {
  return prisma.user.findMany({
    where: {
      exerciseReminderEnabled: true,
      email: { not: "" },
      OR: [
        { exerciseReminderLastSentAt: null },
        { exerciseReminderLastSentAt: { lt: since } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      exerciseReminderLastSentAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

async function loadUsersWhoWorkedOutToday(prisma: PrismaClient, userIds: string[], since: Date) {
  if (userIds.length === 0) return new Set<string>();
  const rows = await prisma.workout.findMany({
    where: { userId: { in: userIds }, finishedAt: { gte: since } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return new Set(rows.map((row) => row.userId));
}

async function loadReminderStats(prisma: PrismaClient, userIds: string[]) {
  const stats = new Map<string, ReminderStats>();
  if (userIds.length === 0) return stats;

  const counts = await prisma.workout.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, finishedAt: { not: null } },
    _count: { _all: true },
  });

  for (const count of counts) {
    stats.set(count.userId, {
      workoutCount: count._count._all,
      lastWorkoutName: null,
      lastWorkoutDate: null,
    });
  }

  const recent = await prisma.$queryRaw<Array<{ userId: string; name: string | null; finishedAt: Date }>>(Prisma.sql`
    SELECT DISTINCT ON (w."userId")
      w."userId" as "userId",
      w.name,
      w."finishedAt" as "finishedAt"
    FROM "Workout" w
    WHERE w."userId" IN (${Prisma.join(userIds)})
      AND w."finishedAt" IS NOT NULL
    ORDER BY w."userId", w."finishedAt" DESC
  `);

  for (const workout of recent) {
    const existing = stats.get(workout.userId) ?? { workoutCount: 0, lastWorkoutName: null, lastWorkoutDate: null };
    stats.set(workout.userId, {
      ...existing,
      lastWorkoutName: workout.name ?? "a workout",
      lastWorkoutDate: formatDate(workout.finishedAt),
    });
  }

  return stats;
}

export async function sendDailyExerciseReminders(
  prisma: PrismaClient,
  options: SendDailyExerciseReminderOptions = {},
): Promise<SendDailyExerciseReminderReport> {
  const now = options.now ?? new Date();
  const todayStart = startOfUtcDay(now);
  const envLimit = Number.parseInt(process.env.EXERCISE_REMINDER_BATCH_SIZE ?? "500", 10);
  const envConcurrency = Number.parseInt(process.env.EXERCISE_REMINDER_CONCURRENCY ?? "5", 10);
  const limit = options.limit ?? (Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 500);
  const concurrency = options.concurrency ?? (Number.isFinite(envConcurrency) && envConcurrency > 0 ? envConcurrency : 5);
  const dryRun = Boolean(options.dryRun);

  const report: SendDailyExerciseReminderReport = {
    candidates: 0,
    skippedWorkedOutToday: 0,
    sent: 0,
    failed: 0,
    dryRun,
    errors: [],
  };

  const candidates = await loadReminderUsers(prisma, todayStart, limit);
  report.candidates = candidates.length;
  if (candidates.length === 0) return report;

  const userIds = candidates.map((user) => user.id);
  const workedOutToday = await loadUsersWhoWorkedOutToday(prisma, userIds, todayStart);
  const pending = candidates.filter((user) => !workedOutToday.has(user.id));
  report.skippedWorkedOutToday = candidates.length - pending.length;

  const stats = await loadReminderStats(prisma, pending.map((user) => user.id));

  if (dryRun) {
    report.sent = pending.length;
    return report;
  }

  const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const from = getRequiredEnv("RESEND_FROM_EMAIL");
  const appUrl = getAppUrl();

  await runPool(pending, concurrency, async (user) => {
    const claim = await prisma.user.updateMany({
      where: {
        id: user.id,
        exerciseReminderEnabled: true,
        OR: [
          { exerciseReminderLastSentAt: null },
          { exerciseReminderLastSentAt: { lt: todayStart } },
        ],
      },
      data: { exerciseReminderLastSentAt: now },
    });

    if (claim.count === 0) return;

    const userStats = stats.get(user.id) ?? { workoutCount: 0, lastWorkoutName: null, lastWorkoutDate: null };

    const { error } = await resend.emails.send({
      from,
      to: user.email,
      subject: `${user.name.split(/\s+/)[0] || "Your"}, your workout is waiting`,
      react: DailyExerciseReminderEmail({
        name: user.name,
        appUrl,
        workoutCount: userStats.workoutCount,
        lastWorkoutName: userStats.lastWorkoutName,
        lastWorkoutDate: userStats.lastWorkoutDate,
      }),
    });

    if (error) {
      report.failed += 1;
      report.errors.push({ userId: user.id, email: user.email, message: error.message });
      await prisma.user.update({
        where: { id: user.id },
        data: { exerciseReminderLastSentAt: user.exerciseReminderLastSentAt },
      });
      return;
    }

    report.sent += 1;
  });

  return report;
}
