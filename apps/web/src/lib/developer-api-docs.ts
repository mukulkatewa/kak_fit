function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Param = { name: string; in: "query" | "path"; type: string; req?: boolean; note?: string };
type Endpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  desc: string;
  params?: Param[];
  body?: string;
  response?: string;
};

function ep(
  method: Endpoint["method"],
  path: string,
  desc: string,
  opts: Omit<Endpoint, "method" | "path" | "desc"> = {},
): Endpoint {
  return { method, path, desc, ...opts };
}

const GROUPS: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: "Users",
    endpoints: [
      ep("GET", "/user/info", "User profile, weight_unit, subscription_tier, workout_count", {
        response: `{"user":{"id":"…","name":"Kate","email":"…","weight_unit":"kg","subscription_tier":"free","member_since":"2026-01-01T00:00:00.000Z","workout_count":42}}`,
      }),
    ],
  },
  {
    title: "Workouts",
    endpoints: [
      ep("GET", "/workouts", "List completed workouts (newest first)", {
        params: [
          { name: "page", in: "query", type: "integer", note: "default 1" },
          { name: "pageSize", in: "query", type: "integer", note: "default 10, max 50" },
        ],
        response: `{"page":1,"page_size":10,"page_count":3,"total_count":25,"data":[{"id":"…","title":"Push Day","start_time":"…","end_time":"…","exercises":[…]}]}`,
      }),
      ep("POST", "/workouts", "Log a completed workout", {
        body: `{"workout":{"title":"Push Day","start_time":"2026-06-24T10:00:00Z","end_time":"2026-06-24T11:00:00Z","exercises":[{"exercise_name":"Bench Press","sets":[{"reps":8,"weight_kg":80,"type":"normal","rpe":8}]}]}}`,
        response: `{"workout":{"id":"…","title":"Push Day","exercises":[…]}}`,
      }),
      ep("GET", "/workouts/count", "Total completed workout count", {
        response: `{"workout_count":25}`,
      }),
      ep("GET", "/workouts/events", "Create/update/delete events since a timestamp", {
        params: [
          { name: "since", in: "query", type: "string (ISO8601)", req: true },
          { name: "page", in: "query", type: "integer" },
          { name: "pageSize", in: "query", type: "integer" },
        ],
        response: `{"page":1,"page_size":10,"total_count":2,"data":[{"type":"updated","workout":{…}},{"type":"deleted","workout_id":"…","deleted_at":"…"}]}`,
      }),
      ep("GET", "/workouts/{workoutId}", "Get one workout with exercises and sets", {
        params: [{ name: "workoutId", in: "path", type: "string", req: true }],
        response: `{"workout":{"id":"…","title":"Push Day","exercises":[…]}}`,
      }),
      ep("PUT", "/workouts/{workoutId}", "Update workout (replaces exercises when sent)", {
        params: [{ name: "workoutId", in: "path", type: "string", req: true }],
        body: `{"workout":{"title":"Push Day","exercises":[{"exercise_template_id":"…","sets":[{"reps":10,"weight_kg":75}]}]}}`,
        response: `{"workout":{…}}`,
      }),
    ],
  },
  {
    title: "Routines",
    endpoints: [
      ep("GET", "/routines", "List routines", {
        params: [
          { name: "page", in: "query", type: "integer" },
          { name: "pageSize", in: "query", type: "integer" },
        ],
        response: `{"page":1,"page_size":10,"total_count":4,"data":[{"id":"…","title":"Push Day","exercises":[…]}]}`,
      }),
      ep("POST", "/routines", "Create a routine", {
        body: `{"routine":{"title":"Push Day","notes":"Chest focus","folder_id":null,"exercises":[]}}`,
        response: `{"routine":{"id":"…","title":"Push Day"}}`,
      }),
      ep("GET", "/routines/search", "Search routines by title", {
        params: [{ name: "q", in: "query", type: "string", req: true }],
        response: `{"routines":[{"id":"…","title":"Push Day"}]}`,
      }),
      ep("GET", "/routines/{routineId}", "Get routine with target sets", {
        params: [{ name: "routineId", in: "path", type: "string", req: true }],
        response: `{"routine":{"id":"…","title":"Push Day","exercises":[…]}}`,
      }),
      ep("PUT", "/routines/{routineId}", "Update routine (full replace if exercises sent)", {
        params: [{ name: "routineId", in: "path", type: "string", req: true }],
        body: `{"routine":{"title":"Push Day","exercises":[{"exercise_name":"Bench Press","sets":[{"reps":8,"weight_kg":80}]}]}}`,
        response: `{"routine":{…}}`,
      }),
      ep("DELETE", "/routines/{routineId}", "Delete a routine", {
        params: [{ name: "routineId", in: "path", type: "string", req: true }],
        response: `{"success":true,"message":"Deleted routine \\"Push Day\\""}`,
      }),
      ep("POST", "/routines/{routineId}/exercises", "Add exercise — exercise_name fuzzy-matches, no ID needed", {
        params: [{ name: "routineId", in: "path", type: "string", req: true }],
        body: `{"exercise":{"exercise_name":"Romanian Deadlift","notes":"3 sec eccentric","sets":[{"reps":12,"weight_kg":100}]}}`,
        response: `{"message":"Added Romanian Deadlift to Leg Day","routine_exercise":{"id":"…","exercise_name":"Romanian Deadlift"}}`,
      }),
      ep("PATCH", "/routines/{routineId}/exercises/{routineExerciseId}", "Update sets or notes", {
        params: [
          { name: "routineId", in: "path", type: "string", req: true },
          { name: "routineExerciseId", in: "path", type: "string", req: true },
        ],
        body: `{"exercise":{"sets":[{"reps":12,"weight_kg":105}],"notes":"Pause at bottom"}}`,
        response: `{"message":"Updated …","routine_exercise":{…}}`,
      }),
      ep("DELETE", "/routines/{routineId}/exercises/{routineExerciseId}", "Remove exercise from routine", {
        params: [
          { name: "routineId", in: "path", type: "string", req: true },
          { name: "routineExerciseId", in: "path", type: "string", req: true },
        ],
        response: `{"success":true,"message":"Removed …"}`,
      }),
    ],
  },
  {
    title: "Routine Folders",
    endpoints: [
      ep("GET", "/routine_folders", "List folders", {
        params: [
          { name: "page", in: "query", type: "integer" },
          { name: "pageSize", in: "query", type: "integer" },
        ],
        response: `{"page":1,"data":[{"id":"…","title":"Hypertrophy","created_at":"…"}]}`,
      }),
      ep("POST", "/routine_folders", "Create folder", {
        body: `{"routine_folder":{"title":"Hypertrophy"}}`,
        response: `{"routine_folder":{"id":"…","title":"Hypertrophy"}}`,
      }),
      ep("GET", "/routine_folders/{folderId}", "Get folder", {
        params: [{ name: "folderId", in: "path", type: "string", req: true }],
        response: `{"routine_folder":{"id":"…","title":"Hypertrophy"}}`,
      }),
      ep("PUT", "/routine_folders/{folderId}", "Rename folder", {
        params: [{ name: "folderId", in: "path", type: "string", req: true }],
        body: `{"routine_folder":{"title":"Strength"}}`,
        response: `{"routine_folder":{"id":"…","title":"Strength"}}`,
      }),
      ep("DELETE", "/routine_folders/{folderId}", "Delete folder (routines kept, unassigned)", {
        params: [{ name: "folderId", in: "path", type: "string", req: true }],
        response: `{"success":true,"message":"Deleted folder \\"Hypertrophy\\""}`,
      }),
    ],
  },
  {
    title: "Exercise Templates",
    endpoints: [
      ep("GET", "/exercise_templates", "List catalog + your custom exercises", {
        params: [
          { name: "page", in: "query", type: "integer" },
          { name: "pageSize", in: "query", type: "integer" },
        ],
        response: `{"page":1,"data":[{"id":"…","title":"Bench Press","category":"Chest","is_custom":false}]}`,
      }),
      ep("POST", "/exercise_templates", "Create custom exercise", {
        body: `{"exercise_template":{"title":"Cable Fly","instructions":"Elbows slightly bent"}}`,
        response: `{"exercise_template":{"id":"…","title":"Cable Fly","is_custom":true}}`,
      }),
      ep("GET", "/exercise_templates/search", "Search by name", {
        params: [{ name: "q", in: "query", type: "string", req: true }],
        response: `{"exercises":[{"id":"…","title":"Bench Press"}]}`,
      }),
      ep("GET", "/exercise_templates/{exerciseTemplateId}", "Get one template", {
        params: [{ name: "exerciseTemplateId", in: "path", type: "string", req: true }],
        response: `{"exercise_template":{"id":"…","title":"Bench Press","primary_muscles":["Chest"]}}`,
      }),
    ],
  },
  {
    title: "Exercise History",
    endpoints: [
      ep("GET", "/exercise_history/{exerciseTemplateId}", "Paginated completed sets for an exercise", {
        params: [
          { name: "exerciseTemplateId", in: "path", type: "string", req: true },
          { name: "page", in: "query", type: "integer" },
          { name: "pageSize", in: "query", type: "integer" },
        ],
        response: `{"page":1,"data":[{"workout_id":"…","workout_title":"Push","date":"…","weight_kg":80,"reps":8,"rpe":8}]}`,
      }),
    ],
  },
  {
    title: "Personal Records",
    endpoints: [
      ep("GET", "/personal_records", "List PRs, optionally by exercise", {
        params: [
          { name: "page", in: "query", type: "integer" },
          { name: "pageSize", in: "query", type: "integer" },
          { name: "exercise_template_id", in: "query", type: "string", note: "optional filter" },
        ],
        response: `{"page":1,"data":[{"exercise_name":"Bench Press","type":"weight","value":100,"achieved_at":"…"}]}`,
      }),
    ],
  },
  {
    title: "Body Measurements",
    endpoints: [
      ep("GET", "/body_measurements", "List measurements", {
        params: [
          { name: "page", in: "query", type: "integer" },
          { name: "pageSize", in: "query", type: "integer" },
        ],
        response: `{"page":1,"data":[{"date":"2026-06-24","weight_kg":80,"body_fat_percentage":15}]}`,
      }),
      ep("POST", "/body_measurements", "Log measurement (409 if date exists — use PUT)", {
        body: `{"body_measurement":{"date":"2026-06-24","weight_kg":80,"body_fat_percentage":15,"waist_cm":82}}`,
        response: `{"body_measurement":{"id":"…","date":"2026-06-24","weight_kg":80}}`,
      }),
      ep("GET", "/body_measurements/{date}", "Get by date (YYYY-MM-DD)", {
        params: [{ name: "date", in: "path", type: "string", req: true }],
        response: `{"body_measurement":{"date":"2026-06-24","weight_kg":80}}`,
      }),
      ep("PUT", "/body_measurements/{date}", "Update measurement for date", {
        params: [{ name: "date", in: "path", type: "string", req: true }],
        body: `{"body_measurement":{"weight_kg":79.5,"body_fat_percentage":14.5}}`,
        response: `{"body_measurement":{…}}`,
      }),
    ],
  },
];

const METHOD_CLASS: Record<string, string> = {
  GET: "m-get",
  POST: "m-post",
  PUT: "m-put",
  PATCH: "m-patch",
  DELETE: "m-del",
};

function paramsTable(params: Param[]) {
  const rows = params
    .map(
      (p) =>
        `<tr><td><code>${esc(p.name)}</code></td><td>${p.in}</td><td>${esc(p.type)}</td><td>${p.req ? "yes" : "no"}</td><td>${esc(p.note ?? "")}</td></tr>`,
    )
    .join("");
  return `<table class="params"><thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderEndpoint(e: Endpoint) {
  const detail: string[] = [];
  if (e.params?.length) {
    detail.push(`<p class="lbl">Parameters</p>${paramsTable(e.params)}`);
  }
  if (e.body) {
    detail.push(`<p class="lbl">Request body</p><pre class="code">${esc(e.body)}</pre>`);
  }
  if (e.response) {
    detail.push(`<p class="lbl">Response example</p><pre class="code">${esc(e.response)}</pre>`);
  }
  const hasDetail = detail.length > 0;
  return `<details class="endpoint">
  <summary class="ep-sum">
    <span class="badge ${METHOD_CLASS[e.method]}">${e.method}</span>
    <code class="path">${esc(e.path)}</code>
    <span class="ep-desc">${esc(e.desc)}</span>
  </summary>
  ${hasDetail ? `<div class="ep-body">${detail.join("")}</div>` : ""}
</details>`;
}

function renderGroup(g: { title: string; endpoints: Endpoint[] }) {
  return `<details class="group" open>
  <summary class="group-sum">${esc(g.title)} <span class="count">${g.endpoints.length}</span></summary>
  <div class="group-body">${g.endpoints.map(renderEndpoint).join("")}</div>
</details>`;
}

export function buildDeveloperApiDocsHtml(base: string, claudePrompt: string) {
  const api = `${base}/api/v1`;
  const curl = `curl -H "api-key: YOUR_KEY" "${api}/workouts?pageSize=5"`;
  const shortPrompt =
    "You are a fitness assistant with access to the user's Kak Fit account via REST API. Always send the api-key header. Use exercise_name (fuzzy matched) so IDs aren't needed. Confirm changes in plain language.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Kak Fit Developer API</title>
<style>
:root{--bg:#050508;--surface:#0f1117;--border:#1e2430;--text:#e8e8ec;--muted:#9aa6b2;--accent:#22d3ee;--accent-dim:#0e7490}
*{box-sizing:border-box}
body{margin:0;font:15px/1.55 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text)}
.wrap{max-width:760px;margin:0 auto;padding:1.5rem 1rem 3rem}
h1{font-size:1.75rem;margin:0 0 .35rem;color:var(--accent)}
.sub{color:var(--muted);margin:0 0 1rem}
.pills{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem}
.pill{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:.35rem .85rem;font-size:.8rem;cursor:pointer;color:var(--text)}
.pill:hover{border-color:var(--accent)}
.pill code{font-size:.78rem}
h2{font-size:1.1rem;color:#a5f3fc;margin:2rem 0 .75rem;border-bottom:1px solid var(--border);padding-bottom:.35rem}
.steps{counter-reset:step;list-style:none;padding:0;margin:0}
.steps li{counter-increment:step;padding:.5rem 0 .5rem 2rem;position:relative;color:var(--muted)}
.steps li::before{content:counter(step);position:absolute;left:0;width:1.4rem;height:1.4rem;background:var(--surface);border:1px solid var(--border);border-radius:50%;font-size:.75rem;line-height:1.4rem;text-align:center;color:var(--accent)}
pre.code{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.85rem 1rem;overflow-x:auto;font-size:.8rem;margin:.5rem 0 1rem}
.curl-wrap{position:relative}
.btn-copy{position:absolute;top:.5rem;right:.5rem;background:#1a2030;border:1px solid var(--border);color:var(--accent);font-size:.7rem;padding:.25rem .55rem;border-radius:4px;cursor:pointer}
.btn-copy:hover{background:#222a3a}
a{color:var(--accent)}
.group{border:1px solid var(--border);border-radius:10px;margin-bottom:.75rem;background:#0a0c12}
.group-sum{padding:.85rem 1rem;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;gap:.5rem}
.group-sum::-webkit-details-marker{display:none}
.count{font-size:.7rem;background:var(--surface);padding:.1rem .45rem;border-radius:999px;color:var(--muted);font-weight:400}
.group-body{border-top:1px solid var(--border)}
.endpoint{border-top:1px solid var(--border)}
.endpoint:first-child{border-top:none}
.ep-sum{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;padding:.65rem 1rem;cursor:pointer;list-style:none}
.ep-sum::-webkit-details-marker{display:none}
.badge{font-size:.65rem;font-weight:700;padding:.2rem .45rem;border-radius:4px;letter-spacing:.03em}
.m-get{background:#1e3a5f;color:#7dd3fc}.m-post{background:#14532d;color:#86efac}
.m-put{background:#78350f;color:#fcd34d}.m-patch{background:#4c1d95;color:#c4b5fd}
.m-del{background:#7f1d1d;color:#fca5a5}
.path{font-size:.82rem;color:var(--text)}
.ep-desc{flex:1 1 100%;font-size:.8rem;color:var(--muted);padding-left:0}
@media(min-width:520px){.ep-desc{flex:1;padding-left:0}}
.ep-body{padding:0 1rem .85rem}
.lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:.5rem 0 .25rem}
.params{width:100%;border-collapse:collapse;font-size:.78rem;margin-bottom:.5rem}
.params th,.params td{border:1px solid var(--border);padding:.35rem .5rem;text-align:left}
.params th{background:var(--surface);color:var(--muted)}
.note{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;font-size:.85rem;color:var(--muted);margin:1rem 0}
.errors{display:grid;gap:.35rem;font-size:.85rem}
.err{display:flex;gap:.75rem}.err code{min-width:2.5rem}
.llm-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-top:.75rem}
.toast{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#1a2030;border:1px solid var(--accent);color:var(--accent);padding:.45rem 1rem;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.show{opacity:1}
footer{margin-top:2.5rem;font-size:.8rem;color:var(--muted)}
@media(max-width:480px){.wrap{padding:1rem .75rem 2rem}h1{font-size:1.45rem}}
</style>
</head>
<body>
<div class="wrap">
<header>
<h1>Kak Fit Developer API</h1>
<p class="sub">Hevy-compatible REST API. Pro users only in production.</p>
<div class="pills">
<button type="button" class="pill" data-copy="${esc(api)}">Base URL: <code>${esc(api)}</code></button>
<button type="button" class="pill" data-copy="api-key: kak_…">Auth: <code>api-key: kak_…</code></button>
<a class="pill" href="${esc(api)}/openapi.json" style="text-decoration:none">OpenAPI JSON ↗</a>
</div>
</header>

<h2>Getting started</h2>
<ol class="steps">
<li>Generate an API key in the app: <strong>Settings → Developer API</strong></li>
<li>Copy the base URL pill above (<code>${esc(api)}</code>)</li>
<li>Send <code>api-key: kak_…</code> on every request</li>
<li>Use with AI — give your key + system prompt to Claude, ChatGPT, or Gemini. Tool definitions: <a href="${esc(api)}/llm-tools">${esc(api)}/llm-tools</a></li>
</ol>
<div class="curl-wrap">
<button type="button" class="btn-copy" data-copy="${esc(curl)}">Copy</button>
<pre class="code">${esc(curl)}</pre>
</div>

<h2>Endpoint reference</h2>
${GROUPS.map(renderGroup).join("")}

<p style="margin:1.25rem 0">
  <strong>Machine-readable spec:</strong>
  <a href="${esc(api)}/openapi.json">OpenAPI 3.0 JSON</a> —
  import into Postman or use with LLM function calling tools.
</p>

<h2>Pagination</h2>
<div class="note">List endpoints return <code>{ page, page_size, page_count, total_count, data: [...] }</code>. Default <code>pageSize</code> is 10; maximum is 50.</div>

<h2>Error codes</h2>
<div class="errors">
<div class="err"><code>401</code><span>Missing or invalid <code>api-key</code></span></div>
<div class="err"><code>403</code><span>Developer API requires Pro (<code>DEVELOPER_API_REQUIRE_PRO=true</code>)</span></div>
<div class="err"><code>404</code><span>Resource not found</span></div>
<div class="err"><code>409</code><span>Body measurement already exists for that date — use PUT</span></div>
<div class="err"><code>400</code><span>Validation error (missing required field, bad JSON, etc.)</span></div>
</div>

<h2>Use with LLMs</h2>
<div class="llm-card">
<p><strong>GET</strong> <a href="${esc(api)}/llm-tools"><code>${esc(api)}/llm-tools</code></a> — JSON tool definitions plus <code>gemini_system_prompt</code>, <code>claude_system_prompt</code>, and <code>openai_system_prompt</code>.</p>
<p class="lbl">Quick system prompt (Claude / ChatGPT)</p>
<div class="curl-wrap">
<button type="button" class="btn-copy" data-copy="${esc(shortPrompt)}">Copy</button>
<pre class="code">${esc(shortPrompt)}</pre>
</div>
<button type="button" class="btn-copy" style="position:static;margin-bottom:.5rem" data-copy="${esc(claudePrompt)}">Copy full Claude prompt</button>
<ol class="steps" style="margin-top:1rem">
<li>Get your API key in Settings → Developer API</li>
<li>Open Claude, ChatGPT, or Gemini</li>
<li>Paste your key and the system prompt above</li>
<li>Say: <em>&quot;Add Romanian deadlifts 3×12 to my Leg Day routine&quot;</em> or <em>&quot;Show me my recent workouts&quot;</em></li>
</ol>
</div>

<footer>Shape inspired by <a href="https://api.hevyapp.com/docs/">Hevy API docs</a>. Machine-readable spec: <a href="${esc(api)}/openapi.json">openapi.json</a></footer>
</div>
<div class="toast" id="toast">Copied</div>
<script>
(function(){
  var t=document.getElementById("toast"),tm;
  function toast(){clearTimeout(tm);t.classList.add("show");tm=setTimeout(function(){t.classList.remove("show")},1400)}
  document.querySelectorAll("[data-copy]").forEach(function(el){
    el.addEventListener("click",function(){
      var v=el.getAttribute("data-copy")||"";
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(v).then(toast);
      }else{toast()}
    });
  });
})();
</script>
</body>
</html>`;
}
