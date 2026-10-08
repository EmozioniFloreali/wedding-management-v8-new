import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildPaymentReceiptPdf } from "@/lib/payment-receipt-pdf";

function euro(value:number){return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(Number(value||0))}
function dateIt(value?:string|null){if(!value)return "—";const d=new Date(value.includes("T")?value:value+"T12:00:00");return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("it-IT",{dateStyle:"medium",timeZone:"Europe/Rome"}).format(d)}
function safeFilePart(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||"coppia"}

async function adminClient(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/login");
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="admin")redirect("/protected");
  return {supabase,user};
}

async function addPayment(formData:FormData){
  "use server";
  const {supabase,user}=await adminClient();
  const coupleId=String(formData.get("couple_id")||"");
  const contractId=String(formData.get("contract_id")||"");
  const paymentDate=String(formData.get("payment_date")||"");
  const amount=Number(String(formData.get("amount")||"0").replace(",","."));
  const description=String(formData.get("description")||"").trim()||null;
  const paymentMethod=String(formData.get("payment_method")||"").trim()||null;
  const notes=String(formData.get("notes")||"").trim()||null;
  const receiptNumber=String(formData.get("receipt_number")||"").trim()||null;
  const receiptDate=String(formData.get("receipt_date")||"").trim()||null;

  if(!coupleId||!contractId||!paymentDate)throw new Error("Dati pagamento incompleti.");
  if(!Number.isFinite(amount)||amount<=0)throw new Error("L'importo deve essere maggiore di zero.");

  const {data:contract,error:contractError}=await supabase
    .from("contracts")
    .select("id,version_number,total_amount,contract_date")
    .eq("id",contractId).eq("couple_id",coupleId).maybeSingle();
  if(contractError||!contract)throw new Error(contractError?.message||"Contratto non trovato.");

  const {data:existing}=await supabase
    .from("contract_payments")
    .select("amount")
    .eq("contract_id",contractId);
  const paidBefore=(existing||[]).reduce((s,p)=>s+Number(p.amount||0),0);
  const contractTotal=Number(contract.total_amount||0);
  if(paidBefore+amount>contractTotal+0.01)throw new Error("Il pagamento supera il saldo del contratto.");

  const {data:payment,error:paymentError}=await supabase
    .from("contract_payments")
    .insert({
      contract_id:contractId,
      payment_date:paymentDate,
      description,
      amount,
      payment_method:paymentMethod,
      notes,
      receipt_number:receiptNumber,
      receipt_date:receiptDate,
    })
    .select("id")
    .single();
  if(paymentError||!payment)throw new Error(paymentError?.message||"Pagamento non registrato.");

  const {data:couple}=await supabase
    .from("couples")
    .select("partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name")
    .eq("id",coupleId).maybeSingle();

  const {data:wedding}=await supabase
    .from("weddings")
    .select("wedding_date,venue")
    .eq("couple_id",coupleId)
    .order("wedding_date",{ascending:true}).limit(1).maybeSingle();

  const paidAfter=paidBefore+amount;
  const balanceAfter=Math.max(0,contractTotal-paidAfter);
  const coupleName=couple?couple.partner1_first_name+" "+couple.partner1_last_name+" & "+couple.partner2_first_name+" "+couple.partner2_last_name:"Coppia";
  const pdf=buildPaymentReceiptPdf({
    receiptNumber,receiptDate,paymentDate,amount,description,paymentMethod,notes,
    coupleName,weddingDate:wedding?.wedding_date||null,venue:wedding?.venue||null,
    contractVersion:contract.version_number,contractTotal,paidBefore,paidAfter,balanceAfter
  });

  const storagePath=coupleId+"/pagamenti/quietanza_"+payment.id+".pdf";
  const {error:uploadError}=await supabase.storage.from("client-documents").upload(
    storagePath,pdf,{contentType:"application/pdf",upsert:false}
  );
  if(uploadError){
    await supabase.from("contract_payments").delete().eq("id",payment.id);
    throw new Error("Errore caricamento quietanza: "+uploadError.message);
  }

  const filename="Quietanza_"+safeFilePart(coupleName)+"_"+payment.id.slice(0,8)+".pdf";
  const {data:document,error:documentError}=await supabase
    .from("client_documents")
    .insert({
      couple_id:coupleId,
      wedding_id:null,
      quote_id:null,
      floral_project_id:null,
      name:filename,
      category:"pagamento",
      storage_path:storagePath,
      mime_type:"application/pdf",
      file_size:pdf.byteLength,
      visible_to_couple:true,
      notes:"Quietanza di pagamento generata automaticamente.",
      uploaded_by:user.id,
    })
    .select("id").single();

  if(documentError||!document){
    await supabase.storage.from("client-documents").remove([storagePath]);
    await supabase.from("contract_payments").delete().eq("id",payment.id);
    throw new Error("Errore registrazione documento quietanza: "+(documentError?.message||"documento non creato"));
  }

  revalidatePath("/protected/coppie/"+coupleId+"/pagamenti");
  revalidatePath("/protected/coppie/"+coupleId+"/documenti");
  revalidatePath("/protected/coppie/"+coupleId);
  revalidatePath("/protected/area-sposi/"+coupleId);
  redirect("/protected/coppie/"+coupleId+"/pagamenti?saved=1");
}

async function deletePayment(formData:FormData){
  "use server";
  const {supabase}=await adminClient();
  const coupleId=String(formData.get("couple_id")||"");
  const paymentId=String(formData.get("payment_id")||"");
  if(!coupleId||!paymentId)return;
  const {data:payment}=await supabase.from("contract_payments").select("id").eq("id",paymentId).maybeSingle();
  if(!payment)return;
  const {data:docs}=await supabase.from("client_documents").select("id,storage_path").eq("category","pagamento").ilike("storage_path","%"+paymentId+".pdf");
  if(docs?.length){
    for(const d of docs){
      if(d.storage_path)await supabase.storage.from("client-documents").remove([d.storage_path]);
      await supabase.from("client_documents").delete().eq("id",d.id);
    }
  }
  const {error}=await supabase.from("contract_payments").delete().eq("id",paymentId);
  if(error)throw new Error(error.message);
  revalidatePath("/protected/coppie/"+coupleId+"/pagamenti");
  redirect("/protected/coppie/"+coupleId+"/pagamenti?saved=1");
}

export default async function PagamentiPage({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{saved?:string}>}){
  const {id:coupleId}=await params;
  const query=searchParams?await searchParams:{};
  const {supabase}=await adminClient();

  const {data:couple}=await supabase.from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name")
    .eq("id",coupleId).maybeSingle();
  if(!couple)redirect("/protected/coppie");

  const {data:contracts}=await supabase.from("contracts")
    .select("id,version_number,total_amount,contract_date,document_id")
    .eq("couple_id",coupleId).order("version_number",{ascending:false});
  const contract=contracts?.[0];
  if(!contract)redirect("/protected/coppie/"+coupleId+"/preventivo");
  const contractIds=(contracts||[]).map(c=>c.id);
  const {data:payments}=await supabase.from("contract_payments")
    .select("id,contract_id,payment_date,description,amount,payment_method,notes,receipt_number,receipt_date,created_at")
    .in("contract_id",contractIds).order("payment_date",{ascending:true}).order("created_at",{ascending:true});
  const rows=payments||[];
  const total=Number(contract.total_amount||0);
  const paidBeforeForLatest=(payments||[]).filter(p=>p.contract_id===contract.id).reduce((s,p)=>s+Number(p.amount||0),0);
  let running=0;
  const computed=rows.map(p=>{running+=Number(p.amount||0);return {...p,after:running,balance:Math.max(0,total-running)}});

  return <main className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link href={"/protected/coppie/"+coupleId} className="text-sm underline">← Torna alla scheda coppia</Link>
      <div className="mb-4"><img src="/logo-emozioni-floreali.svg" alt="Emozioni Floreali di Giusy Surace" className="h-auto w-full max-w-[380px]" /></div><div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Area professionale riservata</p>
          <h1 className="text-3xl font-bold">Pagamenti e quietanze</h1>
          <p className="mt-1 text-slate-600">{couple.partner1_first_name} {couple.partner1_last_name} & {couple.partner2_first_name} {couple.partner2_last_name}</p>
        </div>
        <div className="flex gap-2">
          <Link href={"/protected/coppie/"+coupleId+"/contratti"} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Contratti</Link>
          <Link href={"/protected/coppie/"+coupleId+"/documenti"} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Documenti</Link>
        </div>
      </div>

      {query.saved&&<div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">✓ Operazione completata.</div>}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Contratto V{contract.version_number}</p><p className="mt-2 text-2xl font-bold">{euro(total)}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Totale pagato</p><p className="mt-2 text-2xl font-bold">{euro(running)}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Saldo residuo</p><p className="mt-2 text-2xl font-bold">{euro(Math.max(0,total-running))}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Quietanze</p><p className="mt-2 text-2xl font-bold">{rows.length}</p></div>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Registra un pagamento</h2>
        <p className="mt-1 text-sm text-slate-500">Il sistema genera automaticamente la quietanza PDF e la archivia nei Documenti della coppia.</p>
        <form action={addPayment} className="mt-5 grid gap-4 md:grid-cols-6">
          <input type="hidden" name="couple_id" value={coupleId}/>
          <input type="hidden" name="contract_id" value={contract.id}/>
          <label className="text-sm font-semibold">Data pagamento<input required name="payment_date" type="date" className="mt-1 w-full rounded-xl border px-4 py-3"/></label>
          <label className="text-sm font-semibold">Importo €<input required name="amount" type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-xl border px-4 py-3"/></label>
          <label className="text-sm font-semibold">Scontrino fiscale N.<input name="receipt_number" placeholder="Inserimento libero" className="mt-1 w-full rounded-xl border px-4 py-3"/></label>
          <label className="text-sm font-semibold">Data scontrino fiscale<input name="receipt_date" placeholder="Inserimento libero (es. 08/10/2026)" className="mt-1 w-full rounded-xl border px-4 py-3"/></label>
          <label className="text-sm font-semibold">Modalità<select name="payment_method" className="mt-1 w-full rounded-xl border bg-white px-4 py-3"><option value="">Seleziona</option><option>Contanti</option><option>Bonifico</option><option>POS</option><option>Assegno</option><option>Altro</option></select></label>
          <label className="text-sm font-semibold md:col-span-2">Causale<input name="description" placeholder="Acconto, secondo acconto, saldo..." className="mt-1 w-full rounded-xl border px-4 py-3"/></label>
          <label className="text-sm font-semibold md:col-span-2">Note<input name="notes" className="mt-1 w-full rounded-xl border px-4 py-3"/></label>
          <button className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white md:col-span-2">+ Registra pagamento e genera quietanza</button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Storico pagamenti</h2>
        <div className="mt-5 space-y-3">
          {!computed.length?<div className="rounded-xl border border-dashed p-8 text-center text-slate-500">Nessun pagamento registrato.</div>:
          computed.map(p=><div key={p.id} className="rounded-2xl border bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold">{euro(Number(p.amount))} · {dateIt(p.payment_date)}</p>
                <p className="text-sm text-slate-600">{p.description||"Pagamento"}{p.payment_method?" · "+p.payment_method:""}</p>
                {(p.receipt_number||p.receipt_date)&&<p className="text-xs text-slate-500">Scontrino fiscale: {p.receipt_number||"—"}{p.receipt_date?" · "+p.receipt_date:""}</p>}
              </div>
              <div className="text-right text-sm"><div>Pagato cumulativo: <strong>{euro(p.after)}</strong></div><div>Saldo rispetto al contratto V{contract.version_number}: <strong>{euro(p.balance)}</strong></div></div>
            </div>
            <div className="mt-3 flex justify-end">
              <form action={deletePayment}><input type="hidden" name="couple_id" value={coupleId}/><input type="hidden" name="payment_id" value={p.id}/><button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700">Elimina</button></form>
            </div>
          </div>)}
        </div>
      </section>
    </div>
  </main>
}
