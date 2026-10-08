import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Plus, ArrowLeft, CalendarDays, Archive } from "lucide-react";
import { CoupleArchiveButton } from "@/components/couple-archive-button";

export default async function CoppiePage() {
  const { supabase } = await requireAdmin();
  const { data: couples, error } = await supabase.from("couples").select(`
    id, partner1_first_name, partner1_last_name, partner2_first_name,
    partner2_last_name, email, phone, notes, archived_at,
    weddings (wedding_date, wedding_time, venue, status)
  `).order("created_at", { ascending: false });

  if (error) return <main className="min-h-screen bg-background"><section className="mx-auto max-w-7xl px-5 py-10 md:px-8"><Card><CardHeader><CardTitle>Errore nel caricamento</CardTitle><CardDescription>Non è stato possibile caricare le coppie.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">{error.message}</p></CardContent></Card></section></main>;

  const activeCouples = (couples ?? []).filter((c) => !c.archived_at);
  const archivedCouples = (couples ?? []).filter((c) => !!c.archived_at);

  function CoupleCard({ couple, archived }: { couple: NonNullable<typeof couples>[number]; archived: boolean }) {
    const wedding = Array.isArray(couple.weddings) ? couple.weddings[0] : couple.weddings;
    const coupleName = `${couple.partner1_first_name ?? ""} ${couple.partner1_last_name ?? ""} & ${couple.partner2_first_name ?? ""} ${couple.partner2_last_name ?? ""}`.trim();
    return <Card key={couple.id} className={archived ? "overflow-hidden opacity-80" : "overflow-hidden"}>
      <CardHeader><Users className="mb-2 h-7 w-7" /><CardTitle className="leading-tight">{coupleName}</CardTitle><CardDescription>{couple.email || "Nessuna email inserita"}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {wedding ? <div className="rounded-xl border bg-secondary/60 p-4"><div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4" />Matrimonio</div><p className="mt-2 text-sm text-muted-foreground">{wedding.wedding_date ? new Date(wedding.wedding_date).toLocaleDateString("it-IT") : "Data da definire"}</p>{wedding.venue && <p className="text-sm text-muted-foreground">{wedding.venue}</p>}<p className="mt-1 text-xs font-medium uppercase text-muted-foreground">{wedding.status || "lead"}</p></div> : <div className="rounded-xl border bg-secondary/60 p-4 text-sm text-muted-foreground">Nessuna scheda matrimonio ancora collegata.</div>}
        {archived && couple.archived_at && <p className="text-xs text-muted-foreground">Archiviata il {new Date(couple.archived_at).toLocaleDateString("it-IT")}</p>}
        <Button asChild className="w-full"><Link href={`/protected/coppie/${couple.id}`}>Apri scheda coppia</Link></Button>
        <CoupleArchiveButton coupleId={couple.id} archived={archived} />
      </CardContent>
    </Card>;
  }

  return <main className="min-h-screen bg-background">
    <header className="border-b bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><div><h1 className="text-3xl font-semibold tracking-tight">Gestione Coppie</h1><p className="text-sm text-muted-foreground">Wedding Management • Emozioni Floreali</p></div><Button asChild><Link href="/protected/coppie/nuova"><Plus className="mr-2 h-4 w-4" />Nuova coppia</Link></Button></div></header>
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="mb-2 text-sm font-medium text-muted-foreground">AREA PROFESSIONALE</p><h2 className="text-3xl font-semibold tracking-tight">Le tue coppie</h2><p className="mt-2 text-muted-foreground">Dopo la cerimonia puoi archiviare una coppia senza cancellare dati, documenti o storico.</p></div><Button asChild variant="outline"><Link href="/protected"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link></Button></div>
      <div className="mb-8 rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-medium"><Archive className="h-4 w-4" />Archivio sicuro</div><p className="mt-1 text-sm text-muted-foreground">L'archiviazione nasconde la coppia dall'elenco operativo ma conserva integralmente scheda, matrimonio, preventivi, contratto, pagamenti e documenti. È sempre possibile ripristinarla.</p></div>
      {activeCouples.length > 0 ? <><h3 className="mb-4 text-xl font-semibold tracking-tight">Coppie attive ({activeCouples.length})</h3><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{activeCouples.map((c) => <CoupleCard key={c.id} couple={c} archived={false} />)}</div></> : <Card><CardHeader><CardTitle>Nessuna coppia attiva</CardTitle><CardDescription>Non ci sono coppie attive. Le coppie archiviate restano conservate qui sotto.</CardDescription></CardHeader><CardContent><Button asChild><Link href="/protected/coppie/nuova"><Plus className="mr-2 h-4 w-4" />Inserisci una nuova coppia</Link></Button></CardContent></Card>}
      {archivedCouples.length > 0 && <section className="mt-12"><h3 className="mb-4 text-xl font-semibold tracking-tight">Archivio ({archivedCouples.length})</h3><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{archivedCouples.map((c) => <CoupleCard key={c.id} couple={c} archived />)}</div></section>}
    </section>
  </main>;
}
