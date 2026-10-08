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

async function prepareQuoteFromProject(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const projectId = String(formData.get("project_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  if (!projectId || !coupleId) return;

  const { data: project } = await supabase.from("floral_projects")
    .select("id,couple_id,wedding_id,name,total_amount")
    .eq("id", projectId)
    .eq("couple_id", coupleId)
    .maybeSingle();
  if (!project) return;

  const { data: selectedItems } = await supabase.from("floral_project_items")
    .select("id,category,name,description,quantity,unit,notes,sort_order,include_in_quote")
    .eq("project_id", projectId)
    .eq("include_in_quote", true)
    .order("sort_order", { ascending: true });

  const { data: latestQuote } = await supabase.from("quotes")
    .select("id,version_number,status,deposit_amount")
    .eq("couple_id", coupleId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reusableDraft = latestQuote && latestQuote.status === "bozza";
  const version = reusableDraft ? latestQuote.version_number : (latestQuote?.version_number || 0) + 1;
  let quoteId = reusableDraft ? latestQuote.id : null;

  if (quoteId) {
    const { error } = await supabase.from("quotes").update({
      wedding_id: project.wedding_id,
      title: `Preventivo progetto floreale v${version}`,
      total_amount: Number(project.total_amount || 0),
      updated_at: new Date().toISOString(),
    }).eq("id", quoteId);
    if (error) throw new Error(error.message);
    const { error: deleteError } = await supabase.from("quote_items").delete()
      .eq("quote_id", quoteId)
      .not("floral_project_item_id", "is", null);
    if (deleteError) throw new Error(deleteError.message);
  } else {
    const { data: created, error } = await supabase.from("quotes").insert({
      couple_id: coupleId,
      wedding_id: project.wedding_id,
      version_number: version,
      status: "bozza",
      title: `Preventivo progetto floreale v${version}`,
      total_amount: Number(project.total_amount || 0),
      deposit_amount: 0,
      vat_included: true,
      created_by: (await supabase.auth.getUser()).data.user?.id || null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    quoteId = created.id;
  }

  const rows = (selectedItems || []).map((item: any, index: number) => ({
    quote_id: quoteId,
    floral_project_item_id: item.id,
    area: item.category || null,
    description: item.description ? `${item.name} — ${item.description}` : item.name,
    quantity: item.quantity ?? 1,
    unit: item.unit || "pz",
    notes: item.notes || null,
    sort_order: index + 1,
  }));

  if (rows.length) {
    const { error } = await supabase.from("quote_items").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
  redirect(`/protected/coppie/${coupleId}/progetto?saved=quote`);
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
    updated_at: new Date().toISOString(),
  }, { onConflict: "project_id,section_key" });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
  redirect(`/protected/coppie/${coupleId}/progetto?saved=section`);
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
  redirect(`/protected/coppie/${coupleId}/progetto?saved=composition`);
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
    include_in_contract: false,
  };

  if (existing?.id) {
    const { error } = await supabase.from("floral_project_items").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("floral_project_items").insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
  redirect(`/protected/coppie/${coupleId}/progetto?saved=preset`);
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
    include_in_contract: false,
  }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
  redirect(`/protected/coppie/${coupleId}/progetto?saved=item`);
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
  redirect(`/protected/coppie/${coupleId}/progetto?saved=project`);
}

export async function ProgettoFlorealeContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ saved?: string; error?: string }> }) {
  await connection();
  const { id: coupleId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
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
    supabase.from("floral_project_sections").select("id,section_key,flowers,structures,notes")
      .eq("project_id", project.id),
    supabase.from("floral_project_items").select("id,category,service_key,name,description,quantity,unit,include_in_quote,include_in_contract")
      .eq("project_id", project.id).order("sort_order", { ascending: true }),
  ]);

  const coupleName = [couple.partner1_first_name,couple.partner1_last_name,couple.partner2_first_name,couple.partner2_last_name].filter(Boolean).join(" ");
  const saved = resolvedSearchParams.saved;
  const notice = saved === "quote"
    ? "Preventivo preparato/aggiornato dal progetto. È ancora in bozza e non modifica il contratto."
    : saved === "section"
    ? "Dati della sezione salvati correttamente."
    : saved === "composition"
      ? "Composizione aggiunta correttamente."
      : saved === "preset"
        ? "Scelta salvata correttamente."
        : saved === "item"
          ? "Conferma aggiornata correttamente."
          : saved === "project"
            ? "Dati del progetto salvati correttamente."
            : null;


  const sectionMap = new Map((sections || []).map(s => [s.section_key, s]));
  const itemList = items || [];

  const renderGeneralSection = (key: string, title: string) => {
    const section = sectionMap.get(key);
    return <section key={key} className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Dati generali validi per tutte le composizioni di questa sezione.</p>
      <form action={saveSection} className="mt-4 grid gap-4">
        <input type="hidden" name="project_id" value={project.id}/>
        <input type="hidden" name="couple_id" value={coupleId}/>
        <input type="hidden" name="section_key" value={key}/>
        <label className="text-sm font-semibold text-foreground">Fiori da usare o scelti (inserimento libero: fiore + colore)
          <textarea name="flowers" defaultValue={section?.flowers || ""} rows={3} placeholder="Es. Rose bianche; Ortensie avorio; Eucalipto..." className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>
        <label className="text-sm font-semibold text-foreground">Strutture da utilizzare o scelte (inserimento libero)
          <textarea name="structures" defaultValue={section?.structures || ""} rows={3} placeholder="Es. Candelabri; vasi; supporti..." className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>
        <label className="text-sm font-semibold text-foreground">Note
          <textarea name="notes" defaultValue={section?.notes || ""} rows={2} className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>
        <button className="justify-self-start rounded-xl ef-button-primary">Salva dati sezione</button>
      </form>
    </section>;
  };

  const renderCompositions = (key: string, title: string) => {
    const sectionItems = itemList.filter(i => i.category === key);
    return <section key={key} className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Qui inserisci solo le composizioni, senza ripetere fiori e strutture già definiti sopra.</p>
      <form action={addComposition} className="mt-4 grid gap-3 md:grid-cols-5">
        <input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="category" value={key}/>
        <input required name="name" placeholder="Nome composizione" className="rounded-xl border bg-background px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-ring"/>
        <input name="description" placeholder="Descrizione" className="rounded-xl border bg-background px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-ring"/>
        <input name="quantity" type="number" min="1" defaultValue="1" className="rounded-xl border bg-background px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-ring"/>
        <input name="unit" defaultValue="pz" className="rounded-xl border bg-background px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-ring"/>
        <button className="rounded-lg ef-button-primary">+ Aggiungi</button>
      </form>
      <div className="mt-5 space-y-3">
        {sectionItems.map(item => <div key={item.id} className="rounded-xl border bg-background p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div><h3 className="font-bold">{item.name}</h3>{item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}<p className="text-sm text-muted-foreground">Quantità: {item.quantity} {item.unit}</p></div>
            <form action={confirmItem} className="flex items-center gap-2">
              <input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="item_id" value={item.id}/>
              <input id={`confirm-${item.id}`} type="checkbox" name="selected" defaultChecked={item.include_in_quote} className="h-5 w-5"/>
              <label htmlFor={`confirm-${item.id}`} className="text-sm font-semibold">Inserisci nel preventivo</label>
              <button className="rounded-lg border bg-card px-3 py-2 text-sm font-semibold">Salva</button>
            </form>
          </div>
        </div>)}
      </div>
    </section>;
  };

  const renderPresetSection = (title: string, category: string, options: readonly (readonly [string,string])[]) => {
    const section = sectionMap.get(category);
    return <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Spunta solo ciò che è stato effettivamente scelto dalla sposa. La selezione verrà trasferita nel preventivo quando prepari o aggiorni il preventivo.</p>
      <div className="mt-5 space-y-4">
        {options.map(([serviceKey, name]) => {
          const item = itemList.find(i => i.service_key === serviceKey);
          return <form key={serviceKey} action={savePreset} className="rounded-xl border bg-background p-4">
            <input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/>
            <input type="hidden" name="category" value={category}/><input type="hidden" name="service_key" value={serviceKey}/><input type="hidden" name="name" value={name}/>
            <div className="grid gap-3 md:grid-cols-[auto_1fr_120px_auto] md:items-center">
              <input type="checkbox" name="selected" defaultChecked={!!item?.include_in_quote} className="h-5 w-5"/>
              <div className="font-semibold">{name}</div>
              <input name="quantity" type="number" min="1" defaultValue={item?.quantity || 1} className="rounded-xl border bg-background px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-ring" aria-label={`Quantità ${name}`}/>
              <button className="rounded-lg ef-button-primary">Salva scelta</button>
            </div>
            <input name="description" defaultValue={item?.description || ""} placeholder="Descrizione / dettagli personalizzati" className="mt-3 w-full rounded-xl border bg-background px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-ring"/>
          </form>;
        })}
      </div>
    </section>;
  };

  return <main className="min-h-screen bg-background">{notice && <div className="mx-auto max-w-7xl px-6 pt-6"><div className="rounded-2xl border border-primary/20 bg-secondary px-4 py-3 font-semibold text-primary">✓ {notice}</div></div>}<div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
    <div className="mb-8"><Link href={`/protected/coppie/${coupleId}`} className="text-sm underline">← Torna alla scheda coppia</Link><h1 className="mt-4 text-3xl font-semibold tracking-tight">Progetto floreale</h1><p className="mt-1 text-muted-foreground">{coupleName}</p></div>

    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight">Dati del progetto</h2>
      <form action={saveProject} className="mt-5 grid gap-4 md:grid-cols-4">
        <input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/>
        <input name="name" defaultValue={project.name} className="rounded-xl border px-4 py-3"/>
        <select name="status" defaultValue={project.status} className="rounded-xl border bg-card px-4 py-3"><option value="draft">Bozza</option><option value="in_progress">In lavorazione</option><option value="approved">Approvato</option><option value="completed">Completato</option><option value="archived">Archiviato</option></select>
        <input name="total_amount" defaultValue={project.total_amount ?? ""} placeholder="Totale progetto €" className="rounded-xl border px-4 py-3"/>
        <button className="ef-button-primary">Salva progetto</button>
        <textarea name="notes" defaultValue={project.notes || ""} placeholder="Note generali..." rows={3} className="rounded-xl border px-4 py-3 md:col-span-4"/>
      </form>
      <div className="mt-4 rounded-xl border border-primary/20 bg-secondary p-4"><p className="text-sm text-primary">Il progetto è indipendente da preventivo e contratto. Le modifiche vengono trasferite al preventivo solo quando premi il pulsante seguente.</p><form action={prepareQuoteFromProject} className="mt-3"><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/><button className="ef-button-primary">Prepara / aggiorna preventivo</button></form></div>
    </section>

    <div className="mt-6 grid gap-6">{GENERAL_SECTIONS.map(([key,title]) => renderGeneralSection(key,title))}</div>
    <div className="mt-6 grid gap-6">{renderCompositions("chiesa_interno","Composizioni Interno Chiesa")}{renderCompositions("chiesa_esterno","Composizioni Esterno Chiesa")}{renderCompositions("sala_ricevimento","Composizioni Sala Ricevimento")}{renderCompositions("casa_sposa","Composizioni Casa Sposa")}{renderCompositions("casa_sposo","Composizioni Casa Sposo")}{renderCompositions("auto_sposi","Auto Sposi")}</div>
    <div className="mt-6 grid gap-6">{renderPresetSection("Complementi floreali","complementi_floreali",COMPLEMENTS)}{renderPresetSection("Bouquet della sposa","bouquet_sposa",BOUQUETS)}{renderPresetSection("Servizi aggiuntivi","servizi_aggiuntivi",SERVICES)}</div>

    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-xl font-semibold tracking-tight text-amber-950">Regola economica</h2>
      <p className="mt-2 text-sm text-amber-900">Il progetto non assegna prezzi alle singole composizioni. Il totale economico resta unico. Le voci selezionate per il preventivo saranno la base della proposta economica; il contratto viene generato automaticamente quando il preventivo viene presentato, senza attendere la conferma della coppia.</p>
    </section>
  </div></main>;
}
