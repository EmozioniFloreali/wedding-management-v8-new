
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
