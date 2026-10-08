export type PaymentReceiptData = {
  receiptNumber?: string | null;
  receiptDate?: string | null;
  paymentDate: string;
  amount: number;
  description?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  coupleName: string;
  weddingDate?: string | null;
  venue?: string | null;
  contractVersion?: number | null;
  contractTotal: number;
  paidBefore: number;
  paidAfter: number;
  balanceAfter: number;
};

function esc(s:string){
  const map:Record<string,string>={"€":"EUR","–":"-","—":"-","“":"\"","”":"\"","’":"'","…":"...","·":"-"};
  let out=""; for(const ch of s) out+=map[ch]??ch;
  return out.normalize("NFD").split("").filter(ch=>ch.charCodeAt(0)>=32&&ch.charCodeAt(0)<=126).join("").replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)");
}
function money(v:number){return new Intl.NumberFormat("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0))+" EUR"}
function dateIt(v?:string|null){if(!v)return "";const d=new Date(v.includes("T")?v:v+"T12:00:00");if(Number.isNaN(d.getTime()))return v;return new Intl.DateTimeFormat("it-IT",{dateStyle:"long",timeZone:"Europe/Rome"}).format(d)}
function wrap(s:string,max=82){const lines:string[]=[];let line="";for(const w of s.split(/\s+/).filter(Boolean)){const n=line?line+" "+w:w;if(n.length<=max)line=n;else{if(line)lines.push(line);line=w}}if(line)lines.push(line);return lines.length?lines:[""]}

export function buildPaymentReceiptPdf(data:PaymentReceiptData):Uint8Array{
  const lines:string[]=[];
  lines.push("EMOZIONI FLOREALI","di Giusy Surace","WEDDING & FLORAL DESIGN","");
  lines.push("QUIETANZA DI PAGAMENTO");
  if(data.receiptNumber)lines.push("Scontrino fiscale N.: "+data.receiptNumber);
  if(data.receiptDate)lines.push("Data scontrino fiscale: "+data.receiptDate);
  lines.push("Data pagamento: "+dateIt(data.paymentDate),"");
  lines.push("Committenti: "+data.coupleName);
  if(data.weddingDate)lines.push("Data matrimonio: "+dateIt(data.weddingDate));
  if(data.venue)lines.push("Location: "+data.venue);
  if(data.contractVersion)lines.push("Riferimento contratto: V"+data.contractVersion);
  lines.push("");
  lines.push("PAGAMENTO RICEVUTO");
  lines.push("Importo: "+money(data.amount));
  if(data.description)lines.push("Causale: "+data.description);
  if(data.paymentMethod)lines.push("Modalita di pagamento: "+data.paymentMethod);
  if(data.notes)for(const l of wrap("Note: "+data.notes))lines.push(l);
  lines.push("");
  lines.push("SITUAZIONE ECONOMICA");
  lines.push("Totale contratto: "+money(data.contractTotal));
  lines.push("Pagato prima della presente quietanza: "+money(data.paidBefore));
  lines.push("Totale pagato dopo la presente quietanza: "+money(data.paidAfter));
  lines.push("Saldo residuo: "+money(data.balanceAfter));
  lines.push("");
  lines.push("IVA inclusa nel corrispettivo contrattuale.","");
  lines.push("Emozioni Floreali di Giusy Surace");
  lines.push("Viale Rocco Larussa 53/A - Villa San Giovanni (RC)");
  lines.push("P. IVA 02200030803","");
  lines.push("Firma del titolare: ________________________________","");
  lines.push("La presente quietanza attesta l'avvenuta ricezione dell'importo sopra indicato.");

  const objects:string[]=[];const obj=(s:string)=>{objects.push(s);return objects.length};
  const font=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pages=obj("<< /Type /Pages /Kids [] /Count 0 >>");const pageIds:number[]=[];
  for(let start=0;start<lines.length;start+=34){
    const pg=lines.slice(start,start+34);let graphics="";
    graphics+="q 0.36 0.44 0.21 rg 48 806 499 4 re f Q\n";
    graphics+="BT\n/F2 12 Tf\n0.36 0.44 0.21 rg\n1 0 0 1 505 810 Tm (EF) Tj\nET\n";
    graphics+="q 0.82 0.05 0.28 rg 48 54 499 1 re f Q\n";
    let ts="";
    pg.forEach((line,i)=>{
      const y=780-i*20;
      const head=line==="EMOZIONI FLOREALI"||line==="WEDDING & FLORAL DESIGN";
      const section=/^(QUIETANZA DI PAGAMENTO|PAGAMENTO RICEVUTO|SITUAZIONE ECONOMICA|Emozioni Floreali di Giusy Surace)/.test(line);
      const total=/^(Importo:|Totale contratto:|Saldo residuo:)/.test(line);
      if(total){
        graphics+="q 0.95 0.96 0.92 rg 44 "+(y-9)+" 507 24 re f Q\n";
        ts+="0.36 0.44 0.21 rg\n/F2 13 Tf\n1 0 0 1 48 "+y+" Tm ("+esc(line)+") Tj\n";
      } else {
        ts+=(head?"0.36 0.44 0.21 rg\n/F2 11 Tf\n":section?"0.82 0.05 0.28 rg\n/F2 10 Tf\n":"0.13 0.13 0.13 rg\n/F1 9.2 Tf\n");
        ts+="1 0 0 1 48 "+y+" Tm ("+esc(line)+") Tj\n";
      }
    });
    const stream=graphics+"BT\n"+ts+"ET\n";
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
  return new Uint8Array(Buffer.from(chunks.join(""),"latin1"));
}
