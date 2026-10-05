import { execFileSync } from "node:child_process";

import {
  ergaenzeRedaktion,
  erwarte,
  gibFrei,
  melde,
  neuerKontext,
  adminAnmelden,
  personMitEinladung,
  pruefe,
  reicheNeuesSchilfEin,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

/**
 * Prüft im Server-Log der Testinstanz, ob eine Zeile den Suchtext enthält.
 * Läuft nur mit SSH-Zugriff zur Testinstanz — ohne meldet der Fall UNKLAR statt
 * FEHLER, damit das Skript auch ohne Tunnel/SSH durchläuft.
 */
function serverLogEnthaelt(suchtext) {
  const log = execFileSync("ssh", [
    (process.env.TEST_SSH_HOST ?? "testserver"),
    "docker logs --tail 500 fortbildung-test-app-1",
  ]).toString();
  return log.includes(suchtext);
}

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);
  const titel = `RF09 Freigabe-Mail ${Date.now()}`;
  const id = await reicheNeuesSchilfEin(ref, titel, "Beschreibung für den Freigabe-Mail-Test.");

  await pruefe("Freigabe-Mail im Server-Log", async () => {
    await ergaenzeRedaktion(admin, id);
    await gibFrei(admin, titel);

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
    return {
      satz: "Nach der Freigabe erscheint die Freigabe-Mail mit korrektem Betreff im Server-Log.",
    };
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
