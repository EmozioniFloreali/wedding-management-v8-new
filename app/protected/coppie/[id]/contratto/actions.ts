"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildContractPdf } from "@/lib/contract-pdf";

function moneyNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function categoryLabel(value: string | null) {
  const map: Record<string, string> = {
    chiesa: "Cerimonia / Chiesa",
    sala_ricevimento: "Sala ricevimento",
    casa_sposi: "Casa sposi",
    complementi_floreali: "Complementi floreali",
    bouquet: "Bouquet",
  };
  return value ? (map[value] || value) : "";
}

export async function generaContratto(formData: FormData) {
  const coupleId = String(formData.get("couple_id") || "").trim();
  if (!coupleId) redirect("/protected/coppie");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/protected");

  const { data: couple } = await supabase
    .from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name,email,phone")
    .eq("id", coupleId)
    .maybeSingle();
  if (!couple) redirect("/protected/coppie");

  const { data: wedding } = await supabase
    .from("weddings")
    .select("wedding_date,wedding_time,venue,church,reception_hall,ceremony_location")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: project } = await supabase
    .from("floral_projects")
    .select("id,couple_id,name,status,notes,total_amount")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!project) redirect(`/protected/coppie/${coupleId}/progetto`);

  const { data: rawItems } = await supabase
    .from("floral_project_items")
    .select(`
      id,category,name,description,quantity,unit,notes,sort_order,
      floral_item_flowers(id,color,quantity,notes,floral_flowers(id,name)),
      floral_item_structures(id,quantity,color,custom_name,floral_structures(id,name))
    `)
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  const items = (rawItems || []).map((item: any) => ({
    name: item.name || item.description || "Lavorazione floreale",
    category: categoryLabel(item.category),
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes,
    flowers: (item.floral_item_flowers || []).map((f: any) => {
      const name = Array.isArray(f.floral_flowers) ? f.floral_flowers[0]?.name : f.floral_flowers?.name;
      return [name, f.color, f.quantity != null ? `Q.tà ${f.quantity}` : ""].filter(Boolean).join(" – ");
    }).filter(Boolean),
    structures: (item.floral_item_structures || []).map((s: any) => {
      const name = s.custom_name || (Array.isArray(s.floral_structures) ? s.floral_structures[0]?.name : s.floral_structures?.name);
      return [name, s.color, s.quantity != null ? `Q.tà ${s.quantity}` : ""].filter(Boolean).join(" – ");
    }).filter(Boolean),
  }));

  const { data: quote } = await supabase
    .from("quotes")
    .select("id,status,discount_type,discount_value,vat_rate,total_amount,deposit_required,notes,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let quoteData = null;
  if (quote) {
    const { data: quoteItems } = await supabase
      .from("quote_items")
      .select("description,quantity,unit,unit_price,discount_percent,sort_order")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true });
    const { data: payments } = await supabase
      .from("quote_payments")
      .select("amount")
      .eq("quote_id", quote.id);

    const subtotal = (quoteItems || []).reduce((sum, item: any) => {
      const gross = moneyNumber(item.quantity) * moneyNumber(item.unit_price);
      return sum + gross * (1 - moneyNumber(item.discount_percent) / 100);
    }, 0);
    const discount = quote.discount_type === "fixed"
      ? Math.min(subtotal, moneyNumber(quote.discount_value))
      : Math.min(subtotal, subtotal * moneyNumber(quote.discount_value) / 100);
    const total = Math.max(0, moneyNumber(quote.total_amount) || subtotal - discount);
    const paid = (payments || []).reduce((sum, p: any) => sum + moneyNumber(p.amount), 0);

    quoteData = {
      status: quote.status,
      vatRate: moneyNumber(quote.vat_rate || 10),
      total,
      deposit: moneyNumber(quote.deposit_required),
      balance: Math.max(0, total - paid),
      discount,
      notes: quote.notes,
      items: (quoteItems || []).map((item: any) => ({
        description: item.description,
        quantity: moneyNumber(item.quantity),
        unit: item.unit || "pz",
        unitPrice: moneyNumber(item.unit_price),
        discountPercent: moneyNumber(item.discount_percent),
      })),
    };
  }

  const contractDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" }).format(new Date());
  const pdf = buildContractPdf({
    contractDate,
    couple: {
      first: `${couple.partner1_first_name} ${couple.partner1_last_name}`.trim(),
      second: `${couple.partner2_first_name} ${couple.partner2_last_name}`.trim(),
      email: couple.email,
      phone: couple.phone,
    },
    wedding: {
      date: wedding?.wedding_date,
      time: wedding?.wedding_time,
      venue: wedding?.venue,
      church: wedding?.church || wedding?.ceremony_location,
      reception: wedding?.reception_hall,
    },
    project: {
      name: project.name || "Progetto floreale",
      status: project.status,
      notes: project.notes,
      total: moneyNumber(project.total_amount),
    },
    items,
    quote: quoteData,
  });

  const safeCouple = `${couple.partner1_last_name || "coppia"}-${couple.partner2_last_name || "sposi"}`.replace(/[^a-zA-Z0-9À-ÿ_-]/g, "-");
  const filename = `Contratto_d_opera_${safeCouple}.pdf`;
  const storagePath = `${coupleId}/contratti/${crypto.randomUUID()}-${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(storagePath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(`Errore caricamento contratto: ${uploadError.message}`);

  const { data: document, error: documentError } = await supabase
    .from("client_documents")
    .insert({
      couple_id: coupleId,
      quote_id: quote?.id || null,
      name: filename,
      category: "contratto",
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_size: pdf.byteLength,
      visible_to_couple: false,
      notes: `Contratto generato automaticamente dal Progetto Floreale${quote ? " e dal Preventivo" : ""}. Verificare prima della sottoscrizione.`,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (documentError || !document) {
    await supabase.storage.from("client-documents").remove([storagePath]);
    throw new Error(`Errore registrazione contratto: ${documentError?.message || "documento non creato"}`);
  }

  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
  revalidatePath(`/protected/coppie/${coupleId}/preventivo`);
  revalidatePath(`/protected/coppie/${coupleId}`);
  redirect(`/protected/coppie/${coupleId}/documenti/${document.id}`);
}
