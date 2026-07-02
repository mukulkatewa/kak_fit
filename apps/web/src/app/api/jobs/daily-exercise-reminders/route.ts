import { NextResponse } from "next/server";
import { prisma } from "@kak-fit/db";
import { sendDailyExerciseReminders } from "@kak-fit/api/services/daily-exercise-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const report = await sendDailyExerciseReminders(prisma, {
    dryRun: url.searchParams.get("dryRun") === "true",
    limit: parsePositiveInt(url.searchParams.get("limit")),
    concurrency: parsePositiveInt(url.searchParams.get("concurrency")),
  });

  return NextResponse.json(report, { status: report.failed > 0 ? 207 : 200 });
}

export async function GET(request: Request) {
  return POST(request);
}
