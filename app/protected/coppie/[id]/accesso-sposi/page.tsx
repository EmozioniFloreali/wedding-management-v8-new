import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/protected");
  return { supabase, user };
}

async function setPortalAccess(formData: FormData) {
  "use server";
  const { supabase } = await requireAdmin();
  const coupleId = String(formData.get("couple_id") || "");
  const enabled = String(formData.get("portal_enabled") || "") === "true";
  if (!coupleId) return;

  const { error } = await supabase
    .from("couples")
    .update({ portal_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", coupleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/protected/coppie/${coupleId}`);
  revalidatePath(`/protected/coppie/${coupleId}/accesso-sposi`);
  revalidatePath(`/protected/area-sposi/${coupleId}`);
  redirect(`/protected/coppie/${coupleId}/accesso-sposi?saved=1`);
}

async function AccessoSposiContent({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: couple } = await supabase
    .from("couples")
    .select("id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name,email,portal_enabled")
    .eq("id", id)
    .maybeSingle();

  if (!couple) redirect("/protected/coppie");

  const name = [
    couple.partner1_first_name,
    couple.partner1_last_name,
    couple.partner2_first_name,
    couple.partner2_last_name,
  ].filter(Boolean).join(" ");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/protected/coppie">Coppie</Link>
          <span>/</span>
          <Link href={`/protected/coppie/${id}`}>{name}</Link>
          <span>/</span>
          <span>Accesso Area Sposi</span>
        </div>

        <div className="rounded-2xl border border bg-card p-7 shadow-sm">
          <h1 className="text-3xl font-bold text-foreground">Accesso Area Sposi</h1>
          <p className="mt-2 text-muted-foreground">
            Decidi se questa coppia può accedere alle proprie credenziali e interagire con l&apos;area privata.
            Se l&apos;accesso è disattivato, la gestione resta interamente di tua esclusiva competenza.
          </p>

          {saved === "1" && (
            <div className="mt-5 rounded-xl bg-secondary p-4 text-sm font-semibold text-primary">
              ✓ Impostazione salvata correttamente.
            </div>
          )}

          <div className="mt-6 rounded-2xl border p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-foreground">{name}</div>
                {couple.email && <div className="mt-1 text-sm text-muted-foreground">{couple.email}</div>}
                <div className="mt-2 text-sm">
                  Stato attuale:{" "}
                  <strong className={couple.portal_enabled ? "text-primary" : "text-muted-foreground"}>
                    {couple.portal_enabled ? "Accesso sposi attivo" : "Gestione esclusivamente professionale"}
                  </strong>
                </div>
              </div>

              <form action={setPortalAccess}>
                <input type="hidden" name="couple_id" value={id} />
                <input type="hidden" name="portal_enabled" value={couple.portal_enabled ? "false" : "true"} />
                <button className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">
                  {couple.portal_enabled ? "Disattiva accesso sposi" : "Abilita accesso sposi"}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Importante:</strong> disattivare questo accesso non cancella la coppia, il progetto,
            i preventivi, i contratti, i documenti o i dati già registrati. Impedisce semplicemente alla coppia
            di entrare e interagire con l&apos;Area Sposi.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/protected/coppie/${id}`} className="ef-card px-5 py-3 font-semibold">
              Torna alla scheda coppia
            </Link>
            <Link href="/protected/coppie" className="ef-card px-5 py-3 font-semibold">
              Elenco coppie
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}


export default function AccessoSposiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background p-10">
          <div className="mx-auto max-w-4xl ef-card p-7">
            Caricamento…
          </div>
        </main>
      }
    >
      <AccessoSposiContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
