import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Flower2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
} from "lucide-react";

export const instant = false;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CoupleDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: couple,
    error,
  } = await supabase
    .from("couples")
    .select(
      `
      id,
      partner1_first_name,
      partner1_last_name,
      partner2_first_name,
      partner2_last_name,
      email,
      phone,
      notes,
      portal_enabled,
      weddings (
        id,
        wedding_date,
        wedding_time,
        venue,
        ceremony_location,
        church,
        reception_hall,
        status,
        notes
      )
      `
    )
    .eq("id", id)
    .single();

  if (error || !couple) {
    notFound();
  }

  const wedding = Array.isArray(couple.weddings)
    ? couple.weddings[0]
    : couple.weddings;

  const coupleName =
    `${couple.partner1_first_name} ${couple.partner1_last_name} & ` +
    `${couple.partner2_first_name} ${couple.partner2_last_name}`;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Scheda coppia
            </h1>
            <p className="text-sm text-muted-foreground">
              Wedding Management • Emozioni Floreali
            </p>
          </div>

          <Link
            href="/protected/coppie"
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna alle coppie
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              AREA PROFESSIONALE
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {coupleName}
            </h2>

            <p className="mt-2 text-muted-foreground">
              Scheda completa della coppia e del matrimonio.
            </p>
          </div>

          <Link
            href={`/protected/coppie/${couple.id}/modifica`}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            Modifica coppia
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* DATI DELLA COPPIA */}
          <div className="rounded-xl border bg-background p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold">Dati della coppia</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Informazioni principali e contatti.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Prima persona
                </p>
                <p className="mt-1 font-medium">
                  {couple.partner1_first_name} {couple.partner1_last_name}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Seconda persona
                </p>
                <p className="mt-1 font-medium">
                  {couple.partner2_first_name} {couple.partner2_last_name}
                </p>
              </div>

              {couple.email && (
                <div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Email
                  </p>
                  <p className="mt-1 font-medium">{couple.email}</p>
                </div>
              )}

              {couple.phone && (
                <div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    Telefono
                  </p>
                  <p className="mt-1 font-medium">{couple.phone}</p>
                </div>
              )}

              {couple.notes && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Note</p>
                  <p className="mt-1 whitespace-pre-wrap font-medium">
                    {couple.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* STATO MATRIMONIO */}
          <div className="rounded-xl border bg-background p-6">
            <h3 className="text-lg font-semibold">Stato matrimonio</h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Situazione attuale della pratica.
            </p>

            {!wedding ? (
              <div className="mt-6 rounded-lg border border-dashed p-5">
                <p className="font-medium">Nessun matrimonio inserito</p>

                <p className="mt-2 text-sm text-muted-foreground">
                  Possiamo inserire ora tutti i dati del matrimonio.
                </p>

                <Link
                  href={`/protected/coppie/${couple.id}/matrimonio`}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  <CalendarDays className="h-4 w-4" />
                  Inserisci dati matrimonio
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="mt-1 font-medium">
                    {new Date(wedding.wedding_date).toLocaleDateString(
                      "it-IT"
                    )}
                  </p>
                </div>

                {wedding.wedding_time && (
                  <div>
                    <p className="text-sm text-muted-foreground">Ora</p>
                    <p className="mt-1 font-medium">
                      {wedding.wedding_time}
                    </p>
                  </div>
                )}

                {wedding.status && (
                  <div>
                    <p className="text-sm text-muted-foreground">Stato</p>
                    <p className="mt-1 font-medium">
                      {wedding.status === "lead"
                        ? "Contatto iniziale"
                        : wedding.status === "proposal"
                          ? "Preventivo"
                          : wedding.status === "confirmed"
                            ? "Matrimonio confermato"
                            : wedding.status === "completed"
                              ? "Matrimonio completato"
                              : wedding.status === "cancelled"
                                ? "Annullato"
                                : wedding.status}
                    </p>
                  </div>
                )}

                {wedding.venue && (
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="mt-1 font-medium">{wedding.venue}</p>
                  </div>
                )}

                <Link
                  href={`/protected/coppie/${couple.id}/matrimonio`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" />
                  Modifica dati matrimonio
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* MODULI OPERATIVI */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* PROGETTO FLOREALE */}
          <div className="rounded-xl border bg-background p-6">
            <Flower2 className="h-7 w-7" />

            <h3 className="mt-4 font-semibold">
              Progetto floreale
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Bouquet, cerimonia e allestimenti.
            </p>

            <Link
              href={`/protected/coppie/${couple.id}/progetto`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Apri progetto
            </Link>
          </div>

          {/* COSTI E RENDICONTO INTERNO */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="text-2xl">💶</div>

            <h3 className="mt-4 font-semibold">
              Costi e rendiconto
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Spese interne della cerimonia, costi previsti ed effettivi e margine.
            </p>

            <Link
              href={`/protected/coppie/${couple.id}/costi`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Apri rendiconto
            </Link>

            <p className="mt-3 text-xs font-medium text-amber-900">
              🔒 Solo area professionale
            </p>
          </div>

          {/* ACCESSO AREA SPOSI */}
          <div className={`rounded-xl border p-6 ${couple.portal_enabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <div className="text-2xl">{couple.portal_enabled ? "🔓" : "🔒"}</div>
            <h3 className="mt-4 font-semibold">Accesso Area Sposi</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {couple.portal_enabled ? "La coppia può accedere e interagire." : "Gestione esclusivamente professionale."}
            </p>
            <Link
              href={`/protected/coppie/${couple.id}/accesso-sposi`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Gestisci accesso
            </Link>
          </div>

          {/* CALENDARIO */}
          <div className="rounded-xl border bg-background p-6">
            <CalendarDays className="h-7 w-7" />

            <h3 className="mt-4 font-semibold">Calendario</h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Appuntamenti e scadenze.
            </p>

            <Link
              href={`/protected/coppie/${id}/calendario`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Apri calendario
            </Link>
          </div>

          {/* MESSAGGI */}
          <div className="rounded-xl border bg-background p-6">
            <MessageSquare className="h-7 w-7" />

            <h3 className="mt-4 font-semibold">Messaggi</h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Comunicazioni con la coppia.
            </p>

            <Link
              href={`/protected/coppie/${couple.id}/messaggi`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Apri messaggi
            </Link>
          </div>

          {/* DOCUMENTI */}
          <div className="rounded-xl border bg-background p-6">
            <FileText className="h-7 w-7" />

            <h3 className="mt-4 font-semibold">Documenti</h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Preventivi, contratti e documenti.
            </p>

            <Link
              href={`/protected/coppie/${couple.id}/preventivo`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Apri preventivi
            </Link>

            <Link
              href={`/protected/coppie/${couple.id}/contratti`}
              className="mt-2 inline-flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Apri contratti
            </Link>
          </div>
        </div>

        {/* ATTIVITÀ */}
        <div className="mt-8 rounded-xl border bg-background p-6">
          <h3 className="text-lg font-semibold">Attività</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            Attività e prossime scadenze della coppia.
          </p>

          <div className="mt-6 rounded-lg border border-dashed p-5">
            <p className="font-medium">Area attività pronta</p>

            <p className="mt-2 text-sm text-muted-foreground">
              Qui collegheremo le attività operative del matrimonio.
              <Link href={`/protected/coppie/${couple.id}/attivita`} className="mt-3 inline-block rounded-lg border px-4 py-2 text-sm font-medium">Apri attività</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

