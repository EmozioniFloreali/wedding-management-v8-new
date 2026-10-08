
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";

export const instant = false;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

async function salvaMatrimonio(
  coupleId: string,
  formData: FormData
) {
  "use server";

  const supabase = await createClient();

  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/auth/login");
  }

  const weddingDate =
    String(formData.get("wedding_date") || "").trim();

  const weddingTime =
    String(formData.get("wedding_time") || "").trim();

  const venue =
    String(formData.get("venue") || "").trim();

  const ceremonyLocation =
    String(formData.get("ceremony_location") || "").trim();

  const church =
    String(formData.get("church") || "").trim();

  const receptionHall =
    String(formData.get("reception_hall") || "").trim();

  const status =
    String(formData.get("status") || "lead").trim();

  const notes =
    String(formData.get("notes") || "").trim();

  if (!weddingDate) {
    redirect(
      `/protected/coppie/${coupleId}/matrimonio?error=La%20data%20del%20matrimonio%20%C3%A8%20obbligatoria`
    );
  }

  const { error } = await supabase
    .from("weddings")
    .insert({
      couple_id: coupleId,
      wedding_date: weddingDate,
      wedding_time: weddingTime || null,
      venue: venue || null,
      ceremony_location: ceremonyLocation || null,
      church: church || null,
      reception_hall: receptionHall || null,
      status: status || "lead",
      notes: notes || null,
    });

  if (error) {
    redirect(
      `/protected/coppie/${coupleId}/matrimonio?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  redirect(`/protected/coppie/${coupleId}`);
}

export default async function MatrimonioPage({
  const { supabase } = await requireAdmin();
}