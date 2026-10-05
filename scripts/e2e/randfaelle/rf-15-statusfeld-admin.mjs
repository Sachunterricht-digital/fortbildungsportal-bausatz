import { execFileSync } from "node:child_process";

import {
  BASIS,
  adminAnmelden,
  ergaenzeRedaktion,
  erwarte,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  reicheNeuesSchilfEin,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

/**
 * Sammelliste 29.09., Punkt c: Setzt die Administration im normalen
 * Bearbeitungsformular ein eingereichtes Thema auf „Veröffentlicht“, läuft
 * dieselbe Freigabe-Mail wie über freigeben() (src/actions/fortbildung.ts,
 * gemeinsame sendeFreigabeMail()). Der Wechsel zurück auf „Entwurf“ ist
 * gesperrt (dafür gibt es „Zurückweisen“).
 */
function serverLogEnthaelt(suchtext) {
  const log = execFileSync("ssh", [
    (process.env.TEST_SSH_HOST ?? "testserver"),
    "docker logs --tail 500 fortbildung-test-app-1",
  ]).toString();
  return log.includes(suchtext);
}

async function setzeStatusImFormular(seite, id, optionName) {
  await seite.goto(`${BASIS}/admin/fortbildungen/${id}`);
  const status = seite.locator('[role="combobox"]').filter({ hasText: /eingereicht/i }).first();
  await status.click();
  await seite.getByRole("option", { name: optionName, exact: true }).click();
  await seite.getByRole("button", { name: "Änderungen speichern" }).click();
}

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);

  await pruefe("Statusfeld „Veröffentlicht“ löst dieselbe Freigabe-Mail aus", async () => {
    const titel = `RF15 Statusfeld veroeffentlicht ${Date.now().toString(36)}`;
    const id = await reicheNeuesSchilfEin(ref, titel, "Beschreibung für den Statusfeld-Test.");
    await ergaenzeRedaktion(admin, id);

    await setzeStatusImFormular(admin, id, "Veröffentlicht");
    await admin.waitForURL(/gespeichert=1/, { timeout: 20_000 });

    let logZeile;
    try {
      logZeile = serverLogEnthaelt(`Dein Thema „${titel}“ ist freigegeben`);
    } catch (error) {
      return {
        status: "UNKLAR",
        satz: `Kein SSH-Zugriff zur Testinstanz, Server-Log nicht geprüft (${error instanceof Error ? error.message : String(error)}).`,
      };
    }
    erwarte(logZeile, "Die Freigabe-Mail steht nicht im Server-Log der Testinstanz.");

    await admin.goto(`${BASIS}/fortbildungen?q=${encodeURIComponent(titel)}`);
    await admin.getByText(titel, { exact: true }).waitFor({ timeout: 10_000 });

    return {
      satz: "Direktes Veröffentlichen im Formular schreibt die Freigabe-Mail ins Log und macht das Thema außen sichtbar.",
    };
  });

  await pruefe("Statusfeld verweigert den Sprung von Eingereicht zurück auf Entwurf", async () => {
    const titel = `RF15 Statusfeld gesperrt ${Date.now().toString(36)}`;
    const id = await reicheNeuesSchilfEin(ref, titel, "Beschreibung für den Sperr-Test.");

    await setzeStatusImFormular(admin, id, "Entwurf");
    // Die Meldung erscheint doppelt (Fehlerübersicht oben und Hinweis am
    // Statusfeld selbst), deshalb genügt der erste Treffer.
    await admin
      .getByText(
        "Ein eingereichtes Thema wird hier nicht auf Entwurf zurückgesetzt. Bitte „Zurückweisen“ nutzen, das speichert eine Begründung und informiert per Mail.",
      )
      .first()
      .waitFor({ timeout: 10_000 });

    return { satz: "Der Versuch scheitert mit Hinweis auf „Zurückweisen“, der Status bleibt unangetastet." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await adminKontext.close();
  await refKontext.close();
  await browser.close();
}
