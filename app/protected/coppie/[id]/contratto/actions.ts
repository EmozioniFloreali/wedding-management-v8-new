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
    chiesa_interno: "Interno Chiesa",
    chiesa_esterno: "Esterno Chiesa",
    sala_ricevimento: "Sala ricevimento",
    casa_sposa: "Casa sposa",
    casa_sposo: "Casa sposo",
    auto_sposi: "Auto sposi",
    complementi_floreali: "Complementi floreali",
    bouquet_sposa: "Bouquet della sposa",
    servizi_aggiuntivi: "Servizi aggiuntivi",
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
    .select("id,wedding_date,wedding_time,venue,church,reception_hall,ceremony_location")
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
    .select("id,category,name,description,quantity,unit,notes,sort_order,include_in_contract")
    .eq("project_id", project.id)
    .eq("include_in_contract", true)
    .order("sort_order", { ascending: true });

  const items = (rawItems || []).map((item: any) => ({
    name: item.name || item.description || "Lavorazione floreale",
    category: categoryLabel(item.category),
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes,
  }));

  const { data: sections } = await supabase
    .from("floral_project_sections")
    .select("section_key,flowers,structures,other_items,notes")
    .eq("project_id", project.id);

  const sectionNotes = (sections || [])
    .flatMap((section: any) => {
      const label = categoryLabel(section.section_key);
      const parts = [
        section.flowers ? `Fiori/colori: ${section.flowers}` : "",
        section.structures ? `Strutture/materiali: ${section.structures}` : "",
        section.other_items ? `Altri elementi: ${section.other_items}` : "",
        section.notes ? `Note: ${section.notes}` : "",
      ].filter(Boolean);
      return parts.length ? [`${label}: ${parts.join(" | ")}`] : [];
    })
    .join("\n");

  const requestedQuoteId = String(formData.get("quote_id") || "").trim();
  const quoteQuery = requestedQuoteId
    ? supabase.from("quotes").select("id,wedding_id,status,version_number,total_amount,deposit_amount,vat_included,notes,created_at").eq("id", requestedQuoteId).eq("couple_id", coupleId).maybeSingle()
    : supabase.from("quotes").select("id,wedding_id,status,version_number,total_amount,deposit_amount,vat_included,notes,created_at").eq("couple_id", coupleId).order("version_number", { ascending: false }).limit(1).maybeSingle();

  const { data: quote, error: quoteError } = await quoteQuery;
  if (quoteError) throw new Error(quoteError.message);

  let quoteData = null;
  if (quote) {
    const { data: quoteItems, error: quoteItemsError } = await supabase
      .from("quote_items")
      .select("id,floral_project_item_id,description,quantity,unit,notes,sort_order")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true });

    if (quoteItemsError) throw new Error(quoteItemsError.message);

    const total = moneyNumber(quote.total_amount);
    const deposit = Math.min(total, Math.max(0, moneyNumber(quote.deposit_amount)));

    quoteData = {
      status: quote.status,
      vatRate: quote.vat_included ? 10 : 0,
      total,
      deposit,
      balance: Math.max(0, total - deposit),
      discount: 0,
      notes: quote.notes,
      items: (quoteItems || []).map((item: any) => ({
        description: item.description,
        quantity: moneyNumber(item.quantity),
        unit: item.unit || "pz",
      })),
    };
  }

  if (!quoteData && project.total_amount == null) {
    throw new Error("Imposta prima il totale del Progetto Floreale o salva il Preventivo.");
  }

  if (sectionNotes) {
    items.push({
      name: "Specifiche generali del progetto",
      category: "Progetto floreale",
      description: sectionNotes,
      quantity: null,
      unit: null,
      notes: null,
    });
  }

  const contractTotal = quoteData?.total ?? moneyNumber(project.total_amount);
  const contractDeposit = quoteData?.deposit ?? 0;
  const contractBalance = Math.max(0, contractTotal - contractDeposit);

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
      total: contractTotal,
    },
    items,
    quote: quoteData,
  });

  const safeCouple = `${couple.partner1_last_name || "coppia"}-${couple.partner2_last_name || "sposi"}`.replace(/[^a-zA-Z0-9À-ÿ_-]/g, "-");

  // Il contratto è una vera entità di V8 NEW. Le versioni sono registrate
  // nella tabella contracts e le singole lavorazioni in contract_items.
  const { data: latestContract } = await supabase
    .from("contracts")
    .select("version_number")
    .eq("couple_id", coupleId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Idempotenza: non creare due contratti per la stessa versione di preventivo.
  const { data: existingContract } = quote?.id
    ? await supabase
        .from("contracts")
        .select("id,document_id,version_number")
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (existingContract?.document_id) {
    revalidatePath(`/protected/coppie/${coupleId}/contratti`);
    redirect(`/protected/coppie/${coupleId}/contratti`);
  }

  // Se esiste un contratto incompleto (ad esempio dopo un upload fallito),
  // rimuovilo prima di ricrearlo in modo atomico.
  if (existingContract?.id) {
    await supabase.from("contract_items").delete().eq("contract_id", existingContract.id);
    await supabase.from("contracts").delete().eq("id", existingContract.id);
  }

  const contractVersion = Number(latestContract?.version_number || 0) + 1;
  const contractDateIso = new Date().toISOString().slice(0, 10);

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .insert({
      couple_id: coupleId,
      wedding_id: wedding?.id || quote?.wedding_id || null,
      quote_id: quote?.id || null,
      floral_project_id: project.id,
      version_number: contractVersion,
      contract_date: contractDateIso,
      total_amount: contractTotal,
      deposit_amount: contractDeposit,
      balance_amount: contractBalance,
      notes: quote?.notes || project.notes || null,
      signed_by_client: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (contractError || !contract) {
    throw new Error(`Errore creazione contratto: ${contractError?.message || "contratto non creato"}`);
  }

  const contractItemRows = (rawItems || []).map((item: any, index: number) => ({
    contract_id: contract.id,
    quote_item_id: null,
    floral_project_item_id: item.id,
    area: categoryLabel(item.category) || item.category || "Progetto floreale",
    description: item.description ? `${item.name} — ${item.description}` : (item.name || item.description || "Lavorazione floreale"),
    quantity: item.quantity ?? 1,
    unit: item.unit || "pz",
    notes: item.notes || null,
    sort_order: index + 1,
  }));

  if (sectionNotes) {
    contractItemRows.push({
      contract_id: contract.id,
      quote_item_id: null,
      floral_project_item_id: null,
      area: "Progetto floreale",
      description: sectionNotes,
      quantity: 1,
      unit: "specifica",
      notes: null,
      sort_order: contractItemRows.length + 1,
    });
  }

  if (contractItemRows.length) {
    const { error: contractItemsError } = await supabase
      .from("contract_items")
      .insert(contractItemRows);

    if (contractItemsError) {
      await supabase.from("contracts").delete().eq("id", contract.id);
      throw new Error(`Errore registrazione voci contratto: ${contractItemsError.message}`);
    }
  }

  const filename = `Contratto_d_opera_${safeCouple}_V${contractVersion}.pdf`;
  const storagePath = `${coupleId}/contratti/${crypto.randomUUID()}-${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("client-documents")
    .upload(storagePath, pdf, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    await supabase.from("contract_items").delete().eq("contract_id", contract.id);
    await supabase.from("contracts").delete().eq("id", contract.id);
    throw new Error(`Errore caricamento contratto: ${uploadError.message}`);
  }

  const { data: document, error: documentError } = await supabase
    .from("client_documents")
    .insert({
      couple_id: coupleId,
      wedding_id: wedding?.id || quote?.wedding_id || null,
      quote_id: quote?.id || null,
      floral_project_id: project.id,
      name: filename,
      category: "contratto",
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_size: pdf.byteLength,
      visible_to_couple: false,
      notes: `Contratto V${contractVersion} generato automaticamente dal Progetto Floreale e dal Preventivo V${quote?.version_number || "—"}.`,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (documentError || !document) {
    await supabase.storage.from("client-documents").remove([storagePath]);
    await supabase.from("contract_items").delete().eq("contract_id", contract.id);
    await supabase.from("contracts").delete().eq("id", contract.id);
    throw new Error(`Errore registrazione documento contratto: ${documentError?.message || "documento non creato"}`);
  }

  const { error: linkError } = await supabase
    .from("contracts")
    .update({ document_id: document.id, updated_at: new Date().toISOString() })
    .eq("id", contract.id);

  if (linkError) {
    await supabase.from("client_documents").delete().eq("id", document.id);
    await supabase.storage.from("client-documents").remove([storagePath]);
    await supabase.from("contract_items").delete().eq("contract_id", contract.id);
    await supabase.from("contracts").delete().eq("id", contract.id);
    throw new Error(`Collegamento del documento al contratto non riuscito: ${linkError.message}`);
  }

  revalidatePath(`/protected/coppie/${coupleId}/contratti`);
  revalidatePath(`/protected/coppie/${coupleId}/progetto`);
  revalidatePath(`/protected/coppie/${coupleId}/preventivo`);
  revalidatePath(`/protected/coppie/${coupleId}`);
  redirect(`/protected/coppie/${coupleId}/contratti`);
}
