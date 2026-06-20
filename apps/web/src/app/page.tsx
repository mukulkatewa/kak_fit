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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-zinc-100">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Kak Fit API</p>
        <h1 className="mt-3 text-4xl font-bold">Phase 1 — Workout Engine</h1>
        <p className="mt-2 text-zinc-400">Auth • Exercises • Routines • Workout Logger • PRs</p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-3">
        <Row label="Status" value={health.status} highlight />
        <Row label="Phase" value={version.phase} />
        <Row label="Exercises in DB" value={String(exerciseCount.count)} />
        <Row label="Auth endpoint" value="/api/auth" />
        <Row label="tRPC endpoint" value="/api/trpc" />
      </div>

      <p className="max-w-md text-center text-sm text-zinc-500">
        Run the Expo app and sign in with demo@kakfit.app / password123
      </p>
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={highlight ? "text-emerald-400 font-medium" : "text-zinc-300"}>{value}</span>
    </div>
  );
}
