import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
          <Link href="/protected" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/60 bg-secondary text-sm font-bold tracking-tight text-primary shadow-sm">EF</div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold tracking-tight text-foreground">Emozioni Floreali</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wedding Management · V8 NEW</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {!hasEnvVars ? <EnvVarWarning /> : <Suspense><AuthButton /></Suspense>}
            <ThemeSwitcher />
          </div>
        </div>
      </nav>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
        {children}
      </div>
      <footer className="border-t bg-secondary/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-center text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p><span className="font-semibold text-foreground">Emozioni Floreali</span> · Wedding & Floral Design</p>
          <p>Wedding Management V8 NEW · Area professionale</p>
        </div>
      </footer>
    </main>
  );
}