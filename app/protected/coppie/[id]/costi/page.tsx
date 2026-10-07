import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = [
  ["fiori", "Costo fiori"],
  ["materiali_consumo", "Materiali di consumo"],
  ["noleggio_strutture", "Noleggio strutture"],
  ["noleggio_furgoni", "Noleggio furgoni"],
  ["manodopera_aggiuntiva", "Manodopera aggiuntiva"],
  ["altri_costi", "Altri costi"],
] as const;

const STATUSES = [
  ["da_affrontare", "Da affrontare"],
  ["parzialmente_pagato", "Parzialmente pagato"],
  ["pagato", "Pagato"],
] as const;

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/protected");
  return { supabase, user };
}

async function addExpense(formData: FormData) {
  "use server";
  const { supabase, user } = await adminClient();
  const coupleId = String(formData.get("couple_id") || "");
  const weddingId = String(formData.get("wedding_id") || "");
  const projectId = String(formData.get("floral_project_id") || "") || null;
  const category = String(formData.get("category") || "");
  const description = String(formData.get("description") || "").trim();
  const estimated = Number(String(formData.get("estimated_amount") || "0").replace(",", "."));
  const actual = Number(String(formData.get("actual_amount") || "0").replace(",", "."));
  const status = String(formData.get("status") || "da_affrontare");
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!coupleId || !weddingId || !category || !description) return;
  if (!Number.isFinite(estimated) || estimated < 0 || !Number.isFinite(actual) || actual < 0) {
    throw new Error("Importi non validi.");
  }

  const { error } = await supabase.from("wedding_internal_expenses").insert({
    couple_id: coupleId,
    wedding_id: weddingId,
    floral_project_id: projectId,
    category,
    description,
    estimated_amount: estimated,
    actual_amount: actual,
    status,
    notes,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/coppie/${coupleId}/costi`);
  revalidatePath(`/protected/coppie/${coupleId}`);
  redirect(`/protected/coppie/${coupleId}/costi?saved=1`);
}

async function updateExpense(formData: FormData) {
  "use server";
  const { supabase } = await adminClient();
  const coupleId = String(formData.get("couple_id") || "");
  const expenseId = String(formData.get("expense_id") || "");
  const category = String(formData.get("category") || "");
  const description = String(formData.get("description") || "").trim();
  const estimated = Number(String(formData.get("estimated_amount") || "0").replace(",", "."));
  const actual = Number(String(formData.get("actual_amount") || "0").replace(",", "."));
  const status = String(formData.get("status") || "da_affrontare");
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!coupleId || !expenseId || !category || !description) return;
  if (!Number.isFinite(estimated) || estimated < 0 || !Number.isFinite(actual) || actual < 0) {
    throw new Error("Importi non validi.");
  }

  const { error } = await supabase.from("wedding_internal_expenses").update({
    category,
    description,
    estimated_amount: estimated,
    actual_amount: actual,
    status,
    notes,
    updated_at: new Date().toISOString(),
  }).eq("id", expenseId).eq("couple_id", coupleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/coppie/${coupleId}/costi`);
  redirect(`/protected/coppie/${coupleId}/costi?saved=1`);
}

async function deleteExpense(formData: FormData) {
  "use server";
  const { supabase } = await adminClient();
  const coupleId = String(formData.get("couple_id") || "");
  const expenseId = String(formData.get("expense_id") || "");
  if (!coupleId || !expenseId) return;

  const { error } = await supabase
    .from("wedding_internal_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("couple_id", coupleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/coppie/${coupleId}/costi`);
  redirect(`/protected/coppie/${coupleId}/costi?saved=1`);
}

function euro(value: number | null | undefined) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export default async function CostiMatrimonioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  await connection();
  const { id: coupleId } = await params;
  const query = searchParams ? await searchParams : {};
  const { supabase } = await adminClient();

  const { data: couple } = await supabase
    .from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name")
    .eq("id", coupleId)
    .maybeSingle();

  if (!couple) redirect("/protected/coppie");

  const { data: weddings } = await supabase
    .from("weddings")
    .select("id,wedding_date,wedding_time,venue,church,reception_hall")
    .eq("couple_id", coupleId)
    .order("wedding_date", { ascending: true })
    .limit(1);

  const wedding = weddings?.[0];
  if (!wedding) redirect(`/protected/coppie/${coupleId}/matrimonio`);

  const { data: project } = await supabase
    .from("floral_projects")
    .select("id,total_amount")
    .eq("couple_id", coupleId)
    .maybeSingle();

  const { data: latestQuote } = await supabase
    .from("quotes")
    .select("id,version_number,status,total_amount")
    .eq("couple_id", coupleId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: expenses } = await supabase
    .from("wedding_internal_expenses")
    .select("id,category,description,estimated_amount,actual_amount,status,notes,sort_order")
    .eq("couple_id", coupleId)
    .eq("wedding_id", wedding.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = expenses || [];
  const estimatedTotal = rows.reduce((sum, row) => sum + Number(row.estimated_amount || 0), 0);
  const actualTotal = rows.reduce((sum, row) => sum + Number(row.actual_amount || 0), 0);
  const referenceRevenue = Number(latestQuote?.total_amount ?? project?.total_amount ?? 0);
  const estimatedMargin = referenceRevenue - estimatedTotal;
  const actualMargin = referenceRevenue - actualTotal;

  const coupleName =
    `${couple.partner1_first_name} ${couple.partner1_last_name} & ${couple.partner2_first_name} ${couple.partner2_last_name}`;

  const categoryLabel = (key: string) =>
    CATEGORIES.find(([value]) => value === key)?.[1] || key;

  const statusLabel = (key: string) =>
    STATUSES.find(([value]) => value === key)?.[1] || key;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <Link href={`/protected/coppie/${coupleId}`} className="text-sm underline">
            ← Torna alla scheda coppia
          </Link>
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                Area professionale riservata
              </p>
              <h1 className="text-3xl font-bold">Costi e rendiconto</h1>
              <p className="mt-1 text-slate-600">{coupleName}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              🔒 Visibile esclusivamente a te
            </div>
          </div>
        </div>

        {query.saved && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
            ✓ Rendiconto aggiornato correttamente.
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Totale costi previsti</p>
            <p className="mt-2 text-2xl font-bold">{euro(estimatedTotal)}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Totale costi effettivi</p>
            <p className="mt-2 text-2xl font-bold">{euro(actualTotal)}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Ricavo di riferimento</p>
            <p className="mt-2 text-2xl font-bold">{euro(referenceRevenue)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {latestQuote ? `Preventivo v${latestQuote.version_number} • ${latestQuote.status}` : "Totale progetto"}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Margine previsto</p>
            <p className="mt-2 text-2xl font-bold">{euro(estimatedMargin)}</p>
            <p className="mt-1 text-xs text-slate-500">Margine su ricavo di riferimento meno costi previsti</p>
          </div>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Nuova voce di costo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Inserisci le spese interne previste per questa cerimonia. Non vengono mai trasferite al preventivo o mostrate alla coppia.
          </p>

          <form action={addExpense} className="mt-5 grid gap-4 md:grid-cols-6">
            <input type="hidden" name="couple_id" value={coupleId} />
            <input type="hidden" name="wedding_id" value={wedding.id} />
            <input type="hidden" name="floral_project_id" value={project?.id || ""} />

            <select name="category" defaultValue="fiori" className="rounded-xl border bg-white px-4 py-3">
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input required name="description" placeholder="Descrizione (es. rose bianche)" className="rounded-xl border px-4 py-3 md:col-span-2" />
            <input required name="estimated_amount" type="number" min="0" step="0.01" placeholder="Costo previsto €" className="rounded-xl border px-4 py-3" />
            <input name="actual_amount" type="number" min="0" step="0.01" defaultValue="0" placeholder="Costo effettivo €" className="rounded-xl border px-4 py-3" />
            <select name="status" defaultValue="da_affrontare" className="rounded-xl border bg-white px-4 py-3">
              {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input name="notes" placeholder="Note" className="rounded-xl border px-4 py-3 md:col-span-4" />
            <button className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white md:col-span-2">
              + Aggiungi costo
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Rendiconto spese</h2>
              <p className="text-sm text-slate-500">
                Matrimonio del {new Date(wedding.wedding_date).toLocaleDateString("it-IT")}
                {wedding.venue ? ` • ${wedding.venue}` : ""}
              </p>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              Margine attuale: {euro(actualMargin)}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
                Nessuna spesa inserita. Aggiungi la prima voce qui sopra.
              </div>
            ) : rows.map((row) => (
              <div key={row.id} className="rounded-2xl border bg-slate-50 p-4">
                <form action={updateExpense} className="grid gap-3 md:grid-cols-12 md:items-center">
                  <input type="hidden" name="couple_id" value={coupleId} />
                  <input type="hidden" name="expense_id" value={row.id} />

                  <select name="category" defaultValue={row.category} className="rounded-lg border bg-white px-3 py-2 md:col-span-2">
                    {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input name="description" defaultValue={row.description} className="rounded-lg border bg-white px-3 py-2 md:col-span-3" />
                  <input name="estimated_amount" type="number" min="0" step="0.01" defaultValue={row.estimated_amount} className="rounded-lg border bg-white px-3 py-2" />
                  <input name="actual_amount" type="number" min="0" step="0.01" defaultValue={row.actual_amount} className="rounded-lg border bg-white px-3 py-2" />
                  <select name="status" defaultValue={row.status} className="rounded-lg border bg-white px-3 py-2 md:col-span-2">
                    {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input name="notes" defaultValue={row.notes || ""} placeholder="Note" className="rounded-lg border bg-white px-3 py-2 md:col-span-2" />

                  <div className="flex gap-2 md:col-span-12 md:justify-end">
                    <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salva modifica</button>
                  </div>
                </form>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
                  <div className="text-slate-600">
                    <span className="font-semibold">{categoryLabel(row.category)}</span>
                    {" • "}
                    {statusLabel(row.status)}
                    {" • "}
                    Scostamento: {euro(Number(row.actual_amount || 0) - Number(row.estimated_amount || 0))}
                  </div>
                  <form action={deleteExpense}>
                    <input type="hidden" name="couple_id" value={coupleId} />
                    <input type="hidden" name="expense_id" value={row.id} />
                    <button className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">
                      Elimina
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-bold text-amber-950">Logica economica interna</h2>
          <p className="mt-2 text-sm text-amber-900">
            Queste spese sono collegate al matrimonio e, quando disponibile, al Progetto Floreale. Sono dati gestionali interni: non entrano nel preventivo, non entrano nel contratto e non sono accessibili all'area sposi.
          </p>
        </section>
      </div>
    </main>
  );
}
