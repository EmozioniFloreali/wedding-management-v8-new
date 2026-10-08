import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

const PRIORITIES = ["bassa","normale","alta","urgente"] as const;
const STATUSES = ["da_fare","in_corso","completata","annullata"] as const;
const AREAS = ["coppia","consultazione","preventivo","progetto_floreale","chiesa","contratto","pagamento","logistica","giorno_evento","altro"] as const;

function s(v: FormDataEntryValue | null) { return v == null ? "" : String(v).trim(); }

function statusLabel(v:string) {
  return ({da_fare:"Da fare",in_corso:"In corso",completata:"Completata",annullata:"Annullata"} as Record<string,string>)[v] || v;
}
function priorityLabel(v:string) {
  return ({bassa:"Bassa",normale:"Normale",alta:"Alta",urgente:"Urgente"} as Record<string,string>)[v] || v;
}
function areaLabel(v:string) {
  return ({coppia:"Coppia",consultazione:"Consultazione",preventivo:"Preventivo",progetto_floreale:"Progetto floreale",chiesa:"Chiesa",contratto:"Contratto",pagamento:"Pagamento",logistica:"Logistica",giorno_evento:"Giorno evento",altro:"Altro"} as Record<string,string>)[v] || v;
}
function dueDateTime(fd:FormData) {
  const raw=s(fd.get("due_at"));
  if(!raw) return {date:null as string|null,time:null as string|null};
  const [date,time]=raw.split("T");
  return {date:date||null,time:time||null};
}

async function saveTask(fd:FormData) {
  "use server";
  const { supabase, user } = await requireAdmin();
  const coupleId=s(fd.get("couple_id"));
  const title=s(fd.get("title"));
  if(!coupleId||!title)return;
  const due=dueDateTime(fd);
  const priority=PRIORITIES.includes(s(fd.get("priority")) as any) ? s(fd.get("priority")) : "normale";
  const area=AREAS.includes(s(fd.get("area")) as any) ? s(fd.get("area")) : "altro";
  const {error}=await supabase.from("tasks").insert({
    couple_id:coupleId,title,description:s(fd.get("description"))||null,
    due_date:due.date,due_time:due.time,priority,status:"da_fare",area,
    notes:s(fd.get("notes"))||null,created_by:user.id
  });
  if(error)throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/attivita`);
  revalidatePath("/protected");
}

async function updateTask(fd:FormData) {
  "use server";
  const { supabase } = await requireAdmin();
  const id=s(fd.get("id")); const coupleId=s(fd.get("couple_id"));
  const status=s(fd.get("status"));
  if(!id||!coupleId||!STATUSES.includes(status as any))return;
  const {error}=await supabase.from("tasks").update({
    status,
    completed_at:status==="completata"?new Date().toISOString():null
  }).eq("id",id).eq("couple_id",coupleId);
  if(error)throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/attivita`);
  revalidatePath("/protected");
}

async function deleteTask(fd:FormData) {
  "use server";
  const { supabase } = await requireAdmin();
  const id=s(fd.get("id")); const coupleId=s(fd.get("couple_id"));
  if(!id||!coupleId)return;
  const {error}=await supabase.from("tasks").delete().eq("id",id).eq("couple_id",coupleId);
  if(error)throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/attivita`);
  revalidatePath("/protected");
}
export default async function TasksPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const {supabase}=await requireAdmin();
  const {data:couple}=await supabase.from("couples").select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name").eq("id",id).maybeSingle();
  if(!couple)redirect("/protected/coppie");
  const {data:tasks}=await supabase.from("tasks").select("id,title,description,area,status,priority,due_date,due_time,notes").eq("couple_id",id).order("due_date",{ascending:true,nullsFirst:false}).order("due_time",{ascending:true,nullsFirst:false});

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div className="mb-6 flex items-center justify-between gap-4">
      <div><div className="text-sm text-muted-foreground">Coppie / {couple.partner1_first_name} {couple.partner1_last_name} · {couple.partner2_first_name} {couple.partner2_last_name}</div><h1 className="mt-2 text-3xl font-bold">Attività</h1><p className="mt-1 text-muted-foreground">Checklist, scadenze, priorità e controllo operativo.</p></div>
      <Link className="ef-button-secondary" href={`/protected/coppie/${id}`}>Torna alla scheda coppia</Link>
    </div>
    <section className="ef-card p-6">
      <h2 className="text-xl font-semibold">Nuova attività</h2>
      <form action={saveTask} className="mt-5 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="couple_id" value={id}/>
        <label>Titolo<input required name="title" className="mt-1 w-full rounded-lg border p-3" placeholder="Es. Confermare fiori sala"/></label>
        <label>Scadenza<input type="datetime-local" name="due_at" className="mt-1 w-full rounded-lg border p-3"/></label>
        <label>Priorità<select name="priority" className="mt-1 w-full rounded-lg border p-3">{PRIORITIES.map(x=><option key={x} value={x}>{priorityLabel(x)}</option>)}</select></label>
        <label>Area<select name="area" className="mt-1 w-full rounded-lg border p-3">{AREAS.map(x=><option key={x} value={x}>{areaLabel(x)}</option>)}</select></label>
        <label className="md:col-span-2">Descrizione<textarea name="description" className="mt-1 min-h-24 w-full rounded-lg border p-3"/></label>
        <label className="md:col-span-2">Note<textarea name="notes" className="mt-1 min-h-20 w-full rounded-lg border p-3"/></label>
        <button className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white md:col-span-2">Salva attività</button>
      </form>
    </section>
    <section className="mt-6 ef-card p-6">
      <h2 className="text-xl font-semibold">Checklist</h2>
      <div className="mt-4 space-y-3">
        {(tasks||[]).length===0?<p className="text-muted-foreground">Nessuna attività.</p>:(tasks||[]).map(t=>{
          const due=t.due_date?new Intl.DateTimeFormat("it-IT",{dateStyle:"full",timeZone:"Europe/Rome"}).format(new Date(`${t.due_date}T12:00:00`)):"Nessuna scadenza";
          return <div key={t.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{t.title}</div><div className="text-sm text-muted-foreground">{due}{t.due_time?` · ${String(t.due_time).slice(0,5)}`:""}</div><div className="mt-1 text-sm">{areaLabel(t.area)} · priorità {priorityLabel(t.priority)}</div></div><div className="flex gap-2"><form action={updateTask}><input type="hidden" name="id" value={t.id}/><input type="hidden" name="couple_id" value={id}/><select name="status" defaultValue={t.status} className="rounded-lg border p-2">{STATUSES.map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select><button className="rounded-lg border px-3 py-2">Aggiorna</button></form><form action={deleteTask}><input type="hidden" name="id" value={t.id}/><input type="hidden" name="couple_id" value={id}/><button className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Elimina</button></form></div></div>{t.description&&<p className="mt-3 whitespace-pre-wrap text-slate-700">{t.description}</p>}{t.notes&&<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.notes}</p>}</div>
        })}</div>
    </section>
  </main>;
}
