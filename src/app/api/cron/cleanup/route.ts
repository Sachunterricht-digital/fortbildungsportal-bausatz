import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { runRetention } from "@/lib/retention";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Externer Auslöser für den Löschlauf, falls ein systemseitiger Cronjob
 * bevorzugt wird:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/cleanup
 *
 * Ohne gesetztes CRON_SECRET ist der Endpunkt abgeschaltet — sonst könnte
 * jeder den Lauf anstoßen.
 */
export async function POST(request: NextRequest) {
  return behandle(request);
}

export async function GET(request: NextRequest) {
  return behandle(request);
}

async function behandle(request: NextRequest) {
  const erwartet = process.env.CRON_SECRET;

  if (!erwartet) {
    return NextResponse.json(
      { error: "Kein CRON_SECRET gesetzt — der Endpunkt ist deaktiviert." },
      { status: 404 },
    );
  }

  const kopf = request.headers.get("authorization") ?? "";
  const uebergeben = kopf.startsWith("Bearer ") ? kopf.slice(7) : "";

  if (!gleich(uebergeben, erwartet)) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const ergebnis = await runRetention();
  await auditLog({
    aktion: "RETENTION",
    entitaet: "System",
    details: { ...ergebnis, gelaufenAm: ergebnis.gelaufenAm.toISOString() },
  });

  return NextResponse.json(ergebnis);
}

/** Vergleich in konstanter Zeit — verhindert das Erraten über Antwortzeiten. */
function gleich(a: string, b: string): boolean {
  const pufferA = Buffer.from(a);
  const pufferB = Buffer.from(b);
  if (pufferA.length !== pufferB.length) return false;
  return timingSafeEqual(pufferA, pufferB);
}
