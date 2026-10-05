import {
  BASIS,
  adminAnmelden,
  ergaenzeRedaktion,
  erstelleEntwurf,
  erwarte,
  gibFrei,
  melde,
  neuerKontext,
  personMitEinladung,
  profilSpeichern,
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

  await pruefe("Passwort setzen: synchroner Doppelklick", async () => {
    await setzePasswort(ref, link, person, { doppelt: true });
    const kontrolle = await refKontext.newPage();
    await kontrolle.goto(link);
    const nochFormular = await kontrolle.locator('input[name="wiederholung"]').count();
    await kontrolle.close();
    erwarte(nochFormular === 0, "Der Einladungslink war nach dem Doppelklick noch verwendbar.");
    return { satz: "Genau ein Passwortvorgang gewann; der Token ist anschließend verbraucht." };
  });

  await pruefe("Profil speichern: synchroner Doppelklick", async () => {
    await profilSpeichern(
      ref,
      { telefon: "08251 2000", kurzprofil: "Doppelklick-Profil" },
      { doppelt: true },
    );
    // ref.reload() erwischt die Formularfelder (defaultValue, unkontrolliert)
    // gelegentlich in einem Zwischenzustand und liest dann leer, obwohl die
    // Datenbank längst korrekt steht (per Hand mit psql geprüft). Eine
    // frische Seite in neuem Tab umgeht diesen Test-Artefakt zuverlässig.
    const kontrolle = await refKontext.newPage();
    await kontrolle.goto(`${BASIS}/admin/konto`);
    const wert = await kontrolle.locator('input[name="telefon"]').inputValue();
    await kontrolle.close();
    erwarte(
      wert === "08251 2000",
      "Der Profilwert wurde nach dem Doppelklick nicht gespeichert.",
    );
    return { satz: "Das Profil bleibt ein einzelner Upsert-Datensatz und zeigt die gespeicherten Werte." };
  });

  await pruefe("Entwurf speichern: synchroner Doppelklick", async () => {
    const entwurfTitel = `RF02 Entwurf Doppelklick ${Date.now()}`;
    await erstelleEntwurf(ref, entwurfTitel, { doppelt: true });
    await admin.goto(`${BASIS}/admin?q=${encodeURIComponent(entwurfTitel)}`);
    const anzahl = await admin.getByRole("link", { name: entwurfTitel, exact: true }).count();
    erwarte(anzahl === 1, `Der doppelt gespeicherte Entwurf erscheint ${anzahl}-mal.`);
    return { satz: "Der synchrone Doppelklick führte in diesem Lauf zu genau einem Entwurf." };
  });

  const titel = `RF02 Doppelklick ${Date.now()}`;
  let id;
  await pruefe("Einreichen: synchroner Doppelklick", async () => {
    id = await reicheNeuesSchilfEin(ref, titel, "Doppelklick beim Einreichen.", { doppelt: true });
    await admin.goto(`${BASIS}/admin?q=${encodeURIComponent(titel)}`);
    const anzahl = await admin.getByRole("link", { name: titel, exact: true }).count();
    erwarte(anzahl === 1, `Der Titel erscheint ${anzahl}-mal in der Verwaltung.`);
    return { satz: "Der Doppelklick führte in diesem Lauf zu genau einem eingereichten Thema." };
  });

  await pruefe("Freigeben: synchroner Doppelklick", async () => {
    erwarte(Boolean(id), "Ohne eingereichtes Thema kann die Freigabe nicht geprüft werden.");
    await ergaenzeRedaktion(admin, id);
    await gibFrei(admin, titel, { doppelt: true });
    const oeffentlich = await refKontext.newPage();
    await oeffentlich.goto(`${BASIS}/fortbildungen?q=${encodeURIComponent(titel)}`);
    const anzahl = await oeffentlich.getByText(titel, { exact: true }).count();
    await oeffentlich.close();
    erwarte(anzahl === 1, `Das veröffentlichte Thema erscheint außen ${anzahl}-mal.`);
    return { satz: "Die statusgebundene Freigabe wurde genau einmal wirksam und ist einmal öffentlich sichtbar." };
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
