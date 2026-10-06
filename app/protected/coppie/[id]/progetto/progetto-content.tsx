import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = [
  ["chiesa","Composizioni Chiesa"],
  ["sala_ricevimento","Composizioni Sala Ricevimento"],
  ["casa_sposi","Composizioni Casa Sposo/a"],
  ["complementi_floreali","Complementi floreali"],
] as const;

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/protected");
  return supabase;
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

async function addFlower(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const projectId = String(formData.get("project_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const name = String(formData.get("flower_name") || "").trim();
  if (!projectId || !coupleId || !name) return;
  const { error } = await supabase.from("floral_project_ceremony_flowers").insert({
    project_id: projectId, flower_name: name,
    color: String(formData.get("color") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

async function addItem(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const projectId = String(formData.get("project_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const category = String(formData.get("category") || "");
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !coupleId || !category || !name) return;
  const { error } = await supabase.from("floral_project_items").insert({
    project_id: projectId, category, name,
    description: String(formData.get("description") || "").trim() || null,
    quantity: Number(formData.get("quantity") || 1) || 1,
    unit: String(formData.get("unit") || "pz"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

async function addItemFlower(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const itemId = String(formData.get("item_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const name = String(formData.get("flower_name") || "").trim();
  if (!itemId || !coupleId || !name) return;
  const { error } = await supabase.from("floral_item_flowers").insert({
    project_item_id: itemId, flower_name: name,
    color: String(formData.get("color") || "").trim() || null,
    quantity: Number(formData.get("quantity") || 1) || 1,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

async function addStructure(formData: FormData) {
  "use server";
  const supabase = await adminClient();
  const itemId = String(formData.get("item_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const name = String(formData.get("structure_name") || "").trim();
  if (!itemId || !coupleId || !name) return;
  const { error } = await supabase.from("floral_item_structures").insert({
    project_item_id: itemId, structure_name: name,
    quantity: Number(formData.get("quantity") || 1) || 1,
    color: String(formData.get("color") || "").trim() || null,
    custom_name: String(formData.get("custom_name") || "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
}

export async function ProgettoFlorealeContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id: coupleId } = await params;
  const supabase = await adminClient();

  const { data: couple } = await supabase.from("couples").select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name").eq("id", coupleId).maybeSingle();
  if (!couple) redirect("/protected/coppie");
  const { data: project } = await supabase.from("floral_projects").select("id,couple_id,name,status,notes,total_amount").eq("couple_id", coupleId).maybeSingle();
  if (!project) redirect(`/protected/coppie/${coupleId}`);

  const [{ data: items }, { data: ceremonyFlowers }] = await Promise.all([
    supabase.from("floral_project_items").select("id,category,name,description,quantity,unit,notes").eq("project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("floral_project_ceremony_flowers").select("id,flower_name,color,notes").eq("project_id", project.id).order("sort_order", { ascending: true }),
  ]);
  const ids = (items || []).map(i => i.id);
  const [{ data: itemFlowers }, { data: structures }] = ids.length ? await Promise.all([
    supabase.from("floral_item_flowers").select("id,project_item_id,flower_name,color,quantity,notes").in("project_item_id", ids),
    supabase.from("floral_item_structures").select("id,project_item_id,structure_name,quantity,color,custom_name").in("project_item_id", ids),
  ]) : [{ data: [] }, { data: [] }];

  const coupleName = [couple.partner1_first_name,couple.partner1_last_name,couple.partner2_first_name,couple.partner2_last_name].filter(Boolean).join(" ");

  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-7xl px-6 py-8">
    <div className="mb-8"><Link href={`/protected/coppie/${coupleId}`} className="text-sm underline">← Torna alla scheda coppia</Link><h1 className="mt-4 text-3xl font-bold">Progetto floreale</h1><p className="mt-1 text-slate-600">{coupleName}</p></div>

    <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Dati del progetto</h2>
      <form action={saveProject} className="mt-5 grid gap-4 md:grid-cols-4">
        <input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/>
        <input name="name" defaultValue={project.name} className="rounded-xl border px-4 py-3"/>
        <select name="status" defaultValue={project.status} className="rounded-xl border bg-white px-4 py-3"><option value="draft">Bozza</option><option value="in_progress">In lavorazione</option><option value="approved">Approvato</option><option value="completed">Completato</option><option value="archived">Archiviato</option></select>
        <input name="total_amount" defaultValue={project.total_amount ?? ""} placeholder="Totale €" className="rounded-xl border px-4 py-3"/>
        <button className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">Salva progetto</button>
        <textarea name="notes" defaultValue={project.notes || ""} placeholder="Note generali..." rows={3} className="rounded-xl border px-4 py-3 md:col-span-4"/>
      </form>
    </section>

    <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Palette floreale della cerimonia</h2>
      <div className="mt-4 space-y-2">{(ceremonyFlowers || []).map(f => <div key={f.id} className="rounded-xl border bg-emerald-50 p-3"><b>{f.flower_name}</b>{f.color && <span className="ml-2">• {f.color}</span>}{f.notes && <span className="ml-2 text-sm text-slate-500">• {f.notes}</span>}</div>)}</div>
      <form action={addFlower} className="mt-4 grid gap-3 md:grid-cols-4"><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/><input required name="flower_name" placeholder="Fiore" className="rounded-lg border px-3 py-2"/><input name="color" placeholder="Colore" className="rounded-lg border px-3 py-2"/><input name="notes" placeholder="Note" className="rounded-lg border px-3 py-2"/><button className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">+ Aggiungi fiore</button></form>
    </section>

    <div className="mt-6 space-y-6">{SECTIONS.map(([key,title]) => { const sectionItems=(items||[]).filter(i=>i.category===key); return <section key={key} className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{title}</h2>
      <form action={addItem} className="mt-4 grid gap-3 md:grid-cols-5"><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="category" value={key}/><input required name="name" placeholder="Nome composizione" className="rounded-lg border px-3 py-2"/><input name="description" placeholder="Descrizione" className="rounded-lg border px-3 py-2"/><input name="quantity" type="number" min="1" defaultValue="1" className="rounded-lg border px-3 py-2"/><input name="unit" defaultValue="pz" className="rounded-lg border px-3 py-2"/><button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">+ Aggiungi</button></form>
      <div className="mt-5 space-y-4">{sectionItems.map(item=>{const fs=(itemFlowers||[]).filter(f=>f.project_item_id===item.id);const ss=(structures||[]).filter(s=>s.project_item_id===item.id);return <article key={item.id} className="rounded-xl border bg-slate-50 p-5"><h3 className="text-lg font-bold">{item.name}</h3>{item.description&&<p className="text-sm text-slate-600">{item.description}</p>}<p className="mt-1 text-sm text-slate-500">Quantità: {item.quantity} {item.unit}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-xl border bg-white p-4"><h4 className="font-semibold">Fiori</h4>{fs.map(f=><div key={f.id} className="mt-2 text-sm">{f.flower_name}{f.color?` • ${f.color}`:""} • Qtà {f.quantity}</div>)}<form action={addItemFlower} className="mt-3 space-y-2"><input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="couple_id" value={coupleId}/><input required name="flower_name" placeholder="Nome fiore" className="w-full rounded border px-2 py-2"/><input name="color" placeholder="Colore" className="w-full rounded border px-2 py-2"/><input name="quantity" type="number" min="1" defaultValue="1" className="w-full rounded border px-2 py-2"/><button className="w-full rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">+ Fiore</button></form></div>
        <div className="rounded-xl border bg-white p-4"><h4 className="font-semibold">Strutture e materiali</h4>{ss.map(s=><div key={s.id} className="mt-2 text-sm">{s.custom_name||s.structure_name}{s.color?` • ${s.color}`:""} • Qtà {s.quantity}</div>)}<form action={addStructure} className="mt-3 space-y-2"><input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="couple_id" value={coupleId}/><input required name="structure_name" placeholder="Struttura/materiale" className="w-full rounded border px-2 py-2"/><input name="color" placeholder="Colore" className="w-full rounded border px-2 py-2"/><input name="quantity" type="number" min="1" defaultValue="1" className="w-full rounded border px-2 py-2"/><button className="w-full rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white">+ Struttura</button></form></div></div>
      </article>})}</div>
    </section>})}</div>
  </div></main>;
}
