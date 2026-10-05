import {
  BASIS,
  adminAnmelden,
  anmelden,
  erwarte,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

/**
 * Ergänzt rf-08 „E-Mail einer Person mit Konto ändern" (prüft dort nur, dass
 * der Reset-Link die neue Adresse zeigt): Hier meldet sich die Person
 * tatsächlich an — mit der neuen Mail muss es klappen, mit der alten nicht
 * mehr.
 */
const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);
// Eigener, nicht angemeldeter Kontext für die Login-Versuche — refKontext
// trägt nach setzePasswort() bereits ein gültiges Sitzungscookie, das den
// Login-Versuch sonst sofort auf /admin weiterleitet, egal welche Mail
// eingetragen wird.
const { kontext: loginKontext, seite: loginSeite } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);
  const neueEmail = `mailwechsel-${Date.now().toString(36)}@test.local`;

  await pruefe("Admin ändert die Mail in der Personenverwaltung", async () => {
    await admin.goto(`${BASIS}/admin/referenten`);
    await admin
      .getByRole("button", { name: `${person.vorname} ${person.nachname} bearbeiten` })
      .click();
    const dialog = admin.getByRole("dialog");
    await dialog.locator('input[name="email"]').fill(neueEmail);
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await dialog.getByText(/gespeichert/i).waitFor({ timeout: 15_000 });
    await admin.keyboard.press("Escape");
    return { satz: `Die Mail steht im Verzeichnis jetzt auf ${neueEmail}.` };
  });

  await pruefe("Login mit der alten Mailadresse schlägt fehl", async () => {
    await loginSeite.goto(`${BASIS}/login`);
    await loginSeite.locator('input[name="email"]').fill(person.email);
    await loginSeite.locator('input[name="passwort"]').fill(person.passwort);
    await loginSeite.getByRole("button", { name: "Anmelden" }).click();
    await loginSeite.getByRole("alert").first().waitFor({ timeout: 10_000 });
    const nochAufLogin = loginSeite.url().startsWith(`${BASIS}/login`);
    erwarte(nochAufLogin, "Mit der alten Mailadresse war weiterhin eine Anmeldung möglich.");
    return { satz: "Die alte Mailadresse meldet die Person nicht mehr an." };
  });

  await pruefe("Login mit der neuen Mailadresse gelingt", async () => {
    await anmelden(loginSeite, neueEmail, person.passwort);
    const imAdmin = loginSeite.url().startsWith(`${BASIS}/admin`);
    erwarte(imAdmin, "Mit der neuen Mailadresse war keine Anmeldung möglich.");
    return { satz: "Die neue Mailadresse meldet die Person erfolgreich an." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await adminKontext.close();
  await refKontext.close();
  await loginKontext.close();
  await browser.close();
}
