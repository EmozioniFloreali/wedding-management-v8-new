import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function statusLabel(s: string | null | undefined) {
  if (s === "presentato") return "Preventivo presentato";
  if (s === "confermato") return "Preventivo confermato";
  if (s === "in_attesa_conferma") return "In attesa di conferma";
  return s || "—";
}

export default async function ContrattiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: coupleId } = await params;
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

  if (profile?.role !== "admin") redirect("/protected");

  const { data: couple } = await supabase
    .from("couples")
    .select(
      "id,partner1_first_name,partner1_last_name,partner2_first_name,partner2_last_name"
    )
    .eq("id", coupleId)
    .maybeSingle();

  if (!couple) redirect("/protected/coppie");

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id,quote_id,floral_project_id,version_number,contract_date,total_amount,deposit_amount,balance_amount,notes,signed_by_client,signed_at,created_at"
    )
    .eq("couple_id", coupleId)
    .order("version_number", { ascending: false });

  const quoteIds = (contracts || [])
    .map((contract) => contract.quote_id)
    .filter(Boolean);

  const { data: quotes } = quoteIds.length
    ? await supabase
        .from("quotes")
        .select("id,version_number,status,total_amount,presented_at,confirmed_at")
        .in("id", quoteIds)
    : { data: [] };

  const quoteMap = new Map((quotes || []).map((quote) => [quote.id, quote]));

  const contractIds = (contracts || []).map((contract) => contract.id);

  const { data: items } = contractIds.length
    ? await supabase
        .from("contract_items")
        .select(
          "id,contract_id,quote_item_id,floral_project_item_id,area,description,quantity,unit,notes,sort_order"
        )
        .in("contract_id", contractIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const itemsByContract = new Map<string, typeof items>();
  for (const item of items || []) {
    const current = itemsByContract.get(item.contract_id) || [];
    current.push(item);
    itemsByContract.set(item.contract_id, current);
  }

  const coupleName = [
    couple.partner1_first_name,
    couple.partner1_last_name,
    couple.partner2_first_name,
    couple.partner2_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Link href="/protected/coppie">Coppie</Link>
              <span>/</span>
              <Link href={`/protected/coppie/${coupleId}`}>{coupleName}</Link>
              <span>/</span>
              <span>Contratti</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contratti</h1>
            <p className="mt-1 text-muted-foreground">
              Storico dei contratti generati automaticamente dai preventivi presentati.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/protected/coppie/${coupleId}/preventivo`}
              className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
            >
              Preventivi
            </Link>
            <Link
              href={`/protected/coppie/${coupleId}`}
              className="ef-button-primary"
            >
              Scheda coppia
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-primary/20 bg-secondary p-5">
          <p className="font-semibold text-primary">
            Generazione automatica attiva
          </p>
          <p className="mt-1 text-sm text-primary">
            Ogni nuovo preventivo presentato genera una nuova versione del contratto,
            mantenendo le versioni precedenti.
          </p>
        </div>

        {!contracts?.length ? (
          <section className="rounded-2xl border border-dashed bg-card p-8 text-center">
            <h2 className="text-xl font-semibold tracking-tight">Nessun contratto</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Il primo contratto verrà generato automaticamente quando un preventivo
              verrà presentato.
            </p>
          </section>
        ) : (
          <div className="space-y-6">
            {contracts.map((contract) => {
              const quote = contract.quote_id ? quoteMap.get(contract.quote_id) : null;
              const contractItems = itemsByContract.get(contract.id) || [];
              const signed = Boolean(contract.signed_by_client);

              return (
                <section
                  key={contract.id}
                  className="ef-card p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                          Contratto v{contract.version_number}
                        </span>
                        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-primary">
                          {statusLabel(quote?.status)}
                        </span>
                        {signed ? (
                          <span className="rounded-full bg-accent/20 px-3 py-1 text-sm font-semibold text-accent-foreground">
                            Firmato
                          </span>
                        ) : (
                          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-foreground">
                            Non firmato
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Generato il{" "}
                        {contract.created_at
                          ? new Date(contract.created_at).toLocaleDateString("it-IT")
                          : "—"}
                        {quote?.version_number
                          ? ` · dal Preventivo v${quote.version_number}`
                          : ""}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-sm text-muted-foreground">Totale contratto</p>
                      <p className="text-3xl font-semibold tracking-tight text-foreground">
                        {money(contract.total_amount)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                        <a
                          href={`/protected/coppie/${coupleId}/contratti/documento?contract_id=${contract.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ef-button-primary px-3 py-2"
                        >
                          PDF contratto
                        </a>
                        <a
                          href={`/protected/coppie/${coupleId}/contratti/documento?contract_id=${contract.id}&format=docx`}
                          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground"
                        >
                          DOCX contratto
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-background p-4">
                      <p className="text-sm text-muted-foreground">Acconto</p>
                      <p className="mt-1 font-bold">{money(contract.deposit_amount)}</p>
                    </div>
                    <div className="rounded-xl bg-background p-4">
                      <p className="text-sm text-muted-foreground">Saldo</p>
                      <p className="mt-1 font-bold">{money(contract.balance_amount)}</p>
                    </div>
                    <div className="rounded-xl bg-background p-4">
                      <p className="text-sm text-muted-foreground">Data contratto</p>
                      <p className="mt-1 font-bold">
                        {contract.contract_date
                          ? new Date(contract.contract_date).toLocaleDateString("it-IT")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-bold">Voci contrattuali</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Le voci sono state copiate automaticamente dal preventivo presentato.
                    </p>

                    <div className="mt-4 space-y-2">
                      {contractItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border bg-background p-4"
                        >
                          <div className="font-semibold">{item.description}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {item.quantity} {item.unit}
                            {item.area ? ` · ${item.area}` : ""}
                          </div>
                          {item.notes ? (
                            <div className="mt-2 text-sm text-muted-foreground">{item.notes}</div>
                          ) : null}
                        </div>
                      ))}
                      {!contractItems.length && (
                        <p className="text-sm text-muted-foreground">
                          Nessuna voce associata.
                        </p>
                      )}
                    </div>
                  </div>

                  {contract.notes ? (
                    <div className="mt-6 rounded-xl border bg-secondary/50 p-4">
                      <p className="text-sm font-semibold">Note</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {contract.notes}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t pt-5 text-sm text-muted-foreground">
                    {contract.signed_at
                      ? `Firmato il ${new Date(contract.signed_at).toLocaleDateString("it-IT")}`
                      : "La firma della coppia non è ancora registrata."}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
