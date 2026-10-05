import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BASIS,
  adminAnmelden,
  erwarte,
  idAusUrl,
  legePersonAn,
  neuerKontext,
  starteBrowser,
  testPerson,
} from "./randfaelle/hilfe.mjs";

/**
 * Sichtprüfung der Terminumfrage: legt eine Umfrage mit drei antwortenden
 * Personen an und fotografiert öffentliche Seite (1280 und 390 px), Admin-
 * Detail und Admin-Formular nach `scripts/e2e/bilder/umfrage-*.png`.
 * Räumt die Umfrage am Ende wieder weg.
 */
const ordner = path.join(path.dirname(fileURLToPath(import.meta.url)), "bilder");
const kennung = Date.now().toString(36);
const titel = `Fachtagung Medienbildung ${kennung}`;
const vornamen = { a: "Anna", b: "Benedikt", c: "Carolin" };
const personen = ["a", "b", "c"].map((k) => ({
  ...testPerson(`bild${k}-${kennung}`),
  vorname: vornamen[k],
}));
const antworten = [
  ["Ja", "Vielleicht", "Nein", "Ja", "Nein"],
  ["Nein", "Ja", "Ja", "Vielleicht", "Ja"],
  ["Ja", "Ja", "Nein", "Nein", "Vielleicht"],
];

const browser = await starteBrowser();
const fehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, fehler);
try {
  await adminAnmelden(admin);
  for (const p of personen) await legePersonAn(admin, p);

  await admin.setViewportSize({ width: 1280, height: 900 });
  await admin.goto(`${BASIS}/admin/umfragen/neu`);
  await admin.getByLabel("Titel", { exact: true }).fill(titel);
  await admin.getByLabel("Ort (optional)").fill("Schulamt Aichach-Friedberg, Raum 4");
  await admin.getByLabel("Uhrzeit (optional)").fill("14:00 bis 17:00 Uhr");
  await admin.getByLabel("Beschreibung (optional)").fill("Wir suchen einen Termin für die Fachtagung im November.");
  for (let i = 1; i < 5; i += 1) await admin.getByRole("button", { name: "Termin hinzufügen" }).click();
  const tage = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
  for (const [i, t] of tage.entries()) await admin.locator('input[type="date"]').nth(i).fill(t);
  await admin.screenshot({ path: path.join(ordner, "umfrage-admin-formular-1280.png"), fullPage: true });
  await admin.getByRole("button", { name: "Keine auswählen" }).click();
  for (const p of personen) await admin.getByLabel(new RegExp(p.nachname)).check();
  await admin.getByRole("button", { name: "Umfrage speichern" }).click();
  await admin.waitForURL(/\/admin\/umfragen\/[^/?]+\?gespeichert=1/);
  const id = idAusUrl(admin.url());

  const links = [];
  for (const p of personen) {
    const roh = await admin
      .getByRole("button", { name: `Link für ${p.vorname} ${p.nachname} kopieren` })
      .getAttribute("data-link");
    links.push(`${BASIS}${new URL(roh).pathname}`);
  }

  for (const [i, link] of links.entries()) {
    const { kontext, seite } = await neuerKontext(browser, fehler);
    await seite.setViewportSize({ width: 1280, height: 900 });
    await seite.goto(link);
    const gruppen = seite.getByRole("group", { name: /^Antwort für/ });
    for (const [j, wert] of antworten[i].entries()) {
      await gruppen.nth(j).locator("label").filter({ hasText: new RegExp(`^\\s*${wert}\\s*$`) }).click();
    }
    if (i === 0) await seite.getByLabel("Kommentar (optional)").fill("Donnerstag nur vormittags.");
    await seite.getByRole("button", { name: "Speichern" }).click();
    await seite.getByTestId("dankeskasten").waitFor();
    if (i === 0) {
      await seite.screenshot({ path: path.join(ordner, "umfrage-oeffentlich-1280.png"), fullPage: true });
      await seite.setViewportSize({ width: 390, height: 844 });
      // Kein seitliches Scrollen der ganzen Seite, nur die Tabelle darf scrollen
      const messung = await seite.evaluate(() => ({
        breite: document.documentElement.scrollWidth,
        zuBreit: [...document.querySelectorAll("body *")]
          .filter((e) => !e.closest('[data-testid="umfrage-matrix"]') || e.matches('[data-testid="umfrage-matrix"]'))
          .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 || e.scrollWidth > e.clientWidth + 1)
          .slice(0, 5)
          .map((e) => `${e.tagName}.${String(e.className).slice(0, 50)} r=${Math.round(e.getBoundingClientRect().right)} sw=${e.scrollWidth} cw=${e.clientWidth} ov=${getComputedStyle(e).overflowX}`),
      }));
      console.log("Seitenbreite bei 390 px:", messung.breite, messung.zuBreit.join(" | "));
      erwarte(messung.breite <= 390, `Die Seite ist bei 390 px ${messung.breite} px breit.`);
      await seite.screenshot({ path: path.join(ordner, "umfrage-oeffentlich-390.png"), fullPage: true });
      // Tabelle seitlich scrollen: die Namensspalte muss stehen bleiben
      const matrix = seite.getByTestId("umfrage-matrix");
      await matrix.evaluate((el) => {
        el.scrollLeft = 9999;
      });
      await matrix.screenshot({ path: path.join(ordner, "umfrage-matrix-390-gescrollt.png") });
    }
    await kontext.close();
  }

  await admin.goto(`${BASIS}/admin/umfragen/${id}`);
  await admin.screenshot({ path: path.join(ordner, "umfrage-admin-detail-1280.png"), fullPage: true });
  await admin.goto(`${BASIS}/admin/umfragen`);
  await admin.screenshot({ path: path.join(ordner, "umfrage-admin-liste-1280.png"), fullPage: true });

  // Geschlossene Ansicht mit festgelegtem Termin
  await admin.goto(`${BASIS}/admin/umfragen/${id}`);
  await admin.getByRole("button", { name: "Termin festlegen" }).click();
  await admin.getByRole("dialog").getByLabel("Di 10.11.").check();
  await admin.getByRole("dialog").getByRole("button", { name: "Festlegen und schließen" }).click();
  await admin.getByText("Festgelegt: Di 10.11.").waitFor();
  const { kontext, seite } = await neuerKontext(browser, fehler);
  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto(links[0]);
  await seite.getByText("Die Umfrage ist geschlossen").waitFor();
  await seite.screenshot({ path: path.join(ordner, "umfrage-geschlossen-1280.png"), fullPage: true });
  await kontext.close();

  await admin.goto(`${BASIS}/admin/umfragen/${id}`);
  await admin.getByRole("button", { name: "Löschen", exact: true }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Endgültig löschen" }).click();
  await admin.waitForURL(/\/admin\/umfragen$/);
  erwarte(fehler.length === 0, `Seitenfehler: ${fehler.join("; ")}`);
  console.log("Bilder nach", ordner);
} finally {
  await adminKontext.close();
  await browser.close();
}
