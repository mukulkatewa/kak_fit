import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";

/** Serve the Expo web SPA (same UI as mobile) for all non-API routes. */
export async function GET(_request: NextRequest) {
  const indexPath = join(process.cwd(), "public", "index.html");
  if (!existsSync(indexPath)) {
    return new Response(
      "Kak Fit web UI not built. Run: pnpm export:web && pnpm --filter @kak-fit/web build",
      { status: 503, headers: { "Content-Type": "text/plain" } },
    );
  }
  const html = readFileSync(indexPath, "utf8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
