import { Suspense } from "react";
import { ProgettoFlorealeContent } from "./progetto-content";

export default function ProgettoFlorealePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            Caricamento progetto floreale...
          </div>
        </div>
      </main>
    }>
      <ProgettoFlorealeContent params={params} />
    </Suspense>
  );
}
