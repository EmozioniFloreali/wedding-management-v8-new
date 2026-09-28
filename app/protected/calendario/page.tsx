import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

function dateTimeIt(value: string | null | undefined) {
  if (!value) return "Data non impostata";

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function statusLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    planned: "Pianificato",
    confirmed: "Confermato",
    completed: "Completato",
    cancelled: "Annullato",
  };

  return map[value || ""] || value || "Altro";
}

function typeLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    appuntamento: "Appuntamento",
    sopralluogo: "Sopralluogo",
    consegna: "Consegna",
    montaggio: "Montaggio",
    smontaggio: "Smontaggio",
    scadenza: "Scadenza",
    altro: "Altro",
  };

  return map[value || ""] || value || "Altro";
}

export default async function CalendarioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  let coupleIds: string[] = [];

  if (!isAdmin) {
    const { data: memberships } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id);

    coupleIds = (memberships || []).map((m: any) => m.couple_id);
  }

  let eventsQuery = supabase
    .from("calendar_events")
    .select("*")
    .order("start_at", { ascending: true });

  if (!isAdmin) {
    if (!coupleIds.length) {
      return (
        <main className="min-h-screen bg-slate-50 px-6 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h1 className="text-2xl font-bold text-slate-900">
                Calendario
              </h1>
              <p className="mt-2 text-slate-500">
                Non ci sono coppie associate al tuo account.
              </p>
            </div>
          </div>
        </main>
      );
    }

    eventsQuery = eventsQuery.in("couple_id", coupleIds);
  }

  const { data: events, error } = await eventsQuery;

  if (error) {
    throw new Error(error.message);
  }

  const eventList = events || [];

  const ids = Array.from(
    new Set(eventList.map((event: any) => event.couple_id).filter(Boolean))
  );

  let couples: any[] = [];

  if (ids.length) {
    const { data } = await supabase
      .from("couples")
      .select(
        "id, partner1_first_name, partner1_last_name, partner2_first_name, partner2_last_name"
      )
      .in("id", ids);

    couples = data || [];
  }

  const coupleMap = new Map(
    couples.map((couple: any) => [
      couple.id,
      [
        couple.partner1_first_name,
        couple.partner1_last_name,
        couple.partner2_first_name,
        couple.partner2_last_name,
      ]
        .filter(Boolean)
        .join(" "),
    ])
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              Emozioni Floreali → Wedding Management V8
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Calendario
            </h1>
            <p className="mt-2 text-slate-500">
              Appuntamenti, sopralluoghi, consegne, montaggi e scadenze.
            </p>
          </div>

          <Link
            href="/protected"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Torna alla Dashboard
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Agenda
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {eventList.length} eventi presenti
              </p>
            </div>
          </div>

          {eventList.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">
              Nessun appuntamento presente nel calendario.
            </div>
          ) : (
            <div className="space-y-3">
              {eventList.map((event: any) => {
                const coupleName =
                  coupleMap.get(event.couple_id) || "Coppia";

                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {event.title || "Evento senza titolo"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-600">
                          {dateTimeIt(event.start_at)}
                          {event.end_at
                            ? ` → ${dateTimeIt(event.end_at)}`
                            : ""}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            {typeLabel(event.event_type)}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            {statusLabel(event.status)}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-slate-500">
                          <strong>Coppia:</strong> {coupleName}
                        </p>

                        {event.location && (
                          <p className="mt-1 text-sm text-slate-500">
                            <strong>Luogo:</strong> {event.location}
                          </p>
                        )}
                      </div>

                      {event.couple_id && (
                        <Link
                          href={`/protected/coppie/${event.couple_id}/calendario`}
                          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          Apri calendario coppia
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
