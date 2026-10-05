import {
  adminAnmelden,
  erwarte,
  legePersonAn,
  melde,
  neuerKontext,
  pruefe,
  starteBrowser,
  testPerson,
} from "./hilfe.mjs";

/**
 * Aufgabe 3: Knopf „Einladung per Mail senden“ im Zugangs-Dialog. Ohne
 * SMTP_HOST (Testinstanz, aktuell auch live) täuscht der Dialog keinen
 * Erfolg vor, sondern zeigt den Hinweis und den erzeugten Link zum Kopieren.
 */
const browser = await starteBrowser();
const seitenfehler = [];
const { kontext, seite: admin } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const person = testPerson(`rf16-${Date.now().toString(36)}`);
  await legePersonAn(admin, person);

  await pruefe("Einladung per Mail zeigt ohne SMTP den Hinweis und den Link", async () => {
    await admin
      .getByRole("button", {
        name: `Registrierungslink für ${person.vorname} ${person.nachname} verwalten`,
      })
      .click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Einladung per Mail senden" }).click();
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();

    await dialog.getByText("Mailversand ist aus, bitte Link kopieren.").waitFor({ timeout: 15_000 });
    const linkFeld = dialog.locator("input[readonly]");
    await linkFeld.waitFor({ timeout: 10_000 });
    const link = await linkFeld.inputValue();
    erwarte(/^https?:\/\//.test(link), `Kein brauchbarer Link angezeigt: "${link}"`);

    return { satz: `Hinweis „Mailversand ist aus“ erscheint zusammen mit einem gültigen Link (${link}).` };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await kontext.close();
  await browser.close();
}
