"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Punkt der Hauptnavigation. Der gelbe Strich und `aria-current` markieren die
 * Seite, auf der man gerade ist (auch Unterseiten wie /referenten/<id>).
 * Der Rahmen kommt als Kinder (Icon und Beschriftung) vom Server.
 *
 * Unter 920 px (Breakpoint `kopf`, Handy und iPad hochkant) rutscht die
 * Navigation in eine zweite Zeile, siehe `src/app/(public)/layout.tsx`. Die
 * Klassen mit `max-kopf` gehören dazu.
 */
export function NavLink({
  href,
  label,
  hervorheben = false,
  children,
}: {
  href: string;
  label: string;
  /** Der Knopf „Referentenzugang“: gefüllt, nie als aktive Seite markiert. */
  hervorheben?: boolean;
  children: ReactNode;
}) {
  const pfad = usePathname();
  const aktiv = !hervorheben && (pfad === href || pfad.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={aktiv ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        hervorheben
          ? "my-2 ml-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:px-3 max-kopf:order-2 max-kopf:ml-auto"
          : cn(
              "border-b-2 px-2.5 text-sm transition-colors sm:px-3 max-kopf:order-4 max-kopf:flex-auto max-kopf:justify-center max-kopf:py-2.5",
              aktiv
                ? "border-marke-gelb text-foreground"
                : "border-transparent text-muted-foreground hover:border-primary hover:text-foreground",
            ),
      )}
    >
      {children}
    </Link>
  );
}
