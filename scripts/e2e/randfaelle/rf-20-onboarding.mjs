import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BASIS,
  adminAnmelden,
  erwarte,
  idAusUrl,
  legePersonAn,
  melde,
  neuerKontext,
  personMitEinladung,
  profilSpeichern,
  pruefe,
  setzePasswort,
  starteBrowser,
  testPerson,
} from "./hilfe.mjs";

/**
 * Onboarding unter der Terminumfrage (Zweig `onboarding`): Wortlaut, Zeitenblock,
 * Bilder, Speichern, Trennung von der Terminantwort, Eingabeprüfung, Rollen,
 * Protokoll ohne Handynummer, Stilllegen/Löschen. Die Handynummer des
 * Onboardings ist `Referent.telefon` (Profilfeld „Telefon“), es gibt nur eine.
 *
 * Läuft nur gegen die Testinstanz (Tunnel auf Port 3101). Die Datenbank wird
 * per psql über SSH gelesen, geschrieben nur für Rollen/Status-Wechsel und die
 * Testzeilen der Fälle „Stilllegen“ und „Löschen“.
 */

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BILDER = path.join(HIER, "..", "bilder");
mkdirSync(BILDER, { recursive: true });
const TEXTE = path.join(HIER, "..", "..", "..", "..", "docs", "onboarding", "texte-entwurf.md");

/** SQL über stdin, damit keine Anführungszeichen durch die Shell laufen. */
function sqlAus(befehl) {
  return execFileSync(
    "ssh",
    [(process.env.TEST_SSH_HOST ?? "testserver"), "docker exec -i fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm -At"],
    { input: befehl },
  ).toString().trim();
}
const sql = (befehl) => void sqlAus(befehl);

const NUMMER = "+49 151 5550142";
const NUMMER_ZIFFERN = "5550142";
const NUMMER_PROFIL = "+49 151 5550177";
const NUMMER_PROFIL_ZIFFERN = "5550177";
const BEMERKUNG = "BEMERKUNGSMARKE Montag erst ab 14 Uhr";

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: aKontext, seite: seiteA } = await neuerKontext(browser, seitenfehler);
const { kontext: bKontext, seite: seiteB } = await neuerKontext(browser, seitenfehler);

const kennung = Date.now().toString(36);
const personB = testPerson(`rf20b-${kennung}`);
const personC = testPerson(`rf20c-${kennung}`);
const personD = testPerson(`rf20d-${kennung}`);
const titel = `RF20 Umfrage ${kennung}`;
let personA;
let nameA;
let nameB = `${personB.vorname} ${personB.nachname}`;
let umfrageId = "";
let linkA = "";
let linkB = "";
let idA = "";
let idB = "";
let idC = "";
let idD = "";
let fortbildungsZuordnung = false;

/** Link aus „Link kopieren“ der Admin-Seite, auf die Testinstanz umgebogen. */
async function personenlink(name) {
  const roh = await admin.getByRole("button", { name: `Link für ${name} kopieren` }).getAttribute("data-link");
  erwarte(roh, `Kein Link für ${name} gefunden.`);
  return `${BASIS}${new URL(roh).pathname}`;
}

const referentId = (email) => sqlAus(`SELECT id FROM "Referent" WHERE email='${email}'`);

/** Die eine Telefonnummer der Person, `-` wenn leer. */
const telefon = (id) => sqlAus(`SELECT coalesce(telefon,'-') FROM "Referent" WHERE id='${id}'`);

/** Eine Zeile mit allen Angaben, damit „unverändert“ schon an updatedAt scheitert. */
function zeile(id) {
  return sqlAus(
    `SELECT kontaktwege::text||'|'||"weitereFormate"||'|'||zeiten::text||'|'||coalesce(bemerkung,'-')||'|'||"updatedAt" FROM "ReferentOnboarding" WHERE "referentId"='${id}'`,
  );
}
const zeilenZahl = (id) => Number(sqlAus(`SELECT count(*) FROM "ReferentOnboarding" WHERE "referentId"='${id}'`));

function normal(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** Setzt ein Kästchen über das umgebende Label, wie ein Mensch. */
async function setze(seite, name, an) {
  const feld = typeof name === "string" ? seite.getByLabel(name, { exact: true }) : seite.getByLabel(name);
  if ((await feld.isChecked()) !== an) await feld.locator("xpath=ancestor::label[1]").click();
  erwarte((await feld.isChecked()) === an, `„${name}“ ist nicht ${an ? "an" : "aus"}.`);
}

const formularKnopf = (seite) => seite.getByTestId("onboarding-formular").getByRole("button", { name: "Speichern" });
const profilKnopf = (seite) => seite.getByTestId("onboarding-profil-knopf").getByText("Weiter zum Profil", { exact: true });
const zustimmung = /Bei weiteren Formaten arbeite ich auf Anfrage gern mit/;

async function speichern(seite) {
  await formularKnopf(seite).click();
  await seite.getByTestId("onboarding-erfolg").waitFor({ timeout: 15_000 });
}

async function oeffne(seite, link) {
  await seite.goto(link);
  await seite.locator("#onboarding").waitFor({ timeout: 15_000 });
}

try {
  await adminAnmelden(admin);

  // -------------------------------------------------------------------------
  // Einrichtung: Person A mit Konto (REFERENT), B ohne Konto, Umfrage mit drei Terminen
  // -------------------------------------------------------------------------
  const einladung = await personMitEinladung(admin, { kennung: `rf20a-${kennung}` });
  personA = einladung.person;
  nameA = `${personA.vorname} ${personA.nachname}`;
  await setzePasswort(seiteA, einladung.link, personA);
  await legePersonAn(admin, personB);
  idA = referentId(personA.email);
  idB = referentId(personB.email);
  erwarte(idA && idB, "Referent-IDs der Testpersonen nicht gefunden.");

  await admin.goto(`${BASIS}/admin/umfragen/neu`);
  await admin.getByLabel("Titel", { exact: true }).fill(titel);
  for (let i = 1; i < 3; i += 1) await admin.getByRole("button", { name: "Termin hinzufügen" }).click();
  const felder = admin.locator('input[type="date"]');
  for (const [index, tag] of ["2026-11-09", "2026-11-10", "2026-11-11"].entries()) await felder.nth(index).fill(tag);
  await admin.getByRole("button", { name: "Keine auswählen" }).click();
  await admin.getByLabel(new RegExp(personA.nachname)).check();
  await admin.getByLabel(new RegExp(personB.nachname)).check();
  await admin.getByRole("button", { name: "Umfrage speichern" }).click();
  await admin.waitForURL(/\/admin\/umfragen\/[^/?]+\?gespeichert=1/, { timeout: 20_000 });
  umfrageId = idAusUrl(admin.url());
  linkA = await personenlink(nameA);
  linkB = await personenlink(nameB);

  // -------------------------------------------------------------------------
  await pruefe("Wortlaut aus texte-entwurf.md ist sichtbar, Überschriften H2/H3, kein „du“", async () => {
    await oeffne(seiteA, linkA);
    await setze(seiteA, zustimmung, true);
    const abschnitt = normal(await seiteA.locator("#onboarding").innerText());
    const zeilen = readFileSync(TEXTE, "utf8")
      .split("\n")
      .map((z) => z.replace(/^#+\s*/, "").replace(/^-\s+/, "").replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean);
    erwarte(zeilen.length >= 15, `Die Textquelle ergibt nur ${zeilen.length} Zeilen.`);
    const fehlt = [];
    for (const z of zeilen) {
      const n = normal(z);
      if (abschnitt.includes(n)) continue;
      // Die Seite trennt manche Zeilen in Titel und Text (Handynummer, Schritte)
      const teile = n.split(/(?<=\))\. |: /);
      if (teile.length > 1 && teile.every((t) => abschnitt.includes(normal(t)))) continue;
      fehlt.push(n);
    }
    erwarte(fehlt.length === 0, `Fehlt im Abschnitt: ${fehlt.join(" || ")}`);

    erwarte((await seiteA.locator("h1").count()) === 1, "Es sollte genau eine H1 (Umfragetitel) geben.");
    erwarte(
      (await seiteA.locator("#onboarding h2").innerText()) === "Willkommen im Referentennetzwerk",
      "Titel des Onboardings ist keine H2.",
    );
    const h3 = await seiteA.locator("#onboarding h3").allInnerTexts();
    erwarte(
      h3.join("|") === "Kontaktmöglichkeiten|Weitere Formate|Das Portal in drei Schritten",
      `H3-Karten stimmen nicht: ${h3.join("|")}`,
    );
    erwarte(!/\b(du|dir|dich|dein\w*)\b/i.test(abschnitt), "Im Onboarding-Abschnitt steht ein „du“.");
    return { satz: `${zeilen.length} Zeilen der Textquelle stehen 1:1 auf der Seite, eine H1, ein H2, drei H3, kein „du“.` };
  });

  await pruefe("Zeitenblock erscheint erst nach Ankreuzen von „weitere Formate“", async () => {
    await oeffne(seiteA, linkA);
    erwarte((await seiteA.getByTestId("onboarding-zeiten").count()) === 0, "Zeitenblock ist ohne Ankreuzen im DOM.");
    erwarte((await seiteA.getByText("Wenn ja, passen mir meist diese Zeiten").count()) === 0, "Zeitfrage ist ohne Ankreuzen im DOM.");
    erwarte((await seiteA.locator('input[name="zeit"]').count()) === 0, "Zeit-Kästchen sind ohne Ankreuzen im DOM.");
    await setze(seiteA, zustimmung, true);
    await seiteA.getByTestId("onboarding-zeiten").waitFor();
    erwarte((await seiteA.locator('input[name="zeit"]').count()) === 10, "Es sollten zehn Zeit-Kästchen da sein.");
    await setze(seiteA, zustimmung, false);
    erwarte((await seiteA.getByTestId("onboarding-zeiten").count()) === 0, "Zeitenblock bleibt nach Abwählen stehen.");
    return { satz: "Ohne Haken kein Zeitenblock im DOM, mit Haken zehn Kästchen und die Zeitfrage, nach Abwählen wieder weg." };
  });

  await pruefe("Die drei Bilder laden (img und direkter Abruf)", async () => {
    await oeffne(seiteA, linkA);
    await seiteA.getByTestId("onboarding-portal").scrollIntoViewIfNeeded();
    const bilder = await seiteA.locator('[data-testid="onboarding-portal"] img').evaluateAll((els) =>
      els.map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0, alt: i.alt })),
    );
    erwarte(bilder.length === 3, `Erwartet drei Bilder, gefunden ${bilder.length}.`);
    erwarte(bilder.every((b) => b.ok), `Ein Bild lädt nicht: ${JSON.stringify(bilder.filter((b) => !b.ok))}`);
    for (const b of bilder) {
      const antwort = await seiteA.request.get(`${BASIS}${b.src}`);
      erwarte(antwort.status() === 200 && /image\/png/.test(antwort.headers()["content-type"] ?? ""), `${b.src}: Status ${antwort.status()}`);
    }
    return { satz: `Alle drei Bilder (${bilder.map((b) => b.alt).join(", ")}) laden im Browser und per Direktabruf als PNG.` };
  });

  // -------------------------------------------------------------------------
  await pruefe("Speichern, Neuladen: Angaben sind wieder da (psql), Nummer steht in Referent.telefon und ist vorbelegt", async () => {
    await oeffne(seiteA, linkA);
    await setze(seiteA, "Mail", true);
    await setze(seiteA, "Telefon", true);
    await seiteA.locator("#onboarding-telefon").fill(NUMMER);
    await setze(seiteA, zustimmung, true);
    await setze(seiteA, "Montag vormittags", true);
    await setze(seiteA, "Dienstag nachmittags", true);
    await seiteA.locator("#onboarding-bemerkung").fill(BEMERKUNG);
    await speichern(seiteA);
    erwarte((await seiteA.getByTestId("onboarding-erfolg").innerText()) === "Gespeichert.", "Erfolgsmeldung stimmt nicht.");
    erwarte(
      zeile(idA).startsWith(`{MAIL,TELEFON}|true|{MO_VORMITTAGS,DI_NACHMITTAGS}|${BEMERKUNG}|`),
      `Zeile in der Datenbank stimmt nicht: ${zeile(idA)}`,
    );
    erwarte(telefon(idA) === NUMMER, `Referent.telefon stimmt nicht: ${telefon(idA)}`);
    erwarte(
      Number(sqlAus(`SELECT count(*) FROM information_schema.columns WHERE table_name='ReferentOnboarding' AND column_name IN ('handynummer','telefon')`)) === 0,
      "Die Tabelle ReferentOnboarding hat eine eigene Nummernspalte.",
    );
    await oeffne(seiteA, linkA);
    erwarte((await seiteA.locator("#onboarding-telefon").inputValue()) === NUMMER, "Die Nummer ist nicht vorbelegt.");
    erwarte(await seiteA.getByLabel("Mail", { exact: true }).isChecked(), "Mail ist nach dem Neuladen nicht angekreuzt.");
    erwarte(await seiteA.getByLabel("Telefon", { exact: true }).isChecked(), "Telefon ist nach dem Neuladen nicht angekreuzt.");
    erwarte(!(await seiteA.getByLabel("Messenger-Gruppe", { exact: true }).isChecked()), "Messenger ist angekreuzt.");
    erwarte(await seiteA.getByLabel(zustimmung).isChecked(), "„weitere Formate“ ist nicht angekreuzt.");
    erwarte(await seiteA.getByLabel("Montag vormittags", { exact: true }).isChecked(), "Montag vormittags fehlt.");
    erwarte(await seiteA.getByLabel("Dienstag nachmittags", { exact: true }).isChecked(), "Dienstag nachmittags fehlt.");
    erwarte(!(await seiteA.getByLabel("Montag nachmittags", { exact: true }).isChecked()), "Montag nachmittags ist angekreuzt.");
    erwarte((await seiteA.locator("#onboarding-bemerkung").inputValue()) === BEMERKUNG, "Bemerkung fehlt nach dem Neuladen.");
    return { satz: "Zeile in der Datenbank stimmt, die Nummer steht in Referent.telefon (keine eigene Spalte), nach dem Neuladen sind alle Felder wieder gefüllt." };
  });

  await pruefe("Nur Onboarding speichern: geantwortetAm bleibt leer, keine Terminantwort, nicht in „Alle Antworten“", async () => {
    const stand = sqlAus(
      `SELECT ("geantwortetAm" IS NULL)::text||'|'||(SELECT count(*) FROM "UmfrageAntwort" a WHERE a."teilnehmerId"=t.id) FROM "UmfrageTeilnehmer" t WHERE t."umfrageId"='${umfrageId}' AND t."referentId"='${idA}'`,
    );
    erwarte(stand === "true|0", `Teilnehmerzeile von A stimmt nicht: ${stand}`);
    await oeffne(seiteB, linkB);
    const matrix = seiteB.getByTestId("umfrage-matrix");
    erwarte((await matrix.locator(`tr[data-zeile="${nameA}"]`).count()) === 0, "A steht in „Alle Antworten“.");
    erwarte((await matrix.getByText("Noch hat niemand geantwortet.").count()) === 1, "Die Tabelle sollte leer sein.");
    await oeffne(seiteA, linkA);
    erwarte(
      (await seiteA.getByTestId("umfrage-matrix").locator(`tr[data-zeile="${nameA}"]`).count()) === 0,
      "A steht bei sich selbst in „Alle Antworten“.",
    );
    return { satz: "geantwortetAm leer, null Antwortzeilen, A fehlt in der Tabelle bei A und B." };
  });

  await pruefe("Die Nummer von A taucht nirgends bei B, in der Umfrage-Administration oder öffentlich auf", async () => {
    const orte = [];
    const pruefeSeite = async (seite, url, bezeichnung) => {
      await seite.goto(url, { waitUntil: "networkidle" });
      const inhalt = await seite.content();
      erwarte(!inhalt.includes(NUMMER_ZIFFERN), `${bezeichnung}: Nummer gefunden.`);
      erwarte(!inhalt.includes("BEMERKUNGSMARKE"), `${bezeichnung}: Bemerkung gefunden.`);
      orte.push(bezeichnung);
    };
    await pruefeSeite(seiteB, linkB, "Umfrageseite von B");
    erwarte((await seiteB.locator("#onboarding-telefon").inputValue()) === "", "Das Nummernfeld von B ist nicht leer.");
    await pruefeSeite(seiteB, `${BASIS}/`, "Startseite");
    await pruefeSeite(seiteB, `${BASIS}/fortbildungen`, "Fortbildungen");
    await pruefeSeite(seiteB, `${BASIS}/kalender`, "Kalender");
    await pruefeSeite(admin, `${BASIS}/admin/umfragen/${umfrageId}`, "Admin Umfrage");
    await pruefeSeite(admin, `${BASIS}/admin/umfragen`, "Admin Umfragenliste");
    // Bei A selbst ist sie vorbelegt, im Profil von A steht sie ebenfalls
    await oeffne(seiteA, linkA);
    erwarte((await seiteA.locator("#onboarding-telefon").inputValue()) === NUMMER, "Bei A fehlt die Vorbelegung.");
    return { satz: `Nummer und Bemerkung von A fehlen im HTML von: ${orte.join(", ")}. Nur bei A selbst ist das Feld vorbelegt.` };
  });

  await pruefe("Eine Nummer: Onboarding schreibt ins Profil, das Profil ins Onboarding", async () => {
    // Onboarding -> Profil (A hat in einem früheren Fall mit NUMMER gespeichert)
    await seiteA.goto(`${BASIS}/admin/konto`);
    erwarte((await seiteA.locator('input[name="telefon"]').inputValue()) === NUMMER, "Im Profil von A steht die Onboarding-Nummer nicht.");
    // Profil -> Onboarding
    await profilSpeichern(seiteA, { telefon: NUMMER_PROFIL });
    erwarte(telefon(idA) === NUMMER_PROFIL, `Referent.telefon nach Profil: ${telefon(idA)}`);
    await oeffne(seiteA, linkA);
    erwarte((await seiteA.locator("#onboarding-telefon").inputValue()) === NUMMER_PROFIL, "Das Onboarding zeigt die Profil-Nummer nicht vorbelegt.");
    // Onboarding speichert die Profil-Nummer unverändert mit, ohne die Zeile zu zerstören
    const vorher = zeile(idA).split("|").slice(0, 4).join("|");
    await speichern(seiteA);
    erwarte(telefon(idA) === NUMMER_PROFIL, `Speichern ohne Änderung hat die Nummer verändert: ${telefon(idA)}`);
    erwarte(zeile(idA).split("|").slice(0, 4).join("|") === vorher, "Speichern ohne Änderung hat die Onboarding-Zeile verändert.");
    // Admin sieht die Profil-Nummer in der Onboarding-Ansicht und in der Referentenverwaltung
    await admin.goto(`${BASIS}/admin/referenten/onboarding`);
    erwarte(normal(await admin.locator(`tr[data-zeile="${nameA}"]`).innerText()).includes(NUMMER_PROFIL), "Admin-Ansicht zeigt die Profil-Nummer nicht.");
    // Onboarding ändert wieder auf NUMMER, das Profil folgt
    await oeffne(seiteA, linkA);
    await seiteA.locator("#onboarding-telefon").fill(NUMMER);
    await speichern(seiteA);
    erwarte(telefon(idA) === NUMMER, `Referent.telefon nach Onboarding: ${telefon(idA)}`);
    await seiteA.goto(`${BASIS}/admin/konto`);
    erwarte((await seiteA.locator('input[name="telefon"]').inputValue()) === NUMMER, "Das Profil zeigt die geänderte Onboarding-Nummer nicht.");
    // Die Profil-Nummer war nur kurz da und steht nirgends mehr bei anderen
    await seiteB.goto(linkB, { waitUntil: "networkidle" });
    erwarte(!(await seiteB.content()).includes(NUMMER_PROFIL_ZIFFERN), "Die Profil-Nummer von A steht bei B.");
    return { satz: "Onboarding-Nummer steht im Profil (/admin/konto), Profil-Änderung erscheint vorbelegt im Onboarding, Speichern ohne Änderung lässt alles gleich, Rückweg Onboarding nach Profil ebenfalls." };
  });

  await pruefe("Admin-Ansicht zeigt Angaben, Filter formate/kontakt/offen wirken", async () => {
    await admin.goto(`${BASIS}/admin/referenten/onboarding`);
    const zeileA = admin.locator(`tr[data-zeile="${nameA}"]`);
    await zeileA.waitFor();
    const text = normal(await zeileA.innerText());
    for (const teil of [personA.organisation, "Mail, Telefon", NUMMER, "Ja", "Mo vm, Di nm", BEMERKUNG]) {
      erwarte(text.includes(teil), `Zeile von A enthält „${teil}“ nicht: ${text}`);
    }
    erwarte(/\d{2}\.\d{2}\.\d{4}/.test(text), "Stand (Datum) fehlt.");
    const zeileB = admin.locator(`tr[data-zeile="${nameB}"]`);
    erwarte(normal(await zeileB.innerText()).includes("Noch nichts gespeichert"), "B sollte „Noch nichts gespeichert“ zeigen.");
    // Das Telefon kommt aus dem Profil und steht auch ohne Onboarding-Zeile da
    sql(`UPDATE "Referent" SET telefon='+49 170 5550123' WHERE id='${idB}'`);
    await admin.goto(`${BASIS}/admin/referenten/onboarding`);
    erwarte(normal(await admin.locator(`tr[data-zeile="${nameB}"]`).innerText()).includes("+49 170 5550123"), "B ohne Onboarding zeigt das Profil-Telefon nicht.");
    sql(`UPDATE "Referent" SET telefon=NULL WHERE id='${idB}'`);

    const sicht = async (query) => {
      await admin.goto(`${BASIS}/admin/referenten/onboarding${query}`);
      await admin.getByTestId("onboarding-zaehler").waitFor();
      return {
        a: await admin.locator(`tr[data-zeile="${nameA}"]`).count(),
        b: await admin.locator(`tr[data-zeile="${nameB}"]`).count(),
      };
    };
    let s = await sicht("?formate=1");
    erwarte(s.a === 1 && s.b === 0, `?formate=1: A=${s.a} B=${s.b}`);
    s = await sicht("?kontakt=TELEFON");
    erwarte(s.a === 1 && s.b === 0, `?kontakt=TELEFON: A=${s.a} B=${s.b}`);
    s = await sicht("?kontakt=MESSENGER");
    erwarte(s.a === 0 && s.b === 0, `?kontakt=MESSENGER: A=${s.a} B=${s.b}`);
    s = await sicht("?offen=1");
    erwarte(s.a === 0 && s.b === 1, `?offen=1: A=${s.a} B=${s.b}`);
    s = await sicht("?kontakt=UNSINN");
    erwarte(s.a === 1 && s.b === 1, `?kontakt=UNSINN (wird ignoriert): A=${s.a} B=${s.b}`);
    // Filter über die Knöpfe
    await admin.goto(`${BASIS}/admin/referenten/onboarding`);
    await admin.getByRole("link", { name: "Weitere Formate" }).click();
    await admin.waitForURL(/formate=1/);
    return { satz: "Zeile von A mit allen Spalten, B als „Noch nichts gespeichert“, die vier Filter liefern je die erwartete Menge, Unsinn im Filter wird ignoriert." };
  });

  await pruefe("Sichtprüfung: Screenshots der Seite bei 1280 und 390 px", async () => {
    for (const [breite, hoehe] of [[1280, 900], [390, 844]]) {
      await seiteA.setViewportSize({ width: breite, height: hoehe });
      await oeffne(seiteA, linkA);
      await seiteA.locator("#onboarding").screenshot({ path: path.join(BILDER, `onboarding-${breite}.png`) });
      await profilKnopf(seiteA).scrollIntoViewIfNeeded();
      await seiteA.screenshot({ path: path.join(BILDER, `onboarding-ende-${breite}.png`) });
      const ueberlauf = await seiteA.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      erwarte(ueberlauf <= 0, `Bei ${breite} px läuft die Seite ${ueberlauf} px über.`);
      await admin.setViewportSize({ width: breite, height: hoehe });
      await admin.goto(`${BASIS}/admin/referenten/onboarding`);
      await admin.getByTestId("onboarding-tabelle").waitFor();
      await admin.screenshot({ path: path.join(BILDER, `onboarding-admin-${breite}.png`) });
      const adminUeberlauf = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      erwarte(adminUeberlauf <= 0, `Admin-Ansicht läuft bei ${breite} px ${adminUeberlauf} px über.`);
    }
    await seiteA.setViewportSize({ width: 1280, height: 900 });
    await admin.setViewportSize({ width: 1280, height: 900 });
    return { satz: "Screenshots in scripts/e2e/bilder/onboarding-*.png, kein horizontaler Überlauf bei 1280 und 390 px." };
  });

  const fehlerVorRollen = seitenfehler.length;
  await pruefe("Rollen: REFERENT und REDAKTEUR haben keinen Zugriff, ADMIN sieht den Link", async () => {
    const gesperrt = async (bezeichnung) => {
      await seiteA.goto(`${BASIS}/admin/referenten/onboarding`);
      await seiteA.getByText("Kein Zugriff").waitFor({ timeout: 15_000 });
      const inhalt = await seiteA.content();
      erwarte(!inhalt.includes(NUMMER_ZIFFERN), `${bezeichnung}: Nummer im HTML.`);
      erwarte((await seiteA.getByTestId("onboarding-tabelle").count()) === 0, `${bezeichnung}: Tabelle sichtbar.`);
    };
    await gesperrt("REFERENT");
    sql(`UPDATE "User" SET role='REDAKTEUR' WHERE email='${personA.email}'`);
    try {
      await gesperrt("REDAKTEUR");
      await seiteA.goto(`${BASIS}/admin/referenten`);
      await seiteA.getByRole("heading", { name: "Referentinnen und Referenten" }).waitFor();
      erwarte((await seiteA.getByRole("link", { name: "Onboarding-Angaben" }).count()) === 0, "REDAKTEUR sieht den Link.");
      // Die Referentenverwaltung zeigt `telefon` auch der Rolle REDAKTEUR, das ist akzeptiert
      // (live nur ein ADMIN-Konto, keine Redaktion). Die Onboarding-Ansicht bleibt ADMIN-only.
    } finally {
      sql(`UPDATE "User" SET role='REFERENT' WHERE email='${personA.email}'`);
    }
    await admin.goto(`${BASIS}/admin/referenten`);
    await admin.getByRole("link", { name: "Onboarding-Angaben" }).waitFor();
    return { satz: "REFERENT und REDAKTEUR (per psql gesetzt) sehen „Kein Zugriff“ ohne Nummer, nur ADMIN sieht Link und Tabelle." };
  });

  // Die gesperrten Seiten antworten absichtlich mit 500 (requireRole wirft, error.tsx fängt es ab)
  for (let i = seitenfehler.length - 1; i >= fehlerVorRollen; i -= 1) {
    if (/^500 .*\/admin\/referenten\/onboarding$/.test(seitenfehler[i])) seitenfehler.splice(i, 1);
  }

  await pruefe("AuditLog hält das Speichern fest, aber ohne Handynummer und Bemerkung", async () => {
    const zahl = Number(sqlAus(`SELECT count(*) FROM "AuditLog" WHERE entitaet='ReferentOnboarding' AND aktion='UPDATE' AND "entitaetId"='${idA}'`));
    erwarte(zahl >= 1, "Kein AuditLog-Eintrag für das Speichern.");
    const leck = Number(
      sqlAus(
        `SELECT count(*) FROM "AuditLog" WHERE entitaet='ReferentOnboarding' AND (details::text LIKE '%${NUMMER_ZIFFERN}%' OR details::text LIKE '%BEMERKUNGSMARKE%' OR details::text ILIKE '%handynummer%' OR details::text ILIKE '%bemerkung%')`,
      ),
    );
    erwarte(leck === 0, `${leck} AuditLog-Einträge enthalten Nummer oder Bemerkung.`);
    const leckAlle = Number(
      sqlAus(`SELECT count(*) FROM "AuditLog" WHERE "entitaetId"='${idA}' AND (details::text LIKE '%${NUMMER_ZIFFERN}%' OR details::text LIKE '%${NUMMER_PROFIL_ZIFFERN}%')`),
    );
    erwarte(leckAlle === 0, `${leckAlle} AuditLog-Einträge zu A enthalten eine Nummer.`);
    const beispiel = sqlAus(`SELECT details::text FROM "AuditLog" WHERE entitaet='ReferentOnboarding' AND "entitaetId"='${idA}' ORDER BY at DESC LIMIT 1`);
    erwarte(/telefonGesetzt":\s*true/.test(beispiel), `Protokoll ohne telefonGesetzt: ${beispiel}`);
    return { satz: `${zahl} Einträge, keiner mit Nummer oder Bemerkung, Beispiel: ${beispiel}` };
  });

  // -------------------------------------------------------------------------
  await pruefe("Zu lange Nummer, 301 Zeichen, unmögliche Zeit: Fehler ohne Schreiben", async () => {
    let schritt = "Start";
    const vorher = zeile(idA);
    const telefonVorher = telefon(idA);
    try {
    await oeffne(seiteA, linkA);

    schritt = "1. 41 Zeichen Nummer (Wert wie ein manipulierter Browser, maxlength=40 greift sonst)";
    await seiteA.locator("#onboarding-telefon").evaluate((el, wert) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, wert);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, "0".repeat(41));
    await formularKnopf(seiteA).click();
    await seiteA.getByText(/Die Telefonnummer ist zu lang, höchstens 40 Zeichen\./).waitFor({ timeout: 15_000 });
    erwarte(zeile(idA) === vorher, "Zu lange Nummer hat die Zeile verändert.");
    erwarte(telefon(idA) === telefonVorher, "Zu lange Nummer hat Referent.telefon verändert.");
    erwarte((await seiteA.getByTestId("onboarding-erfolg").count()) === 0, "Trotz Fehler steht „Gespeichert.“ da.");

    schritt = "3. 301 Zeichen Bemerkung (fill umgeht maxlength wie ein manipulierter Browser)";
    await seiteA.locator("#onboarding-telefon").fill(NUMMER);
    // Wert wie ein manipulierter Browser setzen: fill() würde an maxlength=300 abschneiden
    await seiteA.locator("#onboarding-bemerkung").evaluate((el, wert) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, wert);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, "x".repeat(301));
    await formularKnopf(seiteA).click();
    await seiteA.getByText("Die Bemerkung darf höchstens 300 Zeichen haben.").waitFor({ timeout: 15_000 });
    erwarte(zeile(idA) === vorher, "301 Zeichen haben die Zeile verändert.");

    schritt = "4. Unmögliche Zeit über manipulierten Wert";
    await seiteA.locator("#onboarding-bemerkung").fill(BEMERKUNG);
    erwarte((await seiteA.locator("#onboarding-bemerkung").inputValue()) === BEMERKUNG, "Bemerkung wurde nicht zurückgesetzt.");
    const kasten = seiteA.getByLabel("Freitag nachmittags", { exact: true });
    await setze(seiteA, "Freitag nachmittags", true);
    // Erst nach dem Klick, sonst setzt React den Wert beim Rendern zurück
    await kasten.evaluate((el) => { el.value = "SA_VORMITTAGS"; });
    await formularKnopf(seiteA).click();
    await seiteA.getByText("Die Angaben konnten nicht gespeichert werden. Bitte die Seite neu laden.").waitFor({ timeout: 15_000 });
    erwarte(zeile(idA) === vorher, "Unmögliche Zeit hat die Zeile verändert.");
    erwarte(telefon(idA) === telefonVorher, "Unmögliche Zeit hat Referent.telefon verändert.");

    schritt = "5. Unbekannter Kontaktweg";
    await oeffne(seiteA, linkA);
    await setze(seiteA, "Messenger-Gruppe", true);
    await seiteA.getByLabel("Messenger-Gruppe", { exact: true }).evaluate((el) => { el.value = "FAX"; });
    await formularKnopf(seiteA).click();
    await seiteA.getByText("Die Angaben konnten nicht gespeichert werden.").waitFor({ timeout: 15_000 });
    erwarte(zeile(idA) === vorher, "Unbekannter Kontaktweg hat die Zeile verändert.");
    } catch (fehler) {
      throw new Error(`Schritt „${schritt}“: ${fehler.message.split("\n")[0]}`);
    }
    return { satz: "Vier ungültige Eingaben (41 Zeichen Nummer, 301 Zeichen, Zeit, Kontaktweg) zeigen die Meldung, Zeile und Referent.telefon bleiben unverändert." };
  });

  await pruefe("Eingeschleuste fremde referentId bleibt wirkungslos", async () => {
    erwarte(zeilenZahl(idB) === 0, "B hat schon eine Zeile.");
    await oeffne(seiteA, linkA);
    await seiteA.locator("#onboarding-bemerkung").fill(`${BEMERKUNG} zwei`);
    await seiteA.getByTestId("onboarding-formular").evaluate((form, fremd) => {
      for (const name of ["referentId", "referent", "referent_id", "userId", "teilnehmerId"]) {
        const feld = document.createElement("input");
        feld.type = "hidden";
        feld.name = name;
        feld.value = fremd;
        form.appendChild(feld);
      }
    }, idB);
    await speichern(seiteA);
    erwarte(zeilenZahl(idB) === 0, "Für B ist eine Zeile entstanden.");
    erwarte(telefon(idB) === "-", `B hat durch A eine Nummer bekommen: ${telefon(idB)}`);
    erwarte(zeile(idA).includes(`${BEMERKUNG} zwei`), "Die Änderung von A wurde nicht in A gespeichert.");
    return { satz: "Mit eingeschleusten Feldern referentId/userId speichert A weiter nur bei sich, für B entsteht keine Zeile." };
  });

  await pruefe("Formate ab: Zeiten und Bemerkung werden geleert", async () => {
    await oeffne(seiteA, linkA);
    await setze(seiteA, zustimmung, false);
    await speichern(seiteA);
    const z = zeile(idA);
    erwarte(z.startsWith(`{MAIL,TELEFON}|false|{}|-|`), `Zeile nach „Formate ab“: ${z}`);
    erwarte(telefon(idA) === NUMMER, `Die Nummer ging bei „Formate ab“ verloren: ${telefon(idA)}`);
    await oeffne(seiteA, linkA);
    erwarte((await seiteA.getByTestId("onboarding-zeiten").count()) === 0, "Zeitenblock ist trotz „Formate ab“ da.");
    await setze(seiteA, zustimmung, true);
    erwarte(!(await seiteA.getByLabel("Montag vormittags", { exact: true }).isChecked()), "Altes Zeitkästchen ist wieder angekreuzt.");
    erwarte((await seiteA.locator("#onboarding-bemerkung").inputValue()) === "", "Bemerkung ist nicht leer.");
    return { satz: "Zeiten {} und Bemerkung NULL in der Datenbank, nach dem Neuladen auch im Formular leer." };
  });

  await pruefe("Token: manipulierte Links zeigen nur die neutrale Meldung, B schreibt nur bei B", async () => {
    const [id, sig] = new URL(linkA).pathname.split("/").pop().split(".");
    const vorher = zeile(idA);
    for (const variante of [
      `${id}.${sig.slice(0, -1)}${sig.at(-1) === "A" ? "B" : "A"}`,
      `${id}.`,
      id,
      `00000000-0000-0000-0000-000000000000.${sig}`,
    ]) {
      await seiteB.goto(`${BASIS}/umfrage/${variante}`);
      await seiteB.getByText("Dieser Link funktioniert nicht").waitFor({ timeout: 10_000 });
      erwarte((await seiteB.getByTestId("onboarding-formular").count()) === 0, "Manipulierter Link zeigt das Formular.");
      erwarte(!(await seiteB.content()).includes(NUMMER_ZIFFERN), "Manipulierter Link zeigt die Nummer.");
    }
    // Der echte Link von B schreibt in B, A bleibt unverändert
    await oeffne(seiteB, linkB);
    await setze(seiteB, "Messenger-Gruppe", true);
    await seiteB.locator("#onboarding-telefon").fill("+49 170 5550199");
    await speichern(seiteB);
    erwarte(zeilenZahl(idB) === 1 && zeile(idB).startsWith("{MESSENGER}|false|"), `Zeile von B: ${zeile(idB)}`);
    erwarte(telefon(idB) === "+49 170 5550199", `Referent.telefon von B: ${telefon(idB)}`);
    erwarte(telefon(idA) === NUMMER, `A hat durch B eine andere Nummer: ${telefon(idA)}`);
    erwarte(zeile(idA) === vorher, "Die Zeile von A hat sich durch B verändert.");
    return { satz: "Vier manipulierte Token zeigen nur „Dieser Link funktioniert nicht“, B speichert bei B, A bleibt unverändert." };
  });

  await pruefe("Knopf „Weiter zum Profil“ steht ganz unten: nach der Portal-Übersicht, vor der Schlusszeile", async () => {
    await oeffne(seiteA, linkA);
    const knopf = profilKnopf(seiteA);
    await knopf.scrollIntoViewIfNeeded();
    erwarte(await knopf.isVisible(), "Der Knopf ist nicht sichtbar.");
    erwarte((await seiteA.getByText("Weiter zum Profil", { exact: true }).count()) === 1, "Den Knopf gibt es nicht genau einmal.");
    const [portal, knopfBox, schluss] = await Promise.all([
      seiteA.getByTestId("onboarding-portal").boundingBox(),
      knopf.boundingBox(),
      seiteA.getByText("Fragen gern an kontakt@example.org").boundingBox(),
    ]);
    erwarte(portal.y + portal.height <= knopfBox.y, "Der Knopf steht nicht unter der Portal-Übersicht.");
    erwarte(knopfBox.y + knopfBox.height <= schluss.y, "Die Schlusszeile steht nicht unter dem Knopf.");
    erwarte((await seiteA.getByTestId("dankeskasten").count()) === 0, "Dankeskasten ohne Speichern sichtbar.");
    return { satz: "Ein einziger Knopf „Weiter zum Profil“, unter der Portal-Übersicht und über der Schlusszeile." };
  });

  await pruefe("Weiter zum Profil, Person ohne Passwort (auch bei geschlossener Umfrage): Zugang einrichten, /zugang, Passwort setzen", async () => {
    await oeffne(seiteB, linkB);
    await profilKnopf(seiteB).waitFor();
    sql(`UPDATE "Umfrage" SET status='GESCHLOSSEN' WHERE id='${umfrageId}'`);
    try {
      await oeffne(seiteB, linkB);
      erwarte((await seiteB.getByTestId("onboarding-formular").count()) === 0, "Formular trotz geschlossener Umfrage.");
      await profilKnopf(seiteB).waitFor({ timeout: 10_000 });
      await Promise.all([
        seiteB.waitForURL(/\/zugang\?token=/, { timeout: 20_000 }),
        profilKnopf(seiteB).click(),
      ]);
    } finally {
      sql(`UPDATE "Umfrage" SET status='OFFEN' WHERE id='${umfrageId}'`);
    }
    await seiteB.locator('input[name="passwort"]').waitFor();
    erwarte(
      Number(sqlAus(`SELECT count(*) FROM "Zugangstoken" t JOIN "User" u ON u.id=t."userId" WHERE u.email='${personB.email}'`)) >= 1,
      "Es wurde kein Zugangstoken erzeugt.",
    );
    await setzePasswort(seiteB, seiteB.url(), personB);
    erwarte(
      sqlAus(`SELECT "passwordHash" IS NOT NULL FROM "User" WHERE email='${personB.email}'`) === "t",
      "Das Passwort wurde nicht gesetzt.",
    );
    // Jetzt mit Passwort: derselbe Knopf ist der Login-Link mit Ziel Profil
    await oeffne(seiteB, linkB);
    erwarte(
      (await profilKnopf(seiteB).evaluate((el) => el.closest("a")?.getAttribute("href") ?? "")) === "/login?weiter=%2Fadmin%2Fkonto%23profil",
      "Mit Passwort zeigt der Knopf nicht auf den Login mit Ziel Profil.",
    );
    return { satz: "Bei geschlossener Umfrage führt der Knopf von B auf /zugang?token=, das Passwort lässt sich setzen, danach wird aus dem Knopf der Login-Link." };
  });

  await pruefe("Weiter zum Profil, Person mit Passwort: ohne Sitzung auf Login, nach Anmeldung auf /admin/konto#profil; mit Sitzung direkt dorthin", async () => {
    const { kontext, seite } = await neuerKontext(browser, seitenfehler);
    try {
      await seite.goto(linkA);
      await seite.locator("#onboarding").waitFor({ timeout: 15_000 });
      erwarte((await seite.getByRole("button", { name: "Zugang einrichten" }).count()) === 0, "Zugang einrichten wird trotz Passwort angeboten.");
      await Promise.all([seite.waitForURL(/\/login\?weiter=/, { timeout: 15_000 }), profilKnopf(seite).click()]);
      erwarte(new URL(seite.url()).searchParams.get("weiter") === "/admin/konto#profil", `Login-Ziel stimmt nicht: ${seite.url()}`);
      await seite.locator('input[name="email"]').fill(personA.email);
      await seite.locator('input[name="passwort"]').fill(personA.passwort);
      await Promise.all([
        seite.waitForURL(/\/admin\/konto/, { timeout: 15_000 }),
        seite.getByRole("button", { name: "Anmelden" }).click(),
      ]);
      erwarte(new URL(seite.url()).hash === "#profil", `Ziel ohne #profil: ${seite.url()}`);
      await seite.locator("#profil").waitFor();

      // Schon angemeldet: der Knopf springt direkt ins Profil, fremde Ziele werden zu /admin
      await seite.goto(linkA);
      await Promise.all([seite.waitForURL(/\/admin\/konto/, { timeout: 15_000 }), profilKnopf(seite).click()]);
      erwarte(new URL(seite.url()).hash === "#profil", `Mit Sitzung: Ziel ohne #profil: ${seite.url()}`);
      for (const boese of ["//evil.example", "/\\evil.example", "https://evil.example"]) {
        await seite.goto(`${BASIS}/login?weiter=${encodeURIComponent(boese)}`);
        await seite.waitForURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 });
        erwarte(new URL(seite.url()).origin === new URL(BASIS).origin, `Die Weiterleitung zu ${boese} verlässt die Seite.`);
      }
    } finally {
      await kontext.close();
    }
    return { satz: "Ohne Sitzung: Login mit Ziel Profil, nach Anmeldung /admin/konto#profil. Mit Sitzung direkt ins Profil, fremde Ziele werden zu /admin." };
  });

  await pruefe("Geschlossene Umfrage und stillgelegte Person lehnen ab", async () => {
    const vorher = zeile(idA);
    await oeffne(seiteA, linkA);
    await setze(seiteA, "Messenger-Gruppe", true);

    // Stillgelegte Person
    sql(`UPDATE "Referent" SET aktiv=false WHERE id='${idA}'`);
    try {
      await formularKnopf(seiteA).click();
      await seiteA.getByText("Der Link ist nicht mehr gültig.").waitFor({ timeout: 15_000 });
      erwarte(zeile(idA) === vorher, "Stillgelegte Person konnte schreiben.");
    } finally {
      sql(`UPDATE "Referent" SET aktiv=true WHERE id='${idA}'`);
    }

    // Geschlossene Umfrage mit noch offener Seite
    sql(`UPDATE "Umfrage" SET status='GESCHLOSSEN' WHERE id='${umfrageId}'`);
    try {
      await formularKnopf(seiteA).click();
      await seiteA.getByText("Die Umfrage ist geschlossen. Deine Antwort wurde nicht gespeichert.").waitFor({ timeout: 15_000 });
      erwarte(zeile(idA) === vorher, "Geschlossene Umfrage hat die Zeile verändert.");

      // Frische Seite: nur Portal und Schlusszeile, kein Formular, keine Nummer
      await oeffne(seiteA, linkA);
      erwarte((await seiteA.getByTestId("onboarding-formular").count()) === 0, "Formular trotz geschlossener Umfrage.");
      erwarte((await seiteA.locator("#onboarding-telefon").count()) === 0, "Nummernfeld trotz geschlossener Umfrage.");
      erwarte(!(await seiteA.content()).includes(NUMMER_ZIFFERN), "Nummer auf der Seite der geschlossenen Umfrage.");
      await seiteA.getByTestId("onboarding-portal").waitFor();
      await seiteA.getByText("Fragen gern an kontakt@example.org").waitFor();
      erwarte(await profilKnopf(seiteA).isVisible(), "Der Knopf „Weiter zum Profil“ fehlt bei geschlossener Umfrage.");
      erwarte((await seiteA.getByText("Kontaktmöglichkeiten").count()) === 0, "Kontaktkarte trotz geschlossener Umfrage.");
    } finally {
      sql(`UPDATE "Umfrage" SET status='OFFEN' WHERE id='${umfrageId}'`);
    }
    return { satz: "Stillgelegte Person: „Link nicht mehr gültig“. Geschlossene Umfrage: Meldung beim Speichern, danach Portal-Karte, Knopf „Weiter zum Profil“ und Schlusszeile." };
  });

  // -------------------------------------------------------------------------
  await pruefe("Stilllegen und Löschen einer Person entfernen die Onboarding-Zeile (Stilllegen lässt das Telefon stehen)", async () => {
    await legePersonAn(admin, personC);
    await legePersonAn(admin, personD);
    idC = referentId(personC.email);
    idD = referentId(personD.email);
    const einsatz = (id) => sql(`INSERT INTO "ReferentOnboarding" ("referentId", kontaktwege, "weitereFormate", zeiten, "updatedAt") VALUES ('${id}', '{MAIL}', true, '{FR_VORMITTAGS}', now())`);
    einsatz(idC);
    einsatz(idD);
    sql(`UPDATE "Referent" SET telefon='+49 160 5550111' WHERE id='${idC}'`);
    const fortbildung = sqlAus(`SELECT id FROM "Fortbildung" LIMIT 1`);
    erwarte(fortbildung, "Auf der Testinstanz gibt es keine Fortbildung für die Zuordnung (Stilllegen).");
    sql(`INSERT INTO "FortbildungReferent" ("fortbildungId", "referentId") VALUES ('${fortbildung}', '${idC}')`);
    fortbildungsZuordnung = true;

    // C hat eine Zuordnung: wird stillgelegt
    await admin.goto(`${BASIS}/admin/referenten`);
    await admin.getByRole("button", { name: `${personC.vorname} ${personC.nachname} entfernen` }).click();
    for (let i = 0; i < 20 && zeilenZahl(idC) > 0; i += 1) await new Promise((r) => setTimeout(r, 500));
    erwarte(sqlAus(`SELECT aktiv FROM "Referent" WHERE id='${idC}'`) === "f", "C wurde nicht stillgelegt.");
    erwarte(zeilenZahl(idC) === 0, "Beim Stilllegen blieb die Onboarding-Zeile von C stehen.");
    erwarte(telefon(idC) === "+49 160 5550111", `Das Stilllegen hat Referent.telefon verändert: ${telefon(idC)}`);

    // D ohne Zuordnung: wird gelöscht
    await admin.goto(`${BASIS}/admin/referenten`);
    await admin.getByRole("button", { name: `${personD.vorname} ${personD.nachname} entfernen` }).click();
    for (let i = 0; i < 20 && sqlAus(`SELECT count(*) FROM "Referent" WHERE id='${idD}'`) !== "0"; i += 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
    erwarte(sqlAus(`SELECT count(*) FROM "Referent" WHERE id='${idD}'`) === "0", "D wurde nicht gelöscht.");
    erwarte(zeilenZahl(idD) === 0, "Beim Löschen blieb die Onboarding-Zeile von D stehen.");

    // Stillgelegte Person erscheint nicht mehr in der Admin-Ansicht
    await admin.goto(`${BASIS}/admin/referenten/onboarding`);
    await admin.getByTestId("onboarding-tabelle").waitFor();
    erwarte((await admin.locator(`tr[data-zeile="${personC.vorname} ${personC.nachname}"]`).count()) === 0, "Stillgelegte Person steht in der Admin-Ansicht.");
    return { satz: "C (mit Zuordnung) stillgelegt, D (ohne) gelöscht, beide Onboarding-Zeilen weg, C fehlt in der Admin-Ansicht." };
  });

  await pruefe("„Angaben löschen“: Rückfrage, Abbrechen ändert nichts, Bestätigen löscht und protokolliert", async () => {
    erwarte(zeilenZahl(idA) === 1, "A hat keine Zeile mehr.");
    await admin.goto(`${BASIS}/admin/referenten/onboarding`);
    await admin.getByRole("button", { name: `Angaben von ${nameA} löschen` }).click();
    let dialog = admin.getByRole("dialog");
    await dialog.getByText("Angaben löschen?").waitFor();
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    erwarte(zeilenZahl(idA) === 1, "Abbrechen hat gelöscht.");
    await admin.getByRole("button", { name: `Angaben von ${nameA} löschen` }).click();
    dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Endgültig löschen" }).click();
    await admin.locator(`tr[data-zeile="${nameA}"]`).getByText("Noch nichts gespeichert").waitFor({ timeout: 15_000 });
    erwarte(zeilenZahl(idA) === 0, "Die Zeile von A ist noch in der Datenbank.");
    erwarte(
      Number(sqlAus(`SELECT count(*) FROM "AuditLog" WHERE entitaet='ReferentOnboarding' AND aktion='DELETE' AND "entitaetId"='${idA}'`)) === 1,
      "AuditLog DELETE fehlt.",
    );
    erwarte(sqlAus(`SELECT count(*) FROM "Referent" WHERE id='${idA}'`) === "1", "Die Person A wurde mitgelöscht.");
    erwarte(sqlAus(`SELECT count(*) FROM "UmfrageTeilnehmer" WHERE "referentId"='${idA}'`) === "1", "Der Umfrage-Teilnehmer A fehlt.");
    await oeffne(seiteA, linkA);
    erwarte(telefon(idA) === NUMMER, `Angaben löschen hat das Telefon verändert: ${telefon(idA)}`);
    erwarte((await seiteA.locator("#onboarding-telefon").inputValue()) === NUMMER, "Die Nummer aus dem Profil ist nach dem Löschen nicht mehr vorbelegt.");
    return { satz: "Rückfrage erscheint, Abbrechen lässt alles, Bestätigen löscht nur die Onboarding-Zeile, das Telefon im Profil bleibt (und ist weiter vorbelegt), Protokoll ohne Inhalt, Person und Teilnahme bleiben." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  // Aufräumen: Umfrage und die beiden Hilfszeilen von C
  try {
    if (umfrageId) sql(`DELETE FROM "Umfrage" WHERE id='${umfrageId}'`);
    if (fortbildungsZuordnung && idC) {
      sql(`DELETE FROM "FortbildungReferent" WHERE "referentId"='${idC}'`);
      sql(`DELETE FROM "Referent" WHERE id='${idC}'`);
    }
  } catch (error) {
    melde("UNKLAR", "Aufräumen", error instanceof Error ? error.message : String(error));
  }
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await adminKontext.close();
  await aKontext.close();
  await bKontext.close();
  await browser.close();
}
