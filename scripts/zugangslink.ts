/**
 * Erzeugt einen Einladungslink für eine vorhandene Person, ohne Admin-
 * Sitzung — für Fälle, in denen niemand gerade im Portal angemeldet ist.
 *
 * Nutzt dieselbe Kontologik wie der Admin-Knopf „Zugang einrichten"
 * (`sichergestelltesKontoFuerReferent` in src/lib/zugangKern.ts), damit es
 * nur eine Wahrheit für diesen Ablauf gibt. Deckt zwei Fälle ab:
 *
 *   - Person ohne Konto: legt eines an und gibt einen Einladungslink aus.
 *   - Person mit Konto, aber ohne gesetztes Passwort: neuer Einladungslink
 *     (entwertet einen älteren, noch offenen Link derselben Person).
 *
 * Ein Konto mit bereits gesetztem Passwort bleibt unverändert — ein
 * Passwort-Reset über diesen Weg ist nicht Teil dieses Skripts, dafür der
 * Admin-Knopf "Nur Link erzeugen und kopieren" im Portal.
 *
 * Läuft über das Builder-Image, nie gegen die echte Seite:
 *
 *   docker build --target builder -t fortbildung-test:builder .
 *   docker run --rm --network fortbildung-test_default \
 *     -e DATABASE_URL="postgresql://..." -e APP_BASE_URL="https://..." \
 *     fortbildung-test:builder npx tsx scripts/zugangslink.ts <email>
 */
import { prisma } from "@/lib/prisma";
import {
  erzeugeZugangstoken,
  sichergestelltesKontoFuerReferent,
  zugangsLink,
} from "@/lib/zugangKern";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Aufruf: npx tsx scripts/zugangslink.ts <email>");
    process.exitCode = 1;
    return;
  }

  const referent = await prisma.referent.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, vorname: true, nachname: true },
  });

  if (!referent) {
    console.error(`Keine Person mit der Mailadresse "${email}" gefunden.`);
    process.exitCode = 1;
    return;
  }

  const konto = await sichergestelltesKontoFuerReferent(referent.id);

  if (!konto.ok) {
    const meldungen: Record<(typeof konto)["grund"], string> = {
      PERSON_FEHLT: "Person nicht mehr vorhanden.",
      OHNE_MAIL: "Für diese Person ist keine Mailadresse hinterlegt.",
      MAIL_BELEGT: `Die Mailadresse ${email} gehört bereits zu einem anderen Konto.`,
    };
    console.error(meldungen[konto.grund]);
    process.exitCode = 1;
    return;
  }

  if (!konto.neuAngelegt) {
    const user = await prisma.user.findUnique({
      where: { id: konto.userId },
      select: { passwordHash: true },
    });
    if (user?.passwordHash) {
      console.error(
        `${referent.vorname} ${referent.nachname} hat bereits ein Passwort gesetzt. ` +
          "Kein neuer Link — ein Reset läuft über den Admin-Knopf im Portal.",
      );
      process.exitCode = 1;
      return;
    }
  }

  const { token, gueltigBis } = await erzeugeZugangstoken(konto.userId, "EINLADUNG");

  console.log(
    `${konto.neuAngelegt ? "Konto angelegt" : "Neuer Einladungslink"} für ` +
      `${referent.vorname} ${referent.nachname} (${konto.email}).`,
  );
  console.log(`Link: ${zugangsLink(token)}`);
  console.log(`Gültig bis: ${gueltigBis.toISOString()}`);
}

main()
  .catch((error) => {
    console.error("Zugangslink fehlgeschlagen:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
