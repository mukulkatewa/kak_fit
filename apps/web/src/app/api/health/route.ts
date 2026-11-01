import "@/lib/env-check";
import { prisma } from "@kak-fit/db";
import { getAuthEnvStatus } from "@/lib/env-check";

export const dynamic = "force-dynamic";

const VERSION = "0.2.0";

export async function GET() {
  let db: "connected" | "unavailable";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "connected";
  } catch {
    // Keep database connection details out of the public health response.
    db = "unavailable";
  }

  return Response.json({
    status: db === "connected" ? "ok" : "degraded",
    db,
    auth: getAuthEnvStatus(),
    version: VERSION,
  }, { status: db === "connected" ? 200 : 503 });
}
