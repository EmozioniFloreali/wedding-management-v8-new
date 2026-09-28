export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-slate-200" />

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
