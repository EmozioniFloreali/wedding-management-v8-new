import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function projectStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    draft: "Bozza",
    in_progress: "In lavorazione",
    approved: "Approvato",
    completed: "Completato",
    archived: "Archiviato",
  };
  return labels[status || ""] || status || "—";
}

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


async function signContract(formData: FormData) {
  "use server";
  const contractId = String(formData.get("contract_id") || "");
  const coupleId = String(formData.get("couple_id") || "");
  const accepted = formData.get("accepted") === "on";
  if (!contractId || !coupleId || !accepted) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("couple_id", coupleId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/protected");

  const { error } = await supabase.rpc("sign_contract_by_couple", {
    p_contract_id: contractId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/area-sposi/${coupleId}`);
  revalidatePath(`/protected/coppie/${coupleId}/contratti`);
  redirect(`/protected/area-sposi/${coupleId}?contract=signed`);
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
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      body,
      status: "inviato",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: notificationError } = await supabase.rpc("notify_admin_new_couple_message", {
    p_couple_id: coupleId,
    p_message_id: message.id,
  });
  if (notificationError) throw new Error(notificationError.message);

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
  const [{ data: wedding }, { data: project }, { data: events }, { data: docs }, { data: quote }, { data: latestContract }] = await Promise.all([
    supabase.from("weddings").select("wedding_date,wedding_time,venue,ceremony_location,church,reception_hall,status,notes").eq("couple_id", id).maybeSingle(),
    supabase.from("floral_projects").select("id,name,status,notes,total_amount").eq("couple_id", id).maybeSingle(),
    supabase.from("calendar_events").select("id,title,start_at,event_type,location,status").eq("couple_id", id).order("start_at", { ascending: true }).limit(8),

    supabase.from("client_documents").select("id,name,category,storage_path,mime_type,visible_to_couple,created_at").eq("couple_id", id).eq("visible_to_couple", true).order("created_at", { ascending: false }),
    supabase.from("quotes").select("id,status,validity_days,total_amount,deposit_amount,confirmed_at").eq("couple_id", id).order("version_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("contracts").select("id,version_number,contract_date,total_amount,deposit_amount,balance_amount,signed_by_client,signed_at,quote_id,document_id").eq("couple_id", id).order("version_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: conversation } = await supabase.from("conversations").select("id").eq("couple_id", id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const { data: messages } = conversation
    ? await supabase.from("messages").select("id,body,created_at,sender_id,read_at").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(5)
    : { data: [] };
  const name = [couple.partner1_first_name, couple.partner1_last_name, couple.partner2_first_name, couple.partner2_last_name].filter(Boolean).join(" ");

  let quoteTotal = Number(quote?.total_amount || 0);
  if (quote) quoteTotal = Number(quote.total_amount || 0);
  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-6xl px-6 py-10"><div className="mb-8"><p className="text-sm text-muted-foreground">Area riservata sposi</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{name}</h1><p className="mt-1 text-muted-foreground">Tutto ciò che riguarda il vostro matrimonio in un unico spazio.</p></div><div className="grid gap-6 md:grid-cols-2"><section className="ef-card p-6"><h2 className="text-xl font-semibold">Matrimonio</h2>{wedding ? <div className="mt-4 space-y-2 text-foreground"><p><b>Data:</b> {new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" }).format(new Date(`${wedding.wedding_date}T12:00:00`))}</p>{wedding.wedding_time && <p><b>Ora:</b> {String(wedding.wedding_time).slice(0,5)}</p>}{wedding.venue && <p><b>Location:</b> {wedding.venue}</p>}{wedding.church && <p><b>Cerimonia:</b> {wedding.church}</p>}{wedding.reception_hall && <p><b>Ricevimento:</b> {wedding.reception_hall}</p>}</div> : <p className="mt-4 text-muted-foreground">Scheda matrimonio non ancora compilata.</p>}</section><section className="ef-card p-6"><h2 className="text-xl font-semibold">Progetto floreale</h2>{project ? <div className="mt-4"><p className="font-medium">{project.name}</p><p className="mt-1 text-sm text-muted-foreground">Stato: {projectStatusLabel(project.status)}</p><Link className="ef-button-secondary mt-4 inline-block" href={`/protected/area-sposi/${id}/progetto`}>Visualizza progetto</Link></div> : <p className="mt-4 text-muted-foreground">Progetto non ancora disponibile.</p>}</section><section id="calendario" className="ef-card p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Calendario</h2><Link href={`/protected/area-sposi/${id}/calendario`} className="text-sm font-medium underline">Apri calendario</Link></div><div className="mt-4 space-y-3">{(events || []).length ? events!.map(e => <div key={e.id} className="rounded-xl border p-3"><div className="font-medium">{e.title}</div><div className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(e.start_at))}</div>{e.location && <div className="text-sm">{e.location}</div>}</div>) : <p className="text-muted-foreground">Nessun appuntamento.</p>}</div></section><section id="messaggi" className="ef-card p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Messaggi</h2><a href="#messaggi" className="text-sm font-medium underline">Apri messaggi</a></div><div className="mt-4 space-y-3">{(messages || []).length ? messages!.map(m => <div key={m.id} className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(m.created_at))}</div><p className="mt-1 line-clamp-3 whitespace-pre-wrap">{m.body}</p></div>) : <p className="text-muted-foreground">Nessun messaggio.</p>}<form action={sendCoupleMessage} className="mt-5"><input type="hidden" name="couple_id" value={id}/><textarea required name="body" className="min-h-24 w-full rounded-xl border p-3" placeholder="Scrivete un messaggio a Emozioni Floreali..."/><button className="ef-button-primary mt-3">Invia messaggio</button></form></div></section><section className="ef-card p-6"><h2 className="text-xl font-semibold">Documenti disponibili</h2><div className="mt-4 space-y-2">{(docs || []).length ? docs!.map(d => <a key={d.id} href={`/protected/coppie/${id}/documenti/${d.id}`} target="_blank" rel="noreferrer" className="ef-card block p-3 transition hover:shadow-md"><div className="font-medium">{d.name}</div><div className="text-sm text-muted-foreground">{d.category || "Documento"} · Apri documento</div></a>) : <p className="text-muted-foreground">Nessun documento condiviso.</p>}</div></section><section className="ef-card p-6"><h2 className="text-xl font-semibold">Preventivo</h2>{quote ? <div className="mt-4 space-y-4"><p>Stato: <b>{quote.status}</b></p><p>Totale: <b>€ {quoteTotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</b></p>{quote.deposit_amount != null && <p>Acconto: € {Number(quote.deposit_amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>} {(quote.status === "presentato" || quote.status === "in_attesa_conferma") && <form action={confirmQuote}><input type="hidden" name="quote_id" value={quote.id}/><input type="hidden" name="couple_id" value={id}/><button className="ef-button-primary">Confermo il preventivo</button><p className="mt-2 text-xs text-muted-foreground">Il contratto è già stato generato alla presentazione del preventivo. La vostra conferma registra la decisione degli sposi.</p></form>} {quote.status === "confermato" && <p className="rounded-xl bg-secondary p-3 text-sm font-semibold text-primary">Preventivo confermato. Il contratto era già stato generato alla presentazione.</p>}</div> : <p className="mt-4 text-muted-foreground">Nessun preventivo disponibile.</p>}</section>
<section className="ef-card p-6">
  <h2 className="text-xl font-semibold">Firma del contratto</h2>
  {!latestContract ? (
    <p className="mt-4 text-muted-foreground">Il contratto non è ancora disponibile.</p>
  ) : latestContract.signed_by_client ? (
    <div className="mt-4 rounded-xl bg-secondary p-4 text-sm text-primary">
      <p className="font-semibold">Contratto v{latestContract.version_number} firmato.</p>
      <p className="mt-1">Firma registrata il {latestContract.signed_at ? new Date(latestContract.signed_at).toLocaleString("it-IT") : "—"}.</p>
    </div>
  ) : quote?.status !== "confermato" ? (
    <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-semibold">Prima di firmare il contratto dovete confermare il preventivo.</p>
      <p className="mt-1">Dopo la conferma comparirà qui il comando per la firma del Contratto v{latestContract.version_number}.</p>
    </div>
  ) : (
    <form action={signContract} className="mt-4">
      <input type="hidden" name="contract_id" value={latestContract.id}/>
      <input type="hidden" name="couple_id" value={id}/>
      <label className="flex items-start gap-3 rounded-xl border bg-background p-4">
        <input type="checkbox" name="accepted" required className="mt-1 h-4 w-4"/>
        <span className="text-sm text-foreground">Dichiaro di aver letto il Contratto v{latestContract.version_number} e di accettarne il contenuto.</span>
      </label>
      <button className="ef-button-primary mt-4">Firma e accetta il contratto</button>
      <p className="mt-2 text-xs text-muted-foreground">La firma viene registrata con data e ora e comunicata a Emozioni Floreali.</p>
    </form>
  )}
</section></div><div className="mt-8"><Link href="/protected" className="rounded-xl border bg-card px-5 py-3 font-medium">Torna alla home dell'area sposi</Link></div></div></main>;
}






