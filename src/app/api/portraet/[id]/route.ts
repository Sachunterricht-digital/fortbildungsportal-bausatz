import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { lesePortraet } from "@/lib/portraet";
import { oeffentlicheReferentWhere } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Liefert das Profilfoto eines Referenten als WebP.
 *
 * Die ID aus der URL dient nur als Suchschlüssel in der Datenbank — der
 * Dateipfad wird ausschließlich aus dem dort gefundenen Datensatz gebaut,
 * nie direkt aus der URL. Öffentlich sichtbar ist ein Foto nur, wenn die
 * Person laut `oeffentlicheReferentWhere()` öffentlich ist (aktiv und
 * sichtbar) und ein Foto hinterlegt hat; angemeldete Personen sehen ihr
 * eigenes Bild immer.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const referent = await prisma.referent.findUnique({
    where: { id },
    select: { id: true, portraetAm: true },
  });
  if (!referent || !referent.portraetAm) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const oeffentlich =
    (await prisma.referent.count({
      where: { AND: [{ id: referent.id }, oeffentlicheReferentWhere()] },
    })) > 0;

  if (!oeffentlich) {
    const user = await getSessionUser();
    const eigenesBild = user?.referentId === referent.id;
    if (!eigenesBild) {
      return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    }
  }

  const daten = await lesePortraet(referent.id);
  if (!daten) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(daten), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=300",
    },
  });
}
