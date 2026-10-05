import {
  BASIS,
  adminAnmelden,
  erstelleEntwurf,
  erwarte,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  reicheNeuesSchilfEin,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);

  await pruefe("Browser Zurück/Vor im Assistenten", async () => {
    const marker = `Browserhistorie ${Date.now()}`;
    await ref.goto(`${BASIS}/admin`);
    await ref.goto(`${BASIS}/admin/fortbildungen/neu`);
    await ref.locator('input[name="titel"]').fill(marker);
    await ref.getByRole("button", { name: "Weiter" }).click();
    // Seit 03.10.: Zurück mit ungespeicherten Eingaben fragt nach (popstate + confirm).
    // Abbrechen bleibt im Assistenten, die Eingabe bleibt erhalten.
    let gefragt = 0;
    const abbrechen = (d) => { gefragt += 1; d.dismiss(); };
    ref.on("dialog", abbrechen);
    await ref.goBack();
    await ref.waitForTimeout(800);
    ref.off("dialog", abbrechen);
    erwarte(gefragt === 1, `Zurück sollte genau einmal nachfragen, war ${gefragt}.`);
    erwarte(ref.url().includes("/admin/fortbildungen/neu"), "Nach Abbrechen sollte der Assistent offen bleiben.");
    await ref.getByRole("button", { name: "Zurück" }).first().click();
    erwarte((await ref.locator('input[name="titel"]').inputValue()) === marker, "Die Eingabe ging trotz Abbrechen verloren.");
    return { satz: "Zurück mit ungespeicherten Eingaben fragt nach, Abbrechen behält Assistent und Eingabe." };
  });

  await pruefe("Zwei Tabs bearbeiten denselben Entwurf", async () => {
    const titel = `RF03 Ausgang ${Date.now()}`;
    const id = await erstelleEntwurf(ref, titel);
    const tabA = await refKontext.newPage();
    const tabB = await refKontext.newPage();
    await Promise.all([
      tabA.goto(`${BASIS}/admin/fortbildungen/${id}`),
      tabB.goto(`${BASIS}/admin/fortbildungen/${id}`),
    ]);
    const titelA = `${titel} A`;
    const titelB = `${titel} B`;
    await tabA.locator('input[name="titel"]').fill(titelA);
    await tabB.locator('input[name="titel"]').fill(titelB);
    await tabA.getByRole("button", { name: "Änderungen speichern" }).click();
    await tabA.waitForURL(/gespeichert=1/, { timeout: 20_000 });
    // Tab B trägt noch den updatedAt-Stand von vor Tab As Speicherung mit —
    // die optimistische Sperre in saveFortbildung() muss das Update verwerfen
    // statt Tab As Änderung still zu überschreiben.
    await tabB.getByRole("button", { name: "Änderungen speichern" }).click();
    await tabB
      .getByRole("alert")
      .filter({ hasText: /geändert|neu laden/i })
      .first()
      .waitFor({ timeout: 15_000 });
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    const endstand = await ref.locator('input[name="titel"]').inputValue();
    await tabA.close();
    await tabB.close();
    erwarte(endstand === titelA, `Unerwarteter Endstand „${endstand}“ statt der Speicherung aus Tab A „${titelA}“.`);
    return {
      satz: "Tab B erhält beim Speichern über einem zwischenzeitlich geänderten Stand eine Konfliktmeldung statt eines stillen Überschreibens; der Stand aus Tab A bleibt erhalten.",
    };
  });

  await pruefe("Browser Zurück/Vor nach dem Einreichen", async () => {
    const titel = `RF03 Einreichung ${Date.now()}`;
    await reicheNeuesSchilfEin(ref, titel, "Navigation nach dem Einreichen.");
    await ref.goBack();
    await ref.goForward();
    await ref.waitForURL(/\/admin\/fortbildungen\//);
    await admin.goto(`${BASIS}/admin?q=${encodeURIComponent(titel)}`);
    const anzahl = await admin.getByRole("link", { name: titel, exact: true }).count();
    erwarte(anzahl === 1, `Nach Zurück/Vor existieren ${anzahl} Treffer statt genau einem.`);
    return { satz: "Zurück/Vor nach dem Redirect erzeugte in diesem Lauf keine zweite Einreichung." };
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
