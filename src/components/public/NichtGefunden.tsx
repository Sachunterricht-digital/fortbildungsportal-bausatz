import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Inhalt der 404-Seiten (`not-found.tsx`): eine Überschrift und der Weg
 * zurück. Ohne eigenen Rahmen, die Seite steht im jeweiligen Layout.
 */
export function NichtGefunden({
  titel,
  weg,
}: {
  titel: string;
  weg: { href: string; label: string };
}) {
  return (
    <section className="mx-auto max-w-3xl py-6 sm:py-10">
      <h1 className="text-3xl leading-[1.05] font-bold tracking-tight text-balance sm:text-4xl">
        {titel}
      </h1>
      <Link
        href={weg.href}
        className="group mt-6 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        {weg.label}
      </Link>
    </section>
  );
}
