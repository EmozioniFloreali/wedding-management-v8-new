import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

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
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2 text-sm text-slate-500">
              <Link href="/protected/coppie">Coppie</Link>
              <span>/</span>
              <Link href={`/protected/coppie/${coupleId}`}>{coupleName}</Link>
              <span>/</span>
              <span>Contratti</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Contratti</h1>
            <p className="mt-1 text-slate-600">
              Storico dei contratti generati automaticamente dai preventivi presentati.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/protected/coppie/${coupleId}/preventivo`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold"
            >
              Preventivi
            </Link>
            <Link
              href={`/protected/coppie/${coupleId}`}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Scheda coppia
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-900">
            Generazione automatica attiva
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Ogni nuovo preventivo presentato genera una nuova versione del contratto,
            mantenendo le versioni precedenti.
          </p>
        </div>

        {!contracts?.length ? (
          <section className="rounded-2xl border border-dashed bg-white p-8 text-center">
            <h2 className="text-xl font-bold">Nessun contratto</h2>
            <p className="mt-2 text-sm text-slate-500">
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
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                          Contratto v{contract.version_number}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                          {statusLabel(quote?.status)}
                        </span>
                        {signed ? (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                            Firmato
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                            Non firmato
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
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
                      <p className="text-sm text-slate-500">Totale contratto</p>
                      <p className="text-3xl font-bold text-slate-900">
                        {money(contract.total_amount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Acconto</p>
                      <p className="mt-1 font-bold">{money(contract.deposit_amount)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Saldo</p>
                      <p className="mt-1 font-bold">{money(contract.balance_amount)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Data contratto</p>
                      <p className="mt-1 font-bold">
                        {contract.contract_date
                          ? new Date(contract.contract_date).toLocaleDateString("it-IT")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-bold">Voci contrattuali</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Le voci sono state copiate automaticamente dal preventivo presentato.
                    </p>

                    <div className="mt-4 space-y-2">
                      {contractItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border bg-slate-50 p-4"
                        >
                          <div className="font-semibold">{item.description}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {item.quantity} {item.unit}
                            {item.area ? ` · ${item.area}` : ""}
                          </div>
                          {item.notes ? (
                            <div className="mt-2 text-sm text-slate-600">{item.notes}</div>
                          ) : null}
                        </div>
                      ))}
                      {!contractItems.length && (
                        <p className="text-sm text-slate-500">
                          Nessuna voce associata.
                        </p>
                      )}
                    </div>
                  </div>

                  {contract.notes ? (
                    <div className="mt-6 rounded-xl border bg-white p-4">
                      <p className="text-sm font-semibold">Note</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                        {contract.notes}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t pt-5 text-sm text-slate-500">
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
