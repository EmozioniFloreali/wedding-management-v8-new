import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GENERAL_SECTIONS = [
  ["chiesa_interno", "Interno Chiesa"],
  ["chiesa_esterno", "Esterno Chiesa"],
  ["sala_ricevimento", "Sala Ricevimento"],
  ["casa_sposa", "Casa Sposa"],
  ["casa_sposo", "Casa Sposo"],
  ["auto_sposi", "Auto Sposi"],
] as const;

const COMPLEMENTS = [
  ["bottoniere", "Bottoniere"],
  ["coroncine", "Coroncine"],
  ["bracciali_damigelle", "Bracciali damigelle"],
] as const;

const BOUQUETS = [
  ["bouquet_principale", "Principale"],
  ["bouquet_suocera", "Suocera"],
  ["bouquet_lancio", "Lancio"],
] as const;

const SERVICES = [
  ["messalino", "Messalino"],
  ["tableau_de_mariage", "Tableau de Mariage"],
  ["segnaposto", "Segnaposto"],
  ["confettata", "Confettata"],
] as const;

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/protected");
  return supabase;
}

async function saveSection(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const projectId = String(formData.get("project_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const sectionKey = String(formData.get("section_key") || "");
  if (!projectId || !coupleId || !sectionKey) return;
  const { error } = await supabase.from("floral_project_sections").upsert({
    project_id: projectId,
    section_key: sectionKey,
    flowers: String(formData.get("flowers") || "").trim() || null,
    structures: String(formData.get("structures") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    other_items: String(formData.get("other_items") || "").trim() || null,
  }, { onConflict: "project_id,section_key" });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

async function addComposition(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const projectId = String(formData.get("project_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const category = String(formData.get("category") || "");
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !coupleId || !category || !name) return;
  const { error } = await supabase.from("floral_project_items").insert({
    project_id: projectId,
    category,
    name,
    description: String(formData.get("description") || "").trim() || null,
    quantity: Number(formData.get("quantity") || 1) || 1,
    unit: String(formData.get("unit") || "pz"),
    include_in_quote: false,
    include_in_contract: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

async function savePreset(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const projectId = String(formData.get("project_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const category = String(formData.get("category") || "");
  const serviceKey = String(formData.get("service_key") || "");
  const name = String(formData.get("name") || "");
  const selected = formData.get("selected") === "on";
  const quantity = Math.max(1, Number(formData.get("quantity") || 1) || 1);
  const description = String(formData.get("description") || "").trim() || null;
  if (!projectId || !coupleId || !category || !serviceKey) return;

  const { data: existing } = await supabase.from("floral_project_items")
    .select("id")
    .eq("project_id", projectId)
    .eq("service_key", serviceKey)
    .maybeSingle();

  const payload = {
    project_id: projectId,
    category,
    service_key: serviceKey,
    name,
    description,
    quantity,
    unit: "pz",
    include_in_quote: selected,
    include_in_contract: selected,
  };

  if (existing?.id) {
    const { error } = await supabase.from("floral_project_items").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("floral_project_items").insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

async function confirmItem(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const coupleId = String(formData.get("couple_id") || "");
  const itemId = String(formData.get("item_id") || "");
  const selected = formData.get("selected") === "on";
  if (!coupleId || !itemId) return;
  const { error } = await supabase.from("floral_project_items").update({
    include_in_quote: selected,
    include_in_contract: selected,
  }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

async function saveProject(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const id = String(formData.get("project_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const raw = String(formData.get("total_amount") || "").replace(",", ".");
  const total = raw ? Number(raw) : null;
  const { error } = await supabase.from("floral_projects").update({
    name: String(formData.get("name") || "Progetto floreale").trim(),
    status: String(formData.get("status") || "draft"),
    notes: String(formData.get("notes") || "").trim() || null,
    total_amount: Number.isFinite(total as number) ? total : null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

export async function ProgettoFlorealeContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id: coupleId } = await params;
  const supabase = await adminClient();

  const { data: couple } = await supabase.from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name")
    .eq("id", coupleId).maybeSingle();
  if (!couple) redirect("/protected/coppie");

  const { data: project } = await supabase.from("floral_projects")
    .select("id,couple_id,name,status,notes,total_amount")
    .eq("couple_id", coupleId).maybeSingle();
  if (!project) redirect(`/protected/coppie/${coupleId}`);

  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase.from("floral_project_sections").select("id,section_key,flowers,structures,notes,other_items")
      .eq("project_id", project.id),
    supabase.from("floral_project_items").select("id,category,service_key,name,description,quantity,unit,include_in_quote,include_in_contract")
      .eq("project_id", project.id).order("sort_order", { ascending: true }),
  ]);

  const coupleName = [couple.partner1_first_name,couple.partner1_last_name,couple.partner2_first_name,couple.partner2_last_name].filter(Boolean).join(" ");
  const sectionMap = new Map((sections || []).map(s => [s.section_key, s]));
  const itemList = items || [];

  const renderGeneralSection = (key: string, title: string) => {
    const section = sectionMap.get(key);
    return <section key={key} className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">Dati generali validi per tutte le composizioni di questa sezione.</p>
      <form action={saveSection} className="mt-4 grid gap-4">
        <input type="hidden" name="project_id" value={project.id}/>
        <input type="hidden" name="couple_id" value={coupleId}/>
        <input type="hidden" name="section_key" value={key}/>
        <label className="text-sm font-semibold text-slate-700">Fiori da usare o scelti (inserimento libero: fiore + colore)
          <textarea name="flowers" defaultValue={section?.flowers || ""} rows={3} placeholder="Es. Rose bianche; Ortensie avorio; Eucalipto..." className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>
        <label className="text-sm font-semibold text-slate-700">Strutture da utilizzare o scelte (inserimento libero)
          <textarea name="structures" defaultValue={section?.structures || ""} rows={3} placeholder="Es. Candelabri; vasi; supporti..." className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>
        <label className="text-sm font-semibold text-slate-700">Altri elementi / richieste particolari
          <textarea name="other_items" defaultValue={section?.other_items || ""} rows={3} placeholder="Elementi non compresi nelle scelte preimpostate..." className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>
        <label className="text-sm font-semibold text-slate-700">Note
          <textarea name="notes" defaultValue={section?.notes || ""} rows={2} className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>
        <button className="justify-self-start rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Salva dati sezione</button>
      </form>
    </section>;
  };

  const renderCompositions = (key: string, title: string) => {
    const sectionItems = itemList.filter(i => i.category === key);
    return <section key={key} className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">Qui inserisci solo le composizioni, senza ripetere fiori e strutture già definiti sopra.</p>
      <form action={addComposition} className="mt-4 grid gap-3 md:grid-cols-5">
        <input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="category" value={key}/>
        <input required name="name" placeholder="Nome composizione" className="rounded-lg border px-3 py-2"/>
        <input name="description" placeholder="Descrizione" className="rounded-lg border px-3 py-2"/>
        <input name="quantity" type="number" min="1" defaultValue="1" className="rounded-lg border px-3 py-2"/>
        <input name="unit" defaultValue="pz" className="rounded-lg border px-3 py-2"/>
        <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">+ Aggiungi</button>
      </form>
      <div className="mt-5 space-y-3">
        {sectionItems.map(item => <div key={item.id} className="rounded-xl border bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div><h3 className="font-bold">{item.name}</h3>{item.description && <p className="text-sm text-slate-600">{item.description}</p>}<p className="text-sm text-slate-500">Quantità: {item.quantity} {item.unit}</p></div>
            <form action={confirmItem} className="flex items-center gap-2">
              <input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="item_id" value={item.id}/>
              <input id={`confirm-${item.id}`} type="checkbox" name="selected" defaultChecked={item.include_in_quote && item.include_in_contract} className="h-5 w-5"/>
              <label htmlFor={`confirm-${item.id}`} className="text-sm font-semibold">Confermato dalla sposa — preventivo + contratto</label>
              <button className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Salva</button>
            </form>
          </div>
        </div>)}
      </div>
    </section>;
  };

  const renderPresetSection = (title: string, category: string, options: readonly (readonly [string,string])[]) => {
    return <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">Spunta solo ciò che è stato effettivamente scelto dalla sposa. La conferma confluirà nel preventivo e nel contratto.</p>
      <div className="mt-5 space-y-4">
        {options.map(([serviceKey, name]) => {
          const item = itemList.find(i => i.service_key === serviceKey);
          return <form key={serviceKey} action={savePreset} className="rounded-xl border bg-slate-50 p-4">
            <input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/>
            <input type="hidden" name="category" value={category}/><input type="hidden" name="service_key" value={serviceKey}/><input type="hidden" name="name" value={name}/>
            <div className="grid gap-3 md:grid-cols-[auto_1fr_120px_auto] md:items-center">
              <input type="checkbox" name="selected" defaultChecked={!!item?.include_in_quote && !!item?.include_in_contract} className="h-5 w-5"/>
              <div className="font-semibold">{name}</div>
              <input name="quantity" type="number" min="1" defaultValue={item?.quantity || 1} className="rounded-lg border px-3 py-2" aria-label={`Quantità ${name}`}/>
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Salva scelta</button>
            </div>
            <input name="description" defaultValue={item?.description || ""} placeholder="Descrizione / dettagli personalizzati" className="mt-3 w-full rounded-lg border px-3 py-2"/>
          </form>;
        })}
      </div>
    </section>;
  };

  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-7xl px-6 py-8">
    <div className="mb-8"><Link href={`/protected/coppie/${coupleId}`} className="text-sm underline">← Torna alla scheda coppia</Link><h1 className="mt-4 text-3xl font-bold">Progetto floreale</h1><p className="mt-1 text-slate-600">{coupleName}</p></div>

    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Dati del progetto</h2>
      <form action={saveProject} className="mt-5 grid gap-4 md:grid-cols-4">
        <input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/>
        <input name="name" defaultValue={project.name} className="rounded-xl border px-4 py-3"/>
        <select name="status" defaultValue={project.status} className="rounded-xl border bg-white px-4 py-3"><option value="draft">Bozza</option><option value="in_progress">In lavorazione</option><option value="approved">Approvato</option><option value="completed">Completato</option><option value="archived">Archiviato</option></select>
        <input name="total_amount" defaultValue={project.total_amount ?? ""} placeholder="Totale progetto €" className="rounded-xl border px-4 py-3"/>
        <button className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">Salva progetto</button>
        <textarea name="notes" defaultValue={project.notes || ""} placeholder="Note generali..." rows={3} className="rounded-xl border px-4 py-3 md:col-span-4"/>
      </form>
    </section>

    <div className="mt-6 grid gap-6">{GENERAL_SECTIONS.map(([key,title]) => renderGeneralSection(key,title))}</div>
    <div className="mt-6 grid gap-6">{renderCompositions("chiesa_interno","Composizioni Interno Chiesa")}{renderCompositions("chiesa_esterno","Composizioni Esterno Chiesa")}{renderCompositions("sala_ricevimento","Composizioni Sala Ricevimento")}{renderCompositions("casa_sposa","Composizioni Casa Sposa")}{renderCompositions("casa_sposo","Composizioni Casa Sposo")}{renderCompositions("auto_sposi","Auto Sposi")}</div>
    <div className="mt-6 grid gap-6">{renderPresetSection("Complementi floreali","complementi_floreali",COMPLEMENTS)}{renderPresetSection("Bouquet della sposa","bouquet_sposa",BOUQUETS)}{renderPresetSection("Servizi aggiuntivi","servizi_aggiuntivi",SERVICES)}</div>

    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-xl font-bold text-amber-950">Regola economica</h2>
      <p className="mt-2 text-sm text-amber-900">Il progetto non assegna prezzi alle singole composizioni. Il totale economico resta unico. Le voci spuntate come confermate saranno la base per la composizione del preventivo e, successivamente, del contratto.</p>
    </section>
  </div></main>;
}
