
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
  await requireAdmin();
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/auth/login");
  }

  const { data: couple, error: coupleError } =
    await supabase
      .from("couples")
      .select(`
        id,
        partner1_first_name,
        partner1_last_name,
        partner2_first_name,
        partner2_last_name
      `)
      .eq("id", id)
      .single();

  if (coupleError || !couple) {
    redirect("/protected/coppie");
  }

  const coupleName =
    `${couple.partner1_first_name} ${couple.partner1_last_name} & ` +
    `${couple.partner2_first_name} ${couple.partner2_last_name}`;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Dati matrimonio
            </h1>

            <p className="text-sm text-muted-foreground">
              Wedding Management • Emozioni Floreali
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href={`/protected/coppie/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alla scheda
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
            Matrimonio di {coupleName}
          </h2>

          <p className="mt-2 text-muted-foreground">
            Inserisci i dati principali del matrimonio.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <form
          action={salvaMatrimonio.bind(null, id)}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Data e ora</CardTitle>
              <CardDescription>
                Quando si svolgerà il matrimonio?
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wedding_date">
                  Data matrimonio *
                </Label>

                <Input
                  id="wedding_date"
                  name="wedding_date"
                  type="date"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wedding_time">
                  Ora matrimonio
                </Label>

                <Input
                  id="wedding_time"
                  name="wedding_time"
                  type="time"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Luoghi</CardTitle>
              <CardDescription>
                Cerimonia, chiesa e ricevimento.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="venue">
                  Location principale
                </Label>

                <Input
                  id="venue"
                  name="venue"
                  placeholder="Es. Villa, Hotel, Tenuta..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ceremony_location">
                  Luogo cerimonia
                </Label>

                <Input
                  id="ceremony_location"
                  name="ceremony_location"
                  placeholder="Es. Chiesa / Cerimonia civile"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="church">
                    Chiesa
                  </Label>

                  <Input
                    id="church"
                    name="church"
                    placeholder="Nome della chiesa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reception_hall">
                    Sala ricevimento
                  </Label>

                  <Input
                    id="reception_hall"
                    name="reception_hall"
                    placeholder="Nome della sala"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stato della pratica</CardTitle>
              <CardDescription>
                Stato attuale del rapporto con la coppia.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <select
                id="status"
                name="status"
                defaultValue="lead"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="lead">
                  Contatto iniziale
                </option>

                <option value="proposal">
                  Preventivo
                </option>

                <option value="confirmed">
                  Matrimonio confermato
                </option>

                <option value="completed">
                  Matrimonio completato
                </option>

                <option value="cancelled">
                  Annullato
                </option>
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Note</CardTitle>
              <CardDescription>
                Annotazioni relative al matrimonio.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <textarea
                id="notes"
                name="notes"
                rows={6}
                placeholder="Inserisci eventuali note..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button asChild variant="outline">
              <Link href={`/protected/coppie/${id}`}>
                Annulla
              </Link>
            </Button>

            <Button type="submit">
              <Save className="mr-2 h-4 w-4" />
              Salva matrimonio
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}