"use client";

import { useEffect, useMemo, useState } from "react";

type ChurchItem = {
  id: string;
  name: string | null;
  description: string | null;
  quantity: number | null;
  notes: string | null;
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
    flowers: "",
    structure: "",
    notes: source?.notes || "",
    sourceItemId: source?.id,
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
  const [draggedKind, setDraggedKind] = useState<PlannerElement["kind"] | null>(
    null,
  );

  const selected = useMemo(
    () => elements.find((element) => element.id === selectedId) || null,
    [elements, selectedId],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setElements(parsed);
        }
      } else if (churchItems.length) {
        setElements(defaultElements(churchItems));
      }
    } catch {
      if (churchItems.length) setElements(defaultElements(churchItems));
    } finally {
      setHydrated(true);
    }
  }, [storageKey, churchItems]);

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
    setElements((current) =>
      current.map((element) =>
        element.id === selectedId ? { ...element, ...patch } : element,
      ),
    );
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
        "Ricreare la tavola partendo dalle composizioni Chiesa già presenti nella V8?",
      )
    ) {
      return;
    }
    const fresh = defaultElements(churchItems);
    setElements(fresh);
    setSelectedId(fresh[0]?.id || null);
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
            Progettazione grafica per {coupleName}. Le posizioni sono salvate
            localmente sul dispositivo per questa prima integrazione.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
        {VIEWS.map((item) => (
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
              ↻ Importa composizioni V8
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

              {elements.map((element) => (
                <PlannerElementView
                  key={element.id}
                  element={element}
                  selected={element.id === selectedId}
                  onSelect={() => setSelectedId(element.id)}
                  onMove={(x, y) => {
                    setElements((current) =>
                      current.map((item) =>
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

              {(
                [
                  ["position", "Posizione", "text"],
                  ["description", "Descrizione", "textarea"],
                  ["quantity", "Quantità", "number"],
                  ["size", "Dimensione", "text"],
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
        della categoria <strong>Chiesa</strong> già presenti nel progetto.
        In questa V1 le coordinate grafiche vengono conservate nel browser
        tramite LocalStorage; il passaggio successivo potrà salvarle su
        Supabase con campi dedicati, senza modificare le voci economiche del
        preventivo.
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
