import { redirect } from "next/navigation";
import { AUSGEGRAUT } from "@/constants/funktionen";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { istEinrichtungOffen, ladeSchulamt } from "@/lib/schulamt";
import { prisma } from "@/lib/prisma";
import { EinrichtungsFormular } from "@/components/admin/EinrichtungsFormular";
import { EinrichtungsAbschluss } from "@/components/admin/EinrichtungsAbschluss";
import { Schulimport } from "@/components/admin/Schulimport";
import { SystemtextFormular } from "@/components/admin/SystemtextFormular";
import { Button } from "@/components/ui/button";
import type { SuchParameter } from "@/lib/filter";

export const metadata = { title: "Einrichtung" };
const SCHRITTE = ["Schulamt", "Schulen", "Rechtstexte", "Abschluss"];

export default async function EinrichtungsSeite({ searchParams }: { searchParams: Promise<SuchParameter> }) {
  await requireRole("ADMIN");
  // Abgetrennt (src/constants/funktionen.ts): Rechtstexte liegen unter /admin/texte.
  if (AUSGEGRAUT.einrichtung) redirect("/admin");
  const params = await searchParams;
  const [profil, offen] = await Promise.all([ladeSchulamt(), istEinrichtungOffen()]);
  const schrittWert = Array.isArray(params.schritt) ? params.schritt[0] : params.schritt;
  const schritt = /^[1-4]$/.test(schrittWert ?? "") ? Number(schrittWert) : offen ? 1 : 0;
  const [texte, orte, suchbegriffe] = await Promise.all([
    schritt >= 3 ? prisma.systemSetting.findMany({ where: { id: { in: ["impressum", "datenschutz"] } } }) : Promise.resolve([]),
    schritt >= 2 ? prisma.veranstaltungsort.count({ where: { istOnline: false, aktiv: true } }) : Promise.resolve(0),
    schritt === 4 ? prisma.schlagwort.findMany({ where: { fuerFibsImport: true }, select: { name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return <div className="max-w-4xl space-y-6">
    <div><p className="etikett text-primary">Eigene Installation · Bayern</p><h1 className="mt-1 text-3xl font-semibold">{schritt ? "Installationsassistent" : "Einrichtung"}</h1><p className="mt-2 text-sm text-muted-foreground">{schritt ? "Richten Sie das Fortbildungsportal Schritt für Schritt für Ihr Schulamt ein. Gespeicherte Angaben bleiben erhalten; Sie können später weiterarbeiten." : "Passen Sie das Fortbildungsportal an Ihr Schulamt an."} FIBS, DigCompEdu Bavaria und der bayerische Ferienkalender stehen weiterhin zur Verfügung.</p></div>
    {schritt ? <nav aria-label="Einrichtungsschritte"><ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">{SCHRITTE.map((titel, index) => <li key={titel}><Link className={`block rounded-lg border px-3 py-3 text-sm ${index + 1 === schritt ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} aria-current={index + 1 === schritt ? "step" : undefined} href={`/admin/einrichtung?schritt=${index + 1}`}>{index + 1}. {titel}</Link></li>)}</ol></nav> : <Button nativeButton={false} variant="outline" render={<Link href="/admin/einrichtung?schritt=1">Installationsassistent öffnen</Link>} />}
    {schritt <= 1 ? <EinrichtungsFormular profil={profil} assistent={schritt === 1} /> : null}
    {schritt === 2 ? <>
      <p className="text-sm">{orte} aktive Schulen / Veranstaltungsorte sind bereits vorhanden. Der Online-Ort ist separat eingerichtet.</p>
      <Schulimport />
      <div className="flex flex-wrap gap-4 text-sm"><Link className="underline" href="/admin/einrichtung?schritt=3">Weiter zu den Rechtstexten (Schulimport auch später möglich)</Link></div>
    </> : null}
    {schritt === 3 ? <>
      <p className="text-sm text-muted-foreground">Ersetzen Sie die Platzhalter durch die Angaben und geprüften Texte Ihres Schulamts. Speichern Sie beide Texte einzeln, bevor Sie weitergehen. Markdown ist möglich.</p>
      <SystemtextFormular id="impressum" ueberschrift="Impressum" wert={texte.find((text) => text.id === "impressum")?.value ?? ""} />
      <SystemtextFormular id="datenschutz" ueberschrift="Datenschutzerklärung" wert={texte.find((text) => text.id === "datenschutz")?.value ?? ""} />
      <Button nativeButton={false} render={<Link href="/admin/einrichtung?schritt=4">Weiter zur Abschlussprüfung</Link>} />
    </> : null}
    {schritt === 4 ? <section className="space-y-6 rounded-xl border bg-card p-5">
      <div><h2 className="text-lg font-semibold">Ihre Einrichtung</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Schulamt</dt><dd>{profil.name}</dd></div><div><dt className="text-muted-foreground">Zielgruppe / Region</dt><dd>{profil.zielgruppe} · {profil.angebotsRegion}</dd></div><div><dt className="text-muted-foreground">Aktive Schulen / Orte</dt><dd>{orte}</dd></div><div><dt className="text-muted-foreground">FIBS-Suchbegriffe</dt><dd>{suchbegriffe.map((begriff) => begriff.name).join(", ") || "Noch keine ausgewählt"}</dd></div></dl></div>
      <p className="text-sm text-muted-foreground">Der automatische FIBS-Import ist separat im Betrieb freizuschalten. <Link className="underline" href="/admin/schlagworte">Suchbegriffe bearbeiten</Link>. Schulen können jederzeit nachgetragen werden.</p>
      <p className="text-sm text-muted-foreground">Startseitentext: {profil.startText}</p>
      <EinrichtungsAbschluss />
    </section> : null}
    {!schritt ? <>
      <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Schulen und Veranstaltungsorte</h2><p className="mt-2 text-sm text-muted-foreground">Übernehmen Sie Ihr Schulverzeichnis mit CSV-Vorlage und KI-Arbeitsauftrag. Der Import zeigt Änderungen vor dem Speichern an.</p><Link className="mt-3 inline-block text-sm underline underline-offset-4" href="/admin/einrichtung?schritt=2#schulimport">Zum Schulimport</Link></section>
      <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Weitere Einrichtung</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm"><li><Link className="underline" href="/admin/texte">Impressum und Datenschutzerklärung</Link> auf das zuständige Schulamt abstimmen.</li><li><Link className="underline" href="/admin/schlagworte">FIBS-Suchbegriffe</Link> auswählen und vorhandene Begriffe prüfen.</li><li>Ein eigenes Logo für PDF-Aushänge kann beim Betrieb als <code>public/logo.png</code> oder <code>public/logo.jpg</code> hinterlegt werden.</li></ul></section>
    </> : null}
    {schritt > 1 ? <Link className="inline-block text-sm underline underline-offset-4" href={`/admin/einrichtung?schritt=${schritt - 1}`}>Zurück zu Schritt {schritt - 1}</Link> : null}
  </div>;
}
