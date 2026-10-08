"use client";

import { useEffect, useMemo, useState } from "react";
import { getChurchPlan, saveChurchPlan } from "@/app/protected/coppie/[id]/progetto/church-planner/actions";

type FlowerDetail = {
  id?: string | null;
  color?: string | null;
  quantity?: number | null;
  notes?: string | null;
  floral_flowers?: { id?: string | null; name?: string | null } | Array<{ id?: string | null; name?: string | null }> | null;
};

type StructureDetail = {
  id?: string | null;
  quantity?: number | null;
  color?: string | null;
  custom_name?: string | null;
  floral_structures?: { id?: string | null; name?: string | null } | Array<{ id?: string | null; name?: string | null }> | null;
};

type ChurchItem = {
  id: string;
  name: string | null;
  description: string | null;
  quantity: number | null;
  notes: string | null;
  floral_item_flowers?: FlowerDetail[] | null;
  floral_item_structures?: StructureDetail[] | null;
};

type PlannerElement = {
  id: string;
  code: string;
  kind: "composition" | "arch" | "vase" | "candle" | "column" | "carpet" | "chair";
  x: number;
  y: number;
  position: string;
  description: string;
  quantity: number;
  size: string;
  flowers: string;
  structure: string;
  notes: string;
  sourceItemId?: string;
  boardView: "general" | "inside" | "outside";
  width: number;
  height: number;
  flowerDetails: Array<{ name: string; color: string; quantity: number; notes: string }>;
  structureDetails: Array<{ name: string; color: string; quantity: number; customName: string }>;
};

type Props = {
  projectId: string;
  coupleName: string;
  churchItems: ChurchItem[];
};

const STORAGE_PREFIX = "weddingV8_churchPlanner_";

const ELEMENT_LABELS: Record<PlannerElement["kind"], string> = {
  composition: "Composizione",
  arch: "Arco",
  vase: "Vaso / urna",
  candle: "Candela",
  column: "Colonna floreale",
  carpet: "Tappeto",
  chair: "Sedute sposi",
};

const VIEWS = [
  { key: "general", label: "📐 Planimetria generale" },
  { key: "inside", label: "🏛 Pianta interna" },
  { key: "outside", label: "⛪ Vista esterna" },
  { key: "list", label: "🌸 Composizioni" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nextCompositionCode(elements: PlannerElement[]) {
  const numbers = elements
    .filter((element) => element.kind === "composition")
    .map((element) => Number(element.code.replace(/\D/g, "")))
    .filter(Number.isFinite);

  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `C${next}`;
}

function relationName(
  relation:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null
    | undefined,
) {
  if (Array.isArray(relation)) return relation[0]?.name || "";
  return relation?.name || "";
}

function sourceFlowers(source?: ChurchItem) {
  return (source?.floral_item_flowers || [])
    .map((flower) => {
      const name = relationName(flower.floral_flowers);
      const color = flower.color || "";
      const quantity =
        flower.quantity != null ? `Q.tà ${Number(flower.quantity)}` : "";
      return [name, color, quantity].filter(Boolean).join(" · ");
    })
    .filter(Boolean)
    .join(" | ");
}

function sourceStructures(source?: ChurchItem) {
  return (source?.floral_item_structures || [])
    .map((item: any) => {
      const name = item.custom_name || relationName(item.floral_structures) || "Struttura";
      const color = item.color || "";
      const quantity =
        item.quantity != null ? `Q.tà ${Number(item.quantity)}` : "";
      return [name, color, quantity].filter(Boolean).join(" · ");
    })
    .filter(Boolean)
    .join(" | ");
}

function sourceFlowerDetails(source?: ChurchItem) {
  return (source?.floral_item_flowers || []).map((flower) => ({
    name: relationName(flower.floral_flowers),
    color: flower.color || "",
    quantity: Number(flower.quantity || 1),
    notes: flower.notes || "",
  })).filter((flower) => flower.name || flower.color || flower.notes);
}

function sourceStructureDetails(source?: ChurchItem) {
  return (source?.floral_item_structures || []).map((item: any) => ({
    name: relationName(item.floral_structures),
    color: item.color || "",
    quantity: Number(item.quantity || 1),
    customName: item.custom_name || "",
  })).filter((item: any) => item.name || item.color || item.customName);
}

function makeElement(
  kind: PlannerElement["kind"],
  x = 50,
  y = 50,
  elements: PlannerElement[] = [],
  source?: ChurchItem,
): PlannerElement {
  const code =
    kind === "composition"
      ? nextCompositionCode(elements)
      : kind === "arch"
        ? "AR"
        : kind === "vase"
          ? "VS"
          : kind === "candle"
            ? "CL"
            : kind === "column"
              ? "CO"
              : kind === "carpet"
                ? "TP"
                : "SP";

  return {
    id: createId(),
    code,
    kind,
    x,
    y,
    position: "",
    description: source?.description || source?.name || "",
    quantity: Number(source?.quantity || 1),
    size: "",
    flowers: sourceFlowers(source),
    structure: sourceStructures(source),
    notes: source?.notes || "",
    sourceItemId: source?.id,
    boardView: "general",
    width: 10,
    height: 10,
    flowerDetails: sourceFlowerDetails(source),
    structureDetails: sourceStructureDetails(source),
  };
}

function defaultElements(items: ChurchItem[]) {
  return items.map((item, index) =>
    makeElement(
      "composition",
      Math.min(80, 25 + (index % 3) * 25),
      Math.min(82, 25 + Math.floor(index / 3) * 18),
      [],
      item,
    ),
  );
}

function normalizeStoredElement(item: any): PlannerElement {
  const width = Number(item.width || 10);
  const height = Number(item.height || 10);
  return {
    id: String(item.id || createId()), code: String(item.code || "C1"),
    kind: (item.kind || "composition") as PlannerElement["kind"],
    x: Number(item.x ?? 50), y: Number(item.y ?? 50), position: String(item.position || ""),
    description: String(item.description || ""), quantity: Number(item.quantity || 1),
    size: `${width} × ${height}`, flowers: String(item.flowers || ""), structure: String(item.structure || ""), notes: String(item.notes || ""),
    sourceItemId: item.sourceItemId, boardView: item.boardView === "inside" || item.boardView === "outside" ? item.boardView : "general",
    width, height, flowerDetails: Array.isArray(item.flowerDetails) ? item.flowerDetails : [], structureDetails: Array.isArray(item.structureDetails) ? item.structureDetails : [],
  };
}

export default function ChurchPlanner({
  projectId,
  coupleName,
  churchItems,
}: Props) {
  const storageKey = `${STORAGE_PREFIX}${projectId}`;
  const [view, setView] = useState<ViewKey>("general");
  const [elements, setElements] = useState<PlannerElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [draggedKind, setDraggedKind] = useState<PlannerElement["kind"] | null>(
    null,
  );

  const selected = useMemo(
    () => elements.find((element) => element.id === selectedId) || null,
    [elements, selectedId],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPlan = async () => {
      try {
        const cloud = await getChurchPlan(projectId);
        if (cancelled) return;

        if (cloud.length) {
          const loaded: PlannerElement[] = cloud.map((row) => {
            const parseList = (value: unknown): any[] => {
              if (Array.isArray(value)) return value;
              if (typeof value !== "string" || !value.trim()) return [];
              try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            };
            const flowers = parseList(row.flowers);
            const structures = parseList(row.structure);
            const kind = (row.element_type || "composition") as PlannerElement["kind"];
            const number = Number(row.element_number || 1);
            return {
              id: String(row.id),
              code: kind === "composition" ? `C${number}` : String(row.element_type || "E").toUpperCase().slice(0, 2) + number,
              kind,
              x: Number(row.x ?? 50),
              y: Number(row.y ?? 50),
              position: String(row.position_name || ""),
              description: String(row.description || ""),
              quantity: Number(row.quantity ?? 1),
              size: row.width != null || row.height != null ? `${Number(row.width ?? 10)} × ${Number(row.height ?? 10)}` : "",
              flowers: flowers.map((item: any) => [item.name, item.color, item.quantity ? `Q.tà ${item.quantity}` : "", item.notes].filter(Boolean).join(" · ")).filter(Boolean).join(" | "),
              structure: structures.map((item: any) => [item.customName || item.name, item.color, item.quantity ? `Q.tà ${item.quantity}` : ""].filter(Boolean).join(" · ")).filter(Boolean).join(" | "),
              notes: String(row.notes || ""),
              sourceItemId: row.source_item_id ? String(row.source_item_id) : undefined,
              boardView: row.view === "inside" || row.view === "outside" ? row.view : "general",
              width: Number(row.width ?? 10),
              height: Number(row.height ?? 10),
              flowerDetails: flowers.map((item: any) => ({ name: String(item.name || ""), color: String(item.color || ""), quantity: Number(item.quantity || 1), notes: String(item.notes || "") })).filter((item: any) => item.name || item.color || item.notes),
              structureDetails: structures.map((item: any) => ({ name: String(item.name || ""), color: String(item.color || ""), quantity: Number(item.quantity || 1), customName: String(item.customName || item.custom_name || "") })).filter((item: any) => item.name || item.color || item.customName),
            };
          });

          setElements(loaded);
        } else {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setElements(parsed.map(normalizeStoredElement));
          } else if (churchItems.length) {
            setElements(defaultElements(churchItems));
          }
        }
      } catch {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setElements(parsed.map(normalizeStoredElement));
          } else if (churchItems.length) {
            setElements(defaultElements(churchItems));
          }
        } catch {
          if (churchItems.length) setElements(defaultElements(churchItems));
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [projectId, storageKey, churchItems]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(elements));
  }, [elements, hydrated, storageKey]);

  const addElement = (
    kind: PlannerElement["kind"],
    x = 50,
    y = 50,
    source?: ChurchItem,
  ) => {
    setElements((current) => {
      const element = makeElement(kind, x, y, current, source);
      setSelectedId(element.id);
      return [...current, element];
    });
  };

  const updateSelected = (patch: Partial<PlannerElement>) => {
    if (!selectedId) return;
    setElements((current) => current.map((element) => {
      if (element.id !== selectedId) return element;
      const next = { ...element, ...patch };
      if (patch.width !== undefined || patch.height !== undefined) next.size = `${Number(next.width || 10)} × ${Number(next.height || 10)}`;
      if (patch.flowerDetails) next.flowers = patch.flowerDetails.map((item: any) => [item.name, item.color, `Q.tà ${item.quantity}`, item.notes].filter(Boolean).join(" · ")).filter(Boolean).join(" | ");
      if (patch.structureDetails) next.structure = patch.structureDetails.map((item: any) => [item.customName || item.name, item.color, `Q.tà ${item.quantity}`].filter(Boolean).join(" · ")).filter(Boolean).join(" | ");
      return next;
    }));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setElements((current) =>
      current.filter((element) => element.id !== selectedId),
    );
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    setElements((current) => {
      const copy: PlannerElement = {
        ...selected,
        id: createId(),
        x: Math.min(90, selected.x + 6),
        y: Math.min(90, selected.y + 6),
        code:
          selected.kind === "composition"
            ? nextCompositionCode(current)
            : selected.code,
      };
      setSelectedId(copy.id);
      return [...current, copy];
    });
  };

  const clearElements = () => {
    if (!window.confirm("Eliminare tutti gli elementi della progettazione della Chiesa?")) {
      return;
    }
    setElements([]);
    setSelectedId(null);
  };

  const resetFromV8Items = () => {
    if (
      !window.confirm(
        "Aggiornare le composizioni della tavola con i dati V8 senza creare duplicati?",
      )
    ) {
      return;
    }

    setElements((current) => {
      const result = [...current];
      const usedExisting = new Set<string>();

      for (const [index, item] of churchItems.entries()) {
        const technical = makeElement(
          "composition",
          Math.min(80, 25 + (index % 3) * 25),
          Math.min(82, 25 + Math.floor(index / 3) * 18),
          result,
          item,
        );

        // Prima scelta: collegamento esplicito all'elemento V8.
        // Fallback: stesso codice C1/C2/... per i vecchi elementi creati
        // prima dell'introduzione di sourceItemId.
        const existingIndex = result.findIndex((element) =>
          element.kind === "composition" &&
          !usedExisting.has(element.id) &&
          (element.sourceItemId === item.id ||
            (!element.sourceItemId && element.code === technical.code)),
        );

        if (existingIndex >= 0) {
          const existing = result[existingIndex];
          result[existingIndex] = {
            ...technical,
            id: existing.id,
            code: existing.code,
            x: existing.x,
            y: existing.y,
            boardView: existing.boardView,
            width: existing.width,
            height: existing.height,
            position: existing.position,
            notes: existing.notes || technical.notes,
          };
          usedExisting.add(existing.id);
        } else {
          // Se non esiste una corrispondenza, aggiunge la nuova composizione.
          result.push(technical);
          usedExisting.add(technical.id);
        }
      }

      return result;
    });
  };

  const exportJson = () => {
    const payload = {
      version: "V8-ChurchPlanner-1.0",
      projectId,
      coupleName,
      exportedAt: new Date().toISOString(),
      elements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `progetto-chiesa-${projectId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveToCloud = async () => {
    setSavingCloud(true);
    setCloudSaved(false);

    try {
      const payload = elements.map((element, index) => ({
        elementKey: element.id, kind: element.kind, view: element.boardView,
        compositionCode: element.kind === "composition" ? element.code : null,
        sourceItemId: element.sourceItemId || null, name: element.description || ELEMENT_LABELS[element.kind],
        description: element.description || null, position: element.position || null, quantity: Number(element.quantity || 1),
        x: Number(element.x || 0), y: Number(element.y || 0), width: Number(element.width || 10), height: Number(element.height || 10),
        flowers: element.flowerDetails?.length ? element.flowerDetails : [],
        colors: element.flowerDetails?.map((item: any) => item.color).filter(Boolean) || [],
        structure: element.structureDetails?.length ? element.structureDetails : [],
        materials: element.structureDetails?.map((item: any) => item.name).filter(Boolean) || [],
        notes: element.notes || null, sortOrder: index,
      }));

      await saveChurchPlan(projectId, payload);
      setCloudSaved(true);
    } catch (error) {
      console.error("Errore salvataggio ChurchPlanner:", error);
      window.alert(
        error instanceof Error
          ? `Errore nel salvataggio su Supabase: ${error.message}`
          : "Errore nel salvataggio su Supabase.",
      );
    } finally {
      setSavingCloud(false);
    }
  };

  const printProject = () => {
    window.print();
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData(
      "application/x-v8-church-kind",
    ) as PlannerElement["kind"];

    if (!kind) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      2,
      Math.min(94, ((event.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.max(
      2,
      Math.min(94, ((event.clientY - rect.top) / rect.height) * 100),
    );

    addElement(kind, x, y);
    setDraggedKind(null);
  };

  const title =
    VIEWS.find((item) => item.key === view)?.label.replace(/^.\s*/, "") ||
    "Planimetria generale";

  return (
    <section className="mb-8 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm print:hidden">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
            Nuovo modulo V8
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Progetto Floreale · Chiesa
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Progettazione grafica per {coupleName}. Posizioni e dati tecnici possono essere salvati nel progetto V8 e sincronizzati con Supabase.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveToCloud}
            disabled={savingCloud}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {savingCloud
              ? "Salvataggio..."
              : cloudSaved
                ? "✓ Salvato su Supabase"
                : "Salva su Supabase"}
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Esporta progetto
          </button>
          <button
            type="button"
            onClick={printProject}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Stampa / PDF
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((item: any) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
              view === item.key
                ? "bg-emerald-700 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><strong className="text-slate-800">Legenda:</strong><span className="rounded-full border border-rose-300 bg-white px-2 py-1 font-bold">C1–Cn Composizioni</span><span className="rounded-full border border-slate-300 bg-white px-2 py-1">AR Archi</span><span className="rounded-full border border-slate-300 bg-white px-2 py-1">TP Tappeti</span><span className="rounded-full border border-slate-300 bg-white px-2 py-1">SP Sedute</span><span className="ml-auto">Trascina per posizionare · seleziona per modificare</span></div>

      <div className="grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)_290px]">
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Libreria elementi
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Trascina un elemento sulla tavola oppure cliccalo per aggiungerlo.
          </p>

          <div className="mt-4 space-y-2">
            {(
              Object.keys(ELEMENT_LABELS) as PlannerElement["kind"][]
            ).map((kind) => (
              <button
                key={kind}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/x-v8-church-kind",
                    kind,
                  );
                  setDraggedKind(kind);
                }}
                onDragEnd={() => setDraggedKind(null)}
                onClick={() => addElement(kind)}
                className={`w-full rounded-xl border bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:border-rose-300 hover:bg-rose-50 ${
                  draggedKind === kind
                    ? "border-emerald-400 ring-2 ring-emerald-100"
                    : "border-slate-200"
                }`}
              >
                {ELEMENT_LABELS[kind]}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={resetFromV8Items}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              ↻ Aggiorna composizioni V8 + dati floreali senza duplicati
            </button>
            <button
              type="button"
              onClick={clearElements}
              className="mt-2 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              Cancella tavola
            </button>
          </div>
        </aside>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-slate-800">{title}</strong>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {elements.length} elementi
            </span>
          </div>

          {view === "list" ? (
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-rose-50 text-rose-900">
                  <tr>
                    <th className="px-3 py-3">N.</th>
                    <th className="px-3 py-3">Posizione</th>
                    <th className="px-3 py-3">Descrizione</th>
                    <th className="px-3 py-3">Q.tà</th>
                    <th className="px-3 py-3">Fiori / Colori</th>
                    <th className="px-3 py-3">Struttura / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((element) => (
                    <tr
                      key={element.id}
                      onClick={() => setSelectedId(element.id)}
                      className={`cursor-pointer border-t border-slate-100 ${
                        element.id === selectedId ? "bg-emerald-50" : "bg-white"
                      }`}
                    >
                      <td className="px-3 py-3 font-bold">{element.code}</td>
                      <td className="px-3 py-3">{element.position || "—"}</td>
                      <td className="px-3 py-3">
                        {element.description || ELEMENT_LABELS[element.kind]}
                      </td>
                      <td className="px-3 py-3">{element.quantity}</td>
                      <td className="px-3 py-3">{element.flowers || "—"}</td>
                      <td className="px-3 py-3">
                        {element.structure || element.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={`relative min-h-[620px] overflow-hidden rounded-xl border border-slate-300 ${
                view === "outside"
                  ? "bg-gradient-to-b from-emerald-50 via-emerald-50 to-stone-100"
                  : "bg-stone-50"
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onPointerDown={(event) => {
                if (event.currentTarget === event.target) {
                  setSelectedId(null);
                }
              }}
            >
              {view === "outside" ? (
                <div className="absolute inset-x-[15%] top-[11%] bottom-[12%] rounded-t-[80px] border-4 border-stone-500 bg-white/80">
                  <div className="absolute left-1/2 top-[12%] h-24 w-24 -translate-x-1/2 rounded-full border-4 border-stone-400" />
                  <div className="absolute left-1/2 bottom-[10%] h-36 w-24 -translate-x-1/2 rounded-t-xl border-4 border-stone-500 bg-stone-100" />
                  <div className="absolute left-1/2 top-[-9%] h-12 w-12 -translate-x-1/2 rounded-full border-2 border-stone-400" />
                  <div className="absolute bottom-[-7%] left-[8%] right-[8%] h-4 rounded-full bg-stone-300" />
                  <span className="absolute left-1/2 top-[46%] -translate-x-1/2 text-xs font-bold uppercase tracking-wider text-stone-500">
                    Facciata chiesa
                  </span>
                </div>
              ) : (
                <div className="absolute inset-x-[17%] top-[7%] bottom-[7%] rounded-t-[70px] rounded-b-2xl border-4 border-stone-500 bg-white">
                  <div className="absolute left-[24%] right-[24%] top-0 h-[18%] rounded-t-[70px] border-b-2 border-stone-300 bg-rose-50/40">
                    <span className="absolute left-1/2 top-[25%] -translate-x-1/2 text-[10px] font-bold text-stone-500">
                      ALTARE / ABSIDE
                    </span>
                  </div>
                  <div className="absolute left-[24%] right-[24%] top-[27%] bottom-[12%] bg-stone-50">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_28px,#b9aea8_29px,#b9aea8_31px)] opacity-70" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-wider text-stone-500">
                      NAVATA CENTRALE
                    </span>
                  </div>
                  <div className="absolute left-0 top-[20%] bottom-[12%] w-[23%] bg-stone-50" />
                  <div className="absolute right-0 top-[20%] bottom-[12%] w-[23%] bg-stone-50" />
                  <span className="absolute bottom-[3%] left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    INGRESSO
                  </span>
                </div>
              )}

              {elements.filter((element) => view === "general" || element.boardView === view).map((element) => (
                <PlannerElementView
                  key={element.id}
                  element={element}
                  selected={element.id === selectedId}
                  onSelect={() => setSelectedId(element.id)}
                  onMove={(x, y) => {
                    setElements((current) =>
                      current.map((item: any) =>
                        item.id === element.id ? { ...item, x, y } : item,
                      ),
                    );
                  }}
                />
              ))}

              {!elements.length && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-dashed border-slate-300 bg-white/80 px-5 py-3 text-center text-xs text-slate-500">
                  Trascina qui le composizioni
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Scheda elemento
          </h3>

          {!selected ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Seleziona un elemento sulla tavola per modificare posizione,
              descrizione, quantità, fiori e struttura.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Codice
                  </span>
                  <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold">
                    {selected.code}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Tipo
                  </span>
                  <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold">
                    {ELEMENT_LABELS[selected.kind]}
                  </div>
                </div>
              </div>

              {(selected.kind === "composition" && (selected.flowers || selected.structure)) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Dati tecnici dalla V8
                  </div>
                  {selected.flowers && (
                    <div className="mt-2">
                      <div className="text-[10px] font-bold uppercase text-slate-500">Fiori</div>
                      <div className="mt-1 text-xs leading-5 text-slate-700">{selected.flowers}</div>
                    </div>
                  )}
                  {selected.structure && (
                    <div className="mt-2">
                      <div className="text-[10px] font-bold uppercase text-slate-500">Strutture / materiali</div>
                      <div className="mt-1 text-xs leading-5 text-slate-700">{selected.structure}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vista elemento</div>
                <select value={selected.boardView} onChange={(event) => updateSelected({ boardView: event.target.value as PlannerElement["boardView"] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                  <option value="general">Planimetria generale</option><option value="inside">Pianta interna</option><option value="outside">Vista esterna / sagrato</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="text-[10px] font-bold uppercase text-slate-500">Larghezza</span><input type="number" min="1" step="0.5" value={selected.width} onChange={(e) => updateSelected({ width: Number(e.target.value || 10) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
                <label><span className="text-[10px] font-bold uppercase text-slate-500">Altezza</span><input type="number" min="1" step="0.5" value={selected.height} onChange={(e) => updateSelected({ height: Number(e.target.value || 10) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Fiori associati</div>
                <div className="mt-2 space-y-2">
                  {selected.flowerDetails.length ? selected.flowerDetails.map((flower, index) => <div key={index} className="grid grid-cols-[1.4fr_1fr_60px] gap-2"><input value={flower.name} onChange={(e) => { const rows=[...selected.flowerDetails]; rows[index]={...rows[index],name:e.target.value}; updateSelected({flowerDetails:rows}); }} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="Fiore" /><input value={flower.color} onChange={(e) => { const rows=[...selected.flowerDetails]; rows[index]={...rows[index],color:e.target.value}; updateSelected({flowerDetails:rows}); }} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="Colore" /><input type="number" min="1" value={flower.quantity} onChange={(e) => { const rows=[...selected.flowerDetails]; rows[index]={...rows[index],quantity:Number(e.target.value||1)}; updateSelected({flowerDetails:rows}); }} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></div>) : <p className="text-xs text-slate-500">Nessun fiore associato.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Strutture / materiali</div>
                <div className="mt-2 space-y-2">
                  {selected.structureDetails.length ? selected.structureDetails.map((item, index) => <div key={index} className="grid grid-cols-[1.4fr_1fr_60px] gap-2"><input value={item.customName || item.name} onChange={(e) => { const rows=[...selected.structureDetails]; rows[index]={...rows[index],customName:e.target.value}; updateSelected({structureDetails:rows}); }} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="Struttura" /><input value={item.color} onChange={(e) => { const rows=[...selected.structureDetails]; rows[index]={...rows[index],color:e.target.value}; updateSelected({structureDetails:rows}); }} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="Colore" /><input type="number" min="1" value={item.quantity} onChange={(e) => { const rows=[...selected.structureDetails]; rows[index]={...rows[index],quantity:Number(e.target.value||1)}; updateSelected({structureDetails:rows}); }} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" /></div>) : <p className="text-xs text-slate-500">Nessuna struttura associata.</p>}
                </div>
              </div>

              {(
                [
                  ["position", "Posizione / zona", "text"],
                  ["description", "Descrizione", "textarea"],
                  ["quantity", "Quantità", "number"],
                  ["flowers", "Fiori / colori", "text"],
                  ["structure", "Struttura / materiali", "text"],
                  ["notes", "Note", "textarea"],
                ] as const
              ).map(([field, label, type]) => (
                <label key={field} className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                  {type === "textarea" ? (
                    <textarea
                      value={String(selected[field])}
                      onChange={(event) =>
                        updateSelected({ [field]: event.target.value })
                      }
                      rows={field === "description" ? 3 : 2}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <input
                      type={type}
                      min={type === "number" ? 1 : undefined}
                      value={String(selected[field])}
                      onChange={(event) =>
                        updateSelected({
                          [field]:
                            field === "quantity"
                              ? Number(event.target.value || 1)
                              : event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                    />
                  )}
                </label>
              ))}

              <div className="flex gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={duplicateSelected}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Duplica
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  Elimina
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
        <strong>Collegamento V8:</strong> il modulo importa le composizioni
        della categoria <strong>Chiesa</strong> già presenti nel progetto,
        includendo i dati floreali e le strutture associate.
        <strong>Salvataggio cloud:</strong> usa “Salva su Supabase” per
        memorizzare la progettazione della Chiesa nel progetto V8. Il
        LocalStorage resta disponibile come copia locale di sicurezza.
      </div>
    </section>
  );
}

function PlannerElementView({
  element,
  selected,
  onSelect,
  onMove,
}: {
  element: PlannerElement;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const updatePosition = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const board = event.currentTarget.parentElement;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const x = Math.max(
      1,
      Math.min(94, ((event.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.max(
      1,
      Math.min(94, ((event.clientY - rect.top) / rect.height) * 100),
    );
    onMove(x, y);
  };

  return (
    <button
      type="button"
      title={element.description || ELEMENT_LABELS[element.kind]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        onSelect();
      }}
      onPointerMove={updatePosition}
      onPointerUp={(event) => {
        setDragging(false);
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {}
      }}
      className={`absolute z-20 flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white px-2 text-[10px] font-extrabold shadow-md ${
        selected
          ? "border-emerald-600 ring-4 ring-emerald-100"
          : "border-rose-400"
      } ${
        element.kind === "arch"
          ? "rounded-xl"
          : element.kind === "carpet"
            ? "h-6 min-w-24 rounded-md"
            : ""
      }`}
      style={{ left: `${element.x}%`, top: `${element.y}%` }}
    >
      {element.code}
    </button>
  );
}

