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

  const { data: ceremonyFlowers } = await supabase
    .from("floral_project_ceremony_flowers")
    .select("id,flower_id,custom_name,color,sort_order,floral_flowers(id,name)")
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  const { data: items } = await supabase
    .from("floral_project_items")
    .select(`
      id,category,name,description,quantity,unit,notes,sort_order,
      floral_item_flowers(id,flower_id,color,quantity,notes,floral_flowers(id,name)),
      floral_item_structures(id,structure_id,quantity,color,custom_name,floral_structures(id,name))
    `)
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  const sections = [
    { key: "chiesa", title: "Composizioni Chiesa", description: "Composizioni floreali previste per la cerimonia." },
    { key: "sala_ricevimento", title: "Composizioni Sala Ricevimento", description: "Centrotavola, composizioni e decorazioni floreali per il ricevimento." },
    { key: "casa_sposi", title: "Composizioni Casa Sposo/a", description: "Composizioni e decorazioni previste nelle abitazioni degli sposi." },
    { key: "complementi_floreali", title: "Complementi floreali", description: "Bouquet, bottoniere, coroncine, auto sposi, corsage e altri complementi." },
  ];

  function normalizeCategory(category: string | null) {
    if (!category) return "chiesa";
    if (category === "bouquet") return "complementi_floreali";
    if (category === "ceremony") return "chiesa";
    if (category === "arrangements") return "sala_ricevimento";
    if (category === "home") return "casa_sposi";
    return category;
  }

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
              <h2 className="text-xl font-semibold text-slate-900">{project.name || "Progetto floreale"}</h2>
              <p className="mt-2 text-sm text-slate-500">Stato: <span className="font-medium text-slate-700">{project.status || "draft"}</span></p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totale progetto</div>
              <div className="mt-1 text-xl font-bold text-slate-900">€ {totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900">Note del progetto</h3>
            <div className="mt-3 rounded-xl border bg-slate-50 p-4 text-slate-700">{project.notes?.trim() || "Nessuna nota inserita al momento."}</div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Palette floreale della cerimonia</h2>
          <p className="mt-1 text-sm text-slate-500">Fiori e colori scelti per la cerimonia.</p>
          <div className="mt-5 space-y-3">
            {(ceremonyFlowers || []).length ? ceremonyFlowers!.map((flower) => {
              const catalogName = flower.floral_flowers?.[0]?.name;
              return <div key={flower.id} className="rounded-xl border bg-emerald-50 p-4">
                <div className="font-semibold text-slate-900">{flower.custom_name || catalogName || "Fiore"}</div>
                {catalogName && flower.custom_name && <div className="mt-1 text-xs text-slate-500">Catalogo: {catalogName}</div>}
                {flower.color && <div className="mt-2 text-sm text-emerald-800">Colore: {flower.color}</div>}
              </div>;
            }) : <p className="text-slate-500">La palette della cerimonia non è ancora stata definita.</p>}
          </div>
        </section>

        <div className="mt-6 space-y-6">
          {sections.map((section) => {
            const sectionItems = (items || []).filter((item) => normalizeCategory(item.category) === section.key);
            return <section key={section.key} className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{section.description}</p>
              <div className="mt-5 space-y-4">
                {sectionItems.length ? sectionItems.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-slate-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                        {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                        {item.notes && <p className="mt-2 text-sm italic text-slate-500">Note: {item.notes}</p>}
                      </div>
                      {item.quantity != null && <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">Quantità: {item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>}
                    </div>

                    {item.floral_item_flowers?.length > 0 && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <h4 className="font-semibold text-slate-900">Fiori</h4>
                      <div className="mt-3 space-y-2">{item.floral_item_flowers.map((f) => <div key={f.id} className="rounded-lg border bg-white p-3">
                        <span className="font-medium">{f.floral_flowers?.[0]?.name || "Fiore"}</span>
                        {f.color && <span className="ml-2 text-sm text-emerald-700">• {f.color}</span>}
                        {f.quantity != null && <span className="ml-2 text-sm text-slate-500">• Qtà {f.quantity}</span>}
                        {f.notes && <div className="mt-1 text-xs italic text-slate-500">{f.notes}</div>}
                      </div>)}</div>
                    </div>}

                    {item.floral_item_structures?.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <h4 className="font-semibold text-slate-900">Strutture e materiali</h4>
                      <div className="mt-3 space-y-2">{item.floral_item_structures.map((s) => <div key={s.id} className="rounded-lg border bg-white p-3">
                        <span className="font-medium">{s.custom_name || s.floral_structures?.[0]?.name || "Struttura"}</span>
                        {s.quantity != null && <span className="ml-2 text-sm text-slate-500">• Qtà {s.quantity}</span>}
                        {s.color && <span className="ml-2 text-sm text-amber-700">• {s.color}</span>}
                      </div>)}</div>
                    </div>}
                  </div>
                )) : <p className="mt-4 text-slate-500">Nessuna voce inserita in questa sezione.</p>}
              </div>
            </section>;
          })}
        </div> </div>
    </main>
  );
}
