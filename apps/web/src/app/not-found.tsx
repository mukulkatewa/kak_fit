export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#050508] p-8 text-zinc-100">
      <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">Kak Fit API</p>
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-zinc-400">This route does not exist. Use the mobile app or /api/trpc.</p>
    </main>
  );
}
