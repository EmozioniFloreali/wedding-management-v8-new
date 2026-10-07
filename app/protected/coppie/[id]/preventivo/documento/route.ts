import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildQuoteDocx, buildQuotePdfAsync } from "@/lib/quote-document";

export const runtime = "nodejs";

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: coupleId } = await params;
  const format = request.nextUrl.searchParams.get("format") === "docx" ? "docx" : "pdf";
  const requestedQuoteId = request.nextUrl.searchParams.get("quote_id");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/protected");

  const { data: couple } = await supabase.from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name,email,phone")
    .eq("id", coupleId).maybeSingle();
  if (!couple) return new NextResponse("Coppia non trovata", { status: 404 });

  let quote;
  if (requestedQuoteId) {
    const result = await supabase.from("quotes").select("*").eq("couple_id", coupleId).eq("id", requestedQuoteId).maybeSingle();
    quote = result.data;
  } else {
    const result = await supabase.from("quotes").select("*").eq("couple_id", coupleId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    quote = result.data;
  }
  if (!quote) return new NextResponse("Preventivo non trovato", { status: 404 });

  const { data: project } = await supabase.from("floral_projects").select("id,name").eq("couple_id", coupleId).maybeSingle();
  const { data: wedding } = await supabase.from("weddings")
    .select("id,wedding_date,wedding_time,venue,church,reception_hall")
    .eq("couple_id", coupleId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: items } = await supabase.from("quote_items")
    .select("description,quantity,unit,area,notes").eq("quote_id", quote.id).order("sort_order", { ascending: true });

  const data = {
    quote: {
      id: quote.id, version_number: quote.version_number, status: quote.status, title: quote.title,
      validity_days: quote.validity_days, total_amount: quote.total_amount, deposit_amount: quote.deposit_amount,
      vat_included: quote.vat_included, notes: quote.notes, created_at: quote.created_at,
      presented_at: quote.presented_at, confirmed_at: quote.confirmed_at,
    },
    couple: {
      first: [couple.partner1_first_name, couple.partner1_last_name].filter(Boolean).join(" "),
      second: [couple.partner2_first_name, couple.partner2_last_name].filter(Boolean).join(" "),
      email: couple.email, phone: couple.phone,
    },
    wedding: {
      date: wedding?.wedding_date, time: wedding?.wedding_time, venue: wedding?.venue,
      church: wedding?.church, reception: wedding?.reception_hall,
    },
    project: { name: project?.name || "Progetto Floreale" },
    items: (items || []).map((item) => ({
      description: item.description, quantity: Number(item.quantity ?? 1),
      unit: item.unit || "pz", area: item.area, notes: item.notes,
    })),
  };

  const coupleSlug = safeName(data.couple.first + "_" + data.couple.second) || "coppia";
  const filename = "Preventivo_" + coupleSlug + "_v" + quote.version_number;

  if (format === "docx") {
    const bytes = await buildQuoteDocx(data);
    return new NextResponse(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="' + filename + '.docx"',
        "Cache-Control": "no-store",
      },
    });
  }

  const bytes = await buildQuotePdfAsync(data);
  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="' + filename + '.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
