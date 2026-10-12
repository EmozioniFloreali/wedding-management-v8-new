
export type ContractData = {
  contractDate: string;
  versionNumber?: number | null;
  couple: { first: string; second: string; email?: string | null; phone?: string | null };
  wedding: { date?: string | null; time?: string | null; venue?: string | null; church?: string | null; reception?: string | null };
  project: { name: string; status?: string | null; notes?: string | null; total?: number | null };
  items: Array<{ name: string; category?: string | null; description?: string | null; quantity?: number | null; unit?: string | null; notes?: string | null; flowers?: string[]; structures?: string[] }>;
  quote?: { status?: string | null; vatRate?: number | null; total?: number | null; deposit?: number | null; balance?: number | null; discount?: number | null; notes?: string | null; items: Array<{ area?: string | null; description: string; quantity: number; unit: string }> } | null;
};

function winAnsi(text:string){
  const map:Record<string,string>={
    "€":"EUR","–":"-","—":"-","“":"\"","”":"\"","‘":"'","’":"'","…":"...","×":"x","·":"-","«":"\"","»":"\""
  };
  let out="";
  for(const ch of text) out+=map[ch]??ch;
  return out.normalize("NFD").split("").filter(ch=>ch.charCodeAt(0)>=32&&ch.charCodeAt(0)<=126).join("");
}
function pdfEscape(text:string){
  return winAnsi(text).split("\\").join("\\\\").split("(").join("\\(").split(")").join("\\)");
}
function wrap(text:string,max=92){
  const words=text.replace(/\s+/g," ").trim().split(" ").filter(Boolean);
  const lines:string[]=[];
  let line="";
  for(const w of words){
    const n=line?line+" "+w:w;
    if(n.length<=max) line=n;
    else { if(line) lines.push(line); line=w; }
  }
  if(line) lines.push(line);
  return lines.length?lines:[""];
}

function money(v:number|null|undefined){return new Intl.NumberFormat("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0))+" EUR"}
function dateIt(v?:string|null){if(!v)return "";const d=new Date(v.includes("T")?v:v+"T12:00:00");if(Number.isNaN(d.getTime()))return v;return new Intl.DateTimeFormat("it-IT",{dateStyle:"long",timeZone:"Europe/Rome"}).format(d)}
function addSection(lines:string[],title:string,body:string[]){lines.push(title);for(const p of body)for(const l of wrap(p))lines.push(l);lines.push("")}

function contractLines(data:ContractData){
  const lines:string[]=[];
  lines.push("EMOZIONI FLOREALI","di Giusy Surace","WEDDING & FLORAL DESIGN","");
  lines.push("CONTRATTO DI SCRITTURA PRIVATA","SERVIZIO DI ADDOBBO FLOREALE E ALLESTIMENTO","");
  lines.push("Data contratto: "+data.contractDate);
  if(data.versionNumber)lines.push("Versione contratto: "+data.versionNumber);
  lines.push("Committenti: "+data.couple.first+" e "+data.couple.second);
  if(data.couple.email)lines.push("Email: "+data.couple.email);
  if(data.couple.phone)lines.push("Telefono: "+data.couple.phone);
  lines.push("","DATI DEL MATRIMONIO");
  lines.push("Data: "+(dateIt(data.wedding.date)||"da definire"));
  if(data.wedding.time)lines.push("Ora: "+data.wedding.time.slice(0,5));
  if(data.wedding.venue)lines.push("Location: "+data.wedding.venue);
  if(data.wedding.church)lines.push("Cerimonia: "+data.wedding.church);
  if(data.wedding.reception)lines.push("Ricevimento: "+data.wedding.reception);
  lines.push("");
  addSection(lines,"ART. 1 – OGGETTO DEL CONTRATTO",["Il presente contratto disciplina il servizio professionale di progettazione, fornitura, trasporto, allestimento e disallestimento delle decorazioni floreali relative al matrimonio indicato nel presente documento, secondo quanto definito nel Progetto Floreale e nel Preventivo collegati."]);
  addSection(lines,"ART. 2 – SERVIZI E LAVORI DA ESEGUIRE",["Il servizio è definito sulla base del Progetto Floreale “"+data.project.name+"”. Le lavorazioni riportate di seguito costituiscono il perimetro operativo del contratto al momento della sua generazione."]);
  if(!data.items.length)lines.push("Nessuna lavorazione associata.");
  data.items.forEach((item,i)=>{
    const qty=item.quantity!=null?String(item.quantity)+" "+(item.unit||"pz"):"";
    lines.push(String(i+1)+". "+item.name+(qty?" – Quantità: "+qty:""));
    if(item.category)lines.push("Categoria: "+item.category);
    if(item.description)for(const l of wrap("Descrizione: "+item.description,90))lines.push(l);
    if(item.flowers?.length)for(const l of wrap("Fiori/colori: "+item.flowers.join(", "),90))lines.push(l);
    if(item.structures?.length)for(const l of wrap("Strutture/materiali: "+item.structures.join(", "),90))lines.push(l);
    if(item.notes)for(const l of wrap("Note: "+item.notes,90))lines.push(l);
  });
  lines.push("");
  addSection(lines,"ART. 3 – CORRISPETTIVO, IVA, ACCONTO E SALDO",[
    data.quote?"Il corrispettivo complessivo concordato, IVA "+Number(data.quote.vatRate??10)+"% inclusa, è pari a "+money(data.quote.total)+".":"Il valore economico del progetto è pari a "+money(data.project.total)+".",
    data.quote?"Acconto: "+money(data.quote.deposit)+". Saldo residuo: "+money(data.quote.balance)+".":"Acconto e saldo saranno definiti nel preventivo.",
    data.quote?.discount?"Sconto applicato: "+money(data.quote.discount)+".":"",
    data.quote?.notes||""
  ].filter(Boolean));
  lines.push("TOTALE CONTRATTO: "+money(data.quote?.total??data.project.total));
  if(data.quote?.items?.length){
    lines.push("Riepilogo delle voci del preventivo:");
    const bouquetItems: typeof data.quote.items = [];
    const regularItems: typeof data.quote.items = [];
    const isBouquet = (it: typeof data.quote.items[number]) => {
      const area = String(it.area || "").toLowerCase();
      const description = String(it.description || "").toLowerCase();
      return area.startsWith("bouquet") || /bouquet|\bprincipale\b|\bsuocera\b|\blancio\b/.test(description);
    };
    data.quote.items.forEach((it) => (isBouquet(it) ? bouquetItems : regularItems).push(it));
    let index = 1;
    regularItems.forEach((it) => {
      lines.push(String(index++)+". "+it.description+" – "+it.quantity+" "+it.unit);
    });
    if(bouquetItems.length){
      lines.push("Bouquet:");
      bouquetItems.forEach((it) => {
        const description = String(it.description || "").trim();
        const choice = description
          .replace(/^bouquet(?:\s+della\s+sposa)?\s*[:–—-]?\s*/i, "")
          .trim() || description;
        lines.push("  - "+choice+" – "+it.quantity+" "+it.unit);
      });
    }
    lines.push("");
  }
  addSection(lines,"ART. 4 – VARIAZIONI DEL PROGETTO",["Eventuali richieste aggiuntive o modifiche successive alla generazione del presente contratto dovranno essere concordate tra le parti e potranno comportare l’emissione di una nuova versione del Preventivo e del Contratto."]);
  addSection(lines,"ART. 5 – DISPONIBILITÀ STAGIONALE E SOSTITUZIONI",["Le varietà floreali possono essere sostituite con fiori equivalenti per qualità, valore estetico e tonalità quando la disponibilità stagionale o del mercato lo renda necessario. Le variazioni sostanziali saranno preventivamente comunicate e concordate."]);
  addSection(lines,"ART. 6 – RECESSO, RISOLUZIONE E FORZA MAGGIORE",["Per recesso, risoluzione e forza maggiore si applicano le disposizioni del presente contratto e della normativa civile vigente. Eventuali impedimenti sopravvenuti saranno comunicati tempestivamente e gestiti mediante accordo tra le parti, nel rispetto della normativa applicabile."]);
  addSection(lines,"ART. 7 – VERIFICA FINALE E LOGISTICA",["L’ultimo controllo operativo del progetto dovrà essere effettuato indicativamente un mese prima della cerimonia, verificando quantità, orari, accessi, allestimenti e necessità logistiche."]);
  addSection(lines,"ART. 8 – FORO COMPETENTE",["Per quanto non espressamente previsto si applicano le disposizioni del Codice Civile. Per eventuali controversie è competente il Foro di Reggio Calabria, salvo diversa competenza inderogabile prevista dalla legge."]);
  lines.push("DATI DEL FORNITORE","Emozioni Floreali di Giusy Surace","Viale Rocco Larussa 53/A – Villa San Giovanni (RC)","P. IVA 02200030803","","SOTTOSCRIZIONE","Il Fornitore: ________________________________",data.couple.first+": ________________________________",data.couple.second+": ________________________________","","Il presente documento è generato dal Progetto Floreale e dal Preventivo collegati alla coppia. Le parti sono invitate a verificarne il contenuto prima della sottoscrizione.");
  return lines;
}

export function buildContractPdf(data:ContractData):Uint8Array{
  const lines=contractLines(data);
  const objects:string[]=[];
  const obj=(s:string)=>{objects.push(s);return objects.length};
  const font=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pages=obj("<< /Type /Pages /Kids [] /Count 0 >>");
  const pageIds:number[]=[];
  for(let start=0;start<lines.length;start+=34){
    const pg=lines.slice(start,start+34);
    let graphics="";
    graphics+="q 0.36 0.44 0.21 rg 48 806 499 4 re f Q\n";
    graphics+="BT\n/F2 12 Tf\n0.36 0.44 0.21 rg\n1 0 0 1 505 810 Tm (EF) Tj\nET\n";
    let textStream="";
    pg.forEach((line,i)=>{
      const y=780-i*20;
      const main=i<3;
      const head=/^(CONTRATTO |SERVIZIO |ART\\. |DATI |SOTTOSCRIZIONE)/.test(line);
      if(line.startsWith("TOTALE CONTRATTO:")){
        graphics+="q 0.95 0.96 0.92 rg 44 "+(y-9)+" 507 24 re f Q\n";
        textStream+="0.36 0.44 0.21 rg\n/F2 13 Tf\n1 0 0 1 48 "+y+" Tm ("+pdfEscape(line)+") Tj\n";
      }else{
        textStream+=(main?"0.36 0.44 0.21 rg\n/F2 11 Tf\n":head?"0.82 0.05 0.28 rg\n/F2 10 Tf\n":"0.13 0.13 0.13 rg\n/F1 9.2 Tf\n");
        textStream+="1 0 0 1 48 "+y+" Tm ("+pdfEscape(line)+") Tj\n";
      }
    });
    const content=graphics+"BT\n"+textStream+"ET\n";
    const sid=obj("<< /Length "+Buffer.byteLength(content,"latin1")+" >>\nstream\n"+content+"endstream");
    pageIds.push(obj("<< /Type /Page /Parent "+pages+" 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+font+" 0 R /F2 "+bold+" 0 R >> >> /Contents "+sid+" 0 R >>"));
  }
  objects[pages-1]="<< /Type /Pages /Kids ["+pageIds.map(x=>x+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
  const catalog=obj("<< /Type /Catalog /Pages "+pages+" 0 R >>");
  const chunks=["%PDF-1.4\n"];
  const offsets=[0];
  let offset=Buffer.byteLength(chunks[0],"latin1");
  for(let i=0;i<objects.length;i++){
    const o=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n";
    offsets.push(offset);chunks.push(o);offset+=Buffer.byteLength(o,"latin1");
  }
  const xref=offset;
  chunks.push("xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n");
  for(let i=1;i<=objects.length;i++)chunks.push(String(offsets[i]).padStart(10,"0")+" 00000 n \n");
  chunks.push("trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+xref+"\n%%EOF");
  const bytes=new Uint8Array(Buffer.from(chunks.join(""),"latin1"));
  const raw=Buffer.from(bytes).toString("latin1");
  if(!raw.startsWith("%PDF-1.4\n") || !raw.includes("\nxref\n") || !raw.includes("\ntrailer\n") || !raw.includes("\n%%EOF")){
    throw new Error("Generazione PDF contratto non valida.");
  }
  return bytes;
}

function escXml(s:string){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function crc32(buf:Buffer){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16(n:number){const b=Buffer.alloc(2);b.writeUInt16LE(n,0);return b}
function u32(n:number){const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0,0);return b}
function zipStored(files:{name:string;data:Buffer}[]){const local:Buffer[]=[];const central:Buffer[]=[];let offset=0;for(const f of files){const n=Buffer.from(f.name);const h=Buffer.concat([Buffer.from([80,75,3,4]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc32(f.data)),u32(f.data.length),u32(f.data.length),u16(n.length),u16(0),n,f.data]);local.push(h);central.push(Buffer.concat([Buffer.from([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc32(f.data)),u32(f.data.length),u32(f.data.length),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),n]));offset+=h.length}const cd=Buffer.concat(central);const end=Buffer.concat([Buffer.from([80,75,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(offset),u16(0)]);return Buffer.concat(local.concat([cd,end]))}
function p(text:string,bold=false,size=20,color=bold?"5D6F35":"222222"){return "<w:p><w:pPr><w:spacing w:after=\"110\"/></w:pPr><w:r><w:rPr>"+(bold?"<w:b/>":"")+"<w:color w:val=\""+color+"\"/><w:sz w:val=\""+size+"\"/></w:rPr><w:t xml:space=\"preserve\">"+escXml(text)+"</w:t></w:r></w:p>"}
function table(rows:string[][]){return "<w:tbl><w:tblPr><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:color=\"D9DED0\"/><w:left w:val=\"single\" w:sz=\"4\" w:color=\"D9DED0\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"D9DED0\"/><w:right w:val=\"single\" w:sz=\"4\" w:color=\"D9DED0\"/><w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"D9DED0\"/><w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"D9DED0\"/></w:tblBorders></w:tblPr>"+rows.map(r=>"<w:tr>"+r.map((cell,i)=>"<w:tc><w:tcPr><w:shd w:fill=\"F5F6F1\"/></w:tcPr>"+p(cell,i===0,19,i===0?"5D6F35":"333333")+"</w:tc>").join("")+"</w:tr>").join("")+"</w:tbl>"}

export function buildContractDocx(data:ContractData):Buffer{
  const body:string[]=[];
  const center=(text:string,bold=false,size=22,color=bold?"5D6F35":"222222") =>
    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="100"/></w:pPr><w:r><w:rPr>'+(bold?'<w:b/>':'')+'<w:color w:val="'+color+'"/><w:sz w:val="'+size+'"/></w:rPr><w:t xml:space="preserve">'+escXml(text)+'</w:t></w:r></w:p>';
  const paragraph=(text:string,bold=false,size=21,color=bold?"5D6F35":"222222") =>
    '<w:p><w:pPr><w:spacing w:after="120" w:line="280" w:lineRule="auto"/></w:pPr><w:r><w:rPr>'+(bold?'<w:b/>':'')+'<w:color w:val="'+color+'"/><w:sz w:val="'+size+'"/></w:rPr><w:t xml:space="preserve">'+escXml(text)+'</w:t></w:r></w:p>';
  const bullet=(text:string) =>
    '<w:p><w:pPr><w:ind w:left="420" w:hanging="220"/><w:spacing w:after="100" w:line="280" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:color w:val="222222"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">•  '+escXml(text)+'</w:t></w:r></w:p>';
  const heading=(text:string)=>center(text,true,23,"5D6F35");
  const logoBase64="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";
  const logoDrawing='<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1320000" cy="900000"/><wp:docPr id="1" name="Logo Emozioni Floreali"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo-emozioni-floreali.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1320000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  body.push(logoDrawing,center("CONTRATTO PER SERVIZIO DI ADDOBBO FLOREALE",true,27,"222222"),center("TRA LE SEGUENTI PARTI",true,23,"222222"));
  body.push(paragraph('La Sig.ra Giuseppa Surace, nella qualità di titolare del negozio di fiori denominato "Emozioni Floreali", con sede in Villa San Giovanni, Viale Rocco Larussa n. 53/A, Partita IVA 02200030803.'));
  body.push(center("E",true,22,"222222"));
  body.push(paragraph("I Sig.ri "+data.couple.first+" e "+data.couple.second+", nella qualità di committenti."));
  body.push(center("PREMESSO",true,23,"222222"));
  body.push(bullet('Che la Sig.ra Giuseppa Surace, titolare del negozio di fiori denominato "Emozioni Floreali", è specializzata nella realizzazione di addobbi floreali.'));
  body.push(bullet("Che i clienti si uniranno in matrimonio in data "+(dateIt(data.wedding.date)||"da definire")+(data.wedding.time?", alle ore "+data.wedding.time.slice(0,5):"")+(data.wedding.church?", presso "+data.wedding.church:"")+(data.wedding.reception?", e terranno il ricevimento presso "+data.wedding.reception:"")+"."));
  body.push(bullet("Che la Sig.ra Giuseppa Surace ha manifestato la volontà di svolgere il servizio di addobbo floreale dell'evento sopra citato."));
  body.push(center("TANTO PREMESSO",true,23,"222222"),center("LE PARTI CONVENGONO CHE IL SERVIZIO VERRA' SVOLTO COME DI SEGUITO INDICATO",true,21,"222222"));
  body.push(heading("ART. 1 - OGGETTO DEL CONTRATTO"));
  body.push(paragraph("Il presente contratto ha ad oggetto la regolamentazione del servizio per l'addobbo floreale che verrà svolto dalla Sig.ra Giuseppa Surace, nella qualità di titolare del negozio di fiori denominato Emozioni Floreali, per il giorno "+(dateIt(data.wedding.date)||"da definire")+"."));
  body.push(heading("ART. 2 - DESCRIZIONE DEL SERVIZIO E TEMPI DI CONSEGNA"));
  body.push(paragraph("Il servizio per l'addobbo floreale prevede gli allestimenti e le forniture selezionati nel Progetto Floreale, per come di seguito indicato:"));
  const quoteItems=data.quote?.items||[];
  if(quoteItems.length){
    const regular:typeof quoteItems=[];
    const bouquets:typeof quoteItems=[];
    const isBouquet=(it:typeof quoteItems[number])=>String(it.area||"").toLowerCase().startsWith("bouquet")||/bouquet|\bprincipale\b|\bsuocera\b|\blancio\b/i.test(it.description);
    quoteItems.forEach(it=>(isBouquet(it)?bouquets:regular).push(it));
    regular.forEach(it=>body.push(bullet((it.description||"Voce floreale")+" - "+it.quantity+" "+(it.unit||"pz"))));
    if(bouquets.length){
      body.push(paragraph("Sezione bouquet:",true,21,"5D6F35"));
      bouquets.forEach(it=>{
        const label=(it.description||"").replace(/^bouquet(?:\s+della\s+sposa)?\s*[:–—-]?\s*/i,"").trim()||it.description;
        body.push(bullet(label+" - "+it.quantity+" "+(it.unit||"pz")));
      });
    }
  } else if(data.items.length) {
    data.items.forEach(it=>body.push(bullet((it.name||it.description||"Lavorazione floreale")+(it.quantity!=null?" - "+it.quantity+" "+(it.unit||"pz"):""))));
  } else body.push(paragraph("Le lavorazioni saranno quelle riportate nel Progetto Floreale approvato."));
  const floralSpecs=data.items.filter(it=>it.category||it.flowers?.length||it.structures?.length||it.notes);
  if(floralSpecs.length){
    body.push(paragraph("Specifiche del progetto floreale:",true,21,"5D6F35"));
    floralSpecs.forEach(it=>{
      if(it.category)body.push(paragraph(it.category,true,20,"5D6F35"));
      if(it.description)body.push(paragraph(it.description));
      if(it.flowers?.length)body.push(bullet("Fiori/colori: "+it.flowers.join(", ")));
      if(it.structures?.length)body.push(bullet("Strutture da usare: "+it.structures.join(", ")));
      if(it.notes)body.push(bullet("Note: "+it.notes));
    });
  }
  body.push(heading("ART. 3 - PREZZO"));
  body.push(paragraph("Le parti convengono che il prezzo complessivo per il servizio di addobbo floreale oggetto del presente contratto è pari a "+money(data.quote?.total??data.project.total)+", IVA "+Number(data.quote?.vatRate??10)+"% inclusa."));
  body.push(paragraph("All'atto della sottoscrizione del presente contratto i clienti/committenti corrispondono l'importo di "+money(data.quote?.deposit)+" a titolo di acconto."));
  body.push(paragraph("Il saldo residuo, pari a "+money(data.quote?.balance??((data.quote?.total??data.project.total??0)-(data.quote?.deposit??0)))+", sarà corrisposto secondo gli accordi intercorsi tra le parti."));
  if(data.quote?.notes)body.push(paragraph("Note e condizioni economiche: "+data.quote.notes));
  body.push(heading("ART. 4 - RISOLUZIONE"));
  body.push(paragraph("I clienti potranno considerare risolto il presente contratto per grave inadempimento da parte della Sig.ra Surace Giuseppa, salvo il risarcimento dei danni, nei seguenti casi:"));
  body.push(paragraph("a) Interruzione del servizio, in forma di mancata erogazione del medesimo, salvo casi di impedimento per forza maggiore."));
  body.push(paragraph("b) Modalità di svolgimento del servizio in condizioni diverse e con modalità diverse da quelle previste nel presente contratto."));
  body.push(paragraph("In caso di risoluzione del presente contratto, la Sig.ra Giuseppa Surace si impegna alla restituzione degli importi percepiti."));
  body.push(heading("ART. 5 - FORO COMPETENTE"));
  body.push(paragraph("In caso di controversie in merito all'applicazione, interpretazione ed esecuzione del presente accordo, non componibili in via bonaria, le parti riconoscono la competenza a giudicare in via esclusiva del Foro di Reggio Calabria, salvo i casi di competenza inderogabile previsti dalla legge."));
  body.push(paragraph("Letto, approvato e sottoscritto in data "+data.contractDate+", a Villa San Giovanni (RC)."));
  body.push(table([["Il Fornitore","I Committenti"],["Giuseppa Surace",""+data.couple.first+" / "+data.couple.second],["Firma: __________________________","Firme: __________________________"]]));
  body.push(center("Emozioni Floreali di Giusy Surace · Viale Rocco Larussa n. 53/A – 89018 Villa San Giovanni (RC) · P. IVA 02200030803",false,16,"666666"));
  const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body.join("")+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="1000" w:bottom="850" w:left="1000"/></w:sectPr></w:body></w:document>';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo-emozioni-floreali.jpg"/></Relationships>';
  return zipStored([{name:"[Content_Types].xml",data:Buffer.from(types)},{name:"_rels/.rels",data:Buffer.from(rels)},{name:"word/document.xml",data:Buffer.from(doc)},{name:"word/_rels/document.xml.rels",data:Buffer.from(docRels)},{name:"word/media/logo-emozioni-floreali.jpg",data:Buffer.from(logoBase64,"base64")}]);
}
