import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import { EnvVarWarning } from "@/components/env-var-warning";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/70 bg-secondary font-bold text-primary">EF</div>
            <div><div className="font-semibold">Emozioni Floreali</div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wedding Management · V8 NEW</div></div>
          </Link>
          <div className="flex items-center gap-2">
            {!hasEnvVars ? <EnvVarWarning /> : <Suspense><AuthButton /></Suspense>}
            <ThemeSwitcher />
          </div>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="ef-eyebrow">Wedding & Floral Design</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            Ogni matrimonio, progettato con cura. Ogni emozione, custodita.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            La piattaforma professionale di Emozioni Floreali per organizzare coppie, progetto floreale, agenda, preventivi, contratti, pagamenti e Area Sposi in un unico spazio.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/protected" className="ef-button-primary">Accedi alla piattaforma</Link>
            <Link href="/auth/login" className="ef-button-secondary">Accesso riservato</Link>
          </div>
          <div className="mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["Coppie", "Schede e storico"],
              ["Progetto floreale", "Idee e allestimenti"],
              ["Area Sposi", "Documenti e comunicazioni"],
            ].map(([title, text]) => (
              <div key={title} className="ef-card p-4">
                <p className="font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="rounded-[2rem] border border-accent/40 bg-secondary/60 p-5 shadow-xl">
            <div className="rounded-[1.5rem] border bg-card p-6 shadow-sm">
              <p className="ef-eyebrow">Emozioni Floreali</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-secondary p-5"><p className="text-sm text-muted-foreground">Gestione completa</p><p className="mt-2 text-2xl font-semibold">Wedding</p></div>
                <div className="rounded-2xl bg-secondary p-5"><p className="text-sm text-muted-foreground">Creatività</p><p className="mt-2 text-2xl font-semibold">Floral Design</p></div>
                <div className="rounded-2xl border p-5 sm:col-span-2"><p className="text-sm text-muted-foreground">Una regia digitale per seguire ogni fase, dal primo contatto alla cerimonia e oltre.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full w-4/5 rounded-full bg-primary"/></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t py-7 text-center text-xs text-muted-foreground">Emozioni Floreali di Giusy Surace · Wedding & Floral Design</footer>
    </main>
  );
}