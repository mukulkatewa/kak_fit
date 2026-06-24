import { resolvePublicApiBaseUrl } from "@kak-fit/api/lib/public-api-base-url";
import { buildLlmTools } from "@kak-fit/api/public-api/llm-tools";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const base = resolvePublicApiBaseUrl();
  const llm = buildLlmTools(base);
  const systemPrompt = escapeHtml(llm.claude_system_prompt);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Kak Fit Developer API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #e8e8ec; background: #050508; }
    h1 { color: #22d3ee; }
    h2 { color: #a5f3fc; margin-top: 2rem; }
    h3 { color: #e8e8ec; font-size: 1rem; margin-top: 1.25rem; }
    code { background: #12121a; padding: 0.15rem 0.4rem; border-radius: 4px; }
    pre { background: #12121a; padding: 1rem; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; font-size: 0.875rem; }
    a { color: #22d3ee; }
    li { margin: 0.35rem 0; }
    ol { padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>Kak Fit Developer API</h1>
  <p>Hevy-compatible REST API for Pro users. Generate keys in the mobile app under <strong>Settings → Developer API</strong>.</p>
  <p>Base URL: <code>${base}/api/v1</code></p>
  <p>Auth header: <code>api-key: kak_…</code></p>
  <p>
    <a href="${base}/api/v1/openapi.json"><strong>OpenAPI JSON spec</strong></a>
    — import into Postman or use with LLM function calling
  </p>
  <h2>Example</h2>
  <pre>curl -H "api-key: YOUR_KEY" \\
  "${base}/api/v1/workouts?page=1&amp;pageSize=10"</pre>
  <h2>Endpoints</h2>
  <ul>
    <li><code>GET /user/info</code></li>
    <li><code>GET|POST /workouts</code> · <code>GET /workouts/count</code> · <code>GET /workouts/events</code></li>
    <li><code>GET|PUT /workouts/{id}</code></li>
    <li><code>GET|POST /routines</code> · <code>GET|PUT|DELETE /routines/{id}</code></li>
    <li><code>GET|POST /routine_folders</code> · <code>GET|PUT|DELETE /routine_folders/{id}</code></li>
    <li><code>GET|POST /exercise_templates</code> · <code>GET /exercise_templates/{id}</code></li>
    <li><code>GET /exercise_history/{exerciseTemplateId}</code></li>
    <li><code>GET /personal_records</code></li>
    <li><code>GET|POST /body_measurements</code> · <code>GET|PUT /body_measurements/{date}</code></li>
  </ul>

  <h2>Use with AI</h2>
  <p>
  Connect Claude or ChatGPT to your Kak Fit account so you can manage workouts and routines in plain English
  (e.g. &quot;add incline bench 3×10 to Push Day&quot;).
  </p>
  <ol>
    <li>
      In the Kak Fit app, open <strong>Settings → Developer API</strong>. Copy your
      <strong>API key</strong> (<code>kak_…</code>) and note the <strong>base URL</strong>
      (<code>${base}/api/v1</code>).
    </li>
    <li>
      Paste the system prompt below into your AI assistant&apos;s custom instructions
      (Claude: Project instructions or system prompt; ChatGPT: Custom GPT instructions).
    </li>
    <li>
      Give the model HTTP access to the API — e.g. Claude with web fetch / custom connector,
      ChatGPT with Actions or a browsing plugin — using header <code>api-key: YOUR_KEY</code>
      on every request to <code>${base}/api/v1</code>.
    </li>
    <li>
      Optional: import the
      <a href="${base}/api/v1/openapi.json">OpenAPI spec</a> into Postman or point your
      agent at the machine-readable tool manifest:
      <a href="${base}/api/v1/llm-tools"><code>${base}/api/v1/llm-tools</code></a>
    </li>
  </ol>

  <h3>Claude &amp; ChatGPT system prompt</h3>
  <p>Copy everything in the box below into your assistant&apos;s instructions:</p>
  <pre>${systemPrompt}</pre>

  <p>Reference: <a href="https://api.hevyapp.com/docs/">Hevy API docs</a> (similar shape).</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
