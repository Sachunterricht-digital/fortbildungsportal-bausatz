import { execFileSync } from "node:child_process";

import {
  BASIS,
  adminAnmelden,
  ergaenzeRedaktion,
  erwarte,
  gibFrei,
  idAusUrl,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

/**
 * Setzt den Status einer Fortbildung direkt in der Testdatenbank auf
 * ARCHIVIERT — im Formular ist der Status nicht wählbar, er entsteht sonst
 * nur über den Löschlauf (src/lib/retention.ts) nach zwei Jahren.
 */
function aufArchiviertSetzen(id) {
  execFileSync("ssh", [
    (process.env.TEST_SSH_HOST ?? "testserver"),
    `docker exec fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm -c "UPDATE \\"Fortbildung\\" SET status='ARCHIVIERT' WHERE id='${id}';"`,
  ]);
}

/** Wie hilfe.mjs reicheNeuesSchilfEin(), ergänzt um ein eigenes Schlagwort. */
async function reicheNeuesSchilfEinMitSchlagwort(seite, titel, beschreibung, schlagwort) {
  await seite.goto(`${BASIS}/admin/fortbildungen/neu`);
  await seite.locator('input[name="titel"]').fill(titel);
  await seite.getByRole("button", { name: "Weiter" }).click();
  await seite.locator(".ProseMirror").click();
  await seite.keyboard.type(beschreibung);
  await seite.getByRole("button", { name: "Weiter" }).click();
  await seite.getByLabel("Weiteres Schlagwort").fill(schlagwort);
  await seite.getByLabel("Weiteres Schlagwort").press("Enter");
  await seite.getByRole("button", { name: "Weiter" }).click();
  await seite.getByRole("button", { name: "Weiter" }).click();
  const status = seite
    .locator('[role="combobox"]')
    .filter({ hasText: /Entwurf|Eingereicht/ })
    .first();
  if (await status.isVisible().catch(() => false)) {
    await status.click();
    await seite.getByRole("option", { name: /eingereicht/i }).click();
  }
  await seite.getByRole("button", { name: "Zur Freigabe einreichen" }).click();
  await seite.waitForURL(/\/admin\/fortbildungen\/[^/?]+\?gespeichert=1/, { timeout: 20_000 });
  return idAusUrl(seite.url());
}

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);
const { kontext: aussenKontext, seite: aussen } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);

  const kennung = Date.now().toString(36);
  const titel = `RF12 Archiv-Sichtbarkeit ${kennung}`;
  const schlagwort = `Randfallwort${kennung}`;
  const id = await reicheNeuesSchilfEinMitSchlagwort(
    ref,
    titel,
    "Beschreibung für den Archiv-Sichtbarkeitstest.",
    schlagwort,
  );
  await ergaenzeRedaktion(admin, id);
  await gibFrei(admin, titel);

  await pruefe("Veröffentlichtes Thema erscheint außen in Suche und Schlagwort-Filter", async () => {
    await aussen.goto(`${BASIS}/fortbildungen?q=${encodeURIComponent(titel)}`);
    await aussen.getByText(titel, { exact: true }).waitFor({ timeout: 10_000 });
    await aussen.goto(`${BASIS}/fortbildungen?schlagwort=${encodeURIComponent(schlagwort)}`);
    await aussen.getByText(titel, { exact: true }).waitFor({ timeout: 10_000 });
    return { satz: "Vor dem Archivieren findet die Suche und der Schlagwort-Filter das Thema." };
  });

  await pruefe("Archiviertes Thema verschwindet aus Suche und Schlagwort-Filter", async () => {
    try {
      aufArchiviertSetzen(id);
    } catch (error) {
      return {
        status: "UNKLAR",
        satz: `Kein SSH-Zugriff zur Testdatenbank, Status konnte nicht auf ARCHIVIERT gesetzt werden (${error instanceof Error ? error.message : String(error)}).`,
      };
    }

    await aussen.goto(`${BASIS}/fortbildungen?q=${encodeURIComponent(titel)}`);
    const inSuche = await aussen.getByText(titel, { exact: true }).count();
    erwarte(inSuche === 0, "Das archivierte Thema steht weiterhin in der Suchergebnisliste.");

    await aussen.goto(`${BASIS}/fortbildungen?schlagwort=${encodeURIComponent(schlagwort)}`);
    const imSchlagwortFilter = await aussen.getByText(titel, { exact: true }).count();
    erwarte(imSchlagwortFilter === 0, "Das archivierte Thema steht weiterhin im Schlagwort-Filter.");

    return { satz: "Nach dem Archivieren findet weder die Suche noch der Schlagwort-Filter das Thema noch." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await adminKontext.close();
  await refKontext.close();
  await aussenKontext.close();
  await browser.close();
}
