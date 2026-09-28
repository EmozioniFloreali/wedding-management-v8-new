import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generaContratto } from "@/app/protected/coppie/[id]/contratto/actions";

export const instant = false;

const STATUS = [
  ["draft", "Bozza"],
  ["sent", "Inviato"],
  ["accepted", "Accettato"],
  ["rejected", "Rifiutato"],
  ["expired", "Scaduto"],
] as const;

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

async function salvaPreventivo(formData: FormData) {
  "use server";
  const { supabase, user } = await getAdmin();
  const coupleId = value(formData, "couple_id");
  const projectId = value(formData, "project_id") || null;
  const quoteId = value(formData, "quote_id");
  const status = value(formData, "status") || "draft";
  const validUntil = value(formData, "valid_until") || null;
  const notes = value(formData, "notes");
  const discountType = value(formData, "discount_type") || "percent";
  const discountValue = amount(formData, "discount_value");
  const vatRate = amount(formData, "vat_rate");
  const depositRequired = amount(formData, "deposit_required");

  const { data: quote, error } = await supabase.from("quotes").upsert({
    ...(quoteId ? { id: quoteId } : {}),
    couple_id: coupleId,
    project_id: projectId,
    status,
    valid_until: validUntil,
    notes,
    discount_type: discountType,
    discount_value: discountValue,
    vat_rate: vatRate,
    deposit_required: depositRequired,
    created_by: user.id,
  }, { onConflict: "id" }).select("id").single();

  if (error || !quote) throw new Error(error?.message || "Impossibile salvare il preventivo");
  revalidatePath(`/protected/coppie/${coupleId}/preventivo`);
}

async function salvaVoce(formData: FormData) {
  "use server";
  const { supabase } = await getAdmin();
  const quoteId = value(formData, "quote_id");
  const description = value(formData, "description");
  if (!quoteId || !description) return;
  await supabase.from("quote_items").insert({
    quote_id: quoteId,
    description,
    quantity: amount(formData, "quantity") || 1,
    unit: value(formData, "unit") || "pz",
    unit_price: amount(formData, "unit_price"),
    discount_percent: amount(formData, "discount_percent"),
    sort_order: Math.floor(Date.now() / 1000),
  });
  const { data: quote } = await supabase.from("quotes").select("couple_id").eq("id", quoteId).single();
  if (quote) revalidatePath(`/protected/coppie/${quote.couple_id}/preventivo`);
}

async function eliminaVoce(formData: FormData) {
  "use server";
  const { supabase } = await getAdmin();
  const itemId = value(formData, "item_id");
  const quoteId = value(formData, "quote_id");
  await supabase.from("quote_items").delete().eq("id", itemId);
  const { data: quote } = await supabase.from("quotes").select("couple_id").eq("id", quoteId).single();
  if (quote) revalidatePath(`/protected/coppie/${quote.couple_id}/preventivo`);
}

async function registraPagamento(formData: FormData) {
  "use server";
  const { supabase, user } = await getAdmin();
  const quoteId = value(formData, "quote_id");
  await supabase.from("quote_payments").insert({
    quote_id: quoteId,
    payment_date: value(formData, "payment_date") || undefined,
    amount: amount(formData, "payment_amount"),
    method: value(formData, "method"),
    reference: value(formData, "reference"),
    notes: value(formData, "payment_notes"),
    created_by: user.id,
  });
  const { data: quote } = await supabase.from("quotes").select("couple_id").eq("id", quoteId).single();
  if (quote) revalidatePath(`/protected/coppie/${quote.couple_id}/preventivo`);
}

async function eliminaPagamento(formData: FormData) {
  "use server";
  const { supabase } = await getAdmin();
  const paymentId = value(formData, "payment_id");
  const quoteId = value(formData, "quote_id");
  await supabase.from("quote_payments").delete().eq("id", paymentId);
  const { data: quote } = await supabase.from("quotes").select("couple_id").eq("id", quoteId).single();
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

  const { data: couple } = await supabase.from("couples").select("id, partner1_first_name, partner1_last_name, partner2_first_name, partner2_last_name").eq("id", coupleId).maybeSingle();
  if (!couple) redirect("/protected/coppie");

  const { data: project } = await supabase.from("floral_projects").select("id, name, total_amount").eq("couple_id", coupleId).maybeSingle();
  const { data: quote } = await supabase.from("quotes").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: items } = quote ? await supabase.from("quote_items").select("*").eq("quote_id", quote.id).order("sort_order", { ascending: true }) : { data: [] };
  const { data: payments } = quote ? await supabase.from("quote_payments").select("*").eq("quote_id", quote.id).order("payment_date", { ascending: true }) : { data: [] };
  const { data: documents } = await supabase.from("client_documents").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false });

  const coupleName = [couple.partner1_first_name, couple.partner1_last_name, couple.partner2_first_name, couple.partner2_last_name].filter(Boolean).join(" ");
  const subtotal = (items || []).reduce((sum, item) => {
    const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
    const discount = gross * (Number(item.discount_percent || 0) / 100);
    return sum + gross - discount;
  }, 0);
  const discount = quote ? quote.discount_type === "fixed" ? Math.min(subtotal, Number(quote.discount_value || 0)) : Math.min(subtotal, subtotal * Number(quote.discount_value || 0) / 100) : 0;
const total = Math.max(0, subtotal - discount);
const vatRate = Number(quote?.vat_rate || 10);
const taxable = vatRate > 0 ? total / (1 + vatRate / 100) : total;
const vat = total - taxable;
  const paid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, total - paid);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link href="/protected/coppie">Coppie</Link><span>/</span><Link href={`/protected/coppie/${coupleId}`}>{coupleName}</Link><span>/</span><span>Preventivo</span></div>
            <h1 className="text-3xl font-bold text-slate-900">Preventivo e documenti</h1>
            <p className="mt-1 text-slate-600">Gestione economica e amministrativa della coppia.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={generaContratto}>
              <input type="hidden" name="couple_id" value={coupleId} />
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">📄 Crea contratto d'opera</button>
            </form>
            <Link href={`/protected/coppie/${coupleId}/progetto`} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">Progetto floreale</Link>
            <Link href={`/protected/coppie/${coupleId}`} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">Scheda coppia</Link>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5"><h2 className="text-xl font-bold text-slate-900">Preventivo</h2><p className="mt-1 text-sm text-slate-500">Voci, sconti, IVA, acconto e saldo.</p></div>
          <form action={salvaPreventivo} className="grid gap-5 lg:grid-cols-4">
            <input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="project_id" value={project?.id || ""}/><input type="hidden" name="quote_id" value={quote?.id || ""}/>
            <div><label className="mb-1 block text-sm font-semibold">Stato</label><select name="status" defaultValue={quote?.status || "draft"} className="w-full rounded-xl border px-3 py-3">{STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="mb-1 block text-sm font-semibold">Valido fino al</label><input type="date" name="valid_until" defaultValue={quote?.valid_until || ""} className="w-full rounded-xl border px-3 py-3"/></div>
            <div><label className="mb-1 block text-sm font-semibold">Tipo sconto</label><select name="discount_type" defaultValue={quote?.discount_type || "percent"} className="w-full rounded-xl border px-3 py-3"><option value="percent">Percentuale</option><option value="fixed">Importo fisso</option></select></div>
            <div><label className="mb-1 block text-sm font-semibold">Sconto</label><input name="discount_value" defaultValue={quote?.discount_value || "0"} className="w-full rounded-xl border px-3 py-3"/></div>
            <div><label className="mb-1 block text-sm font-semibold">IVA %</label><input name="vat_rate" defaultValue={quote?.vat_rate ?? 10} className="w-full rounded-xl border px-3 py-3"/></div>
            <div><label className="mb-1 block text-sm font-semibold">Acconto richiesto</label><input name="deposit_required" defaultValue={quote?.deposit_required || "0"} className="w-full rounded-xl border px-3 py-3"/></div>
            <div className="lg:col-span-2"><label className="mb-1 block text-sm font-semibold">Note</label><input name="notes" defaultValue={quote?.notes || ""} className="w-full rounded-xl border px-3 py-3" placeholder="Condizioni, tempi, note commerciali..."/></div>
            <div className="lg:col-span-4 flex justify-end"><button className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white">Salva preventivo</button></div>
          </form>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5"><h2 className="text-xl font-bold">Voci del preventivo</h2></div>
          {!quote ? <p className="text-sm text-slate-500">Salva prima il preventivo per aggiungere le voci.</p> : <>
            <div className="space-y-2">{(items || []).map(item => <div key={item.id} className="flex flex-col gap-3 rounded-xl border bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"><div><div className="font-semibold">{item.description}</div><div className="text-sm text-slate-500">{item.quantity} {item.unit} × {money(Number(item.unit_price || 0))}{Number(item.discount_percent||0)>0?` · sconto ${item.discount_percent}%`:""}</div></div><div className="flex items-center gap-3"><strong>{money(Number(item.quantity||0)*Number(item.unit_price||0)*(1-Number(item.discount_percent||0)/100))}</strong><form action={eliminaVoce}><input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="quote_id" value={quote.id}/><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Elimina</button></form></div></div>)}</div>
            <form action={salvaVoce} className="mt-5 grid gap-3 rounded-xl border border-dashed p-4 lg:grid-cols-5"><input type="hidden" name="quote_id" value={quote.id}/><input name="description" required placeholder="Descrizione voce" className="rounded-lg border px-3 py-2.5 lg:col-span-2"/><input name="quantity" defaultValue="1" type="number" min="0.01" step="0.01" className="rounded-lg border px-3 py-2.5"/><input name="unit" defaultValue="pz" className="rounded-lg border px-3 py-2.5"/><input name="unit_price" placeholder="Prezzo unitario" className="rounded-lg border px-3 py-2.5"/><input name="discount_percent" defaultValue="0" placeholder="Sconto %" className="rounded-lg border px-3 py-2.5"/><button className="rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white lg:col-span-5">+ Aggiungi voce</button></form>
          </>}
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Riepilogo economico</h2><div className="mt-5 space-y-2 text-sm"><div className="flex justify-between"><span>Totale voci IVA inclusa</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span>Sconto</span><strong>- {money(discount)}</strong></div><div className="flex justify-between"><span>Imponibile</span><strong>{money(taxable)}</strong></div><div className="flex justify-between"><span>IVA {quote?.vat_rate ?? 10}%</span><strong>{money(vat)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Totale</span><strong>{money(total)}</strong></div><div className="flex justify-between"><span>Pagato</span><strong>{money(paid)}</strong></div><div className="flex justify-between text-lg text-amber-700"><span>Saldo</span><strong>{money(balance)}</strong></div></div></div>
          <div className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Pagamenti</h2>{!quote?<p className="mt-3 text-sm text-slate-500">Salva il preventivo per registrare gli acconti.</p>:<><div className="mt-4 space-y-2">{(payments||[]).map(p=><div key={p.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><div><strong>{p.payment_date}</strong> · {p.method||"Pagamento"}{p.reference?` · ${p.reference}`:""}</div><div className="flex gap-3"><strong>{money(Number(p.amount||0))}</strong><form action={eliminaPagamento}><input type="hidden" name="payment_id" value={p.id}/><input type="hidden" name="quote_id" value={quote.id}/><button className="text-red-600">×</button></form></div></div>)}</div><form action={registraPagamento} className="mt-4 grid gap-2"><input type="hidden" name="quote_id" value={quote.id}/><div className="grid gap-2 md:grid-cols-3"><input name="payment_date" type="date" className="rounded-lg border px-3 py-2"/><input name="payment_amount" placeholder="Importo" className="rounded-lg border px-3 py-2"/><input name="method" placeholder="Metodo" className="rounded-lg border px-3 py-2"/></div><div className="grid gap-2 md:grid-cols-2"><input name="reference" placeholder="Riferimento" className="rounded-lg border px-3 py-2"/><input name="payment_notes" placeholder="Note" className="rounded-lg border px-3 py-2"/></div><button className="rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white">Registra pagamento</button></form></>}</div>
        </section>

        <section className="mb-8 rounded-2xl border bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-bold">Documenti e file</h2><p className="mt-1 text-sm text-slate-500">Contratti, preventivi, ricevute, foto e PDF collegati alla coppia.</p></div><div className="space-y-2">{(documents||[]).map(d=><div key={d.id} className="flex flex-col gap-2 rounded-xl border bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"><div><div className="font-semibold">{d.name}</div><div className="text-xs text-slate-500">{d.category}{d.visible_to_couple?" · visibile agli sposi":" · privato"}</div></div><div className="flex items-center gap-2"><Link href={`/protected/coppie/${coupleId}/documenti/${d.id}`} target="_blank" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">Apri</Link><form action={eliminaDocumento}><input type="hidden" name="document_id" value={d.id}/><input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="storage_path" value={d.storage_path||""}/><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Elimina</button></form></div></div>)}</div><form action={uploadDocumento} encType="multipart/form-data" className="mt-5 grid gap-3 rounded-xl border border-dashed p-4 lg:grid-cols-4"><input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="quote_id" value={quote?.id||""}/><input type="file" name="file" required className="rounded-lg border bg-white px-3 py-2 lg:col-span-2"/><select name="category" defaultValue="altro" className="rounded-lg border px-3 py-2">{CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="visible_to_couple"/> Visibile agli sposi</label><input name="document_notes" placeholder="Nota documento" className="rounded-lg border px-3 py-2 lg:col-span-3"/><button className="rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white">Carica documento</button></form></section>
      </div>
    </main>
  );
}



