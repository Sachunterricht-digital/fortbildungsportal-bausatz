import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BASIS,
  adminAnmelden,
  erwarte,
  legePersonAn,
  erzeugeEinladungslink,
  setzePasswort,
  starteBrowser,
} from "./randfaelle/hilfe.mjs";

/**
 * Nimmt die drei Bilder für „Das Portal in drei Schritten“ auf der Testinstanz
 * auf (Testperson „Erika Muster“, „GS Musterstadt“, keine echten Daten) und
 * legt sie in public/bilder/onboarding/ ab.
 * Räumt die Testperson danach weg. Nur gegen localhost.
 */
const HIER = path.dirname(fileURLToPath(import.meta.url));
const ZIELE = [
  path.join(HIER, "..", "..", "public", "bilder", "onboarding"),
  path.join(HIER, "..", "..", "..", "docs", "onboarding", "bilder"),
];
const ROH = path.join(HIER, "bilder", "onboarding-roh");
mkdirSync(ROH, { recursive: true });
for (const z of ZIELE) mkdirSync(z, { recursive: true });

function sql(befehl) {
  execFileSync(
    "ssh",
    [(process.env.TEST_SSH_HOST ?? "testserver"), "docker exec -i fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm"],
    { input: befehl },
  );
}

const kennung = Date.now().toString(36);
const person = {
  vorname: "Erika",
  // Zunächst eindeutig, damit die Hilfsfunktionen die Person finden (auf der
  // Testinstanz gibt es schon eine ältere „Erika Muster“). Umbenannt wird per SQL.
  nachname: `Muster-${kennung}`,
  organisation: "GS Musterstadt",
  email: `erika.muster.${kennung}@test.local`,
  passwort: `Muster-${kennung}-Passwort!`,
};

const browser = await starteBrowser();
const kontextAdmin = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const admin = await kontextAdmin.newPage();
const kontext = await browser.newContext({ viewport: { width: 1128, height: 1000 }, deviceScaleFactor: 2 });
const seite = await kontext.newPage();

async function ausschnitt(datei, { x, y, width, height }) {
  const ziel = path.join(ROH, datei);
  await seite.screenshot({ path: ziel, fullPage: true, clip: { x, y, width, height } });
  for (const z of ZIELE) copyFileSync(ziel, path.join(z, datei));
}

try {
  await adminAnmelden(admin);
  await legePersonAn(admin, person);
  const link = await erzeugeEinladungslink(admin, person);
  await setzePasswort(seite, link, person);

  sql(`UPDATE "Referent" SET nachname='Muster' WHERE email='${person.email}'`);

  // 1. Profil
  await seite.goto(`${BASIS}/admin/konto`);
  await seite.locator('input[name="schwerpunkte"]').fill("iPad, TaskCards, KI");
  await seite
    .locator('textarea[name="kurzprofil"]')
    .fill("Lehrerin an der GS Musterstadt. Ich zeige gern, wie digitale Medien den Unterricht einfacher machen.");
  await seite.getByRole("button", { name: /^(Profil speichern|Speichern und veröffentlichen)$/ }).click();
  await seite.locator("span.text-primary").filter({ hasText: /^Profil gespeichert|^Gespeichert/ }).first().waitFor({ timeout: 15000 });
  // Neu laden, damit die Rückmeldung „Gespeichert“ nicht im Bild steht
  await seite.reload();
  const profil = seite.locator("form").filter({ has: seite.locator('textarea[name="kurzprofil"]') }).first();
  await profil.waitFor();
  await profil.screenshot({ path: path.join(ROH, "1-profil.png") });
  for (const z of ZIELE) copyFileSync(path.join(ROH, "1-profil.png"), path.join(z, "1-profil.png"));

  // 2. Assistent, Schritt 1
  await seite.goto(`${BASIS}/admin/fortbildungen/neu`);
  await seite.locator('input[name="titel"]').fill("iPad im Unterricht");
  const form = seite.locator("form").filter({ has: seite.locator('input[name="titel"]') }).first();
  const hinweis = seite.getByText("SchiLf ohne festen Termin:");
  await hinweis.waitFor();
  await seite.evaluate(() => document.activeElement?.blur());
  const fb = await form.boundingBox();
  const hb = await hinweis.boundingBox();
  await ausschnitt("2-themen-assistent-schritt-1.png", { x: fb.x, y: fb.y, width: fb.width, height: hb.y + hb.height + 14 - fb.y });

  // 3. Prüfen
  await seite.getByRole("button", { name: "Weiter" }).click();
  await seite.locator(".ProseMirror").click();
  await seite.keyboard.type("Wie sich das iPad im Unterricht sinnvoll einsetzen lässt.");
  for (let i = 0; i < 3; i += 1) await seite.getByRole("button", { name: "Weiter" }).click();
  // Seit 03.10. kein Statusfeld mehr für Referenten, nur die zwei Knöpfe
  const kopf = seite.getByText("Prüfung und Veröffentlichung", { exact: true });
  await kopf.waitFor();
  const kasten = await kopf.locator('xpath=ancestor::div[contains(@class,"border")][1]').boundingBox();
  const fn = await seite.getByText("Als Entwurf speichern: noch nicht eingereicht").boundingBox();
  const f2 = await form.boundingBox();
  const sy = await seite.evaluate(() => window.scrollY);
  await seite.evaluate(() => document.activeElement?.blur());
  await ausschnitt("3-pruefen.png", { x: f2.x, y: kasten.y + sy - 2, width: f2.width, height: fn.y + fn.height + 14 - kasten.y });
  erwarte(true, "");
  console.log("Bilder geschrieben:", ZIELE.join(", "));
} finally {
  try {
    sql(`DELETE FROM "Referent" WHERE email='${person.email}'; DELETE FROM "User" WHERE email='${person.email}';`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message);
  }
  await kontextAdmin.close();
  await kontext.close();
  await browser.close();
}
