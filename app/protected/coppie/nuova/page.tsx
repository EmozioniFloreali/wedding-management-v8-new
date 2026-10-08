import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";

export const instant = false;

async function createCouple(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/auth/login");
  }

  const partner1FirstName =
    String(formData.get("partner1_first_name") || "").trim();
  const partner1LastName =
    String(formData.get("partner1_last_name") || "").trim();
  const partner2FirstName =
    String(formData.get("partner2_first_name") || "").trim();
  const partner2LastName =
    String(formData.get("partner2_last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (
    !partner1FirstName ||
    !partner1LastName ||
    !partner2FirstName ||
    !partner2LastName
  ) {
    redirect("/protected/coppie/nuova?error=Campi%20obbligatori");
  }

  const { data: couple, error } = await supabase
    .from("couples")
    .insert({
      created_by: user.id,
      partner1_first_name: partner1FirstName,
      partner1_last_name: partner1LastName,
      partner2_first_name: partner2FirstName,
      partner2_last_name: partner2LastName,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error || !couple) {
    redirect(
      `/protected/coppie/nuova?error=${encodeURIComponent(
        error?.message || "Errore durante il salvataggio"
      )}`
    );
  }

  redirect(`/protected/coppie/${couple.id}`);
}

export default async function NuovaCoppiaPage({
  const { supabase, user } = await requireAdmin();
}