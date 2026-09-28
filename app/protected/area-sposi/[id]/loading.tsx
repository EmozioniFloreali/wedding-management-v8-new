export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    </main>
  );
}
