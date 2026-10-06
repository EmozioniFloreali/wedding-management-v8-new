export type ContractData = {
  contractDate: string;
  couple: { first: string; second: string; email?: string | null; phone?: string | null };
  wedding: {
    date?: string | null;
    time?: string | null;
    venue?: string | null;
    church?: string | null;
    reception?: string | null;
  };
  project: { name: string; status?: string | null; notes?: string | null; total?: number | null };
  items: Array<{
    name: string;
    category?: string | null;
    description?: string | null;
    quantity?: number | null;
    unit?: string | null;
    notes?: string | null;
    flowers?: string[];
    structures?: string[];
  }>;
  quote?: {
    status?: string | null;
    vatRate?: number | null;
    total?: number | null;
    deposit?: number | null;
    balance?: number | null;
    discount?: number | null;
    notes?: string | null;
    items: Array<{ description: string; quantity: number; unit: string }>;
  } | null;
};

function winAnsi(text: string) {
  const replacements: Record<string, string> = {
    "€": "\x80", "–": "\x96", "—": "\x97", "“": "\x93", "”": "\x94", "‘": "\x91", "’": "\x92", "…": "\x85", "×": "\xD7", "·": "\xB7", "«": "\xAB", "»": "\xBB",
  };
  let out = "";
  for (const ch of text) out += replacements[ch] ?? ch;
  return out.normalize("NFC").replace(/[^\x00-\xFF]/g, "?");
}

function pdfEscape(text: string) {
  return winAnsi(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, max = 94) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if ((line + " " + word).length <= max) line += " " + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Number(value || 0));
}

function dateIt(value?: string | null) {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" }).format(d);
}

function addSection(lines: string[], title: string, body: string[]) {
  lines.push(title);
  for (const paragraph of body) for (const line of wrap(paragraph)) lines.push(line);
  lines.push("");
}

export function buildContractPdf(data: ContractData): Uint8Array {
  const lines: string[] = [];
  lines.push("EMOZIONI FLOREALI");
  lines.push("di Giuseppa Surace");
  lines.push("CONTRATTO DI SCRITTURA PRIVATA");
  lines.push("CONTRATTO PER SERVIZIO DI ADDOBBO FLOREALE E ALLESTIMENTO");
  lines.push("");
  lines.push(`Data contratto: ${data.contractDate}`);
  lines.push(`Committenti: ${data.couple.first} e ${data.couple.second}`);
  if (data.couple.email) lines.push(`Email: ${data.couple.email}`);
  if (data.couple.phone) lines.push(`Telefono: ${data.couple.phone}`);
  lines.push("");
  lines.push("DATI DEL MATRIMONIO");
  lines.push(`Data: ${dateIt(data.wedding.date) || "da definire"}`);
  if (data.wedding.time) lines.push(`Ora: ${data.wedding.time.slice(0, 5)}`);
  if (data.wedding.venue) lines.push(`Location: ${data.wedding.venue}`);
  if (data.wedding.church) lines.push(`Cerimonia: ${data.wedding.church}`);
  if (data.wedding.reception) lines.push(`Ricevimento: ${data.wedding.reception}`);
  lines.push("");

  addSection(lines, "ART. 1 – OGGETTO DEL CONTRATTO", [
    "Il presente contratto disciplina il servizio d'opera professionale per la progettazione, fornitura, trasporto, allestimento e disallestimento delle decorazioni floreali relative al matrimonio indicato nel presente documento, ai sensi dell'art. 2222 del Codice Civile.",
  ]);

  addSection(lines, "ART. 2 – SERVIZI E LAVORI DA ESEGUIRE", [
    `Il servizio è definito sulla base del Progetto Floreale “${data.project.name}”. Di seguito sono riportate le lavorazioni effettivamente presenti nel progetto al momento della generazione del contratto.`,
  ]);
  if (!data.items.length) lines.push("Nessuna lavorazione presente nel progetto.");
  data.items.forEach((item, index) => {
    const qty = item.quantity != null ? `${item.quantity} ${item.unit || "pz"}` : "";
    lines.push(`${index + 1}. ${item.name}${qty ? ` – Quantità: ${qty}` : ""}`);
    if (item.category) lines.push(`   Categoria: ${item.category}`);
    if (item.description) for (const l of wrap(`   Descrizione: ${item.description}`, 90)) lines.push(l);
    if (item.flowers?.length) for (const l of wrap(`   Fiori/colori: ${item.flowers.join(", ")}`, 90)) lines.push(l);
    if (item.structures?.length) for (const l of wrap(`   Strutture/materiali: ${item.structures.join(", ")}`, 90)) lines.push(l);
    if (item.notes) for (const l of wrap(`   Note: ${item.notes}`, 90)) lines.push(l);
  });
  lines.push("");

  addSection(lines, "ART. 3 – CORRISPETTIVO, IVA, ACCONTO E SALDO", [
    data.quote ? `Il corrispettivo complessivo concordato, IVA ${Number(data.quote.vatRate ?? 10)}% inclusa, è pari a ${money(data.quote.total)}.` : `Il valore economico indicato nel Progetto Floreale è pari a ${money(data.project.total)}. Il corrispettivo definitivo dovrà essere confermato nel preventivo prima della sottoscrizione.`,
    data.quote ? `Acconto richiesto: ${money(data.quote.deposit)}. Saldo residuo: ${money(data.quote.balance)}.` : "Acconto e saldo saranno definiti nel preventivo.",
    data.quote?.discount ? `Sconto applicato: ${money(data.quote.discount)}.` : "",
    data.quote?.notes || "",
  ].filter(Boolean));

  if (data.quote?.items?.length) {
    lines.push("Riepilogo delle voci confermate del preventivo:");
    data.quote.items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.description} – ${item.quantity} ${item.unit}`);
    });
    lines.push("");
  }

  addSection(lines, "ART. 4 – RECESSO, RISOLUZIONE E FORZA MAGGIORE", [
    "In caso di recesso o mancata esecuzione del servizio si applicano le disposizioni del presente contratto e della normativa civile vigente. L'acconto eventualmente versato segue quanto previsto dall'art. 1385 C.C., salvo diverso accordo scritto tra le parti.",
    "Eventi di forza maggiore che rendano impossibile o gravemente ostacolino l'esecuzione del servizio saranno comunicati tempestivamente e gestiti mediante accordo tra le parti, nel rispetto della normativa applicabile.",
  ]);

  addSection(lines, "ART. 5 – VERIFICA FINALE E VARIAZIONI STAGIONALI", [
    "L'ultimo controllo operativo del progetto dovrà essere effettuato indicativamente un mese prima della cerimonia, verificando quantità, orari, accessi, allestimenti e necessità logistiche.",
    "Le varietà floreali possono essere sostituite con fiori equivalenti per qualità, valore estetico e tonalità qualora la disponibilità stagionale o del mercato lo renda necessario. Eventuali variazioni sostanziali saranno concordate con i committenti.",
  ]);

  addSection(lines, "ART. 6 – FORO COMPETENTE", [
    "Per quanto non espressamente previsto si applicano le disposizioni del Codice Civile. Per eventuali controversie è competente il Foro di Reggio Calabria, salvo diversa competenza inderogabile prevista dalla legge.",
  ]);

  lines.push("DATI DEL FORNITORE");
  lines.push("Emozioni Floreali di Giuseppa Surace");
  lines.push("Viale Rocco Larussa 53/A – Villa San Giovanni (RC)");
  lines.push("P. IVA 02200030803");
  lines.push("");
  lines.push("FIRME");
  lines.push("Il Fornitore: ________________________________");
  lines.push(`${data.couple.first}: ________________________________`);
  lines.push(`${data.couple.second}: ________________________________`);
  lines.push("");
  lines.push("Il presente documento è generato dal Progetto Floreale e dal Preventivo collegati alla coppia e deve essere verificato e sottoscritto dalle parti prima dell'esecuzione del servizio.");

  const pages: string[][] = [];
  const maxLines = 46;
  let page: string[] = [];
  for (const line of lines) {
    for (const part of wrap(line, 94)) {
      if (page.length >= maxLines) { pages.push(page); page = []; }
      page.push(part);
    }
  }
  if (page.length) pages.push(page);

  const objects: string[] = [];
  const add = (obj: string) => { objects.push(obj); return objects.length; };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const pagesId = add("<< /Type /Pages /Kids [] /Count 0 >>");
  const pageIds: number[] = [];
  for (const pg of pages) {
    let stream = "BT\n/F1 10 Tf\n50 800 Td\n14 TL\n";
    pg.forEach((line, i) => {
      if (i === 0) stream += `(${pdfEscape(line)}) Tj\n`;
      else stream += `T* (${pdfEscape(line)}) Tj\n`;
    });
    stream += "ET\n";
    const streamId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const chunks: string[] = ["%PDF-1.4\n%\xFF\xFF\xFF\xFF\n"];
  const offsets: number[] = [0];
  let offset = Buffer.byteLength(chunks[0], "latin1");
  for (let i = 0; i < objects.length; i++) {
    const obj = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    offsets.push(offset);
    chunks.push(obj);
    offset += Buffer.byteLength(obj, "latin1");
  }
  const xrefOffset = offset;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objects.length; i++) chunks.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Uint8Array(Buffer.from(chunks.join(""), "latin1"));
}
