import {
  BASIS,
  adminAnmelden,
  erstelleEntwurf,
  erwarte,
  melde,
  neuerKontext,
  personMitEinladung,
  profilSpeichern,
  pruefe,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

/**
 * Löst ein echtes `beforeunload` synthetisch aus und meldet, ob die Seite es
 * verhindert (also warnen würde). So lässt sich die Warnung prüfen, ohne den
 * nativen, nicht anpassbaren Browser-Dialog selbst bedienen zu müssen.
 */
async function beforeUnloadVerhindert(seite) {
  return seite.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);
  await profilSpeichern(ref, { telefon: "08251 1000" });

  await pruefe("Profil: Warnung bei ungespeicherten Änderungen", async () => {
    await ref.goto(`${BASIS}/admin/konto`);
    const sauber = await beforeUnloadVerhindert(ref);
    erwarte(sauber === false, "Frisch geladen warnt das Profilformular bereits, ohne dass etwas geändert wurde.");
    await ref.locator('input[name="telefon"]').fill("08251 2000");
    const geaendert = await beforeUnloadVerhindert(ref);
    erwarte(geaendert === true, "Nach einer Änderung am Profil bleibt beforeunload unbeeinflusst.");
    await profilSpeichern(ref, { telefon: "08251 2000" });
    const nachSpeichern = await beforeUnloadVerhindert(ref);
    erwarte(nachSpeichern === false, "Nach erfolgreichem Speichern warnt das Profilformular weiterhin.");
    return { satz: "Das Profilformular warnt bei ungespeicherten Änderungen und nach dem Speichern nicht mehr." };
  });

  await pruefe("Thema (Assistent): Warnung bei ungespeicherten Änderungen", async () => {
    await ref.goto(`${BASIS}/admin/fortbildungen/neu`);
    const sauber = await beforeUnloadVerhindert(ref);
    erwarte(sauber === false, "Der frisch geöffnete Assistent warnt bereits ohne jede Eingabe.");
    await ref.locator('input[name="titel"]').fill(`RF01 Warnung ${Date.now()}`);
    const geaendert = await beforeUnloadVerhindert(ref);
    erwarte(geaendert === true, "Nach einer Eingabe im Assistenten bleibt beforeunload unbeeinflusst.");
    await ref.getByRole("button", { name: "Als Entwurf speichern" }).click();
    await ref.waitForURL(/\/admin\/fortbildungen\/[^/?]+\?gespeichert=1/, { timeout: 20_000 });
    const nachSpeichern = await beforeUnloadVerhindert(ref);
    erwarte(nachSpeichern === false, "Nach dem Speichern des Entwurfs warnt der Assistent weiterhin.");
    return { satz: "Der Themen-Assistent warnt bei ungespeicherten Änderungen und nach dem Speichern nicht mehr." };
  });

  await pruefe("Thema (Bearbeitungsformular): Warnung bei ungespeicherten Änderungen", async () => {
    const titel = `RF01 Formular-Warnung ${Date.now()}`;
    const id = await erstelleEntwurf(ref, titel);
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    const sauber = await beforeUnloadVerhindert(ref);
    erwarte(sauber === false, "Das frisch geladene Bearbeitungsformular warnt bereits ohne Änderung.");
    await ref.locator('input[name="titel"]').fill(`${titel} geändert`);
    const geaendert = await beforeUnloadVerhindert(ref);
    erwarte(geaendert === true, "Nach einer Änderung im Bearbeitungsformular bleibt beforeunload unbeeinflusst.");
    await ref.getByRole("button", { name: "Änderungen speichern" }).click();
    await ref.waitForURL(/gespeichert=1/, { timeout: 20_000 });
    const nachSpeichern = await beforeUnloadVerhindert(ref);
    erwarte(nachSpeichern === false, "Nach dem Speichern warnt das Bearbeitungsformular weiterhin.");
    return { satz: "Das Bearbeitungsformular warnt bei ungespeicherten Änderungen und nach dem Speichern nicht mehr." };
  });

  await pruefe("Profil: Neuladen vor Speichern", async () => {
    const marker = "08251 NICHT GESPEICHERT";
    await ref.goto(`${BASIS}/admin/konto`);
    await ref.locator('input[name="telefon"]').fill(marker);
    await ref.reload();
    const danach = await ref.locator('input[name="telefon"]').inputValue();
    if (danach === marker) throw new Error("Ein ungespeicherter Profilwert erschien nach dem Neuladen als gespeichert.");
    return {
      status: "UNKLAR",
      satz: `Es gibt kein Autosave; nach Neuladen steht wieder „${danach}“ im Feld.`,
    };
  });

  await pruefe("Profil: Tab schließen vor Speichern", async () => {
    const marker = "Tababbruch ohne Speichern";
    const tab = await refKontext.newPage();
    await tab.goto(`${BASIS}/admin/konto`);
    await tab.locator('textarea[name="kurzprofil"]').fill(marker);
    await tab.close();
    const neu = await refKontext.newPage();
    await neu.goto(`${BASIS}/admin/konto`);
    const danach = await neu.locator('textarea[name="kurzprofil"]').inputValue();
    await neu.close();
    if (danach === marker) throw new Error("Der abgebrochene Profilwert wurde unerwartet persistiert.");
    return {
      status: "UNKLAR",
      satz: "Beim Schließen des Tabs geht der ungespeicherte Profiltext ohne Wiederherstellung verloren.",
    };
  });

  await pruefe("Thema: Neuladen mitten im Assistenten", async () => {
    const marker = `Ungespeichert ${Date.now()}`;
    await ref.goto(`${BASIS}/admin/fortbildungen/neu`);
    await ref.locator('input[name="titel"]').fill(marker);
    await ref.getByRole("button", { name: "Weiter" }).click();
    await ref.reload();
    const danach = await ref.locator('input[name="titel"]').inputValue();
    if (danach === marker) throw new Error("Der Assistent stellte einen nie gespeicherten Titel als persistent wieder her.");
    return {
      status: "UNKLAR",
      satz: "Der Assistent speichert Schritte nicht automatisch; ein Neuladen beginnt wieder mit leerem Titel.",
    };
  });

  await pruefe("Thema: Tab schließen mitten im Assistenten", async () => {
    const marker = `Tababbruch Thema ${Date.now()}`;
    const tab = await refKontext.newPage();
    await tab.goto(`${BASIS}/admin/fortbildungen/neu`);
    await tab.locator('input[name="titel"]').fill(marker);
    await tab.close();
    const neu = await refKontext.newPage();
    await neu.goto(`${BASIS}/admin/fortbildungen/neu`);
    const danach = await neu.locator('input[name="titel"]').inputValue();
    await neu.close();
    if (danach === marker) throw new Error("Der nie gespeicherte Thementitel wurde nach Tababbruch wiederhergestellt.");
    return {
      status: "UNKLAR",
      satz: "Nach dem Schließen des Tabs gibt es keine Wiederherstellung des ungespeicherten Wizard-Zustands.",
    };
  });

  await pruefe("Thema: ausdrücklich gespeicherter Entwurf", async () => {
    const titel = `RF01 Entwurf ${Date.now()}`;
    const id = await erstelleEntwurf(ref, titel);
    await ref.reload();
    const danach = await ref.locator('input[name="titel"]').inputValue();
    if (danach !== titel) throw new Error(`Der gespeicherte Entwurf zeigt statt „${titel}“ den Wert „${danach}“.`);
    return { satz: `Der Entwurf ${id} bleibt nach dem Neuladen vollständig erreichbar.` };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) {
    melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  }
  await adminKontext.close();
  await refKontext.close();
  await browser.close();
}
