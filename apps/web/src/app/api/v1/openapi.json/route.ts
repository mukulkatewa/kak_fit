import { buildOpenApiDocument } from "@kak-fit/api/public-api/openapi";
import { resolvePublicApiBaseUrl } from "@kak-fit/api/lib/public-api-base-url";

export async function GET() {
  const spec = buildOpenApiDocument(resolvePublicApiBaseUrl());
  return Response.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
