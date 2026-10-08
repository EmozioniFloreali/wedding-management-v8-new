import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

function s(v: FormDataEntryValue | null) { return v == null ? "" : String(v).trim(); }

async function markRead(fd: FormData) {
  "use server";
  const { supabase, user } = await requireAdmin();
  const id = s(fd.get("id"));
  if (!id) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/protected/notifiche");
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id,couple_id,wedding_id,message_id,title,body,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-4xl px-6 py-10"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-bold text-foreground">Notifiche</h1><p className="mt-1 text-muted-foreground">Messaggi, appuntamenti e aggiornamenti delle coppie.</p></div><Link href="/protected" className="ef-card px-4 py-2 font-medium">Dashboard</Link></div><section className="space-y-3">{(notifications || []).length === 0 ? <div className="ef-card p-8 text-center text-muted-foreground">Nessuna notifica.</div> : (notifications || []).map(n => {
    const target = n.couple_id ? `/protected/coppie/${n.couple_id}/messaggi` : "/protected";
    return <div key={n.id} className={`ef-card p-5 shadow-sm ${n.read_at ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-foreground">{n.title}</div>
          {n.body && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{n.body}</p>}
          <div className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(n.created_at))}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={target} className="rounded-lg border px-3 py-2 text-sm font-medium">Apri</Link>
          {!n.read_at && <form action={markRead}><input type="hidden" name="id" value={n.id}/><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Letta</button></form>}
        </div>
      </div>
    </div>;
  })}</section></div></main>;
}
