import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

async function salvaMatrimonio(coupleId: string, formData: FormData) {
  "use server";
  const { supabase } = await requireAdmin();
  const weddingDate = String(formData.get("wedding_date") || "").trim();
  const weddingTime = String(formData.get("wedding_time") || "").trim();
  const venue = String(formData.get("venue") || "").trim();
  const ceremonyLocation = String(formData.get("ceremony_location") || "").trim();
  const church = String(formData.get("church") || "").trim();
  const receptionHall = String(formData.get("reception_hall") || "").trim();
  const status = String(formData.get("status") || "lead").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!weddingDate) redirect(`/protected/coppie/${coupleId}/matrimonio?error=La%20data%20del%20matrimonio%20%C3%A8%20obbligatoria`);

  const payload = {
    wedding_date: weddingDate,
    wedding_time: weddingTime || null,
    venue: venue || null,
    ceremony_location: ceremonyLocation || null,
    church: church || null,
    reception_hall: receptionHall || null,
    status: ["lead", "confirmed", "completed", "cancelled"].includes(status) ? status : "lead",
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existingWedding } = await supabase
    .from("weddings")
    .select("id")
    .eq("couple_id", coupleId)
    .order("wedding_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { error } = existingWedding?.id
    ? await supabase.from("weddings").update(payload).eq("id", existingWedding.id).eq("couple_id", coupleId)
    : await supabase.from("weddings").insert({ ...payload, couple_id: coupleId });

  if (error) redirect(`/protected/coppie/${coupleId}/matrimonio?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/protected/coppie/${coupleId}`);
  revalidatePath(`/protected/coppie/${coupleId}/matrimonio`);
  redirect(`/protected/coppie/${coupleId}`);
}

export default async function MatrimonioPage({ params, searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const { data: couple, error: coupleError } = await supabase.from("couples").select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name").eq("id", id).single();
  if (coupleError || !couple) redirect("/protected/coppie");
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id,wedding_date,wedding_time,venue,ceremony_location,church,reception_hall,status,notes")
    .eq("couple_id", id)
    .order("wedding_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const coupleName = `${couple.partner1_first_name} ${couple.partner1_last_name} & ${couple.partner2_first_name} ${couple.partner2_last_name}`;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><div><h1 className="text-2xl font-bold tracking-tight">Dati matrimonio</h1><p className="text-sm text-muted-foreground">Wedding Management • Emozioni Floreali</p></div><Button asChild variant="outline"><Link href={`/protected/coppie/${id}`}><ArrowLeft className="mr-2 h-4 w-4" />Torna alla scheda</Link></Button></div></header>
      <section className="mx-auto max-w-4xl px-6 py-10"><div className="mb-8"><p className="mb-2 text-sm font-medium text-muted-foreground">AREA PROFESSIONALE</p><h2 className="text-3xl font-bold tracking-tight">Matrimonio di {coupleName}</h2><p className="mt-2 text-muted-foreground">Inserisci o aggiorna i dati principali del matrimonio.</p></div>
        {error && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
        <form action={salvaMatrimonio.bind(null, id)} className="space-y-6">
          <Card><CardHeader><CardTitle>Data e ora</CardTitle><CardDescription>Quando si svolgerà il matrimonio?</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="wedding_date">Data matrimonio *</Label><Input id="wedding_date" name="wedding_date" type="date" defaultValue={wedding?.wedding_date || ""} required /></div><div className="space-y-2"><Label htmlFor="wedding_time">Ora matrimonio</Label><Input id="wedding_time" name="wedding_time" type="time" defaultValue={wedding?.wedding_time ? String(wedding.wedding_time).slice(0,5) : ""} /></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Luoghi</CardTitle><CardDescription>Cerimonia, chiesa e ricevimento.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label htmlFor="venue">Location principale</Label><Input id="venue" name="venue" defaultValue={wedding?.venue || ""} placeholder="Es. Villa, Hotel, Tenuta..." /></div><div className="space-y-2"><Label htmlFor="ceremony_location">Luogo cerimonia</Label><Input id="ceremony_location" name="ceremony_location" defaultValue={wedding?.ceremony_location || ""} placeholder="Es. Chiesa / Cerimonia civile" /></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="church">Chiesa</Label><Input id="church" name="church" defaultValue={wedding?.church || ""} placeholder="Nome della chiesa" /></div><div className="space-y-2"><Label htmlFor="reception_hall">Sala ricevimento</Label><Input id="reception_hall" name="reception_hall" defaultValue={wedding?.reception_hall || ""} placeholder="Nome della sala" /></div></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Stato della pratica</CardTitle><CardDescription>Stato attuale del rapporto con la coppia.</CardDescription></CardHeader><CardContent><select id="status" name="status" defaultValue={wedding?.status || "lead"} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"><option value="lead">Contatto iniziale</option><option value="confirmed">Matrimonio confermato</option><option value="completed">Matrimonio completato</option><option value="cancelled">Annullato</option></select></CardContent></Card>
          <Card><CardHeader><CardTitle>Note</CardTitle><CardDescription>Annotazioni relative al matrimonio.</CardDescription></CardHeader><CardContent><textarea id="notes" name="notes" defaultValue={wedding?.notes || ""} rows={6} placeholder="Inserisci eventuali note..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring" /></CardContent></Card>
          <div className="flex justify-end gap-3"><Button asChild variant="outline"><Link href={`/protected/coppie/${id}`}>Annulla</Link></Button><Button type="submit"><Save className="mr-2 h-4 w-4" />Salva matrimonio</Button></div>
        </form>
      </section>
    </main>
  );
}
