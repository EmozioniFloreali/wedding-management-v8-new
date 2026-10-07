export type QuoteDocumentData = {
  quote: { id: string; version_number: number; status: string; title?: string|null; validity_days?: number|null; total_amount?: number|null; deposit_amount?: number|null; vat_included?: boolean|null; notes?: string|null; created_at?: string|null };
  couple: { first:string; second:string; email?:string|null; phone?:string|null };
  wedding: { date?:string|null; time?:string|null; venue?:string|null; church?:string|null; reception?:string|null };
  project: { name:string };
  items: Array<{description:string; quantity:number; unit:string; area?:string|null; notes?:string|null}>;
};

function money(v:number|null|undefined){return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",minimumFractionDigits:2}).format(Number(v||0))}
function dateIt(v?:string|null){if(!v)return "";const d=new Date(v.includes("T")?v:v+"T12:00:00");if(Number.isNaN(d.getTime()))return v;return new Intl.DateTimeFormat("it-IT",{dateStyle:"long",timeZone:"Europe/Rome"}).format(d)}
function wrap(t:string,max:number){const out:string[]=[];let line="";for(const w of t.split(/\s+/).filter(Boolean)){const n=line?line+" "+w:w;if(n.length<=max)line=n;else{if(line)out.push(line);line=w}}if(line)out.push(line);return out.length?out:[""]}
function pdfEscape(s:string){const m:Record<string,string>={"€":"\\x80","–":"\\x96","—":"\\x97","“":"\\x93","”":"\\x94","’":"\\x92","…":"\\x85"};let o="";for(const ch of s)o+=m[ch]??ch;return o.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}

function buildPdf(data:QuoteDocumentData){
  const lines:string[]=[];
  const add=(s:string)=>wrap(s,88).forEach(x=>lines.push(x));
  lines.push("EMOZIONI FLOREALI","di Giusy Surace","WEDDING & FLORAL DESIGN","");
  add("PREVENTIVO PROFESSIONALE");
  add((data.quote.title||"Preventivo Progetto Floreale")+" · Versione "+data.quote.version_number);
  add("Stato: "+data.quote.status);
  lines.push("","DATI DEGLI SPOSI"); add(data.couple.first+" & "+data.couple.second);
  if(data.couple.email)add("Email: "+data.couple.email); if(data.couple.phone)add("Telefono: "+data.couple.phone);
  lines.push("","DATI DEL MATRIMONIO");
  if(data.wedding.date)add("Data: "+dateIt(data.wedding.date)); if(data.wedding.time)add("Ora: "+data.wedding.time.slice(0,5));
  if(data.wedding.venue)add("Location: "+data.wedding.venue); if(data.wedding.church)add("Cerimonia: "+data.wedding.church); if(data.wedding.reception)add("Ricevimento: "+data.wedding.reception);
  lines.push("","PROGETTO FLOREALE"); add(data.project.name);
  add("Le singole composizioni non hanno un prezzo autonomo: il preventivo esprime un unico corrispettivo complessivo.");
  lines.push("","VOCI COMPRESE");
  if(!data.items.length)add("Nessuna voce inserita.");
  data.items.forEach((it,i)=>{add((i+1)+". "+it.description+" · "+it.quantity+" "+it.unit+(it.area?" · "+it.area:""));if(it.notes)add("Note: "+it.notes)});
  lines.push("","RIEPILOGO ECONOMICO");
  add("TOTALE COMPLESSIVO: "+money(data.quote.total_amount));
  add("Acconto: "+money(data.quote.deposit_amount));
  add("Saldo: "+money(Math.max(0,Number(data.quote.total_amount||0)-Number(data.quote.deposit_amount||0))));
  add(data.quote.vat_included?"IVA inclusa":"IVA esclusa");
  lines.push("","VALIDITÀ E NOTE"); add("Validità del preventivo: "+(data.quote.validity_days??30)+" giorni."); if(data.quote.notes)add(data.quote.notes);
  lines.push("","Emozioni Floreali di Giusy Surace · Wedding & Floral Design");

  const objects:string[]=[]; const obj=(s:string)=>{objects.push(s);return objects.length};
  const font=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pages=obj("<< /Type /Pages /Kids [] /Count 0 >>"); const pageIds:number[]=[];
  for(let start=0;start<lines.length;start+=36){
    const pg=lines.slice(start,start+36); let stream="";
    stream+="q 0.36 0.44 0.21 rg 48 806 499 4 re f Q\n";
    stream+="q 0.82 0.05 0.28 rg 48 54 499 1 re f Q\n";
    stream+="BT\n";
    pg.forEach((l,i)=>{
      const y=780-i*20;
      const isMain=l==="EMOZIONI FLOREALI"||l==="WEDDING & FLORAL DESIGN";
      const isHead=/^(PREVENTIVO PROFESSIONALE|DATI |PROGETTO |VOCI |RIEPILOGO |VALIDITÀ )/.test(l);
      if(l.startsWith("TOTALE COMPLESSIVO:")){
        stream+="q 0.95 0.96 0.92 rg 44 "+(y-9)+" 507 24 re f Q\n";
        stream+="0.36 0.44 0.21 rg\n/F2 13 Tf\n48 "+y+" Td ("+pdfEscape(l)+") Tj -48 -"+y+" Td\n";
      } else {
        if(isMain)stream+="0.36 0.44 0.21 rg\n"; else if(isHead)stream+="0.82 0.05 0.28 rg\n"; else stream+="0.13 0.13 0.13 rg\n";
        stream+=(isMain||isHead?"/F2 11 Tf\n":"/F1 9.5 Tf\n")+"48 "+y+" Td ("+pdfEscape(l)+") Tj -48 -"+y+" Td\n";
      }
    });
    stream+="ET\n";
    const sid=obj("<< /Length "+Buffer.byteLength(stream,"latin1")+" >>\nstream\n"+stream+"endstream");
    pageIds.push(obj("<< /Type /Page /Parent "+pages+" 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+font+" 0 R /F2 "+bold+" 0 R >> >> /Contents "+sid+" 0 R >>"));
  }
  objects[pages-1]="<< /Type /Pages /Kids ["+pageIds.map(x=>x+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
  const catalog=obj("<< /Type /Catalog /Pages "+pages+" 0 R >>");
  const chunks=["%PDF-1.4\n"];const offsets=[0];let offset=Buffer.byteLength(chunks[0],"latin1");
  for(let i=0;i<objects.length;i++){const o=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n";offsets.push(offset);chunks.push(o);offset+=Buffer.byteLength(o,"latin1")}
  const xref=offset;chunks.push("xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n");
  for(let i=1;i<=objects.length;i++)chunks.push(String(offsets[i]).padStart(10,"0")+" 00000 n \n");
  chunks.push("trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+xref+"\n%%EOF");
  return Buffer.from(chunks.join(""),"latin1")
}

function escXml(s:string){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function crc32(buf:Buffer){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16(n:number){const b=Buffer.alloc(2);b.writeUInt16LE(n,0);return b}
function u32(n:number){const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0,0);return b}
function zipStored(files:{name:string;data:Buffer}[]){const local:Buffer[]=[];const central:Buffer[]=[];let offset=0;for(const f of files){const n=Buffer.from(f.name);const h=Buffer.concat([Buffer.from([80,75,3,4]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc32(f.data)),u32(f.data.length),u32(f.data.length),u16(n.length),u16(0),n,f.data]);local.push(h);central.push(Buffer.concat([Buffer.from([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc32(f.data)),u32(f.data.length),u32(f.data.length),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),n]));offset+=h.length}const cd=Buffer.concat(central);const end=Buffer.concat([Buffer.from([80,75,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(offset),u16(0)]);return Buffer.concat(local.concat([cd,end]))}
function xmlParagraph(text:string,bold=false,size=22,color=bold?"5D6F35":"222222"){
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr>${bold?"<w:b/>":""}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}
function xmlCell(text:string,bold=false){
  return `<w:tc><w:tcPr><w:shd w:fill="F5F6F1"/><w:tcMar w:top="100" w:start="120" w:bottom="100" w:end="120"/></w:tcPr>${xmlParagraph(text,bold,20,bold?"5D6F35":"333333")}</w:tc>`;
}
function xmlTable(rows:string[][]){
  return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9DED0"/><w:left w:val="single" w:sz="4" w:color="D9DED0"/><w:bottom w:val="single" w:sz="4" w:color="D9DED0"/><w:right w:val="single" w:sz="4" w:color="D9DED0"/><w:insideH w:val="single" w:sz="4" w:color="D9DED0"/><w:insideV w:val="single" w:sz="4" w:color="D9DED0"/></w:tblBorders></w:tblPr>${rows.map(r=>"<w:tr>"+r.map((c,i)=>xmlCell(c,i===0)).join("")+"</w:tr>").join("")}</w:tbl>`;
}

export function buildQuoteDocx(data:QuoteDocumentData){
  const body:string[]=[];
  body.push(xmlParagraph("EMOZIONI FLOREALI",true,32,"5D6F35"));
  body.push(xmlParagraph("di Giusy Surace · WEDDING & FLORAL DESIGN",false,20,"7A7A7A"));
  body.push(xmlParagraph("PREVENTIVO PROFESSIONALE",true,28,"C41452"));
  body.push(xmlParagraph((data.quote.title||"Preventivo Progetto Floreale")+" · Versione "+data.quote.version_number,true,22));
  body.push(xmlParagraph("Stato: "+data.quote.status,false,20));
  body.push(xmlParagraph("DATI DEGLI SPOSI",true,24,"C41452"));
  body.push(xmlTable([[data.couple.first+" & "+data.couple.second]]));
  if(data.couple.email||data.couple.phone)body.push(xmlParagraph([data.couple.email?("Email: "+data.couple.email):"",data.couple.phone?("Telefono: "+data.couple.phone):""].filter(Boolean).join(" · ")));
  body.push(xmlParagraph("DATI DEL MATRIMONIO",true,24,"C41452"));
  body.push(xmlTable([["Data",dateIt(data.wedding.date)||"—"],["Ora",data.wedding.time?.slice(0,5)||"—"],["Location",data.wedding.venue||"—"],["Cerimonia",data.wedding.church||"—"],["Ricevimento",data.wedding.reception||"—"]]));
  body.push(xmlParagraph("PROGETTO FLOREALE",true,24,"C41452"));
  body.push(xmlParagraph(data.project.name,true));
  body.push(xmlParagraph("Le singole composizioni non hanno un prezzo autonomo: il preventivo esprime un unico corrispettivo complessivo.",false,19,"555555"));
  body.push(xmlParagraph("VOCI COMPRESE",true,24,"C41452"));
  body.push(xmlTable((data.items.length?data.items:[{description:"Nessuna voce inserita.",quantity:0,unit:""}]).map((it,i)=>[(i+1)+". "+it.description,String(it.quantity)+" "+it.unit+(it.area?" · "+it.area:"")])));
  body.push(xmlParagraph("RIEPILOGO ECONOMICO",true,24,"C41452"));
  body.push(xmlTable([["TOTALE COMPLESSIVO",money(data.quote.total_amount)],["Acconto",money(data.quote.deposit_amount)],["Saldo",money(Math.max(0,Number(data.quote.total_amount||0)-Number(data.quote.deposit_amount||0)))],["IVA",data.quote.vat_included?"Inclusa":"Esclusa"]]));
  body.push(xmlParagraph("VALIDITÀ E NOTE",true,24,"C41452"));
  body.push(xmlParagraph("Validità del preventivo: "+(data.quote.validity_days??30)+" giorni."));
  if(data.quote.notes)body.push(xmlParagraph(data.quote.notes));
  body.push(xmlParagraph("Emozioni Floreali di Giusy Surace · Wedding & Floral Design",true,18,"5D6F35"));
  const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body.join("")+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  return zipStored([{name:"[Content_Types].xml",data:Buffer.from(types)},{name:"_rels/.rels",data:Buffer.from(rels)},{name:"word/document.xml",data:Buffer.from(documentXml)}]);
}

export async function buildQuotePdfAsync(data:QuoteDocumentData){return new Uint8Array(buildPdf(data))}
