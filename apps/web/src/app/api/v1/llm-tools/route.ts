import { buildLlmTools } from "@kak-fit/api/public-api/llm-tools";
import { resolvePublicApiBaseUrl } from "@kak-fit/api/lib/public-api-base-url";

export async function GET() {
  return Response.json(buildLlmTools(resolvePublicApiBaseUrl()));
}
