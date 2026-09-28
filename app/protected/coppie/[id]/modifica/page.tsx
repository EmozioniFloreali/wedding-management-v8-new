import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";

export const instant = false;

const text = (value: FormDataEntryValue | null) => String(value || "").trim();

async function updateCouple(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/auth/login");

  const id = text(formData.get("id"));
  const partner1FirstName = text(formData.get("partner1_first_name"));
  const partner1LastName = text(formData.get("partner1_last_name"));
  const partner2FirstName = text(formData.get("partner2_first_name"));
  const partner2LastName = text(formData.get("partner2_last_name"));
  const email = text(formData.get("email"));
  const phone = text(formData.get("phone"));
  const notes = text(formData.get("notes"));

  if (!id || !partner1FirstName || !partner1LastName || !partner2FirstName || !partner2LastName) {
    redirect(`/protected/coppie/${id}/modifica?error=Compila%20tutti%20i%20campi%20obbligatori`);
  }

  const { error } = await supabase
    .from("couples")
    .update({
      partner1_first_name: partner1FirstName,
      partner1_last_name: partner1LastName,
      partner2_first_name: partner2FirstName,
      partner2_last_name: partner2LastName,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    redirect(`/protected/coppie/${id}/modifica?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/protected/coppie/${id}`);
}

export default async function ModificaCoppiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/auth/login");

  const { data: couple, error } = await supabase
    .from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name,email,phone,notes")
    .eq("id", id)
    .single();

  if (error || !couple) notFound();

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Modifica coppia</h1>
            <p className="text-sm text-muted-foreground">Wedding Management • Emozioni Floreali</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/protected/coppie/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />Torna alla scheda
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        {query.error && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Errore: {query.error}</div>}
        <form action={updateCouple} className="space-y-6">
          <input type="hidden" name="id" value={couple.id} />
          <Card>
            <CardHeader><CardTitle>Prima persona</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="partner1_first_name">Nome *</Label><Input id="partner1_first_name" name="partner1_first_name" required defaultValue={couple.partner1_first_name || ""} /></div>
              <div className="space-y-2"><Label htmlFor="partner1_last_name">Cognome *</Label><Input id="partner1_last_name" name="partner1_last_name" required defaultValue={couple.partner1_last_name || ""} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Seconda persona</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="partner2_first_name">Nome *</Label><Input id="partner2_first_name" name="partner2_first_name" required defaultValue={couple.partner2_first_name || ""} /></div>
              <div className="space-y-2"><Label htmlFor="partner2_last_name">Cognome *</Label><Input id="partner2_last_name" name="partner2_last_name" required defaultValue={couple.partner2_last_name || ""} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contatti e note</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={couple.email || ""} /></div>
                <div className="space-y-2"><Label htmlFor="phone">Telefono</Label><Input id="phone" name="phone" type="tel" defaultValue={couple.phone || ""} /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="notes">Note</Label><textarea id="notes" name="notes" rows={5} defaultValue={couple.notes || ""} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring" /></div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-3">
            <Button asChild variant="outline"><Link href={`/protected/coppie/${id}`}>Annulla</Link></Button>
            <Button type="submit"><Save className="mr-2 h-4 w-4" />Salva modifiche</Button>
          </div>
        </form>
      </section>
    </main>
  );
}
