"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Settings,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Download,
  ExternalLink,
  FileText,
  LogOut,
  Menu,
  Vote,
  Settings2,
  Tags,
  Users,
  X,
} from "lucide-react";

import { logout } from "@/actions/auth";
import { type Rolle } from "@/constants/fortbildung";
import { AUSGEGRAUT } from "@/constants/funktionen";
import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

const ALLE: Rolle[] = ["ADMIN", "REDAKTEUR", "REFERENT"];
const REDAKTION: Rolle[] = ["ADMIN", "REDAKTEUR"];
const NUR_ADMIN: Rolle[] = ["ADMIN"];

interface Eintrag {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  rollen: Rolle[];
  /** Sichtbar, aber nicht anklickbar — Funktion ist vorerst ausgegraut. */
  ausgegraut?: boolean;
}

const GRUPPEN: Array<{ titel: string; eintraege: Eintrag[] }> = [
  {
    titel: T.zugang.seitenleiste.gruppeArbeit,
    eintraege: [
      { href: "/admin", label: T.zugang.seitenleiste.fortbildungen, icon: CalendarDays, rollen: ALLE },
      { href: "/admin/kalender", label: T.zugang.seitenleiste.planungskalender, icon: CalendarRange, rollen: ALLE, ausgegraut: AUSGEGRAUT.planungskalender },
      { href: "/admin/katalog", label: T.zugang.seitenleiste.fortbildungskatalog, icon: BookOpen, rollen: ALLE },
      { href: "/admin/auswertung", label: T.zugang.seitenleiste.auswertung, icon: BarChart3, rollen: ALLE, ausgegraut: AUSGEGRAUT.auswertung },
    ],
  },
  {
    titel: T.zugang.seitenleiste.gruppeStammdaten,
    eintraege: [
      { href: "/admin/referenten", label: T.zugang.seitenleiste.referenten, icon: Users, rollen: REDAKTION },
      { href: "/admin/schlagworte", label: T.zugang.seitenleiste.schlagworte, icon: Tags, rollen: REDAKTION },
      { href: "/admin/umfragen", label: T.umfrage.seitenleiste, icon: Vote, rollen: NUR_ADMIN },
    ],
  },
  {
    titel: T.zugang.seitenleiste.gruppeSystem,
    eintraege: [
      { href: "/admin/import", label: T.zugang.seitenleiste.fibsImport, icon: Download, rollen: REDAKTION, ausgegraut: AUSGEGRAUT.fibsImport },
      ...(AUSGEGRAUT.einrichtung ? [] : [{ href: "/admin/einrichtung", label: T.zugang.seitenleiste.einrichtung, icon: Settings, rollen: NUR_ADMIN }]),
      { href: "/admin/texte", label: T.zugang.seitenleiste.rechtstexte, icon: FileText, rollen: NUR_ADMIN },
    ],
  },
];

export function Seitenleiste({ name, rolle, schulamtName }: { name: string; rolle: Rolle; schulamtName: string }) {
  const [offen, setOffen] = useState(false);
  const [mobil, setMobil] = useState(false);
  const ausloeserRef = useRef<HTMLButtonElement>(null);
  const schliessenRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);

  const schliesseNavigation = useCallback(() => {
    setOffen(false);
    window.requestAnimationFrame(() => ausloeserRef.current?.focus());
  }, []);

  useEffect(() => {
    const abfrage = window.matchMedia("(max-width: 1023px)");
    const aktualisieren = () => {
      setMobil(abfrage.matches);
      if (!abfrage.matches) setOffen(false);
    };
    aktualisieren();
    abfrage.addEventListener("change", aktualisieren);
    return () => abfrage.removeEventListener("change", aktualisieren);
  }, []);

  useEffect(() => {
    if (!mobil || !offen) return;

    const beiTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === "Escape") {
        ereignis.preventDefault();
        schliesseNavigation();
        return;
      }

      if (ereignis.key !== "Tab") return;
      const fokusierbare = Array.from(
        navigationRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.tabIndex >= 0 && !element.hasAttribute("inert"));
      const erstes = fokusierbare[0];
      const letztes = fokusierbare.at(-1);

      if (!erstes || !letztes) return;
      if (ereignis.shiftKey && document.activeElement === erstes) {
        ereignis.preventDefault();
        letztes.focus();
      } else if (!ereignis.shiftKey && document.activeElement === letztes) {
        ereignis.preventDefault();
        erstes.focus();
      }
    };

    document.addEventListener("keydown", beiTaste);
    window.requestAnimationFrame(() => schliessenRef.current?.focus());
    return () => document.removeEventListener("keydown", beiTaste);
  }, [mobil, offen, schliesseNavigation]);

  return (
    <>
      <a
        href="#hauptinhalt"
        className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only"
      >
        {T.zugang.seitenleiste.zumInhalt}
      </a>

      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          ref={ausloeserRef}
          type="button"
          onClick={() => setOffen(true)}
          aria-label={T.zugang.seitenleiste.navigationOeffnen}
          aria-controls="admin-navigation"
          aria-expanded={offen}
          className="flex size-9 items-center justify-center rounded-md border border-border bg-card transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          <Menu className="size-4" aria-hidden />
        </button>
        <Wortmarke schulamtName={schulamtName} />
      </div>

      {offen ? (
        <button
          type="button"
          aria-label={T.zugang.seitenleiste.navigationSchliessen}
          onClick={schliesseNavigation}
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <nav
        id="admin-navigation"
        ref={navigationRef}
        aria-label={T.zugang.seitenleiste.bereiche}
        aria-hidden={mobil && !offen ? true : undefined}
        inert={mobil && !offen ? true : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-sidebar shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
          offen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-5">
          <Wortmarke schulamtName={schulamtName} onNavigate={() => setOffen(false)} />
          <button
            ref={schliessenRef}
            type="button"
            onClick={schliesseNavigation}
            aria-label={T.zugang.seitenleiste.navigationSchliessen}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 lg:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
          {GRUPPEN.map((gruppe) => {
            const sichtbar = gruppe.eintraege.filter((eintrag) => eintrag.rollen.includes(rolle));
            if (sichtbar.length === 0) return null;

            return (
              <section key={gruppe.titel} aria-label={gruppe.titel}>
                <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">{gruppe.titel}</p>
                <ul className="space-y-1">
                  {sichtbar.map((eintrag) => (
                    <li key={eintrag.href}>
                      <Punkt eintrag={eintrag} onNavigate={() => setOffen(false)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="space-y-1 border-t border-border p-3">
          <Link href="/" onClick={() => setOffen(false)} className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            {T.zugang.seitenleiste.frontendAnsehen}
          </Link>

          <Link
            href="/admin/konto#konto"
            onClick={() => setOffen(false)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings2 className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-medium text-foreground">Kontoeinstellungen</span>
              <span className="block truncate text-xs">{name}</span>
            </span>
          </Link>

          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <LogOut className="size-4 shrink-0" aria-hidden />
              {T.zugang.seitenleiste.abmelden}
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}

function Punkt({ eintrag, onNavigate }: { eintrag: Eintrag; onNavigate: () => void }) {
  const pfad = usePathname();
  const aktiv = eintrag.href === "/admin" ? pfad === "/admin" || pfad.startsWith("/admin/fortbildungen") : pfad.startsWith(eintrag.href);
  const Icon = eintrag.icon;

  if (eintrag.ausgegraut) {
    return (
      <span
        aria-disabled="true"
        title={T.allgemein.kommtSpaeterTitel}
        className="zeile flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-muted-foreground/50"
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate">{eintrag.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={eintrag.href}
      onClick={onNavigate}
      aria-current={aktiv ? "page" : undefined}
      className={cn(
        "zeile relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
        aktiv
          ? "bg-accent font-medium text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{eintrag.label}</span>
    </Link>
  );
}

function Wortmarke({ onNavigate, schulamtName }: { onNavigate?: () => void; schulamtName: string }) {
  return (
    <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35">
      {/* eslint-disable-next-line @next/next/no-img-element -- statisches Logo */}
      <img src="/bilder/bdb-logo.svg" alt="" aria-hidden className="h-7 w-auto shrink-0" />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-[-0.01em] text-primary">Fortbildungen</span>
        <span className="mt-0.5 block max-w-40 truncate text-xs text-muted-foreground" title={schulamtName}>{schulamtName}</span>
      </span>
    </Link>
  );
}
