import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generaContratto } from "@/app/protected/coppie/[id]/contratto/actions";
const STATUS = [
  ["bozza", "Bozza"],
  ["in_attesa_conferma", "In attesa di conferma"],
  ["presentato", "Presentato"],
  ["confermato", "Confermato"],
  ["rifiutato_da_modificare", "Da modificare"],
] as const;

function uiStatus(status: string | null | undefined) {
  if (status === "sent" || status === "presentato") return "presentato";
  if (status === "rejected" || status === "rifiutato_da_modificare") return "rifiutato_da_modificare";
  if (status === "accepted" || status === "confermato") return "confermato";
  return "bozza";
}

function dbStatus(status: string) {
  if (status === "presentato" || status === "in_attesa_conferma") return "sent";
  if (status === "rifiutato_da_modificare") return "rejected";
  if (status === "confermato") return "accepted";
  return "draft";
}

const CATEGORIES = [
  ["preventivo", "Preventivo"],
  ["contratto", "Contratto"],
  ["ricevuta", "Ricevuta"],
  ["foto", "Foto"],
  ["pdf", "PDF"],
  ["altro", "Altro"],
] as const;

function value(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null ? "" : String(v).trim();
}

function amount(formData: FormData, key: string) {
  const raw = value(formData, key).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function money(n: number) {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function getAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/protected");
  return { supabase, user };
}

async function syncProjectSelectionsToQuote(supabase: any, projectId: string, quoteId: string) {
  const { data: selectedItems } = await supabase.from("floral_project_items")
    .select("id,category,name,description,quantity,unit,notes,sort_order,include_in_quote")
    .eq("project_id", projectId)
    .eq("include_in_quote", true)
    .order("sort_order", { ascending: true });

  await supabase.from("quote_items")
    .delete()
    .eq("quote_id", quoteId)
    .like("notes", "floral_project_item_id:%");

  const rows = (selectedItems || []).map((item: any, index: number) => ({
    quote_id: quoteId,
    area: item.category || null,
    description: item.description ? `${item.name} — ${item.description}` : item.name,
    quantity: item.quantity ?? 1,
    unit: item.unit || "pz",
    notes: `floral_project_item_id:${item.id}${item.notes ? ` — ${item.notes}` : ""}`,
    sort_order: index + 1,
  }));

  if (rows.length) {
    const { error } = await supabase.from("quote_items").insert(rows);
    if (error) throw new Error(error.message);
  }
}

async function assertQuoteDraft(supabase: any, quoteId: string) {
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("couple_id,status")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quote) throw new Error("Preventivo non trovato.");
  if (quote.status !== "draft") {
    throw new Error("Il preventivo non è più modificabile perché è stato presentato. Modifica il Progetto Floreale e crea una nuova versione del preventivo.");
  }
  return quote;
}

async function salvaPreventivo(formData: FormData) {
  "use server";
  const { supabase, user } = await getAdmin();
  const coupleId = value(formData, "couple_id");
  const projectId = value(formData, "project_id");
  const quoteId = value(formData, "quote_id");
  const statusUi = value(formData, "status") || "bozza";
  const status = dbStatus(statusUi);
  const validityDays = Math.max(0, Math.round(amount(formData, "validity_days") || 30));
  const notes = value(formData, "notes");
  const totalAmount = amount(formData, "total_amount");
  const depositAmount = Math.min(totalAmount, Math.max(0, amount(formData, "deposit_amount")));
  const vatIncluded = value(formData, "vat_included") === "on";
  const vatRate = vatIncluded ? 10 : 0;
  const taxableAmount = vatIncluded ? Math.round((totalAmount / 1.1) * 100) / 100 : totalAmount;
  const vatAmount = Math.round((totalAmount - taxableAmount) * 100) / 100;
  const validUntil = new Date(Date.now() + validityDays * 86400000).toISOString().slice(0, 10);

  if (!coupleId || !projectId) return;

  if (quoteId) {
    const { data: existingQuote, error: existingQuoteError } = await supabase
      .from("quotes")
      .select("id,status")
      .eq("id", quoteId)
      .maybeSingle();
    if (existingQuoteError) throw new Error(existingQuoteError.message);
    if (!existingQuote) throw new Error("Preventivo non trovato.");

    // Recupero controllato: se il precedente tentativo di presentazione
    // ha già portato lo stato a "sent" ma la generazione del contratto
    // è fallita, consentiamo di ripetere esclusivamente la generazione.
    if (existingQuote.status !== "draft") {
      if (statusUi === "presentato" && existingQuote.status === "sent") {
        await generaContratto((() => {
          const fd = new FormData();
          fd.set("couple_id", coupleId);
          return fd;
        })());
        return;
      }
      throw new Error("Il preventivo non è più modificabile perché è stato presentato. Modifica il Progetto Floreale e crea una nuova versione del preventivo.");
    }
  }

  const payload = {
    couple_id: coupleId,
    project_id: projectId,
    status,
    valid_until: validUntil,
    notes: notes || null,
    discount_type: "percent",
    discount_value: 0,
    vat_rate: vatRate,
    subtotal: taxableAmount,
    discount_amount: 0,
    taxable_amount: taxableAmount,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    deposit_required: depositAmount,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: quote, error } = quoteId
    ? await supabase.from("quotes").update(payload).eq("id", quoteId).select("id").single()
    : await supabase.from("quotes").insert(payload).select("id").single();

  if (error || !quote) throw new Error(error?.message || "Impossibile salvare il preventivo");

  await syncProjectSelectionsToQuote(supabase, projectId, quote.id);
  revalidatePath(`/protected/coppie/${coupleId}/preventivo`);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
  if (statusUi === "presentato") {
    const contractForm = new FormData();
    contractForm.set("couple_id", coupleId);
    await generaContratto(contractForm);
  }
}

async function salvaVoce(formData: FormData) {
  "use server";
  const { supabase } = await getAdmin();
  const quoteId = value(formData, "quote_id");
  const description = value(formData, "description");
  if (!quoteId || !description) return;
  const quote = await assertQuoteDraft(supabase, quoteId);
  const { error } = await supabase.from("quote_items").insert({
    quote_id: quoteId,
    area: "manuale",
    description,
    quantity: amount(formData, "quantity") || 1,
    unit: value(formData, "unit") || "pz",
    notes: value(formData, "notes") || null,
    sort_order: Math.floor(Date.now() / 1000),
  });
  if (error) throw new Error(error.message);
  if (quote) revalidatePath(`/protected/coppie/${quote.couple_id}/preventivo`);
}

async function eliminaVoce(formData: FormData) {
  "use server";
  const { supabase } = await getAdmin();
  const itemId = value(formData, "item_id");
  const quoteId = value(formData, "quote_id");
  const quote = await assertQuoteDraft(supabase, quoteId);
  await supabase.from("quote_items").delete().eq("id", itemId);
  if (quote) revalidatePath(`/protected/coppie/${quote.couple_id}/preventivo`);
}

async function uploadDocumento(formData: FormData) {
  "use server";
  const { supabase, user } = await getAdmin();
  const coupleId = value(formData, "couple_id");
  const quoteId = value(formData, "quote_id") || null;
  const category = value(formData, "category") || "altro";
  const visible = value(formData, "visible_to_couple") === "on";
  const notes = value(formData, "document_notes");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${coupleId}/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("client-documents").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("client_documents").insert({
    couple_id: coupleId,
    quote_id: quoteId,
    name: file.name,
    category,
    storage_path: path,
    mime_type: file.type || null,
    file_size: file.size,
    visible_to_couple: visible,
    notes,
    uploaded_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/preventivo`);
}

async function eliminaDocumento(formData: FormData) {
  "use server";
  const { supabase } = await getAdmin();
  const documentId = value(formData, "document_id");
  const coupleId = value(formData, "couple_id");
  const path = value(formData, "storage_path");
  await supabase.from("client_documents").delete().eq("id", documentId);
  if (path) await supabase.storage.from("client-documents").remove([path]);
  revalidatePath(`/protected/coppie/${coupleId}/preventivo`);
}

export default async function PreventivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: coupleId } = await params;
  const { supabase } = await getAdmin();

  const { data: couple } = await supabase.from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name")
    .eq("id", coupleId).maybeSingle();
  if (!couple) redirect("/protected/coppie");

  const { data: project } = await supabase.from("floral_projects")
    .select("id,name,total_amount").eq("couple_id", coupleId).maybeSingle();
  if (!project) redirect(`/protected/coppie/${coupleId}`);

  const { data: wedding } = await supabase.from("weddings")
    .select("id").eq("couple_id", coupleId).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: quote } = await supabase.from("quotes")
    .select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: items } = quote
    ? await supabase.from("quote_items").select("*").eq("quote_id", quote.id).order("sort_order", { ascending: true })
    : { data: [] };

  const { data: documents } = await supabase.from("client_documents")
    .select("*").eq("couple_id", coupleId).order("created_at", { ascending: false });

  const coupleName = [couple.partner1_first_name, couple.partner1_last_name, couple.partner2_first_name, couple.partner2_last_name].filter(Boolean).join(" ");
  const total = Number(quote?.total_amount ?? project.total_amount ?? 0);
  const deposit = Number(quote?.deposit_required ?? 0);
  const balance = Math.max(0, total - deposit);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Link href="/protected/coppie">Coppie</Link><span>/</span>
              <Link href={`/protected/coppie/${coupleId}`}>{coupleName}</Link><span>/</span><span>Preventivo</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Preventivo</h1>
            <p className="mt-1 text-slate-600">Le voci derivano esclusivamente da ciò che è stato selezionato nel Progetto Floreale.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {uiStatus(quote?.status) === "confermato" ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ Preventivo confermato. Il contratto era già stato generato alla presentazione.</div> : <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Il contratto viene generato automaticamente quando il preventivo viene presentato. La conferma della coppia registra la decisione degli sposi.</div>}
            <Link href={`/protected/coppie/${coupleId}/progetto`} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">Progetto floreale</Link>
            {quote && (
              <>
                <Link
                  href={`/protected/coppie/${coupleId}/preventivo/documento?format=pdf&quote_id=${quote.id}&template=professional-v2`}
                  target="_blank"
                  className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"
                >
                  PDF / Stampa
                </Link>
                <Link
                  href={`/protected/coppie/${coupleId}/preventivo/documento?format=docx&quote_id=${quote.id}&template=professional-v2`}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
                >
                  Scarica DOCX
                </Link>
              </>
            )}
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Dati economici</h2>
          <p className="mt-1 text-sm text-slate-500">Il prezzo resta unico: non vengono assegnati prezzi alle singole composizioni.</p>
          <form action={salvaPreventivo} className="mt-5 grid gap-5 lg:grid-cols-4">
            <input type="hidden" name="couple_id" value={coupleId}/>
            <input type="hidden" name="project_id" value={project.id}/>
            <input type="hidden" name="quote_id" value={quote?.id || ""}/>
            <input type="hidden" name="wedding_id" value={wedding?.id || ""}/>
            <div><label className="mb-1 block text-sm font-semibold">Titolo</label><input name="title" defaultValue={"Preventivo Progetto Floreale"} className="w-full rounded-xl border px-3 py-3"/></div>
            <div><label className="mb-1 block text-sm font-semibold">Stato</label><select name="status" defaultValue={uiStatus(quote?.status)} className="w-full rounded-xl border px-3 py-3">{STATUS.filter(([v]) => v !== "confermato").map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="mb-1 block text-sm font-semibold">Validità (giorni)</label><input name="validity_days" type="number" min="0" defaultValue={quote?.valid_until ? Math.max(0, Math.round((new Date(quote.valid_until).getTime() - new Date(quote.created_at).getTime()) / 86400000)) : 30} className="w-full rounded-xl border px-3 py-3"/></div>
            <div><label className="mb-1 block text-sm font-semibold">Totale progetto €</label><input name="total_amount" defaultValue={quote?.total_amount ?? project.total_amount ?? ""} className="w-full rounded-xl border px-3 py-3"/></div>
            <div><label className="mb-1 block text-sm font-semibold">Acconto €</label><input name="deposit_amount" defaultValue={quote?.deposit_required ?? 0} className="w-full rounded-xl border px-3 py-3"/></div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="vat_included" defaultChecked={Number(quote?.vat_rate ?? 10) === 10}/> IVA inclusa</label>
            <div className="lg:col-span-2"><label className="mb-1 block text-sm font-semibold">Note</label><input name="notes" defaultValue={quote?.notes || ""} className="w-full rounded-xl border px-3 py-3" placeholder="Condizioni, tempi, note commerciali..."/></div>
            <div className="lg:col-span-4 flex justify-end"><button className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white">Salva preventivo e aggiorna voci</button></div>
          </form>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Voci del preventivo</h2>
          <p className="mt-1 text-sm text-slate-500">Qui vengono riportate le voci selezionate nel Progetto Floreale. Le singole voci non hanno un prezzo.</p>
          {!quote ? <p className="mt-4 text-sm text-slate-500">Salva il preventivo per riportare automaticamente le voci selezionate dal progetto.</p> : (
            <div className="mt-4 space-y-2">
              {(items || []).map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border bg-slate-50 p-4">
                  <div><div className="font-semibold">{item.description}</div><div className="text-sm text-slate-500">{item.quantity} {item.unit}{item.area ? ` · ${item.area}` : ""}</div></div>
                  <form action={eliminaVoce}><input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="quote_id" value={quote.id}/><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Elimina voce</button></form>
                </div>
              ))}
              {!items?.length && <p className="text-sm text-slate-500">Nessuna voce confermata.</p>}
            </div>
          )}
          {quote && <form action={salvaVoce} className="mt-5 grid gap-3 rounded-xl border border-dashed p-4 lg:grid-cols-4">
            <input type="hidden" name="quote_id" value={quote.id}/>
            <input name="description" required placeholder="Voce aggiuntiva manuale" className="rounded-lg border px-3 py-2.5 lg:col-span-2"/>
            <input name="quantity" defaultValue="1" type="number" min="0.01" step="0.01" className="rounded-lg border px-3 py-2.5"/>
            <input name="unit" defaultValue="pz" className="rounded-lg border px-3 py-2.5"/>
            <input name="notes" placeholder="Note" className="rounded-lg border px-3 py-2.5 lg:col-span-3"/>
            <button className="rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white">+ Aggiungi voce manuale</button>
          </form>}
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Riepilogo economico</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span>Totale complessivo</span><strong>{money(total)}</strong></div>
              <div className="flex justify-between"><span>Acconto</span><strong>{money(deposit)}</strong></div>
              <div className="flex justify-between border-t pt-3 text-lg"><span>Saldo</span><strong>{money(balance)}</strong></div>
              <p className="pt-2 text-xs text-slate-500">{Number(quote?.vat_rate ?? 0) === 10 ? "IVA inclusa nel totale." : "IVA non inclusa nel totale."}</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Documenti e file</h2>
            <div className="mt-4 space-y-2">
              {(documents || []).map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border bg-slate-50 p-4">
                  <div><div className="font-semibold">{d.name}</div><div className="text-xs text-slate-500">{d.category}{d.visible_to_couple ? " · visibile agli sposi" : " · privato"}</div></div>
                  <Link href={`/protected/coppie/${coupleId}/documenti/${d.id}`} target="_blank" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Apri</Link>
                </div>
              ))}
            </div>
            <form action={uploadDocumento} encType="multipart/form-data" className="mt-5 grid gap-3 rounded-xl border border-dashed p-4">
              <input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="quote_id" value={quote?.id || ""}/>
              <input type="file" name="file" required className="rounded-lg border bg-white px-3 py-2"/>
              <select name="category" defaultValue="altro" className="rounded-lg border px-3 py-2">{CATEGORIES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="visible_to_couple"/> Visibile agli sposi</label>
              <input name="document_notes" placeholder="Nota documento" className="rounded-lg border px-3 py-2"/>
              <button className="rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white">Carica documento</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
