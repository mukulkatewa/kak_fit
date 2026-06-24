import { resolvePublicApiBaseUrl } from "@kak-fit/api/lib/public-api-base-url";
import { buildLlmTools } from "@kak-fit/api/public-api/llm-tools";
import { buildDeveloperApiDocsHtml } from "@/lib/developer-api-docs";

export async function GET() {
  const base = resolvePublicApiBaseUrl();
  const llm = buildLlmTools(base);
  const html = buildDeveloperApiDocsHtml(base, llm.claude_system_prompt);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
