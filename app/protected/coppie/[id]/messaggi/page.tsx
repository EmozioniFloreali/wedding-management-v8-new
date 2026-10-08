import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
function s(v:FormDataEntryValue|null){return v==null?"":String(v).trim();}

async function getOrCreateConversation(supabase:any,coupleId:string){
  const {data:existing}=await supabase.from("conversations").select("id").eq("couple_id",coupleId).order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(existing)return existing.id;
  const {data:created,error}=await supabase.from("conversations").insert({couple_id:coupleId,title:"Comunicazioni Emozioni Floreali"}).select("id").single();
  if(error)throw new Error(error.message);
  return created.id;
}

async function sendMessage(fd:FormData){
  "use server";
  const {supabase,user}=await requireAdmin();
  const coupleId=s(fd.get("couple_id")); const body=s(fd.get("body"));
  if(!coupleId||!body)return;
  const conversationId=await getOrCreateConversation(supabase,coupleId);
  const {error}=await supabase.from("messages").insert({conversation_id:conversationId,sender_id:user.id,body,status:"inviato"});
  if(error)throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/messaggi`);
  revalidatePath(`/protected/area-sposi/${coupleId}`);
}

async function markRead(fd:FormData){
  "use server";
  const {supabase}=await requireAdmin();
  const id=s(fd.get("id")); const coupleId=s(fd.get("couple_id"));
  if(!id||!coupleId)return;
  const {error}=await supabase.from("messages").update({read_at:new Date().toISOString(),status:"letto"}).eq("id",id);
  if(error)throw new Error(error.message);
  revalidatePath(`/protected/coppie/${coupleId}/messaggi`);
}

export default async function MessagesPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase,user}=await requireAdmin();
  const {data:couple}=await supabase.from("couples").select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name").eq("id",id).maybeSingle();
  if(!couple)redirect("/protected/coppie");
  const {data:conversation}=await supabase.from("conversations").select("id,title").eq("couple_id",id).order("created_at",{ascending:true}).limit(1).maybeSingle();
  const {data:messages}=conversation?await supabase.from("messages").select("id,body,sender_id,read_at,status,created_at").eq("conversation_id",conversation.id).order("created_at",{ascending:true}):{data:[]};
  return <main className="mx-auto max-w-4xl px-6 py-10">
    <div className="mb-6 flex items-center justify-between"><div><div className="text-sm text-muted-foreground">Coppia · {couple.partner1_first_name} {couple.partner1_last_name} / {couple.partner2_first_name} {couple.partner2_last_name}</div><h1 className="mt-2 text-3xl font-bold">Messaggi</h1><p className="mt-1 text-muted-foreground">Conversazione privata collegata alla coppia.</p></div><Link className="ef-button-secondary" href={`/protected/coppie/${id}`}>Torna alla scheda</Link></div>
    <section className="ef-card p-6"><div className="space-y-3">{(messages||[]).length===0?<p className="text-muted-foreground">Nessun messaggio.</p>:(messages||[]).map(m=><div key={m.id} className={`rounded-xl border p-4 ${m.sender_id===user.id?"ml-12":"mr-12"}`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-muted-foreground">{m.sender_id===user.id?"Tu":"Cliente"}</span><span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("it-IT",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Rome"}).format(new Date(m.created_at))}</span></div><p className="mt-2 whitespace-pre-wrap">{m.body}</p>{m.sender_id!==user.id&&!m.read_at&&<form action={markRead} className="mt-3"><input type="hidden" name="id" value={m.id}/><input type="hidden" name="couple_id" value={id}/><button className="text-sm font-medium underline">Segna come letto</button></form>}</div>)}</div><form action={sendMessage} className="mt-6"><input type="hidden" name="couple_id" value={id}/><textarea required name="body" className="min-h-28 w-full rounded-xl border p-3" placeholder="Scrivi un messaggio..."/><button className="mt-3 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white">Invia messaggio</button></form></section>
  </main>;
}
