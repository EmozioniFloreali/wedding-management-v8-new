import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Plus, ArrowLeft, CalendarDays } from "lucide-react";

export const instant = false;

export default async function CoppiePage() {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/auth/login");
  }

  const { data: couples, error } = await supabase
    .from("couples")
    .select(`
      id,
      partner1_first_name,
      partner1_last_name,
      partner2_first_name,
      partner2_last_name,
      email,
      phone,
      notes,
      weddings (
        wedding_date,
        wedding_time,
        venue,
        status
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-muted/30">
        <section className="mx-auto max-w-7xl px-6 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Errore nel caricamento</CardTitle>
              <CardDescription>
                Non è stato possibile caricare le coppie.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {error.message}
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Gestione Coppie
            </h1>
            <p className="text-sm text-muted-foreground">
              Wedding Management • Emozioni Floreali
            </p>
          </div>

          <Button asChild>
            <Link href="/protected/coppie/nuova">
              <Plus className="mr-2 h-4 w-4" />
              Nuova coppia
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              AREA PROFESSIONALE
            </p>
            <h2 className="text-3xl font-bold tracking-tight">
              Le tue coppie
            </h2>
            <p className="mt-2 text-muted-foreground">
              Gestisci le coppie e accedi alle relative schede matrimonio.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link href="/protected">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        {couples && couples.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {couples.map((couple) => {
              const wedding = Array.isArray(couple.weddings)
                ? couple.weddings[0]
                : couple.weddings;

              const coupleName =
                `${couple.partner1_first_name} ${couple.partner1_last_name} & ${couple.partner2_first_name} ${couple.partner2_last_name}`;

              return (
                <Card key={couple.id} className="overflow-hidden">
                  <CardHeader>
                    <Users className="mb-2 h-7 w-7" />
                    <CardTitle className="leading-tight">
                      {coupleName}
                    </CardTitle>
                    <CardDescription>
                      {couple.email || "Nessuna email inserita"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {wedding ? (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <CalendarDays className="h-4 w-4" />
                          Matrimonio
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {wedding.wedding_date
                            ? new Date(
                                wedding.wedding_date
                              ).toLocaleDateString("it-IT")
                            : "Data da definire"}
                        </p>

                        {wedding.venue && (
                          <p className="text-sm text-muted-foreground">
                            {wedding.venue}
                          </p>
                        )}

                        <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">
                          {wedding.status || "lead"}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                        Nessuna scheda matrimonio ancora collegata.
                      </div>
                    )}

                    <Button asChild className="w-full">
                      <Link href={`/protected/coppie/${couple.id}`}>
                        Apri scheda coppia
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Nessuna coppia presente</CardTitle>
              <CardDescription>
                Non hai ancora inserito nessuna coppia nel gestionale.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Button asChild>
                <Link href="/protected/coppie/nuova">
                  <Plus className="mr-2 h-4 w-4" />
                  Inserisci la prima coppia
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}