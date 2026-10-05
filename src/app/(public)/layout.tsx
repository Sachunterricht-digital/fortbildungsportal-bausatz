import { ladeSchulamt } from "@/lib/schulamt";
import Link from "next/link";
import { CalendarDays, Download, ListFilter, LogIn, Users } from "lucide-react";

import { NavLink } from "@/components/public/NavLink";
import { T } from "@/texte/de";

const NAVIGATION = [
  { href: "/fortbildungen", label: T.aussen.layout.nav.alleFortbildungen, icon: ListFilter },
  { href: "/kalender", label: T.aussen.layout.nav.kalender, icon: CalendarDays },
  { href: "/referenten", label: T.aussen.layout.nav.referenten, icon: Users },
  // Platzhalter, bis die Kataloge als PDF vorliegen (siehe Startseite,
  // Abschnitt „Kataloge 26/27“). Sichtbar, aber ausgegraut und ohne Link —
  // gleiches Muster wie AUSGEGRAUT in der Admin-Seitenleiste.
  { href: null, label: T.aussen.layout.nav.kataloge, icon: Download, ausgegraut: true },
  { href: "/login", label: T.aussen.layout.nav.redaktion, icon: LogIn, hervorheben: true },
] as const;

export default async function OeffentlichesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const schulamt = await ladeSchulamt();
  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {T.aussen.layout.skipLink}
      </a>

      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-sm">
        {/* Unter 920 px (Breakpoint `kopf`, Handy und iPad hochkant) bricht die
            Navigation in eine zweite Zeile um: Marke und Knopf oben, die Punkte
            darunter, getrennt durch eine Linie. Einzeilig passen Marke, vier
            Punkte und Knopf erst ab etwa 905 px, schmaler überlappte die Marke
            den ersten Punkt. */}
        <div className="mx-auto flex max-w-6xl items-stretch gap-x-1 px-3 sm:px-4 kopf:gap-x-6 max-kopf:flex-wrap max-kopf:gap-x-3 max-kopf:after:order-3 max-kopf:after:h-px max-kopf:after:shrink-0 max-kopf:after:grow-0 max-kopf:after:bg-border/80 max-sm:after:-mx-3 max-sm:after:basis-[calc(100%+1.5rem)] sm:max-kopf:after:-mx-4 sm:max-kopf:after:basis-[calc(100%+2rem)]">
          <Link
            href="/"
            aria-label={T.aussen.layout.startseiteAriaLabel}
            className="flex min-w-0 items-center gap-2 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring max-kopf:order-1 sm:gap-3"
          >
            <span className="leading-tight">
              <span className="block font-heading text-base font-bold tracking-tight text-primary">
                {T.aussen.layout.marke}
              </span>
              <span className="hidden max-w-56 truncate text-xs text-muted-foreground min-[420px]:block">
                {schulamt.kurzname}
              </span>
            </span>
          </Link>

          <nav className="ml-auto flex items-stretch max-kopf:contents">
            {NAVIGATION.map((eintrag) => {
              const { label, icon: Icon } = eintrag;

              if ("ausgegraut" in eintrag && eintrag.ausgegraut) {
                return (
                  <span
                    key={label}
                    aria-disabled="true"
                    title={T.allgemein.kommtSpaeterTitel}
                    className="flex cursor-not-allowed items-center gap-2 border-b-2 border-transparent px-2.5 text-sm text-muted-foreground/50 max-kopf:order-4 max-kopf:flex-auto max-kopf:justify-center max-kopf:py-2.5 sm:px-3"
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="sr-only sm:not-sr-only">{label}</span>
                  </span>
                );
              }

              const hervorheben = "hervorheben" in eintrag && eintrag.hervorheben;
              return (
                <NavLink key={label} href={eintrag.href ?? "#"} label={label} hervorheben={hervorheben}>
                  <Icon className="size-4" aria-hidden />
                  <span className={hervorheben ? "inline" : "sr-only sm:not-sr-only"}>
                    {label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="inhalt" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
        {children}
      </main>

      <footer className="mt-16 border-t border-border bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-x-8 gap-y-4 px-4 py-8 text-sm">
          <p className="text-muted-foreground">
            {schulamt.name}
          </p>

          <nav className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link href="/impressum" className="hover:text-foreground">
              {T.aussen.layout.footer.impressum}
            </Link>
            <Link href="/datenschutz" className="hover:text-foreground">
              {T.aussen.layout.footer.datenschutz}
            </Link>
            <a href="/api/ics" className="hover:text-foreground">
              {T.aussen.layout.footer.kalenderAbo}
            </a>
            <Link href="/login" className="hover:text-foreground">
              {T.aussen.layout.footer.anmeldungReferenten}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
