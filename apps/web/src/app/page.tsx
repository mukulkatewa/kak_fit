import { getApiCaller } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const api = await getApiCaller();
  const [health, version, exerciseCount] = await Promise.all([
    api.health(),
    api.version(),
    api.exerciseCount(),
  ]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-[#050508] p-8 text-zinc-100">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative text-center">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">Kak Fit API</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Backend is live</h1>
        <p className="mt-3 max-w-lg text-zinc-400">
          This page is the API server — not the mobile app. Open the Expo app on{" "}
          <span className="text-zinc-200">localhost:8081</span> for the premium UI.
        </p>
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-6 shadow-2xl shadow-blue-500/5 backdrop-blur">
        <Row label="Status" value={health.status} highlight />
        <Row label="Phase" value={version.phase} />
        <Row label="Exercises in DB" value={String(exerciseCount.count)} />
        <Row label="Auth" value="/api/auth ✓" />
        <Row label="tRPC" value="/api/trpc ✓" />
      </div>

      <div className="relative max-w-md space-y-2 text-center text-sm text-zinc-500">
        <p>
          <span className="text-zinc-300">Mobile:</span>{" "}
          <code className="rounded bg-zinc-900 px-2 py-1 text-cyan-400">pnpm --filter @kak-fit/mobile start</code>
        </p>
        <p>Demo login: demo@kakfit.app / password123</p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/60 py-3 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className={highlight ? "font-semibold text-emerald-400" : "text-zinc-200"}>{value}</span>
    </div>
  );
}
