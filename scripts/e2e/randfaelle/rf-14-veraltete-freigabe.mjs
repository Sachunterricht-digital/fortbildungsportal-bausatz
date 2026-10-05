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
 * Ändert nur die Beschreibung und speichert — der Status bleibt unangetastet
 * (Select bleibt auf dem geladenen Wert stehen), damit ausschließlich
 * `updatedAt` springt. Eigenständig statt hilfe.mjs' `reicheEntwurfEin()`,
 * weil dessen Status-Select-Filter „Entwurf|Eingereicht“ ohne /i-Flag am
 * klein geschriebenen Label „Zur Freigabe eingereicht“ vorbeigreift.
 */
async function aendereNurBeschreibung(seite, id, beschreibung) {
  await seite.goto(`${BASIS}/admin/fortbildungen/${id}`);
  await seite.getByRole("tab", { name: "Beschreibung" }).click();
  await seite.locator(".ProseMirror").click();
  await seite.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await seite.keyboard.type(beschreibung);
  await seite.getByRole("tab", { name: "Eckdaten" }).click();
  await seite.getByRole("button", { name: "Änderungen speichern" }).click();
  await seite.waitForURL(/gespeichert=1/, { timeout: 20_000 });
}

/**
 * Sammelliste 29.09., Punkt b: freigeben() und zurueckweisen() lehnen eine
 * Freigabe ab, wenn sich das Thema seit dem zuletzt gesehenen Formular
 * geändert hat (updatedAt-Abgleich, src/actions/freigabe.ts). Der Referent
 * ändert das eingereichte Thema erneut — das bekannte, hier nicht behobene
 * Nebenverhalten „EINGEREICHT bleibt bearbeitbar“ macht diesen Testaufbau
 * überhaupt erst möglich.
 */
const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);

  const titel = `RF14 Veraltete Freigabe ${Date.now().toString(36)}`;
  const id = await reicheNeuesSchilfEin(ref, titel, "Ursprüngliche Beschreibung.");
  await ergaenzeRedaktion(admin, id);

  // Admin öffnet die Freigabeliste — das Formular trägt den updatedAt-Stand
  // von jetzt verdeckt mit.
  await admin.goto(`${BASIS}/admin/freigaben`);
  const karte = admin.locator("article").filter({ hasText: titel });
  await karte.waitFor({ timeout: 15_000 });

  // Referent ändert das Thema zwischenzeitlich erneut (Status bleibt
  // EINGEREICHT) — der Admin hat diese Fassung nicht gesehen.
  await aendereNurBeschreibung(ref, id, "Zwischenzeitlich geänderte Beschreibung.");

  await pruefe("Freigabe auf veraltetem Stand wird abgelehnt", async () => {
    await karte.getByRole("button", { name: "Freigeben und veröffentlichen" }).click();
    await admin
      .getByText("Das Thema wurde inzwischen geändert. Bitte neu laden und erneut prüfen.")
      .waitFor({ timeout: 10_000 });
    // Die Karte bleibt stehen — anders als bei einer erfolgreichen Freigabe,
    // die sie aus der Liste entfernt (siehe gibFrei() in hilfe.mjs).
    erwarte(
      (await karte.count()) > 0,
      "Die Karte ist trotz abgelehnter Freigabe aus der Liste verschwunden.",
    );
    return { satz: "Die Freigabe auf altem Stand meldet die Änderung und veröffentlicht nichts." };
  });

  await pruefe("Nach dem Neuladen klappt die Freigabe auf dem aktuellen Stand", async () => {
    await admin.goto(`${BASIS}/admin/freigaben`);
    const frischeKarte = admin.locator("article").filter({ hasText: titel });
    await frischeKarte.getByRole("button", { name: "Freigeben und veröffentlichen" }).click();
    await frischeKarte.getByRole("link", { name: titel, exact: true }).waitFor({
      state: "detached",
      timeout: 15_000,
    });
    return { satz: "Nach dem Neuladen mit aktuellem Stand klappt die Freigabe wie gewohnt." };
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
