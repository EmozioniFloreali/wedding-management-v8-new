import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Paragraph,
  Packer,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export type QuoteDocumentData = {
  quote: {
    id: string;
    version_number: number;
    status: string;
    title?: string | null;
    validity_days?: number | null;
    total_amount?: number | null;
    deposit_amount?: number | null;
    vat_included?: boolean | null;
    notes?: string | null;
    created_at?: string | null;
    presented_at?: string | null;
    confirmed_at?: string | null;
  };
  couple: {
    first: string;
    second: string;
    email?: string | null;
    phone?: string | null;
  };
  wedding: {
    date?: string | null;
    time?: string | null;
    venue?: string | null;
    church?: string | null;
    reception?: string | null;
  };
  project: {
    name: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    area?: string | null;
    notes?: string | null;
  }>;
};

const GREEN = "5D6F35";
const PINK = "C2185B";

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateIt(value?: string | null) {
  if (!value) return "";
  const d = new Date(value.includes("T") ? value : value + "T12:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeZone: "Europe/Rome",
  }).format(d);
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value.includes("T") ? value : value + "T12:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeZone: "Europe/Rome",
  }).format(d);
}

function statusLabel(status: string) {
  return ({
    bozza: "Bozza",
    presentato: "Presentato",
    in_attesa_conferma: "In attesa di conferma",
    confermato: "Confermato",
    rifiutato_da_modificare: "Da modificare",
  } as Record<string, string>)[status] || status;
}

function wrap(text: string, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length <= max) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function buildQuotePdf(data: QuoteDocumentData): Uint8Array {
  const pdf = awaitablePdf();
  return pdf;
}

function awaitablePdf(): Uint8Array {
  throw new Error("buildQuotePdf must be replaced by buildQuotePdfAsync");
}

export async function buildQuotePdfAsync(data: QuoteDocumentData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: any[] = [];
  let page = pdf.addPage([595.28, 841.89]);
  pages.push(page);

  const margin = 48;
  let y = 790;

  const drawHeader = () => {
    page.drawText("EMOZIONI FLOREALI", {
      x: margin,
      y,
      size: 21,
      font: bold,
      color: rgb(0.36, 0.44, 0.21),
    });
    page.drawText("di Giusy Surace", {
      x: margin,
      y: y - 23,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText("PREVENTIVO PROFESSIONALE", {
      x: 360,
      y: y - 4,
      size: 11,
      font: bold,
      color: rgb(0.76, 0.09, 0.36),
    });
    page.drawText(`Versione ${data.quote.version_number}`, {
      x: 448,
      y: y - 20,
      size: 9,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawLine({
      start: { x: margin, y: y - 34 },
      end: { x: 547, y: y - 34 },
      thickness: 1.5,
      color: rgb(0.76, 0.09, 0.36),
    });
    y -= 58;
  };

  const ensure = (height: number) => {
    if (y - height < 55) {
      page.drawLine({
        start: { x: margin, y: 38 },
        end: { x: 547, y: 38 },
        thickness: 0.7,
        color: rgb(0.82, 0.82, 0.82),
      });
      page.drawText(`Emozioni Floreali di Giusy Surace • Preventivo v${data.quote.version_number}`, {
        x: margin,
        y: 24,
        size: 7,
        font: regular,
        color: rgb(0.45, 0.45, 0.45),
      });
      page = pdf.addPage([595.28, 841.89]);
      pages.push(page);
      y = 790;
      drawHeader();
    }
  };

  const text = (value: string, size = 10, font = regular, color = rgb(0.15,0.15,0.15), gap = 15) => {
    for (const line of wrap(value, Math.max(35, Math.floor(500 / (size * 0.55))))) {
      ensure(gap);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= gap;
    }
  };

  const section = (title: string) => {
    ensure(34);
    y -= 4;
    page.drawText(title.toUpperCase(), {
      x: margin,
      y,
      size: 10,
      font: bold,
      color: rgb(0.36, 0.44, 0.21),
    });
    y -= 17;
  };

  drawHeader();
  text(data.quote.title || "Preventivo Progetto Floreale", 17, bold, rgb(0.10,0.10,0.10), 21);
  text(`Preventivo v${data.quote.version_number} • Stato: ${statusLabel(data.quote.status)}`, 9, regular, rgb(0.40,0.40,0.40), 14);
  y -= 6;

  section("Dati degli sposi");
  text(`${data.couple.first} & ${data.couple.second}`, 12, bold, rgb(0.10,0.10,0.10), 17);
  if (data.couple.email) text(`Email: ${data.couple.email}`, 9, regular, undefined, 13);
  if (data.couple.phone) text(`Telefono: ${data.couple.phone}`, 9, regular, undefined, 13);

  section("Dati del matrimonio");
  if (data.wedding.date) text(`Data: ${dateIt(data.wedding.date)}`, 9, regular, undefined, 13);
  if (data.wedding.time) text(`Ora: ${data.wedding.time.slice(0,5)}`, 9, regular, undefined, 13);
  if (data.wedding.venue) text(`Location: ${data.wedding.venue}`, 9, regular, undefined, 13);
  if (data.wedding.church) text(`Cerimonia: ${data.wedding.church}`, 9, regular, undefined, 13);
  if (data.wedding.reception) text(`Ricevimento: ${data.wedding.reception}`, 9, regular, undefined, 13);

  section("Progetto floreale");
  text(data.project.name, 10, bold, undefined, 15);
  text("Il presente preventivo riporta esclusivamente le voci selezionate nel Progetto Floreale. Le singole composizioni non hanno un prezzo autonomo.", 9, regular, rgb(0.30,0.30,0.30), 14);

  section("Voci comprese");
  for (const [index, item] of data.items.entries()) {
    ensure(32);
    page.drawText(`${index + 1}. ${item.description}`, { x: margin, y, size: 9.5, font: bold, color: rgb(0.12,0.12,0.12) });
    y -= 14;
    page.drawText(`${item.quantity} ${item.unit}${item.area ? " • " + item.area : ""}`, { x: margin + 14, y, size: 8.5, font: regular, color: rgb(0.42,0.42,0.42) });
    y -= 13;
    if (item.notes) {
      text(`Note: ${item.notes}`, 8.5, regular, rgb(0.42,0.42,0.42), 12);
    }
    y -= 4;
  }

  ensure(92);
  section("Riepilogo economico");
  const total = Number(data.quote.total_amount || 0);
  const deposit = Number(data.quote.deposit_amount || 0);
  const balance = Math.max(0, total - deposit);
  page.drawRectangle({ x: margin, y: y - 64, width: 499, height: 76, color: rgb(0.97,0.97,0.95), borderColor: rgb(0.84,0.84,0.80), borderWidth: 0.8 });
  page.drawText("TOTALE COMPLESSIVO", { x: margin + 16, y: y - 13, size: 9, font: bold, color: rgb(0.36,0.44,0.21) });
  page.drawText(money(total), { x: 420, y: y - 16, size: 16, font: bold, color: rgb(0.76,0.09,0.36) });
  page.drawText(`Acconto: ${money(deposit)}`, { x: margin + 16, y: y - 36, size: 9, font: regular });
  page.drawText(`Saldo: ${money(balance)}`, { x: 260, y: y - 36, size: 9, font: regular });
  page.drawText(data.quote.vat_included ? "IVA inclusa" : "IVA esclusa", { x: margin + 16, y: y - 53, size: 8, font: regular, color: rgb(0.42,0.42,0.42) });
  y -= 92;

  section("Validità e note");
  text(`Validità del preventivo: ${data.quote.validity_days ?? 30} giorni.`, 9, regular, undefined, 13);
  if (data.quote.notes) text(data.quote.notes, 9, regular, undefined, 13);

  ensure(65);
  y -= 10;
  text("Documento generato dal Wedding Management di Emozioni Floreali. La versione del documento corrisponde alla versione del preventivo selezionata e viene mantenuta come riferimento storico.", 8, regular, rgb(0.42,0.42,0.42), 12);

  for (const [index, p] of pages.entries()) {
    p.drawText(`Pagina ${index + 1} di ${pages.length}`, {
      x: 480, y: 24, size: 7, font: regular, color: rgb(0.45,0.45,0.45)
    });
  }

  return pdf.save();
}

export async function buildQuoteDocx(data: QuoteDocumentData): Promise<Uint8Array> {
  const total = Number(data.quote.total_amount || 0);
  const deposit = Number(data.quote.deposit_amount || 0);
  const balance = Math.max(0, total - deposit);

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 220, after: 100 },
      children: [new TextRun({ text, bold: true, color: GREEN })],
    });

  const itemRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Voce", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Quantità", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Unità", bold: true })] })] }),
      ],
    }),
    ...data.items.map((item) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(item.description)] }),
          new TableCell({ children: [new Paragraph(String(item.quantity))] }),
          new TableCell({ children: [new Paragraph(item.unit)] }),
        ],
      })
    ),
  ];

  const doc = new Document({
    creator: "Emozioni Floreali di Giusy Surace",
    title: `Preventivo v${data.quote.version_number} - ${data.couple.first} & ${data.couple.second}`,
    description: "Preventivo professionale Wedding Management",
    sections: [{
      properties: {
        page: {
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: "EMOZIONI FLOREALI", bold: true, size: 34, color: GREEN })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 260 },
          children: [new TextRun({ text: "di Giusy Surace", italics: true, size: 20, color: PINK })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "PREVENTIVO PROFESSIONALE", bold: true, size: 26 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 260 },
          children: [new TextRun({ text: `Versione ${data.quote.version_number} • ${shortDate(data.quote.created_at)}`, size: 18, color: "666666" })],
        }),
        new Paragraph({
          children: [new TextRun({ text: data.quote.title || "Preventivo Progetto Floreale", bold: true, size: 28 })],
          spacing: { after: 180 },
        }),
        heading("Dati degli sposi"),
        new Paragraph({ children: [new TextRun({ text: `${data.couple.first} & ${data.couple.second}`, bold: true, size: 22 })] }),
        ...(data.couple.email ? [new Paragraph(`Email: ${data.couple.email}`)] : []),
        ...(data.couple.phone ? [new Paragraph(`Telefono: ${data.couple.phone}`)] : []),
        heading("Dati del matrimonio"),
        ...(data.wedding.date ? [new Paragraph(`Data: ${dateIt(data.wedding.date)}`)] : []),
        ...(data.wedding.time ? [new Paragraph(`Ora: ${data.wedding.time.slice(0,5)}`)] : []),
        ...(data.wedding.venue ? [new Paragraph(`Location: ${data.wedding.venue}`)] : []),
        ...(data.wedding.church ? [new Paragraph(`Cerimonia: ${data.wedding.church}`)] : []),
        ...(data.wedding.reception ? [new Paragraph(`Ricevimento: ${data.wedding.reception}`)] : []),
        heading("Progetto floreale"),
        new Paragraph({ children: [new TextRun({ text: data.project.name, bold: true })] }),
        new Paragraph("Le singole composizioni non hanno un prezzo autonomo: il preventivo esprime un unico corrispettivo complessivo."),
        heading("Voci comprese"),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: itemRows }),
        heading("Riepilogo economico"),
        new Paragraph({ children: [new TextRun({ text: `TOTALE COMPLESSIVO: ${money(total)}`, bold: true, size: 24, color: PINK })] }),
        new Paragraph(`Acconto: ${money(deposit)}`),
        new Paragraph(`Saldo: ${money(balance)}`),
        new Paragraph(data.quote.vat_included ? "IVA inclusa nel totale." : "IVA esclusa dal totale."),
        heading("Validità e note"),
        new Paragraph(`Validità del preventivo: ${data.quote.validity_days ?? 30} giorni.`),
        ...(data.quote.notes ? [new Paragraph(data.quote.notes)] : []),
        new Paragraph({
          spacing: { before: 400 },
          children: [new TextRun({
            text: "Emozioni Floreali di Giusy Surace • Wedding & Floral Design",
            bold: true,
            color: GREEN,
          })],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
