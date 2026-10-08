import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


function coupleName(c: any) {
  return [c?.partner1_first_name, c?.partner1_last_name, c?.partner2_first_name, c?.partner2_last_name]
    .filter(Boolean)
    .join(" ") || "Coppia";
}

function dateIt(value: string | null | undefined) {
  if (!value) return "Data non impostata";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

function dateTimeIt(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    draft: "Bozza",
    in_progress: "In lavorazione",
    approved: "Approvato",
    completed: "Completato",
    archived: "Archiviato",
    planned: "Programmato",
    confirmed: "Confermato",
    cancelled: "Annullato",
    todo: "Da fare",
    in_progress_task: "In corso",
    done: "Completata",
  };
  return map[value || ""] || value || "Altro";
}
export default async function ProtectedDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || "couple";

  // Gli utenti coppia non devono entrare nella dashboard professionale.
  // Li portiamo direttamente nella loro Area riservata sposi.
  if (role === "couple") {
    const { data: membership } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership?.couple_id) {
      const { data: coupleAccess } = await supabase.from("couples").select("portal_enabled").eq("id", membership.couple_id).maybeSingle();
      if (coupleAccess?.portal_enabled) redirect(`/protected/area-sposi/${membership.couple_id}`);
      return <main className="min-h-screen bg-background p-10"><div className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center shadow-sm"><div className="text-4xl">🔒</div><h1 className="mt-4 text-2xl font-bold text-foreground">Area Sposi non disponibile</h1><p className="mt-3 text-muted-foreground">L accesso all Area Sposi è attualmente disattivato. La gestione del matrimonio rimane esclusivamente a Emozioni Floreali.</p></div></main>;
    }

    redirect("/auth/login?error=area_sposi_non_collegata");
  }

  const isAdmin = role === "admin";

  let coupleIds: string[] = [];
  if (!isAdmin) {
    const { data: memberships } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id);
    coupleIds = (memberships || []).map((m: any) => m.couple_id);
  }

  let couplesQuery = supabase
    .from("couples")
    .select("id, partner1_first_name, partner1_last_name, partner2_first_name, partner2_last_name, email, phone, updated_at")
    .order("updated_at", { ascending: false });
  if (!isAdmin) couplesQuery = couplesQuery.in("id", coupleIds.length ? coupleIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: couples } = await couplesQuery;

  let weddingsQuery = supabase
    .from("weddings")
    .select("id, couple_id, wedding_date, wedding_time, venue, ceremony_location, reception_hall, status")
    .gte("wedding_date", new Date().toISOString().slice(0, 10))
    .order("wedding_date", { ascending: true })
    .limit(8);
  if (!isAdmin) weddingsQuery = weddingsQuery.in("couple_id", coupleIds.length ? coupleIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: weddings } = await weddingsQuery;

  let projectsQuery = supabase.from("floral_projects").select("id, couple_id, name, status, total_amount, updated_at").order("updated_at", { ascending: false });
  if (!isAdmin) projectsQuery = projectsQuery.in("couple_id", coupleIds.length ? coupleIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: projects } = await projectsQuery.limit(8);

  let tasksQuery = supabase.from("tasks").select("id, couple_id, title, due_date, due_time, priority, status, area").neq("status", "completata").order("due_date", { ascending: true, nullsFirst: false }).limit(8);
  if (!isAdmin) tasksQuery = tasksQuery.in("couple_id", coupleIds.length ? coupleIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: tasks } = await tasksQuery;

  let eventsQuery = supabase.from("calendar_events").select("id, couple_id, title, event_type, start_at, location, status").gte("start_at", new Date().toISOString()).order("start_at", { ascending: true }).limit(6);
  if (!isAdmin) eventsQuery = eventsQuery.in("couple_id", coupleIds.length ? coupleIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: events } = await eventsQuery;

  const { count: unreadNotifications } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  const { count: unreadMessages } = await supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user.id);

  const coupleMap = new Map((couples || []).map((c: any) => [c.id, c]));
  const totalProjectValue = (projects || []).reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0);

  const cards = [
    { label: "Coppie", value: couples?.length || 0, href: "/protected/coppie", text: "Gestisci clienti e schede" },
    { label: "Matrimoni prossimi", value: weddings?.length || 0, href: couples?.[0] ? `/protected/coppie/${couples[0].id}/calendario` : "/protected/coppie", text: "Apri agenda" },
    { label: "Attività aperte", value: tasks?.length || 0, href: couples?.[0] ? `/protected/coppie/${couples[0].id}/attivita` : "/protected/coppie", text: "Vedi attività" },
    { label: "Messaggi non letti", value: unreadMessages || 0, href: couples?.[0] ? `/protected/coppie/${couples[0].id}/messaggi` : "/protected/coppie", text: "Apri comunicazioni" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="ef-eyebrow">Emozioni Floreali → Wedding Management V8 NEW</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">{profile?.full_name ? `Bentornato, ${profile.full_name}.` : "Panoramica operativa del tuo Wedding Management."}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/protected/coppie/nuova" className="rounded-xl ef-button-primary">+ Nuova coppia</Link>
            <Link href="/protected/notifiche" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-secondary/60">Notifiche {unreadNotifications ? `(${unreadNotifications})` : ""}</Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="ef-card p-5 hover:-translate-y-0.5">
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{card.value}</p>
              <p className="mt-2 text-sm text-primary">{card.text} ?</p>
            </Link>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="ef-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="text-xl font-bold text-foreground">Prossimi matrimoni</h2><p className="mt-1 text-sm text-muted-foreground">Gli eventi più vicini da tenere sotto controllo.</p></div>
              <Link href="/protected/calendario" className="text-sm font-semibold text-primary hover:opacity-80">Calendario →</Link>
            </div>
            <div className="mt-5 space-y-3">
              {(weddings || []).map((w: any) => {
                const c = coupleMap.get(w.couple_id);
                return <Link key={w.id} href={`/protected/coppie/${w.couple_id}`} className="flex flex-col gap-2 rounded-xl border border p-4 hover:bg-secondary/60 md:flex-row md:items-center md:justify-between">
                  <div><p className="font-semibold text-foreground">{coupleName(c)}</p><p className="text-sm text-muted-foreground">{w.venue || w.reception_hall || w.ceremony_location || "Location da definire"}</p></div>
                  <div className="text-left md:text-right"><p className="font-semibold text-foreground">{dateIt(w.wedding_date)}</p><p className="text-sm text-muted-foreground">{w.wedding_time ? String(w.wedding_time).slice(0,5) : "Orario da definire"} → {statusLabel(w.status)}</p></div>
                </Link>;
              })}
              {!weddings?.length && <div className="rounded-xl bg-secondary/60 p-5 text-sm text-muted-foreground">Nessun matrimonio futuro presente.</div>}
            </div>
          </div>

          <div className="ef-card p-6">
            <h2 className="text-xl font-bold text-foreground">Accessi rapidi</h2>
            <div className="mt-5 grid gap-3">
              {[
                ["Coppie", "/protected/coppie", "CRM sposi"],
                ["Calendario", "/protected/calendario", "Appuntamenti e scadenze"],
                ["Attività", couples?.[0] ? `/protected/coppie/${couples[0].id}/attivita` : "/protected/coppie", "Checklist operative"],
                ["Messaggi", couples?.[0] ? `/protected/coppie/${couples[0].id}/messaggi` : "/protected/coppie", "Comunicazione con gli sposi"],
                ["Area Sposi", couples?.[0] ? `/protected/area-sposi/${couples[0].id}` : "/protected/area-sposi", "Portale cliente"],
                ["Notifiche", "/protected/notifiche", "Aggiornamenti e avvisi"],
              ].map(([label, href, sub]) => <Link key={label} href={href} className="rounded-xl border border px-4 py-3 hover:bg-secondary/60"><p className="font-semibold text-foreground">{label}</p><p className="text-xs text-muted-foreground">{sub}</p></Link>)}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="ef-card p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-foreground">Attività da completare</h2><p className="mt-1 text-sm text-muted-foreground">Le prossime azioni operative.</p></div><Link href={couples?.[0] ? `/protected/coppie/${couples[0].id}/attivita` : "/protected/coppie"} className="text-sm font-semibold text-primary">Tutte →</Link></div>
            <div className="mt-5 space-y-3">
              {(tasks || []).map((t: any) => <Link key={t.id} href={couples?.[0] ? `/protected/coppie/${couples[0].id}/attivita` : "/protected/coppie"} className="block rounded-xl border border p-4 hover:bg-secondary/60"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-foreground">{t.title}</p><span className="text-xs font-semibold uppercase text-muted-foreground">{statusLabel(t.priority)}</span></div><p className="mt-1 text-sm text-muted-foreground">{coupleName(coupleMap.get(t.couple_id))} → {t.due_date ? dateTimeIt(new Date(`${t.due_date}T${t.due_time || "12:00"}`)) : "Senza scadenza"}</p></Link>)}
              {!tasks?.length && <div className="rounded-xl bg-secondary/60 p-5 text-sm text-muted-foreground">Nessuna attività aperta.</div>}
            </div>
          </div>

          <div className="ef-card p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-foreground">Agenda imminente</h2><p className="mt-1 text-sm text-muted-foreground">Appuntamenti, sopralluoghi, consegne e montaggi.</p></div><Link href="/protected/calendario" className="text-sm font-semibold text-primary">Agenda →</Link></div>
            <div className="mt-5 space-y-3">
              {(events || []).map((e: any) => <Link key={e.id} href={couples?.[0] ? `/protected/coppie/${couples[0].id}/calendario` : "/protected/coppie"} className="block rounded-xl border border p-4 hover:bg-secondary/60"><p className="font-semibold text-foreground">{e.title}</p><p className="mt-1 text-sm text-muted-foreground">{dateTimeIt(e.start_at)} → {coupleName(coupleMap.get(e.couple_id))}</p><p className="mt-1 text-xs text-muted-foreground">{e.location || e.event_type || ""}</p></Link>)}
              {!events?.length && <div className="rounded-xl bg-secondary/60 p-5 text-sm text-muted-foreground">Nessun appuntamento imminente.</div>}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Controllo economico</p><h2 className="mt-1 text-xl font-bold text-foreground">Valore complessivo dei progetti floreali visualizzati</h2></div>
            <p className="text-2xl font-bold text-foreground">€ {totalProjectValue.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </section>
      </div>
    </main>
  );
}







