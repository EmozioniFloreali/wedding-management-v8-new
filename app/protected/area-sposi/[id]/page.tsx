import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function confirmQuote(formData: FormData) {
  "use server";
  const quoteId = String(formData.get("quote_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  if (!quoteId || !coupleId) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: membership } = await supabase.from("couple_members").select("couple_id").eq("couple_id", coupleId).eq("user_id", user.id).maybeSingle();
  if (!membership) redirect("/protected");
  const { error } = await supabase.rpc("confirm_quote", { p_quote_id: quoteId });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/area-sposi/${coupleId}`);
  redirect(`/protected/area-sposi/${coupleId}?quote=confirmed`);
}

async function sendCoupleMessage(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const coupleId = String(formData.get("couple_id") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!coupleId || !body) return;
  const { data: member } = await supabase.from("couple_members").select("couple_id").eq("couple_id", coupleId).eq("user_id", user.id).maybeSingle();
  const { data: coupleAccess } = await supabase.from("couples").select("portal_enabled").eq("id", coupleId).maybeSingle();
  if (!member || !coupleAccess?.portal_enabled) redirect("/protected");
  let { data: conversation } = await supabase.from("conversations").select("id").eq("couple_id", coupleId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!conversation) {
    const created = await supabase.from("conversations").insert({ couple_id: coupleId, title: "Comunicazioni Emozioni Floreali" }).select("id").single();
    if (created.error) throw new Error(created.error.message);
    conversation = created.data;
  }
  const { error } = await supabase.from("messages").insert({ conversation_id: conversation.id, sender_id: user.id, body, status: "inviato" });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/area-sposi/${coupleId}`);
}

export default async function AreaSposiPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: membership } = await supabase.from("couple_members").select("couple_id").eq("couple_id", id).eq("user_id", user.id).maybeSingle(); const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!membership && profile?.role !== "admin") redirect("/protected");
  const { data: couple } = await supabase.from("couples").select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name,portal_enabled").eq("id", id).maybeSingle();
  if (!couple) redirect("/protected");
  if (!couple.portal_enabled && profile?.role !== "admin") redirect("/protected");
  const [{ data: wedding }, { data: project }, { data: events }, { data: docs }, { data: quote }] = await Promise.all([
    supabase.from("weddings").select("wedding_date,wedding_time,venue,ceremony_location,church,reception_hall,status,notes").eq("couple_id", id).maybeSingle(),
    supabase.from("floral_projects").select("id,name,status,notes,total_amount").eq("couple_id", id).maybeSingle(),
    supabase.from("calendar_events").select("id,title,start_at,event_type,location,status").eq("couple_id", id).order("start_at", { ascending: true }).limit(8),

    supabase.from("client_documents").select("id,name,category,storage_path,mime_type,visible_to_couple,created_at").eq("couple_id", id).eq("visible_to_couple", true).order("created_at", { ascending: false }),
    supabase.from("quotes").select("id,status,validity_days,total_amount,deposit_amount,confirmed_at").eq("couple_id", id).order("version_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: conversation } = await supabase.from("conversations").select("id").eq("couple_id", id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const { data: messages } = conversation
    ? await supabase.from("messages").select("id,body,created_at,sender_id,read_at").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(5)
    : { data: [] };
  const name = [couple.partner1_first_name, couple.partner1_last_name, couple.partner2_first_name, couple.partner2_last_name].filter(Boolean).join(" ");

  let quoteTotal = Number(quote?.total_amount || 0);
  let quotePaid = 0;

  if (quote) {
    const { data: quoteItems } = await supabase.from("quote_items").select("quantity").eq("quote_id", quote.id);
    const { data: quotePayments } = await supabase.from("quote_payments").select("amount").eq("quote_id", quote.id);
    if (quoteItems && quoteItems.length) {
      quoteTotal = Number(quote?.total_amount || 0);
    }
    quotePaid = (quotePayments || []).reduce((sum,payment) => sum + Number(payment.amount || 0), 0);
  }
  return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-6xl px-6 py-10"><div className="mb-8"><p className="text-sm text-slate-500">Area riservata sposi</p><h1 className="mt-1 text-3xl font-bold text-slate-900">{name}</h1><p className="mt-1 text-slate-600">Tutto ciò che riguarda il vostro matrimonio in un unico spazio.</p></div><div className="grid gap-6 md:grid-cols-2"><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Matrimonio</h2>{wedding ? <div className="mt-4 space-y-2 text-slate-700"><p><b>Data:</b> {new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" }).format(new Date(`${wedding.wedding_date}T12:00:00`))}</p>{wedding.wedding_time && <p><b>Ora:</b> {String(wedding.wedding_time).slice(0,5)}</p>}{wedding.venue && <p><b>Location:</b> {wedding.venue}</p>}{wedding.church && <p><b>Cerimonia:</b> {wedding.church}</p>}{wedding.reception_hall && <p><b>Ricevimento:</b> {wedding.reception_hall}</p>}</div> : <p className="mt-4 text-slate-500">Scheda matrimonio non ancora compilata.</p>}</section><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Progetto floreale</h2>{project ? <div className="mt-4"><p className="font-medium">{project.name}</p><p className="mt-1 text-sm text-slate-500">Stato: {project.status}</p><Link className="mt-4 inline-block rounded-lg border px-4 py-2" href={`/protected/area-sposi/${id}/progetto`}>Visualizza progetto</Link></div> : <p className="mt-4 text-slate-500">Progetto non ancora disponibile.</p>}</section><section id="calendario" className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Calendario</h2><a href="#calendario" className="text-sm font-medium underline">Apri calendario</a></div><div className="mt-4 space-y-3">{(events || []).length ? events!.map(e => <div key={e.id} className="rounded-xl border p-3"><div className="font-medium">{e.title}</div><div className="text-sm text-slate-500">{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(e.start_at))}</div>{e.location && <div className="text-sm">{e.location}</div>}</div>) : <p className="text-slate-500">Nessun appuntamento.</p>}</div></section><section id="messaggi" className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Messaggi</h2><a href="#messaggi" className="text-sm font-medium underline">Apri messaggi</a></div><div className="mt-4 space-y-3">{(messages || []).length ? messages!.map(m => <div key={m.id} className="rounded-xl border p-3"><div className="text-xs text-slate-400">{new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(m.created_at))}</div><p className="mt-1 line-clamp-3 whitespace-pre-wrap">{m.body}</p></div>) : <p className="text-slate-500">Nessun messaggio.</p>}<form action={sendCoupleMessage} className="mt-5"><input type="hidden" name="couple_id" value={id}/><textarea required name="body" className="min-h-24 w-full rounded-xl border p-3" placeholder="Scrivete un messaggio a Emozioni Floreali..."/><button className="mt-3 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Invia messaggio</button></form></div></section><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Documenti disponibili</h2><div className="mt-4 space-y-2">{(docs || []).length ? docs!.map(d => <a key={d.id} href={`/protected/coppie/${id}/documenti/${d.id}`} target="_blank" rel="noreferrer" className="block rounded-xl border p-3 transition hover:bg-slate-50"><div className="font-medium">{d.name}</div><div className="text-sm text-slate-500">{d.category || "Documento"} · Apri documento</div></a>) : <p className="text-slate-500">Nessun documento condiviso.</p>}</div></section><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Preventivo</h2>{quote ? <div className="mt-4 space-y-4"><p>Stato: <b>{quote.status}</b></p><p>Totale: <b>€ {quoteTotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</b></p>{quote.deposit_amount != null && <p>Acconto: € {Number(quote.deposit_amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>} {(quote.status === "presentato" || quote.status === "in_attesa_conferma") && <form action={confirmQuote}><input type="hidden" name="quote_id" value={quote.id}/><input type="hidden" name="couple_id" value={id}/><button className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Confermo il preventivo</button><p className="mt-2 text-xs text-slate-500">Il contratto è già stato generato alla presentazione del preventivo. La vostra conferma registra la decisione degli sposi.</p></form>} {quote.status === "confermato" && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Preventivo confermato. Il contratto era già stato generato alla presentazione.</p>}</div> : <p className="mt-4 text-slate-500">Nessun preventivo disponibile.</p>}</section></div><div className="mt-8"><Link href="/protected" className="rounded-xl border bg-white px-5 py-3 font-medium">Torna alla home dell'area sposi</Link></div></div></main>;
}






