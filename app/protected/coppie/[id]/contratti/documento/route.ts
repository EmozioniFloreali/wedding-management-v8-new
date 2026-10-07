"use server";

import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildContractDocx, buildContractPdf } from "@/lib/contract-pdf";

function safeName(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
}

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id:coupleId}=await params;
  const format=request.nextUrl.searchParams.get("format")==="docx"?"docx":"pdf";
  const contractId=request.nextUrl.searchParams.get("contract_id");
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/auth/login");
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="admin")redirect("/protected");

  if(!contractId)return new NextResponse("Contratto non specificato",{status:400});
  const {data:contract}=await supabase.from("contracts").select("id,couple_id,wedding_id,quote_id,floral_project_id,version_number,contract_date,total_amount,deposit_amount,balance_amount,notes").eq("id",contractId).eq("couple_id",coupleId).maybeSingle();
  if(!contract)return new NextResponse("Contratto non trovato",{status:404});

  const [{data:couple},{data:wedding},{data:project},{data:items},{data:quote}]=await Promise.all([
    supabase.from("couples").select("partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name,email,phone").eq("id",coupleId).maybeSingle(),
    supabase.from("weddings").select("wedding_date,wedding_time,venue,church,reception_hall,ceremony_location").eq("id",contract.wedding_id||"").maybeSingle(),
    supabase.from("floral_projects").select("name,status,notes,total_amount").eq("id",contract.floral_project_id||"").maybeSingle(),
    supabase.from("contract_items").select("name:description,category:area,description,quantity,unit,notes,sort_order").eq("contract_id",contract.id).order("sort_order",{ascending:true}),
    supabase.from("quotes").select("status,total_amount,deposit_amount,vat_included,notes").eq("id",contract.quote_id||"").maybeSingle()
  ]);

  const quoteItems=contract.quote_id?await supabase.from("quote_items").select("description,quantity,unit").eq("quote_id",contract.quote_id).order("sort_order",{ascending:true}):{data:[]};
  const data={
    contractDate:contract.contract_date?new Intl.DateTimeFormat("it-IT",{dateStyle:"long",timeZone:"Europe/Rome"}).format(new Date(contract.contract_date+"T12:00:00")):new Date().toLocaleDateString("it-IT"),
    versionNumber:contract.version_number,
    couple:{first:[couple?.partner1_first_name,couple?.partner1_last_name].filter(Boolean).join(" "),second:[couple?.partner2_first_name,couple?.partner2_last_name].filter(Boolean).join(" "),email:couple?.email,phone:couple?.phone},
    wedding:{date:wedding?.wedding_date,time:wedding?.wedding_time,venue:wedding?.venue,church:wedding?.church||wedding?.ceremony_location,reception:wedding?.reception_hall},
    project:{name:project?.name||"Progetto Floreale",status:project?.status,notes:project?.notes,total:contract.total_amount},
    items:(items||[]).map((it:any)=>({name:it.name||it.description||"Lavorazione floreale",category:it.category,description:it.description,quantity:Number(it.quantity??1),unit:it.unit||"pz",notes:it.notes})),
    quote:quote?{status:quote.status,vatRate:quote.vat_included?10:0,total:Number(quote.total_amount??contract.total_amount??0),deposit:Number(quote.deposit_amount??contract.deposit_amount??0),balance:Number(contract.balance_amount??0),discount:0,notes:quote.notes,items:(quoteItems.data||[]).map((it:any)=>({description:it.description,quantity:Number(it.quantity??1),unit:it.unit||"pz"}))}:null
  };

  const coupleSlug=safeName(data.couple.first+"_"+data.couple.second)||"coppia";
  const filename="Contratto_"+coupleSlug+"_v"+contract.version_number;
  if(format==="docx"){
    const bytes=buildContractDocx(data);
    return new NextResponse(bytes as BodyInit,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":"attachment; filename=\""+filename+".docx\"","Cache-Control":"no-store"}});
  }
  const bytes=buildContractPdf(data);
  return new NextResponse(bytes as BodyInit,{headers:{"Content-Type":"application/pdf","Content-Disposition":"inline; filename=\""+filename+".pdf\"","Cache-Control":"no-store"}});
}
