import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { id, documentId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/auth/login", _request.url)
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  const { data: coupleAccess } = await supabase
    .from("couples")
    .select("portal_enabled")
    .eq("id", id)
    .maybeSingle();

  if (!isAdmin && !coupleAccess?.portal_enabled) {
    return new NextResponse("Area Sposi non disponibile", { status: 403 });
  }

  if (!isAdmin) {
    const { data: member } = await supabase
      .from("couple_members")
      .select("id")
      .eq("couple_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return new NextResponse("Non autorizzato", { status: 403 });
    }
  }

  const { data: document } = await supabase
    .from("client_documents")
    .select("id, name, storage_path, visible_to_couple")
    .eq("id", documentId)
    .eq("couple_id", id)
    .maybeSingle();

  if (!isAdmin && document && !document.visible_to_couple) {
    return new NextResponse("Documento non disponibile", { status: 404 });
  }

  if (!document?.storage_path) {
    return new NextResponse("Documento non disponibile", {
      status: 404,
    });
  }

  const { data: signed, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(document.storage_path, 3600);

  if (error || !signed?.signedUrl) {
    return new NextResponse("Impossibile aprire il documento", {
      status: 500,
    });
  }

  return NextResponse.redirect(signed.signedUrl);
}
