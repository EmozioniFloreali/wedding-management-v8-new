
export type ContractData = {
  contractDate: string;
  versionNumber?: number | null;
  couple: { first: string; second: string; email?: string | null; phone?: string | null };
  wedding: { date?: string | null; time?: string | null; venue?: string | null; church?: string | null; reception?: string | null };
  project: { name: string; status?: string | null; notes?: string | null; total?: number | null };
  items: Array<{ name: string; category?: string | null; description?: string | null; quantity?: number | null; unit?: string | null; notes?: string | null; flowers?: string[]; structures?: string[] }>;
  quote?: { status?: string | null; vatRate?: number | null; total?: number | null; deposit?: number | null; balance?: number | null; discount?: number | null; notes?: string | null; items: Array<{ description: string; quantity: number; unit: string }> } | null;
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
  const words=text.split(" ").filter(Boolean);
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
    data.quote.items.forEach((it,i)=>lines.push(String(i+1)+". "+it.description+" – "+it.quantity+" "+it.unit));
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
    let stream="";
    stream+="q 0.36 0.44 0.21 rg 48 806 499 4 re f Q\n";
    stream+="q 0.82 0.05 0.28 rg 48 54 499 1 re f Q\n";
    pg.forEach((line,i)=>{
      const y=780-i*20;
      const main=i<3;
      const head=/^(CONTRATTO |SERVIZIO |ART\\. |DATI |SOTTOSCRIZIONE)/.test(line);
      if(line.startsWith("TOTALE CONTRATTO:")){
        stream+="q 0.95 0.96 0.92 rg 44 "+(y-9)+" 507 24 re f Q\n";
        stream+="0.36 0.44 0.21 rg\n/F2 13 Tf\n1 0 0 1 48 "+y+" Tm ("+pdfEscape(line)+") Tj\n";
      }else{
        stream+=(main?"0.36 0.44 0.21 rg\n/F2 11 Tf\n":head?"0.82 0.05 0.28 rg\n/F2 10 Tf\n":"0.13 0.13 0.13 rg\n/F1 9.2 Tf\n");
        stream+="1 0 0 1 48 "+y+" Tm ("+pdfEscape(line)+") Tj\n";
      }
    });
    const content="BT\n"+stream+"ET\n";
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
  return new Uint8Array(Buffer.from(chunks.join(""),"latin1"));
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
  body.push(p("EMOZIONI FLOREALI",true,32,"5D6F35"),p("di Giusy Surace · WEDDING & FLORAL DESIGN",false,19,"777777"));
  body.push(p("CONTRATTO DI SCRITTURA PRIVATA",true,28,"C41452"),p("SERVIZIO DI ADDOBBO FLOREALE E ALLESTIMENTO",true,22,"5D6F35"));
  body.push(table([["Data contratto",data.contractDate],["Versione",String(data.versionNumber||1)],["Committenti",data.couple.first+" e "+data.couple.second]]));
  body.push(p("DATI DEL MATRIMONIO",true,24,"C41452"));
  body.push(table([["Data",dateIt(data.wedding.date)||"da definire"],["Ora",data.wedding.time?.slice(0,5)||"—"],["Location",data.wedding.venue||"—"],["Cerimonia",data.wedding.church||"—"],["Ricevimento",data.wedding.reception||"—"]]));
  body.push(p("ART. 1 – OGGETTO DEL CONTRATTO",true,23,"C41452"),p("Il presente contratto disciplina il servizio professionale di progettazione, fornitura, trasporto, allestimento e disallestimento delle decorazioni floreali relative al matrimonio indicato nel presente documento, secondo quanto definito nel Progetto Floreale e nel Preventivo collegati."));
  body.push(p("ART. 2 – SERVIZI E LAVORI DA ESEGUIRE",true,23,"C41452"),p("Progetto Floreale: "+data.project.name,true,20,"5D6F35"));
  if(data.items.length)body.push(table(data.items.map((it,i)=>[String(i+1)+". "+it.name,(it.quantity!=null?String(it.quantity)+" "+(it.unit||"pz"):"")+(it.category?" · "+it.category:"")])));
  else body.push(p("Nessuna lavorazione associata."));
  body.push(p("ART. 3 – CORRISPETTIVO, IVA, ACCONTO E SALDO",true,23,"C41452"));
  body.push(table([[data.quote?"Corrispettivo complessivo":"Valore progetto",money(data.quote?.total??data.project.total)],["Acconto",money(data.quote?.deposit)],["Saldo",money(data.quote?.balance)],["IVA",data.quote?(Number(data.quote.vatRate??10)+"% inclusa"):"da definire"]]));
  if(data.quote?.items?.length)body.push(p("Riepilogo delle voci del preventivo",true,20,"5D6F35"),table(data.quote.items.map((it,i)=>[String(i+1)+". "+it.description,String(it.quantity)+" "+it.unit])));
  const clauses=[["ART. 4 – VARIAZIONI DEL PROGETTO","Eventuali richieste aggiuntive o modifiche successive alla generazione del presente contratto dovranno essere concordate tra le parti e potranno comportare l’emissione di una nuova versione del Preventivo e del Contratto."],["ART. 5 – DISPONIBILITÀ STAGIONALE E SOSTITUZIONI","Le varietà floreali possono essere sostituite con fiori equivalenti per qualità, valore estetico e tonalità quando la disponibilità stagionale o del mercato lo renda necessario. Le variazioni sostanziali saranno preventivamente comunicate e concordate."],["ART. 6 – RECESSO, RISOLUZIONE E FORZA MAGGIORE","Per recesso, risoluzione e forza maggiore si applicano le disposizioni del presente contratto e della normativa civile vigente."],["ART. 7 – VERIFICA FINALE E LOGISTICA","L’ultimo controllo operativo del progetto dovrà essere effettuato indicativamente un mese prima della cerimonia, verificando quantità, orari, accessi, allestimenti e necessità logistiche."],["ART. 8 – FORO COMPETENTE","Per quanto non espressamente previsto si applicano le disposizioni del Codice Civile. Per eventuali controversie è competente il Foro di Reggio Calabria, salvo diversa competenza inderogabile prevista dalla legge."]];
  for(const clause of clauses)body.push(p(clause[0],true,23,"C41452"),p(clause[1]));
  body.push(p("DATI DEL FORNITORE",true,23,"C41452"),p("Emozioni Floreali di Giusy Surace · Viale Rocco Larussa 53/A – Villa San Giovanni (RC) · P. IVA 02200030803"));
  body.push(p("SOTTOSCRIZIONE",true,23,"C41452"),table([["Il Fornitore","____________________________"],[data.couple.first,"____________________________"],[data.couple.second,"____________________________"]]));
  body.push(p("Il presente documento è generato dal Progetto Floreale e dal Preventivo collegati alla coppia. Le parti sono invitate a verificarne il contenuto prima della sottoscrizione.",false,18,"666666"));
  const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body.join("")+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  return zipStored([{name:"[Content_Types].xml",data:Buffer.from(types)},{name:"_rels/.rels",data:Buffer.from(rels)},{name:"word/document.xml",data:Buffer.from(doc)}]);
}
