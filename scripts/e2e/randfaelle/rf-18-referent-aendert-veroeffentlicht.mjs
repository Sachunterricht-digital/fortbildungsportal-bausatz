import { execFileSync } from "node:child_process";

import {
  BASIS,
  adminAnmelden,
  ergaenzeRedaktion,
  erwarte,
  gibFrei,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  reicheNeuesSchilfEin,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

/**
 * Prüft im Server-Log der Testinstanz, ob eine Zeile den Suchtext enthält.
 * Läuft nur mit SSH-Zugriff zur Testinstanz — ohne meldet der Fall UNKLAR statt
 * FEHLER, damit das Skript auch ohne Tunnel/SSH durchläuft. Siehe rf-09.
 */
function serverLogEnthaelt(suchtext) {
  const log = execFileSync("ssh", [
    (process.env.TEST_SSH_HOST ?? "testserver"),
    "docker logs --tail 500 fortbildung-test-app-1",
  ]).toString();
  return log.includes(suchtext);
}

/**
 * Sammelliste 29.09. mittags, Fall 2: Referentinnen und Referenten dürfen ein
 * bereits freigegebenes Thema weiter bearbeiten. Die Änderung geht sofort
 * online (kein neuer Freigabeschritt), die Beratung digitale Bildung bekommt
 * nur eine Hinweis-Mail. Die Veröffentlichungsprüfung bleibt dabei in Kraft
 * (zweiter Fall unten: unvollständige Änderung wird abgelehnt).
 */
const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);

  const titel = `RF18 Veröffentlicht ändern ${Date.now()}`;
  const id = await reicheNeuesSchilfEin(ref, titel, "Ursprüngliche Beschreibung für den Test.");
  await ergaenzeRedaktion(admin, id);
  await gibFrei(admin, titel);

  await pruefe("Referent ändert veröffentlichtes Thema, bleibt veröffentlicht", async () => {
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    await ref
      .getByText("Dieses Thema ist bereits veröffentlicht.", { exact: false })
      .waitFor({ timeout: 15_000 });

    const speichernKnopf = ref.getByRole("button", { name: "Änderungen speichern" });
    erwarte(
      (await speichernKnopf.count()) > 0,
      "Der Referent sieht keinen Speichern-Knopf — die Bearbeitung scheint weiter gesperrt zu sein.",
    );

    await ref.getByRole("tab", { name: "Beschreibung" }).click();
    await ref.locator(".ProseMirror").click();
    await ref.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    const neueBeschreibung = `Geänderte Beschreibung nach Freigabe ${Date.now()}.`;
    await ref.keyboard.type(neueBeschreibung);

    await speichernKnopf.click();
    await ref.waitForURL(/gespeichert=1/, { timeout: 20_000 });

    await ref.getByText("Veröffentlicht", { exact: true }).first().waitFor({ timeout: 15_000 });
    await ref.getByRole("tab", { name: "Beschreibung" }).click();
    await ref.getByText(neueBeschreibung).waitFor({ timeout: 15_000 });

    let logZeile;
    try {
      logZeile = serverLogEnthaelt(`Geändert: „${titel}“`);
    } catch (error) {
      return {
        status: "UNKLAR",
        satz: `Änderung gespeichert, Thema bleibt veröffentlicht. Kein SSH-Zugriff zur Testinstanz, Hinweis-Mail im Log nicht geprüft (${error instanceof Error ? error.message : String(error)}).`,
      };
    }

    erwarte(logZeile, "Die Hinweis-Mail an die Dienstmail steht nicht im Server-Log der Testinstanz.");
    return {
      satz: "Die Änderung ist sofort online, das Thema bleibt veröffentlicht, und die Hinweis-Mail steht im Server-Log.",
    };
  });

  await pruefe("Unvollständige Änderung an veröffentlichtem Thema wird abgelehnt", async () => {
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    await ref.getByRole("tab", { name: "Referenten" }).click();
    await ref
      .getByRole("button", { name: `${person.vorname} ${person.nachname} entfernen` })
      .click();

    await ref.getByRole("button", { name: "Änderungen speichern" }).click();
    await ref
      .getByText(/mindestens eine Referentin oder einen Referenten/i)
      .first()
      .waitFor({ timeout: 15_000 });

    erwarte(
      !/gespeichert=1/.test(ref.url()),
      "Die Seite ist trotz fehlender Referenten auf die gespeicherte Ansicht gesprungen.",
    );

    return {
      satz: "Ohne mindestens eine Referentin oder einen Referenten lehnt die Veröffentlichungsprüfung das Speichern ab, das Thema bleibt unverändert.",
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
