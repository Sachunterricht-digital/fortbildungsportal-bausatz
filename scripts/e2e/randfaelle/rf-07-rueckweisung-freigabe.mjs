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
  weiseZurueck,
} from "./hilfe.mjs";

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);
  const titel = `RF07 Rückweisung ${Date.now()}`;
  const begruendung = "Bitte die Beschreibung um ein konkretes Beispiel ergänzen.";
  const id = await reicheNeuesSchilfEin(ref, titel, "Erste Fassung der Beschreibung.");

  await pruefe("Rückweisung mit sichtbarer Begründung", async () => {
    await weiseZurueck(admin, titel, begruendung);
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    await ref.getByText(begruendung, { exact: true }).waitFor({ timeout: 15_000 });
    return { satz: "Die Rückweisungsbegründung steht in der Bearbeitungsseite des Referenten." };
  });

  await pruefe("Ändern und erneut einreichen", async () => {
    await ref.getByRole("tab", { name: "Beschreibung" }).click();
    await ref.locator(".ProseMirror").click();
    await ref.keyboard.press("End");
    await ref.keyboard.type(" Konkretes Beispiel ergänzt.");
    await ref.getByRole("tab", { name: "Eckdaten" }).click();
    const status = ref
      .locator('[role="combobox"]')
      .filter({ hasText: /Entwurf|Eingereicht/ })
      .first();
    await status.click();
    await ref.getByRole("option", { name: /eingereicht/i }).click();
    await ref.getByRole("button", { name: "Änderungen speichern" }).click();
    await ref.waitForURL(/gespeichert=1/, { timeout: 20_000 });
    await admin.goto(`${BASIS}/admin/freigaben`);
    await admin.getByRole("link", { name: titel, exact: true }).waitFor();
    return { satz: "Das korrigierte Thema steht erneut mit Status EINGEREICHT in der Freigabeliste." };
  });

  await pruefe("Freigabe und öffentliche Auffindbarkeit", async () => {
    await ergaenzeRedaktion(admin, id);
    await gibFrei(admin, titel);
    const aussen = await refKontext.newPage();
    await aussen.goto(`${BASIS}/fortbildungen?q=${encodeURIComponent(titel)}`);
    await aussen.getByText(titel, { exact: true }).click();
    await aussen.getByText("Konkretes Beispiel ergänzt.", { exact: false }).waitFor();
    erwarte(!aussen.url().includes("/admin/"), "Die Prüfung landete nicht auf der öffentlichen Detailseite.");
    await aussen.close();
    return { satz: "Nach der Freigabe ist die überarbeitete Fassung über Suche und öffentliche Detailseite auffindbar." };
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
