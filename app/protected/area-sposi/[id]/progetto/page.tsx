import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export default async function ProgettoFlorealeSposiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("couple_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!membership && profile?.role !== "admin") {
    redirect("/protected");
  }

  const { data: couple } = await supabase
    .from("couples")
    .select(
      "id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name"
    )
    .eq("id", id)
    .maybeSingle();

  if (!couple) redirect("/protected");

  const { data: project, error: projectError } = await supabase
    .from("floral_projects")
    .select("id,name,status,notes,total_amount,created_at,updated_at")
    .eq("couple_id", id)
    .maybeSingle();

  if (projectError || !project) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            href={`/protected/area-sposi/${id}`}
            className="text-sm font-medium underline"
          >
            ← Torna all'Area Sposi
          </Link>
          <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              Progetto floreale
            </h1>
            <p className="mt-3 text-slate-600">
              Il progetto floreale non è ancora disponibile.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const coupleName = [
    couple.partner1_first_name,
    couple.partner1_last_name,
    couple.partner2_first_name,
    couple.partner2_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const totalAmount = Number(project.total_amount || 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <Link
            href={`/protected/area-sposi/${id}`}
            className="text-sm font-medium text-slate-600 underline"
          >
            ← Torna all'Area Sposi
          </Link>
          <p className="mt-6 text-sm text-slate-500">Area riservata sposi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Progetto floreale
          </h1>
          <p className="mt-1 text-slate-600">{coupleName}</p>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {project.name || "Progetto floreale"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Stato: <span className="font-medium text-slate-700">{project.status || "draft"}</span>
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Totale progetto
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                € {totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900">
              Note del progetto
            </h3>
            <div className="mt-3 rounded-xl border bg-slate-50 p-4 text-slate-700">
              {project.notes?.trim() || "Nessuna nota inserita al momento."}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            Questa è la visualizzazione del progetto riservata agli sposi.
            Le modifiche al progetto vengono gestite da Emozioni Floreali.
          </div>
        </section>
      </div>
    </main>
  );
}
