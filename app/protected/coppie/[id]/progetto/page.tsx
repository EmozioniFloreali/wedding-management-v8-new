import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generaContratto } from "@/app/protected/coppie/[id]/contratto/actions";

export const instant = false;

const SECTIONS = [
  {
    key: "chiesa",
    title: "Composizioni Chiesa",
    description:
      "Composizioni floreali previste per la cerimonia. La palette floreale viene definita una sola volta per tutta la cerimonia.",
  },
  {
    key: "sala_ricevimento",
    title: "Composizioni Sala Ricevimento",
    description:
      "Centrotavola, composizioni e decorazioni floreali per la sala del ricevimento.",
  },
  {
    key: "casa_sposi",
    title: "Composizioni Casa Sposo/a",
    description:
      "Composizioni e decorazioni floreali previste nelle abitazioni degli sposi.",
  },
  {
    key: "complementi_floreali",
    title: "Complementi floreali",
    description:
      "Bouquet, bottoniere, coroncine, auto sposi, corsage e altri complementi.",
  },
] as const;

const COMPLEMENT_TYPES = [
  "Bouquet",
  "Bottoniere",
  "Coroncine",
  "Auto sposi",
  "Corsage",
  "Altro",
];

const BOUQUET_TYPES = [
  "Sposa",
  "Suocera",
  "Lancio",
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Bozza" },
  { value: "in_progress", label: "In lavorazione" },
  { value: "approved", label: "Approvato" },
  { value: "completed", label: "Completato" },
  { value: "archived", label: "Archiviato" },
];

const COMMON_FLOWER_COLORS = [
  "Bianco",
  "Avorio",
  "Crema",
  "Champagne",
  "Rosa",
  "Rosa cipria",
  "Pesca",
  "Corallo",
  "Lilla",
  "Lavanda",
  "Viola",
  "Borgogna",
  "Bordeaux",
  "Rosso",
  "Burgundy",
  "Giallo",
  "Arancio",
  "Verde",
  "Azzurro",
  "Blu",
  "Terracotta",
  "Marrone",
  "Naturale",
  "Altro",
];

const STRUCTURE_DEFAULT_COLORS = [
  "Bianco",
  "Oro",
  "Altro",
];

const CARPET_COLORS = [
  "Verde",
  "Bianco",
  "Rosso",
  "Bordeaux",
  "Altro",
];

function normalizeCategory(category: string | null) {
  if (!category) return "chiesa";

  if (category === "bouquet") return "complementi_floreali";
  if (category === "ceremony") return "chiesa";
  if (category === "arrangements") return "sala_ricevimento";
  if (category === "home") return "casa_sposi";

  return category;
}

function parseAmount(value: FormDataEntryValue | null) {
  if (value === null) return null;

  const raw = String(value).trim();

  if (!raw) return null;

  const normalized = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const amount = Number(normalized);

  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 100) / 100;
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return value === null ? "" : String(value).trim();
}

function textValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim());
}

async function salvaProgetto(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const projectId = textValue(formData, "project_id");

  if (!projectId) {
    redirect("/protected/coppie");
  }

  const name =
    textValue(formData, "name") || "Progetto floreale";

  const status =
    textValue(formData, "status") || "draft";

  const notes = textValue(formData, "notes");

  const totalAmount = parseAmount(
    formData.get("total_amount")
  );

  const { data: project } = await supabase
    .from("floral_projects")
    .select("couple_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    redirect("/protected/coppie");
  }

  const { error } = await supabase
    .from("floral_projects")
    .update({
      name,
      status,
      notes: notes || null,
      total_amount: totalAmount,
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(
      `Errore salvataggio progetto: ${error.message}`
    );
  }

  revalidatePath(
    `/protected/coppie/${project.couple_id}/progetto`
  );
}

async function salvaPaletteCerimonia(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const projectId = textValue(formData, "project_id");

  if (!projectId) {
    redirect("/protected/coppie");
  }

  const flowerIds = textValues(formData, "flower_id");
  const customNames = textValues(formData, "custom_name");
  const colors = textValues(formData, "color");

  const rows = [];

  for (let index = 0; index < Math.max(
    flowerIds.length,
    customNames.length,
    colors.length
  ); index++) {
    const flowerId = flowerIds[index] || "";
    const customName = customNames[index] || "";
    const color = colors[index] || "";

    if (!flowerId && !customName && !color) {
      continue;
    }

    if (!color) {
      continue;
    }

    rows.push({
      project_id: projectId,
      flower_id: flowerId || null,
      custom_name: customName || null,
      color,
      sort_order: index,
    });
  }

  const { data: project } = await supabase
    .from("floral_projects")
    .select("couple_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    redirect("/protected/coppie");
  }

  const { error: deleteError } = await supabase
    .from("floral_project_ceremony_flowers")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) {
    throw new Error(
      `Errore aggiornamento palette: ${deleteError.message}`
    );
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("floral_project_ceremony_flowers")
      .insert(rows);

    if (insertError) {
      throw new Error(
        `Errore salvataggio fiori: ${insertError.message}`
      );
    }
  }

  revalidatePath(
    `/protected/coppie/${project.couple_id}/progetto`
  );
}

async function aggiungiElemento(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const projectId = textValue(formData, "project_id");

  if (!projectId) {
    redirect("/protected/coppie");
  }

  const category = textValue(formData, "category");
  const name = textValue(formData, "name");
  const description = textValue(formData, "description");
  const structureId = textValue(formData, "structure_id");
  const structureColor = textValue(formData, "structure_color");
  const customStructureName = textValue(
    formData,
    "custom_structure_name"
  );
  const quantityRaw = textValue(formData, "structure_quantity");
  const flowerIds = textValues(formData, "item_flower_id");
  const flowerColors = textValues(formData, "item_flower_color");
  const flowerQuantities = textValues(formData, "item_flower_quantity");
  const flowerNotes = textValues(formData, "item_flower_notes");

  if (!category || !name) {
    return;
  }

  const { data: lastItem } = await supabase
    .from("floral_project_items")
    .select("sort_order")
    .eq("project_id", projectId)
    .eq("category", category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder =
    typeof lastItem?.sort_order === "number"
      ? lastItem.sort_order + 1
      : 0;

  const { data: project } = await supabase
    .from("floral_projects")
    .select("couple_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    redirect("/protected/coppie");
  }

  const { data: insertedItem, error } = await supabase
    .from("floral_project_items")
    .insert({
      project_id: projectId,
      category,
      name,
      description: description || null,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error || !insertedItem) {
    throw new Error(
      `Errore inserimento elemento: ${error?.message || "elemento non creato"}`
    );
  }

  // Se la struttura viene indicata già nel form iniziale, la associamo
  // immediatamente alla nuova composizione. Le strutture aggiuntive
  // possono comunque essere inserite successivamente.
  if (structureId) {
    const { data: structure } = await supabase
      .from("floral_structures")
      .select("id,name")
      .eq("id", structureId)
      .maybeSingle();

    if (!structure) {
      throw new Error("Struttura/materiale non valido.");
    }

    const quantity = Number(quantityRaw);
    const safeQuantity =
      Number.isFinite(quantity) && quantity > 0
        ? quantity
        : 1;

    let safeColor = structureColor;

    if (structure.name === "Tappeti") {
      safeColor = CARPET_COLORS.includes(structureColor)
        ? structureColor
        : structureColor || "Altro";
    } else if (structure.name === "Altro") {
      safeColor = structureColor || "Altro";
    } else {
      safeColor = STRUCTURE_DEFAULT_COLORS.includes(structureColor)
        ? structureColor
        : structureColor || "Altro";
    }

    const { error: structureError } = await supabase
      .from("floral_item_structures")
      .insert({
        project_item_id: insertedItem.id,
        structure_id: structureId,
        quantity: safeQuantity,
        color: safeColor || null,
        custom_name: customStructureName || null,
      });

    if (structureError) {
      throw new Error(
        `Errore inserimento struttura: ${structureError.message}`
      );
    }
  }

  const flowerRows = [];

  for (let index = 0; index < flowerIds.length; index++) {
    const flowerId = flowerIds[index] || "";
    if (!flowerId) continue;

    const quantity = Number(flowerQuantities[index] || "1");
    flowerRows.push({
      project_item_id: insertedItem.id,
      flower_id: flowerId,
      color: flowerColors[index] || null,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      notes: flowerNotes[index] || null,
    });
  }

  if (flowerRows.length > 0) {
    const { error: flowerError } = await supabase
      .from("floral_item_flowers")
      .insert(flowerRows);

    if (flowerError) {
      throw new Error(`Errore inserimento fiori: ${flowerError.message}`);
    }
  }

  revalidatePath(
    `/protected/coppie/${project.couple_id}/progetto`
  );
}

async function salvaBouquet(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const projectId = textValue(formData, "project_id");
  const bouquetType = textValue(formData, "bouquet_type");
  const description = textValue(formData, "description");

  if (!projectId || !BOUQUET_TYPES.includes(bouquetType)) {
    return;
  }

  const { data: project } = await supabase
    .from("floral_projects")
    .select("couple_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    redirect("/protected/coppie");
  }

  const { data: existingItem } = await supabase
    .from("floral_project_items")
    .select("id")
    .eq("project_id", projectId)
    .eq("category", "complementi_floreali")
    .eq("name", bouquetType)
    .maybeSingle();

  let itemId = existingItem?.id;

  if (itemId) {
    const { error: updateError } = await supabase
      .from("floral_project_items")
      .update({ description: description || null })
      .eq("id", itemId);

    if (updateError) {
      throw new Error(
        `Errore aggiornamento bouquet ${bouquetType}: ${updateError.message}`
      );
    }

    const { error: deleteFlowersError } = await supabase
      .from("floral_item_flowers")
      .delete()
      .eq("project_item_id", itemId);

    if (deleteFlowersError) {
      throw new Error(
        `Errore aggiornamento fiori ${bouquetType}: ${deleteFlowersError.message}`
      );
    }
  } else {
    const { data: lastItem } = await supabase
      .from("floral_project_items")
      .select("sort_order")
      .eq("project_id", projectId)
      .eq("category", "complementi_floreali")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder =
      typeof lastItem?.sort_order === "number"
        ? lastItem.sort_order + 1
        : 0;

    const { data: insertedItem, error: insertError } = await supabase
      .from("floral_project_items")
      .insert({
        project_id: projectId,
        category: "complementi_floreali",
        name: bouquetType,
        description: description || null,
        sort_order: sortOrder,
      })
      .select("id")
      .single();

    if (insertError || !insertedItem) {
      throw new Error(
        `Errore inserimento bouquet ${bouquetType}: ${insertError?.message || "elemento non creato"}`
      );
    }

    itemId = insertedItem.id;
  }

  const flowerIds = textValues(formData, "bouquet_flower_id");
  const colors = textValues(formData, "bouquet_flower_color");
  const quantities = textValues(formData, "bouquet_flower_quantity");
  const notes = textValues(formData, "bouquet_flower_notes");

  const rows = [];

  for (let index = 0; index < flowerIds.length; index++) {
    const flowerId = flowerIds[index] || "";
    if (!flowerId) continue;

    const quantity = Number(quantities[index] || "1");
    rows.push({
      project_item_id: itemId,
      flower_id: flowerId,
      color: colors[index] || null,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      notes: notes[index] || null,
    });
  }

  if (rows.length > 0) {
    const { error: flowerError } = await supabase
      .from("floral_item_flowers")
      .insert(rows);

    if (flowerError) {
      throw new Error(
        `Errore salvataggio fiori ${bouquetType}: ${flowerError.message}`
      );
    }
  }

  revalidatePath(
    `/protected/coppie/${project.couple_id}/progetto`
  );
}

async function salvaFioriElemento(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const projectItemId = textValue(formData, "project_item_id");

  if (!projectItemId) return;

  const flowerIds = textValues(formData, "item_flower_id");
  const colors = textValues(formData, "item_flower_color");
  const quantities = textValues(formData, "item_flower_quantity");
  const notes = textValues(formData, "item_flower_notes");

  const { data: item } = await supabase
    .from("floral_project_items")
    .select("project_id")
    .eq("id", projectItemId)
    .maybeSingle();

  if (!item) return;

  const { data: project } = await supabase
    .from("floral_projects")
    .select("couple_id")
    .eq("id", item.project_id)
    .maybeSingle();

  const { error: deleteError } = await supabase
    .from("floral_item_flowers")
    .delete()
    .eq("project_item_id", projectItemId);

  if (deleteError) {
    throw new Error(`Errore aggiornamento fiori: ${deleteError.message}`);
  }

  const rows = [];

  for (let index = 0; index < flowerIds.length; index++) {
    const flowerId = flowerIds[index] || "";
    if (!flowerId) continue;

    const quantity = Number(quantities[index] || "1");
    rows.push({
      project_item_id: projectItemId,
      flower_id: flowerId,
      color: colors[index] || null,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      notes: notes[index] || null,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("floral_item_flowers")
      .insert(rows);

    if (error) {
      throw new Error(`Errore salvataggio fiori: ${error.message}`);
    }
  }

  if (project) {
    revalidatePath(`/protected/coppie/${project.couple_id}/progetto`);
  }
}

async function eliminaElemento(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const itemId = textValue(formData, "item_id");

  if (!itemId) return;

  const { data: item } = await supabase
    .from("floral_project_items")
    .select("project_id")
    .eq("id", itemId)
    .maybeSingle();

  if (!item) return;

  const { data: project } = await supabase
    .from("floral_projects")
    .select("couple_id")
    .eq("id", item.project_id)
    .maybeSingle();

  const { error } = await supabase
    .from("floral_project_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw new Error(
      `Errore eliminazione elemento: ${error.message}`
    );
  }

  if (project) {
    revalidatePath(
      `/protected/coppie/${project.couple_id}/progetto`
    );
  }
}

async function aggiungiStruttura(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const projectItemId = textValue(
    formData,
    "project_item_id"
  );

  const structureId = textValue(
    formData,
    "structure_id"
  );

  const color = textValue(formData, "color");

  const customName = textValue(
    formData,
    "custom_name"
  );

  const quantityRaw = textValue(
    formData,
    "quantity"
  );

  if (!projectItemId || !structureId) {
    return;
  }

  const quantity = Number(quantityRaw);

  const safeQuantity =
    Number.isFinite(quantity) && quantity > 0
      ? quantity
      : 1;

  const { data: structure } = await supabase
    .from("floral_structures")
    .select("id,name")
    .eq("id", structureId)
    .maybeSingle();

  if (!structure) {
    return;
  }

  let safeColor = color;

  if (structure.name === "Tappeti") {
    if (!CARPET_COLORS.includes(color)) {
      safeColor = color || "Altro";
    }
  } else if (structure.name === "Altro") {
    safeColor = color || "Altro";
  } else {
    if (!STRUCTURE_DEFAULT_COLORS.includes(color)) {
      safeColor = "Altro";
    }
  }

  const { data: item } = await supabase
    .from("floral_project_items")
    .select("project_id")
    .eq("id", projectItemId)
    .maybeSingle();

  if (!item) return;

  const { data: project } = await supabase
    .from("floral_projects")
    .select("couple_id")
    .eq("id", item.project_id)
    .maybeSingle();

  const { error } = await supabase
    .from("floral_item_structures")
    .insert({
      project_item_id: projectItemId,
      structure_id: structureId,
      quantity: safeQuantity,
      color: safeColor || null,
      custom_name: customName || null,
    });

  if (error) {
    throw new Error(
      `Errore inserimento struttura: ${error.message}`
    );
  }

  if (project) {
    revalidatePath(
      `/protected/coppie/${project.couple_id}/progetto`
    );
  }
}

async function eliminaStruttura(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const structureItemId = textValue(
    formData,
    "structure_item_id"
  );

  if (!structureItemId) return;

  const { data: structureItem } = await supabase
    .from("floral_item_structures")
    .select("project_item_id")
    .eq("id", structureItemId)
    .maybeSingle();

  if (!structureItem) return;

  const { data: item } = await supabase
    .from("floral_project_items")
    .select("project_id")
    .eq("id", structureItem.project_item_id)
    .maybeSingle();

  const { error } = await supabase
    .from("floral_item_structures")
    .delete()
    .eq("id", structureItemId);

  if (error) {
    throw new Error(
      `Errore eliminazione struttura: ${error.message}`
    );
  }

  if (item) {
    const { data: project } = await supabase
      .from("floral_projects")
      .select("couple_id")
      .eq("id", item.project_id)
      .maybeSingle();

    if (project) {
      revalidatePath(
        `/protected/coppie/${project.couple_id}/progetto`
      );
    }
  }
}

export default async function ProgettoFlorealePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: coupleId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: couple } = await supabase
    .from("couples")
    .select(
      `
      id,
      partner1_first_name,
      partner1_last_name,
      partner2_first_name,
      partner2_last_name
      `
    )
    .eq("id", coupleId)
    .maybeSingle();

  if (!couple) {
    redirect("/protected/coppie");
  }

  const { data: project } = await supabase
    .from("floral_projects")
    .select(
      `
      id,
      couple_id,
      wedding_id,
      name,
      status,
      notes,
      total_amount,
      created_at,
      updated_at
      `
    )
    .eq("couple_id", coupleId)
    .maybeSingle();

  if (!project) {
    redirect(`/protected/coppie/${coupleId}`);
  }

  const { data: items } = await supabase
    .from("floral_project_items")
    .select(
      `
      id,
      project_id,
      category,
      name,
      description,
      quantity,
      unit,
      notes,
      sort_order,
      created_at,
      floral_item_structures (
        id,
        project_item_id,
        structure_id,
        quantity,
        color,
        custom_name,
        floral_structures (
          id,
          name,
          color_options
        )
      )
      ,
      floral_item_flowers (
        id,
        project_item_id,
        flower_id,
        color,
        quantity,
        notes,
        floral_flowers (
          id,
          name
        )
      )
      `
    )
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  const { data: ceremonyFlowers } = await supabase
    .from("floral_project_ceremony_flowers")
    .select(
      `
      id,
      project_id,
      flower_id,
      custom_name,
      color,
      sort_order,
      floral_flowers (
        id,
        name
      )
      `
    )
    .eq("project_id", project.id)
    .order("sort_order", { ascending: true });

  const { data: flowers, error: flowersError } = await supabase
    .from("floral_flowers")
    .select("id,name")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (flowersError) {
    throw new Error(
      `Errore caricamento catalogo fiori: ${flowersError.message}`
    );
  }

  const { data: structures } = await supabase
    .from("floral_structures")
    .select("id,name,color_options")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const groupedItems = SECTIONS.map((section) => ({
    ...section,
    items: (items || []).filter(
      (item) =>
        normalizeCategory(item.category) === section.key
    ),
  }));

  const coupleName = [
    couple.partner1_first_name,
    couple.partner1_last_name,
    couple.partner2_first_name,
    couple.partner2_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const totalAmount =
    typeof project.total_amount === "number"
      ? project.total_amount
      : Number(project.total_amount || 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Link
                href="/protected/coppie"
                className="hover:text-slate-900"
              >
                Coppie
              </Link>

              <span>/</span>

              <Link
                href={`/protected/coppie/${coupleId}`}
                className="hover:text-slate-900"
              >
                {coupleName}
              </Link>

              <span>/</span>

              <span>Progetto floreale</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Progetto floreale
            </h1>

            <p className="mt-1 text-slate-600">
              {coupleName}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={generaContratto}>
              <input type="hidden" name="couple_id" value={coupleId} />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                📄 Crea contratto d'opera
              </button>
            </form>
            <Link
              href={`/protected/coppie/${coupleId}`}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Torna alla scheda coppia
            </Link>
          </div>
        </div>

        {/* DATI GENERALI PROGETTO */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">
              Dati del progetto
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Informazioni generali e valore complessivo del progetto.
            </p>
          </div>

          <form action={salvaProgetto}>
            <input
              type="hidden"
              name="project_id"
              value={project.id}
            />

            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nome progetto
                </label>

                <input
                  name="name"
                  defaultValue={project.name}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Stato
                </label>

                <select
                  name="status"
                  defaultValue={project.status}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-500"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Totale progetto floreale
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {"\u20AC"}
                  </span>

                  <input
                    name="total_amount"
                    type="text"
                    inputMode="decimal"
                    defaultValue={
                      totalAmount > 0
                        ? totalAmount
                            .toFixed(2)
                            .replace(".", ",")
                        : ""
                    }
                    placeholder="0,00"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xl font-bold outline-none focus:border-slate-500"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Unico valore economico del progetto. Nessun prezzo viene associato alle singole composizioni.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Note generali
              </label>

              <textarea
                name="notes"
                defaultValue={project.notes || ""}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                placeholder="Note generali sul progetto floreale..."
              />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Salva progetto
              </button>
            </div>
          </form>
        </section>

        {/* PALETTE FLOREALE CERIMONIA */}
        <section className="mb-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-2xl">
                  Fiori
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Palette floreale della cerimonia
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    I fiori e i relativi colori definiti qui valgono per tutta la cerimonia.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <strong>Regola del progetto:</strong>{" "}
              stessa tipologia e stesso colore di fiori per tutte le composizioni della Chiesa.
            </div>
          </div>

          <form action={salvaPaletteCerimonia}>
            <input
              type="hidden"
              name="project_id"
              value={project.id}
            />

            <datalist id="flower-colors">
              {COMMON_FLOWER_COLORS.map((color) => (
                <option
                  key={color}
                  value={color}
                />
              ))}
            </datalist>

            <datalist id="structure-colors">
              {[...STRUCTURE_DEFAULT_COLORS, ...CARPET_COLORS, ...COMMON_FLOWER_COLORS]
                .filter((value, index, array) => array.indexOf(value) === index)
                .map((color) => (
                  <option key={color} value={color} />
                ))}
            </datalist>

            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, index) => {
                const selected =
                  ceremonyFlowers?.[index];

                const selectedFlowerId =
                  selected?.flower_id || "";

                const selectedFlowerName =
                  selected?.floral_flowers?.[0]?.name || "";

                const selectedCustomName =
                  selected?.custom_name || "";

                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1fr]"
                  >
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Fiore {index + 1}
                      </label>

                      <select
                        name="flower_id"
                        defaultValue={selectedFlowerId}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">
                          Seleziona un fiore
                        </option>

                        {(flowers || []).map((flower) => (
                          <option
                            key={flower.id}
                            value={flower.id}
                          >
                            {flower.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Oppure altro fiore
                      </label>

                      <input
                        name="custom_name"
                        defaultValue={
                          selectedCustomName
                        }
                        placeholder="Nome personalizzato"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />

                      {selectedFlowerName && (
                        <p className="mt-1 text-xs text-slate-500">
                          Catalogo: {selectedFlowerName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Colore
                      </label>

                      <input
                        name="color"
                        defaultValue={
                          selected?.color || ""
                        }
                        list="flower-colors"
                        placeholder="Es. bianco, rosa cipria..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 md:flex-row md:items-center md:justify-between">
              <p>
                Puoi utilizzare il catalogo oppure indicare un fiore personalizzato. Il colore è libero.
              </p>

              <button
                type="submit"
                className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800"
              >
                Salva palette cerimonia
              </button>
            </div>
          </form>
        </section>

        {/* SEZIONI DEL PROGETTO */}
        <div className="space-y-8">
          {groupedItems.map((section) => (
            <section
              key={section.key}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-6 border-b border-slate-200 pb-5">
                <h2 className="text-2xl font-bold text-slate-900">
                  {section.title}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {section.description}
                </p>

                {section.key === "chiesa" && (
                  <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                    Le composizioni della Chiesa fanno riferimento alla palette floreale della cerimonia definita sopra.
                  </div>
                )}
              </div>

              {/* ELEMENTI ESISTENTI */}
              <div className="space-y-5">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-900">
                          {item.name}
                        </h3>

                        {item.description && (
                          <p className="mt-1 text-sm text-slate-600">
                            {item.description}
                          </p>
                        )}

                        {item.notes && (
                          <p className="mt-2 text-sm italic text-slate-500">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>

                      <form action={eliminaElemento}>
                        <input
                          type="hidden"
                          name="item_id"
                          value={item.id}
                        />

                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Elimina voce
                        </button>
                      </form>
                    </div>

                    {section.key === "complementi_floreali" ? (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="mb-4">
                          <h4 className="font-bold text-slate-900">
                            Fiori e specifiche di realizzazione
                          </h4>
                          <p className="mt-1 text-xs text-slate-600">
                            Il bouquet viene definito principalmente attraverso i fiori, i colori, le quantità e le indicazioni tecniche di realizzazione.
                          </p>
                        </div>

                        {item.floral_item_flowers &&
                          item.floral_item_flowers.length > 0 && (
                            <div className="mb-4 space-y-2">
                              {item.floral_item_flowers.map((itemFlower) => (
                                <div
                                  key={itemFlower.id}
                                  className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-800">
                                      {itemFlower.floral_flowers?.[0]?.name || "Fiore"}
                                    </span>
                                    {itemFlower.color && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                                        Colore: {itemFlower.color}
                                      </span>
                                    )}
                                    {itemFlower.quantity != null && (
                                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                        Quantità: {itemFlower.quantity}
                                      </span>
                                    )}
                                    {itemFlower.notes && (
                                      <span className="text-xs italic text-slate-500">
                                        {itemFlower.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                        <p className="text-xs text-slate-500">
                          Per modificare il bouquet, utilizza la scheda dedicata qui sotto.
                        </p>
                      </div>
                    ) : (
                      <>
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="mb-4">
                          <h4 className="font-bold text-slate-900">Fiori della composizione</h4>
                          <p className="mt-1 text-xs text-slate-600">
                            Indica i fiori utilizzati, il colore, la quantità e le eventuali indicazioni tecniche.
                          </p>
                        </div>

                        {item.floral_item_flowers && item.floral_item_flowers.length > 0 && (
                          <div className="mb-4 space-y-2">
                            {item.floral_item_flowers.map((itemFlower) => (
                              <div key={itemFlower.id} className="rounded-lg border border-emerald-200 bg-white p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-800">{itemFlower.floral_flowers?.[0]?.name || "Fiore"}</span>
                                  {itemFlower.color && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{itemFlower.color}</span>}
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Qtà {itemFlower.quantity}</span>
                                  {itemFlower.notes && <span className="text-xs italic text-slate-500">{itemFlower.notes}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <form action={salvaFioriElemento}>
                          <input type="hidden" name="project_item_id" value={item.id} />
                          <div className="space-y-2">
                            {Array.from({ length: 6 }).map((_, flowerIndex) => {
                              const existingFlower = item.floral_item_flowers?.[flowerIndex];
                              return (
                                <div key={flowerIndex} className="grid gap-2 md:grid-cols-[1.4fr_1fr_110px_1.4fr]">
                                  <select name="item_flower_id" defaultValue={existingFlower?.flower_id || ""} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                    <option value="">Fiore {flowerIndex + 1}</option>
                                    {(flowers || []).map((flower) => <option key={flower.id} value={flower.id}>{flower.name}</option>)}
                                  </select>
                                  <input name="item_flower_color" defaultValue={existingFlower?.color || ""} list="flower-colors" placeholder="Colore" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                                  <input name="item_flower_quantity" type="number" min="1" step="1" defaultValue={existingFlower?.quantity ?? 1} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                                  <input name="item_flower_notes" defaultValue={existingFlower?.notes || ""} placeholder="Nota tecnica" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button type="submit" className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Salva fiori</button>
                          </div>
                        </form>
                      </div>

                      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="mb-4">
                          <h4 className="font-bold text-slate-900">
                            Strutture e materiali
                          </h4>

                          <p className="mt-1 text-xs text-slate-600">
                            Archi, tappeti, coppe, colonne, vasi e altri elementi possono essere associati alla singola composizione.
                          </p>
                        </div>

                        {item.floral_item_structures &&
                          item.floral_item_structures.length > 0 && (
                            <div className="mb-4 space-y-2">
                              {item.floral_item_structures.map((itemStructure) => {
                                const structure = itemStructure.floral_structures;
                                const displayName =
                                  itemStructure.custom_name ||
                                  structure?.[0]?.name ||
                                  "Struttura";

                                return (
                                  <div
                                    key={itemStructure.id}
                                    className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-slate-800">
                                        {displayName}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                        Quantità: {itemStructure.quantity}
                                      </span>
                                      {itemStructure.color && (
                                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                          Colore: {itemStructure.color}
                                        </span>
                                      )}
                                    </div>
                                    <form action={eliminaStruttura}>
                                      <input
                                        type="hidden"
                                        name="structure_item_id"
                                        value={itemStructure.id}
                                      />
                                      <button
                                        type="submit"
                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                      >
                                        Rimuovi
                                      </button>
                                    </form>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        <form action={aggiungiStruttura}>
                          <input type="hidden" name="project_item_id" value={item.id} />
                          <div className="grid gap-3 lg:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Struttura / materiale
                              </label>
                              <select
                                name="structure_id"
                                required
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                <option value="">Seleziona</option>
                                {(structures || []).map((structure) => (
                                  <option key={structure.id} value={structure.id}>
                                    {structure.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Colore
                              </label>
                              <input
                                name="color"
                                list="structure-colors"
                                placeholder="Bianco / Oro / colore..."
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Quantità
                              </label>
                              <input
                                name="quantity"
                                type="number"
                                min="1"
                                step="1"
                                defaultValue="1"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">
                                Descrizione personalizzata
                              </label>
                              <input
                                name="custom_name"
                                placeholder="Solo se necessario"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <p className="text-xs text-slate-500">
                              Per i tappeti: Verde, Bianco, Rosso, Bordeaux oppure un colore libero.
                            </p>
                            <button
                              type="submit"
                              className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"
                            >
                              + Aggiungi struttura
                            </button>
                          </div>
                        </form>
                      </div>
                      </>
                    )}
                  </div>
                ))}

                {section.items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Nessuna voce inserita in questa sezione.
                  </div>
                )}
              </div>

              {/* NUOVA VOCE */}
              {section.key === "complementi_floreali" ? (
                <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-5">
                  <h3 className="mb-2 font-bold text-slate-900">
                    Bouquet
                  </h3>
                  <p className="mb-5 text-sm text-slate-600">
                    Sono previsti almeno tre bouquet distinti: Sposa, Suocera e Lancio. Per ciascuno puoi definire i fiori, colori, quantità e le specifiche di realizzazione.
                  </p>

                  <div className="space-y-5">
                    {BOUQUET_TYPES.map((bouquetType) => {
                      const bouquetItem = section.items.find(
                        (item) => item.name === bouquetType
                      );
                      const bouquetFlowers = bouquetItem?.floral_item_flowers || [];

                      return (
                        <form
                          key={bouquetType}
                          action={salvaBouquet}
                          className="rounded-2xl border border-emerald-200 bg-white p-5"
                        >
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="bouquet_type" value={bouquetType} />

                          <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h4 className="text-lg font-bold text-slate-900">
                                Bouquet {bouquetType}
                              </h4>
                              <p className="text-xs text-slate-500">
                                Definisci i fiori e le specifiche tecniche di realizzazione.
                              </p>
                            </div>
                          </div>

                          <div className="mb-5">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">
                              Specifiche di realizzazione / descrizione
                            </label>
                            <textarea
                              name="description"
                              defaultValue={bouquetItem?.description || ""}
                              rows={3}
                              placeholder="Forma, stile, dimensioni, legatura, nastri, finitura, particolari richiesti..."
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                            />
                          </div>

                          <div className="space-y-3">
                            {Array.from({ length: 6 }, (_, index) => {
                              const existingFlower = bouquetFlowers[index];
                              return (
                                <div
                                  key={index}
                                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1.4fr_1fr_0.6fr_1.4fr]"
                                >
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                                      Fiore {index + 1}
                                    </label>
                                    <select
                                      name="bouquet_flower_id"
                                      defaultValue={existingFlower?.flower_id || ""}
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                                    >
                                      <option value="">Seleziona un fiore</option>
                                      {(flowers || []).map((flower) => (
                                        <option key={flower.id} value={flower.id}>
                                          {flower.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                                      Colore
                                    </label>
                                    <input
                                      name="bouquet_flower_color"
                                      defaultValue={existingFlower?.color || ""}
                                      placeholder="Bianco, rosa cipria..."
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                                      Quantità
                                    </label>
                                    <input
                                      name="bouquet_flower_quantity"
                                      type="number"
                                      min="1"
                                      step="1"
                                      defaultValue={existingFlower?.quantity ?? 1}
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                                      Nota tecnica
                                    </label>
                                    <input
                                      name="bouquet_flower_notes"
                                      defaultValue={existingFlower?.notes || ""}
                                      placeholder="Solo se necessaria"
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex justify-end">
                            <button
                              type="submit"
                              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                            >
                              Salva bouquet {bouquetType}
                            </button>
                          </div>
                        </form>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-xl bg-white p-4 text-xs text-slate-600">
                    <strong>Nota:</strong> i bouquet sono gestiti separatamente dalle strutture della Chiesa e della Sala. Qui il focus è sui fiori e sulle specifiche di realizzazione.
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <h3 className="mb-4 font-bold text-slate-900">
                    + Aggiungi voce
                  </h3>
                  <form action={aggiungiElemento}>
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="category" value={section.key} />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                          Nome composizione
                        </label>
                        <input
                          name="name"
                          required
                          placeholder={
                            section.key === "chiesa"
                              ? "Es. Altare maggiore"
                              : section.key === "sala_ricevimento"
                                ? "Es. Centrotavola tavolo sposi"
                                : "Es. Composizione ingresso"
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700">
                          Descrizione
                        </label>
                        <input
                          name="description"
                          placeholder="Descrizione della composizione..."
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="mb-4">
                        <h4 className="font-bold text-slate-900">Fiori della composizione</h4>
                        <p className="mt-1 text-xs text-slate-600">Puoi indicare fino a 6 tipologie di fiore già durante la creazione della voce.</p>
                      </div>
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, flowerIndex) => (
                          <div key={flowerIndex} className="grid gap-2 md:grid-cols-[1.4fr_1fr_110px_1.4fr]">
                            <select name="item_flower_id" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                              <option value="">Fiore {flowerIndex + 1}</option>
                              {(flowers || []).map((flower) => <option key={flower.id} value={flower.id}>{flower.name}</option>)}
                            </select>
                            <input name="item_flower_color" list="flower-colors" placeholder="Colore" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                            <input name="item_flower_quantity" type="number" min="1" step="1" defaultValue="1" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                            <input name="item_flower_notes" placeholder="Nota tecnica" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-4">
                        <h4 className="font-bold text-slate-900">Struttura / materiale</h4>
                        <p className="mt-1 text-xs text-slate-600">
                          Puoi indicare subito la prima struttura della composizione. Potrai aggiungerne altre dopo il salvataggio.
                        </p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Struttura / materiale</label>
                          <select name="structure_id" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                            <option value="">Nessuna struttura</option>
                            {(structures || []).map((structure) => (
                              <option key={structure.id} value={structure.id}>{structure.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Colore struttura / tappeto</label>
                          <input name="structure_color" list="structure-colors" placeholder="Bianco / Oro / Bordeaux..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Quantità</label>
                          <input name="structure_quantity" type="number" min="1" step="1" defaultValue="1" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Nome personalizzato</label>
                          <input name="custom_structure_name" placeholder="Solo se necessario" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Per i tappeti: Verde, Bianco, Rosso, Bordeaux oppure un colore libero.</p>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button type="submit" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100">
                        + Aggiungi voce
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </section>
          ))}
        </div>

        {/* RIEPILOGO FINALE */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Riepilogo economico
              </p>

              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Totale progetto floreale
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Il progetto non prevede prezzi sulle singole composizioni, strutture o fiori.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 px-8 py-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                TOTALE PROGETTO FLOREALE
              </div>

              <div className="mt-1 text-3xl font-bold">
                {"\u20AC"}{" "}
                {totalAmount.toLocaleString(
                  "it-IT",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER NAVIGAZIONE */}
        <div className="mt-8 flex flex-wrap gap-3 pb-10">
          <Link
            href={`/protected/coppie/${coupleId}`}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Torna alla scheda coppia
          </Link>

          <Link
            href="/protected/coppie"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Torna alle coppie
          </Link>
        </div>
      </div>
    </main>
  );
}



