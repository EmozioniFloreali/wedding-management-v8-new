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
  await requireAdmin();
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Nuova coppia
            </h1>
            <p className="text-sm text-muted-foreground">
              Wedding Management • Emozioni Floreali
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/protected/coppie">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alle coppie
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            AREA PROFESSIONALE
          </p>

          <h2 className="text-3xl font-bold tracking-tight">
            Inserisci una nuova coppia
          </h2>

          <p className="mt-2 text-muted-foreground">
            Compila i dati principali degli sposi. Potrai completare la
            scheda matrimonio successivamente.
          </p>
        </div>

        {params.error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Errore: {params.error}
          </div>
        )}

        <form action={createCouple} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prima persona</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner1_first_name">Nome *</Label>
                <Input
                  id="partner1_first_name"
                  name="partner1_first_name"
                  required
                  placeholder="Nome"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner1_last_name">Cognome *</Label>
                <Input
                  id="partner1_last_name"
                  name="partner1_last_name"
                  required
                  placeholder="Cognome"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seconda persona</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partner2_first_name">Nome *</Label>
                <Input
                  id="partner2_first_name"
                  name="partner2_first_name"
                  required
                  placeholder="Nome"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner2_last_name">Cognome *</Label>
                <Input
                  id="partner2_last_name"
                  name="partner2_last_name"
                  required
                  placeholder="Cognome"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contatti e note</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@esempio.it"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+39 ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={5}
                  placeholder="Annotazioni iniziali sulla coppia..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button asChild variant="outline">
              <Link href="/protected/coppie">Annulla</Link>
            </Button>

            <Button type="submit">
              <Save className="mr-2 h-4 w-4" />
              Salva coppia
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}