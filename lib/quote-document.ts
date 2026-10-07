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

function pdfEscape(s:string){return s.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
function buildPdf(data:QuoteDocumentData){
  const lines:string[]=[];
  const add=(s:string)=>wrap(s,88).forEach(x=>lines.push(x));
  lines.push("EMOZIONI FLOREALI","di Giusy Surace","WEDDING & FLORAL DESIGN","");
  add("PREVENTIVO PROFESSIONALE");
  add((data.quote.title||"Preventivo Progetto Floreale")+" - Versione "+data.quote.version_number);
  add("Stato: "+data.quote.status);
  lines.push("","DATI DEGLI SPOSI"); add(data.couple.first+" & "+data.couple.second);
  if(data.couple.email)add("Email: "+data.couple.email); if(data.couple.phone)add("Telefono: "+data.couple.phone);
  lines.push("","DATI DEL MATRIMONIO");
  if(data.wedding.date)add("Data: "+dateIt(data.wedding.date)); if(data.wedding.time)add("Ora: "+data.wedding.time.slice(0,5));
  if(data.wedding.venue)add("Location: "+data.wedding.venue); if(data.wedding.church)add("Cerimonia: "+data.wedding.church); if(data.wedding.reception)add("Ricevimento: "+data.wedding.reception);
  lines.push("","PROGETTO FLOREALE"); add(data.project.name);
  add("Le singole composizioni non hanno un prezzo autonomo: il preventivo esprime un unico corrispettivo complessivo.");
  lines.push("","VOCI COMPRESE");
  data.items.forEach((it,i)=>{add((i+1)+". "+it.description+" - "+it.quantity+" "+it.unit+(it.area?" - "+it.area:"")); if(it.notes)add("Note: "+it.notes)});
  lines.push("","RIEPILOGO ECONOMICO"); add("TOTALE COMPLESSIVO: EUR "+Number(data.quote.total_amount||0).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}));
  add("Acconto: EUR "+Number(data.quote.deposit_amount||0).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}));
  add("Saldo: EUR "+Math.max(0,Number(data.quote.total_amount||0)-Number(data.quote.deposit_amount||0)).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}));
  add(data.quote.vat_included?"IVA inclusa":"IVA esclusa");
  lines.push("","VALIDITA E NOTE"); add("Validita del preventivo: "+(data.quote.validity_days??30)+" giorni."); if(data.quote.notes)add(data.quote.notes);
  lines.push("","Emozioni Floreali di Giusy Surace - Wedding & Floral Design");

  const objects:string[]=[];
  function obj(s:string){objects.push(s);return objects.length}
  const font=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pages=obj("<< /Type /Pages /Kids [] /Count 0 >>");
  const pageIds:number[]=[];
  for(let start=0;start<lines.length;start+=42){
    const pg=lines.slice(start,start+42); let stream="BT\n";
    pg.forEach((l,i)=>{const isHead=/^(EMOZIONI FLOREALI|WEDDING|PREVENTIVO|DATI |PROGETTO |VOCI |RIEPILOGO |VALIDITA )/.test(l); stream+=(isHead?"/F2 11 Tf\n":"/F1 9 Tf\n")+"50 "+(790-i*17)+" Td\n("+pdfEscape(l)+") Tj\n";});
    stream+="ET\n";
    const sid=obj("<< /Length "+Buffer.byteLength(stream,"latin1")+" >>\nstream\n"+stream+"endstream");
    pageIds.push(obj("<< /Type /Page /Parent "+pages+" 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+font+" 0 R /F2 "+bold+" 0 R >> >> /Contents "+sid+" 0 R >>"));
  }
  objects[pages-1]="<< /Type /Pages /Kids ["+pageIds.map(x=>x+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
  const catalog=obj("<< /Type /Catalog /Pages "+pages+" 0 R >>");
  const chunks=["%PDF-1.4\n"]; const offsets=[0]; let offset=Buffer.byteLength(chunks[0],"latin1");
  for(let i=0;i<objects.length;i++){const o=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n"; offsets.push(offset); chunks.push(o); offset+=Buffer.byteLength(o,"latin1")}
  const xref=offset; chunks.push("xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n");
  for(let i=1;i<=objects.length;i++)chunks.push(String(offsets[i]).padStart(10,"0")+" 00000 n \n");
  chunks.push("trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+xref+"\n%%EOF");
  return Buffer.from(chunks.join(""),"latin1")
}

function escXml(s:string){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function crc32(buf:Buffer){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function u16(n:number){const b=Buffer.alloc(2);b.writeUInt16LE(n,0);return b}
function u32(n:number){const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0,0);return b}
function zipStored(files:{name:string;data:Buffer}[]){const local:Buffer[]=[];const central:Buffer[]=[];let offset=0;for(const f of files){const n=Buffer.from(f.name);const h=Buffer.concat([Buffer.from([80,75,3,4]),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc32(f.data)),u32(f.data.length),u32(f.data.length),u16(n.length),u16(0),n,f.data]);local.push(h);central.push(Buffer.concat([Buffer.from([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc32(f.data)),u32(f.data.length),u32(f.data.length),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),n]));offset+=h.length}const cd=Buffer.concat(central);const end=Buffer.concat([Buffer.from([80,75,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(offset),u16(0)]);return Buffer.concat(local.concat([cd,end]))}
function paragraph(s:string,bold=false){return "<w:p><w:r><w:rPr>"+(bold?"<w:b/>":"")+"<w:color w:val=\""+(bold?"5D6F35":"222222")+"\"/></w:rPr><w:t xml:space=\"preserve\">"+escXml(s)+"</w:t></w:r></w:p>"}
export function buildQuoteDocx(data:QuoteDocumentData){const body:string[]=[];const add=(s:string,b=false)=>body.push(paragraph(s,b));add("EMOZIONI FLOREALI",true);add("di Giusy Surace");add("PREVENTIVO PROFESSIONALE",true);add("Versione "+data.quote.version_number+" - "+data.quote.status);add(data.quote.title||"Preventivo Progetto Floreale",true);add("DATI DEGLI SPOSI",true);add(data.couple.first+" & "+data.couple.second,true);if(data.couple.email)add("Email: "+data.couple.email);if(data.couple.phone)add("Telefono: "+data.couple.phone);add("DATI DEL MATRIMONIO",true);if(data.wedding.date)add("Data: "+dateIt(data.wedding.date));if(data.wedding.time)add("Ora: "+data.wedding.time.slice(0,5));if(data.wedding.venue)add("Location: "+data.wedding.venue);if(data.wedding.church)add("Cerimonia: "+data.wedding.church);if(data.wedding.reception)add("Ricevimento: "+data.wedding.reception);add("PROGETTO FLOREALE",true);add(data.project.name);add("Le singole composizioni non hanno un prezzo autonomo: il preventivo esprime un unico corrispettivo complessivo.");add("VOCI COMPRESE",true);data.items.forEach((it,i)=>add((i+1)+". "+it.description+" - "+it.quantity+" "+it.unit+(it.area?" - "+it.area:"")));add("RIEPILOGO ECONOMICO",true);add("TOTALE COMPLESSIVO: "+money(data.quote.total_amount),true);add("Acconto: "+money(data.quote.deposit_amount));add("Saldo: "+money(Math.max(0,Number(data.quote.total_amount||0)-Number(data.quote.deposit_amount||0))));add(data.quote.vat_included?"IVA inclusa":"IVA esclusa");add("VALIDITA E NOTE",true);add("Validita del preventivo: "+(data.quote.validity_days??30)+" giorni.");if(data.quote.notes)add(data.quote.notes);add("Emozioni Floreali di Giusy Surace - Wedding & Floral Design",true);const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body.join("")+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>';return zipStored([{name:"[Content_Types].xml",data:Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')},{name:"_rels/.rels",data:Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')},{name:"word/document.xml",data:Buffer.from(xml)}])}
export async function buildQuotePdfAsync(data:QuoteDocumentData){return new Uint8Array(buildPdf(data))}
