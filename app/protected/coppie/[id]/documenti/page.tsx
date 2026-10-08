import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentiPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/auth/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="admin")redirect("/protected");
 const {data:docs}=await supabase.from("client_documents").select("id,name,category,visible_to_couple,created_at").eq("couple_id",id).order("created_at",{ascending:false});
 return <main className="min-h-screen bg-slate-50"><div className="mx-auto max-w-6xl px-6 py-8"><Link href={"/protected/coppie/"+id} className="text-sm underline">← Torna alla scheda coppia</Link><img src="/logo-emozioni-floreali.svg" alt="Emozioni Floreali di Giusy Surace" className="mt-6 h-auto w-full max-w-[380px]" /><h1 className="mt-6 text-3xl font-bold">Documenti</h1><div className="mt-6 space-y-3">{(docs||[]).map(d=><a key={d.id} href={"/protected/coppie/"+id+"/documenti/"+d.id} target="_blank" rel="noreferrer" className="block rounded-2xl border bg-white p-5 shadow-sm"><div className="font-bold">{d.name}</div><div className="text-sm text-slate-500">{d.category||"Documento"} · {d.visible_to_couple?"Visibile agli sposi":"Solo amministrazione"}</div></a>)}</div></div></main>;
}
