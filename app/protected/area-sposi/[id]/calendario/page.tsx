import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPE_LABELS: Record<string, string> = {
  appuntamento: "Appuntamento",
  sopralluogo: "Sopralluogo",
  consegna: "Consegna",
  montaggio: "Montaggio",
  smontaggio: "Smontaggio",
  scadenza: "Scadenza",
  altro: "Altro",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Pianificato",
  confirmed: "Confermato",
  completed: "Completato",
  cancelled: "Annullato",
};

export default async function AreaSposiCalendarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("couple_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  if (!membership && !isAdmin) redirect("/protected");

  const [{ data: couple }, { data: events }] = await Promise.all([
    supabase
      .from("couples")
      .select(
        "id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name,portal_enabled"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("calendar_events")
      .select(
        "id,title,description,event_type,start_at,end_at,all_day,location,status,notes"
      )
      .eq("couple_id", id)
      .order("start_at", { ascending: true }),
  ]);

  if (!couple) redirect("/protected");
  if (!couple.portal_enabled && !isAdmin) redirect("/protected");

  const name = [
    couple.partner1_first_name,
    couple.partner1_last_name,
    couple.partner2_first_name,
    couple.partner2_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <Link
            href={`/protected/area-sposi/${id}`}
            className="text-sm font-medium underline"
          >
            ← Torna all&apos;area sposi
          </Link>
          <p className="mt-5 text-sm text-slate-500">Area riservata sposi</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Calendario</h1>
          <p className="mt-1 text-slate-600">{name}</p>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Appuntamenti e scadenze</h2>
              <p className="mt-1 text-sm text-slate-500">
                Qui visualizzi gli eventi condivisi da Emozioni Floreali.
              </p>
            </div>
            <div className="text-sm font-medium text-slate-500">
              {(events || []).length} {(events || []).length === 1 ? "evento" : "eventi"}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {(events || []).length === 0 ? (
              <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
                <p className="font-semibold text-slate-800">
                  Nessun evento programmato
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Quando verrà inserito un appuntamento, lo troverai qui.
                </p>
              </div>
            ) : (
              events!.map((event) => {
                const start = new Date(event.start_at);
                const end = event.end_at ? new Date(event.end_at) : null;
                const dateText = event.all_day
                  ? new Intl.DateTimeFormat("it-IT", {
                      dateStyle: "full",
                      timeZone: "Europe/Rome",
                    }).format(start)
                  : new Intl.DateTimeFormat("it-IT", {
                      dateStyle: "full",
                      timeStyle: "short",
                      timeZone: "Europe/Rome",
                    }).format(start);

                const endText =
                  end && !event.all_day
                    ? new Intl.DateTimeFormat("it-IT", {
                        timeStyle: "short",
                        timeZone: "Europe/Rome",
                      }).format(end)
                    : "";

                return (
                  <article
                    key={event.id}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {event.title}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {dateText}
                          {endText ? ` → ${endText}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                            {TYPE_LABELS[event.event_type || ""] ||
                              event.event_type ||
                              "Evento"}
                          </span>
                          {event.status && (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                              {STATUS_LABELS[event.status] || event.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {event.location && (
                        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 md:min-w-56">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Luogo
                          </div>
                          <div className="mt-1 font-medium">{event.location}</div>
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                        {event.description}
                      </p>
                    )}

                    {event.notes && (
                      <p className="mt-3 text-sm text-slate-500">
                        <span className="font-semibold">Note:</span> {event.notes}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
