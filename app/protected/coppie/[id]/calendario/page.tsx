import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

export const instant = false;
const TYPES = ["appuntamento","sopralluogo","consegna","montaggio","smontaggio","scadenza","altro"];
const STATUSES = ["planned","confirmed","completed","cancelled"];

function s(v: FormDataEntryValue | null) { return v == null ? "" : String(v).trim(); }
function romeLocalToIso(value: string) {
  if (!value) return null;
  const [d,t] = value.split("T"); if (!d || !t) return null;
  const [y,m,day] = d.split("-").map(Number); const [hh,mm] = t.split(":").map(Number);
  const guess = new Date(Date.UTC(y,m-1,day,hh,mm));
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"Europe/Rome", hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"}).formatToParts(guess);
  const get=(x:string)=>Number(parts.find(p=>p.type===x)?.value||0);
  const shown=Date.UTC(get("year"),get("month")-1,get("day"),get("hour")%24,get("minute"));
  return new Date(guess.getTime()-(shown-guess.getTime())).toISOString();
}
async function saveEvent(fd: FormData) {
  "use server";
  const { supabase, user } = await requireAdmin();
  const coupleId=s(fd.get("couple_id")); const title=s(fd.get("title")); if(!coupleId||!title) return;
  const {error}=await supabase.from("calendar_events").insert({couple_id:coupleId,title,description:s(fd.get("description"))||null,event_type:s(fd.get("event_type"))||"appuntamento",start_at:romeLocalToIso(s(fd.get("start_at")))||new Date().toISOString(),end_at:romeLocalToIso(s(fd.get("end_at"))),all_day:fd.get("all_day")==="on",location:s(fd.get("location"))||null,status:s(fd.get("status"))||"planned",reminder_minutes:Number(s(fd.get("reminder_minutes")))||null,notes:s(fd.get("notes"))||null,created_by:user.id});
  if(error) throw new Error(error.message); revalidatePath(`/protected/coppie/${coupleId}/calendario`);
}
async function updateStatus(fd: FormData) {
  "use server"; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/auth/login");
  const id=s(fd.get("id")); const coupleId=s(fd.get("couple_id")); const status=s(fd.get("status")); if(!id||!coupleId||!STATUSES.includes(status)) return;
  const {error}=await supabase.from("calendar_events").update({status}).eq("id",id); if(error) throw new Error(error.message); revalidatePath(`/protected/coppie/${coupleId}/calendario`);
}
async function deleteEvent(fd: FormData) {
  "use server"; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/auth/login");
  const id=s(fd.get("id")); const coupleId=s(fd.get("couple_id")); if(!id||!coupleId) return; const {error}=await supabase.from("calendar_events").delete().eq("id",id); if(error) throw new Error(error.message); revalidatePath(`/protected/coppie/${coupleId}/calendario`);
}

export default async function CalendarPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const { supabase }=await requireAdmin();
  const {data:couple}=await supabase.from("couples").select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name").eq("id",id).maybeSingle(); if(!couple) redirect("/protected/coppie");
  const {data:events}=await supabase.from("calendar_events").select("*").eq("couple_id",id).order("start_at",{ascending:true});
  return <main className="mx-auto max-w-6xl px-6 py-10"><div className="mb-6 flex items-center justify-between gap-4"><div><div className="text-sm text-slate-500">Coppie / {couple.partner1_first_name} {couple.partner1_last_name} · {couple.partner2_first_name} {couple.partner2_last_name}</div><h1 className="mt-2 text-3xl font-bold">Calendario</h1><p className="mt-1 text-slate-600">Appuntamenti, sopralluoghi, consegne e montaggi.</p></div><Link className="rounded-lg border px-4 py-2 font-medium" href={`/protected/coppie/${id}`}>Torna alla scheda coppia</Link></div>
  <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Nuovo evento</h2><form action={saveEvent} className="mt-5 grid gap-4 md:grid-cols-2"><input type="hidden" name="couple_id" value={id}/><label>Titolo<input required name="title" className="mt-1 w-full rounded-lg border p-3" placeholder="Es. Sopralluogo sala"/></label><label>Tipo<select name="event_type" className="mt-1 w-full rounded-lg border p-3">{TYPES.map(x=><option key={x}>{x}</option>)}</select></label><label>Inizio<input required type="datetime-local" name="start_at" className="mt-1 w-full rounded-lg border p-3"/></label><label>Fine<input type="datetime-local" name="end_at" className="mt-1 w-full rounded-lg border p-3"/></label><label>Luogo<input name="location" className="mt-1 w-full rounded-lg border p-3"/></label><label>Stato<select name="status" className="mt-1 w-full rounded-lg border p-3"><option value="planned">Pianificato</option><option value="confirmed">Confermato</option></select></label><label>Promemoria<input type="number" min="0" name="reminder_minutes" className="mt-1 w-full rounded-lg border p-3" placeholder="Minuti prima"/></label><label className="flex items-center gap-2 pt-8"><input type="checkbox" name="all_day"/> Tutto il giorno</label><label className="md:col-span-2">Descrizione<textarea name="description" className="mt-1 min-h-24 w-full rounded-lg border p-3"/></label><label className="md:col-span-2">Note<textarea name="notes" className="mt-1 min-h-20 w-full rounded-lg border p-3"/></label><button className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white md:col-span-2">Salva evento</button></form></section>
  <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Agenda</h2><div className="mt-4 space-y-3">{(events||[]).length===0?<p className="text-slate-500">Nessun evento programmato.</p>:(events||[]).map(e=><div key={e.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{e.title}</div><div className="text-sm text-slate-500">{new Intl.DateTimeFormat("it-IT",{dateStyle:"full",timeStyle:"short",timeZone:"Europe/Rome"}).format(new Date(e.start_at))}{e.end_at?` → ${new Intl.DateTimeFormat("it-IT",{timeStyle:"short",timeZone:"Europe/Rome"}).format(new Date(e.end_at))}`:""}</div><div className="mt-1 text-sm">{e.event_type}{e.location?` · ${e.location}`:""}</div></div><div className="flex gap-2"><form action={updateStatus}><input type="hidden" name="id" value={e.id}/><input type="hidden" name="couple_id" value={id}/><select name="status" defaultValue={e.status} className="rounded-lg border p-2">{STATUSES.map(x=><option key={x} value={x}>{x}</option>)}</select><button className="rounded-lg border px-3 py-2">Aggiorna</button></form><form action={deleteEvent}><input type="hidden" name="id" value={e.id}/><input type="hidden" name="couple_id" value={id}/><button className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Elimina</button></form></div></div>{e.description&&<p className="mt-3 whitespace-pre-wrap text-slate-700">{e.description}</p>}</div>)}</div></section></main>;
}
