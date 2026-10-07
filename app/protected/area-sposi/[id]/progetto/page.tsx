import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SECTION_LABELS: Record<string, string> = {
  chiesa_interno: "Interno Chiesa",
  chiesa_esterno: "Esterno Chiesa",
  sala_ricevimento: "Sala Ricevimento",
  casa_sposa: "Casa Sposa",
  casa_sposo: "Casa Sposo",
  auto_sposi: "Auto Sposi",
  complementi_floreali: "Complementi floreali",
  bouquet_sposa: "Bouquet della sposa",
  servizi_aggiuntivi: "Servizi aggiuntivi",
};

const ORDER = [
  "chiesa_interno",
  "chiesa_esterno",
  "sala_ricevimento",
  "casa_sposa",
  "casa_sposo",
  "auto_sposi",
  "complementi_floreali",
  "bouquet_sposa",
  "servizi_aggiuntivi",
];

export default async function ProgettoFlorealeSposiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
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

  if (!membership && profile?.role !== "admin") redirect("/protected");

  const [{ data: couple }, { data: project }] = await Promise.all([
    supabase
      .from("couples")
      .select("partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("floral_projects")
      .select("id,name,status,notes,total_amount,updated_at")
      .eq("couple_id", id)
      .maybeSingle(),
  ]);

  if (!couple || !project) redirect(`/protected/area-sposi/${id}`);

  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase
      .from("floral_project_sections")
      .select("id,section_key,flowers,structures,notes")
      .eq("project_id", project.id),
    supabase
      .from("floral_project_items")
      .select("id,category,service_key,name,description,quantity,unit,include_in_quote,include_in_contract")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
  ]);

  const name = [
    couple.partner1_first_name,
    couple.partner1_last_name,
    couple.partner2_first_name,
    couple.partner2_last_name,
  ].filter(Boolean).join(" ");

  const sectionMap = new Map((sections || []).map((section) => [section.section_key, section]));
  const itemList = items || [];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <Link href={`/protected/area-sposi/${id}`} className="text-sm font-medium underline">
            ← Torna all'area sposi
          </Link>
          <p className="mt-5 text-sm text-slate-500">Area riservata sposi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Progetto floreale</h1>
          <p className="mt-1 text-slate-600">{name}</p>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">{project.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Stato: {project.status}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">Totale progetto</span>
              <div className="text-lg font-bold">€ {Number(project.total_amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          {project.notes && <p className="mt-5 whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm">{project.notes}</p>}
        </section>

        <div className="mt-6 space-y-6">
          {ORDER.map((key) => {
            const section = sectionMap.get(key);
            const sectionItems = itemList.filter((item) => item.category === key);
            if (!section && !sectionItems.length) return null;

            return (
              <section key={key} className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold">{SECTION_LABELS[key]}</h2>

                {(section?.flowers || section?.structures || section?.notes) && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {section?.flowers && (
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <h3 className="font-semibold">Fiori scelti</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{section.flowers}</p>
                      </div>
                    )}
                    {section?.structures && (
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <h3 className="font-semibold">Strutture scelte</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{section.structures}</p>
                      </div>
                    )}
                    {section?.notes && (
                      <div className="rounded-xl border bg-slate-50 p-4 md:col-span-2">
                        <h3 className="font-semibold">Note</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{section.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {sectionItems.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {sectionItems.map((item) => (
                      <div key={item.id} className="rounded-xl border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="font-semibold">{item.name}</h3>
                            {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                            <p className="mt-1 text-sm text-slate-500">Quantità: {item.quantity} {item.unit}</p>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${item.include_in_quote && item.include_in_contract ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            {item.include_in_quote && item.include_in_contract ? "Confermato" : "Da confermare"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-bold text-amber-950">Come procediamo</h2>
          <p className="mt-2 text-sm text-amber-900">
            Il progetto floreale viene elaborato da Emozioni Floreali. Le voci contrassegnate come
            confermate sono quelle destinate al preventivo e al contratto. Non vengono mostrati prezzi
            per le singole composizioni.
          </p>
        </section>
      </div>
    </main>
  );
}
