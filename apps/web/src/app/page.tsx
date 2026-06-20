import { getApiCaller } from "@/trpc/server";

export default async function Home() {
  const api = await getApiCaller();
  const health = await api.health();
  const version = await api.version();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-zinc-100">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
          Kak Fit API
        </p>
        <h1 className="mt-3 text-4xl font-bold">Workout Tracker Backend</h1>
        <p className="mt-2 text-zinc-400">
          Hevy-style fitness app — mobile-first, lower price
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">API Status</span>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-400">
            {health.status}
          </span>
        </div>
        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>
            <span className="text-zinc-500">Service:</span> {health.service}
          </p>
          <p>
            <span className="text-zinc-500">Version:</span> {version.version}
          </p>
          <p>
            <span className="text-zinc-500">Phase:</span> {version.phase}
          </p>
          <p>
            <span className="text-zinc-500">Timestamp:</span> {health.timestamp}
          </p>
        </div>
      </div>

      <p className="max-w-md text-center text-sm text-zinc-500">
        React Native app connects here via tRPC. See docs/PROJECT_ROADMAP.md for
        the full build plan.
      </p>
    </main>
  );
}
