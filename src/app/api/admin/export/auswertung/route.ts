import { ladeSchulamt } from "@/lib/schulamt";
import { NextResponse, type NextRequest } from "next/server";
import { ERFASSER, getSessionUser } from "@/lib/auth";
import { leseAuswertungsFilter } from "@/lib/auswertung";
import { ladeAuswertung } from "@/lib/auswertungDaten";
import { erstelleAuswertungsmappe } from "@/lib/auswertungExcel";
import { berlinIsoDatum } from "@/lib/datetime";
import { auditLog } from "@/lib/audit";
import { AUSGEGRAUT } from "@/constants/funktionen";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auswertung ist ausgegraut (src/constants/funktionen.ts), auch per Adresse.
  if (AUSGEGRAUT.auswertung) return NextResponse.json({ error: "Nicht verfügbar." }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!ERFASSER.includes(user.role)) return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  // Wiederholte Parameter werden wie auf der Seite gelesen (erster Wert).
  const params: Record<string, string[]> = {};
  request.nextUrl.searchParams.forEach((wert, name) => { (params[name] ??= []).push(wert); });
  let filter;
  try {
    filter = leseAuswertungsFilter(params);
  } catch (fehler) {
    return NextResponse.json({ error: (fehler as Error).message }, { status: 400 });
  }
  const auswertung = await ladeAuswertung(user, filter);
  const schulamt = await ladeSchulamt();
  const mappe = erstelleAuswertungsmappe(auswertung, filter, schulamt.name);
  const puffer = await mappe.xlsx.writeBuffer();
  await auditLog({ userId: user.id, aktion: "UPDATE", entitaet: "Export", details: { art: "Auswertung", anzahl: auswertung.gesamt.veranstaltungen } });
  return new NextResponse(puffer as ArrayBuffer, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="auswertung-${berlinIsoDatum(auswertung.jetzt)}.xlsx"`,
    "Cache-Control": "no-store",
  } });
}
