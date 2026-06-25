import "@/lib/env-check";
import { prisma } from "@kak-fit/db";
import { getAuthEnvStatus } from "@/lib/env-check";

export const dynamic = "force-dynamic";

const VERSION = "0.2.0";

export async function GET() {
  let db: string;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "connected";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db = `error: ${message}`;
  }

  return Response.json({
    status: "ok",
    db,
    auth: getAuthEnvStatus(),
    version: VERSION,
  });
}
