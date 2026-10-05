import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

import {
  ADMIN_MAIL,
  ADMIN_PW,
  BASIS,
  adminAnmelden,
  erwarte,
  idAusUrl,
  legePersonAn,
  melde,
  neuerKontext,
  pruefe,
  starteBrowser,
  testPerson,
} from "./hilfe.mjs";

/**
 * Befunde eines Code-Reviews (Zweig `befunde-0210`), die sich am laufenden
 * System prüfen lassen:
 *
 *   1  Open Redirect nach dem Login (auch /\evil, //evil, /%5Cevil, https:, javascript:)
 *   2  Sperren: Schließen und Stilllegen warten auf laufendes öffentliches Speichern
 *      (eine zweite Datenbanksitzung hält die Zeile, wie ein gleichzeitiger Admin)
 *   3  Zugangstoken: parallele Erzeugung hinterlässt einen offenen Token, der
 *      Verbrauch entwertet die anderen
 *   4  Terminänderung: neue Termine setzen „geantwortet“ zurück, Antworten bleiben
 *   5  Einladung und Erinnerung: atomares Beanspruchen, Fünf-Minuten-Sperre
 *   7  {Zugang}: ältere Token bleiben beim Versand offen (geändert 03.10.)
 *   8  Doppelte Termine: zwei gleichzeitige Speichern, Unique-Index
 *   9  Telefon im Onboarding: nur bei Änderung, nie über eine neuere Nummer
 *
 * Läuft nur gegen die Testinstanz (Tunnel auf Port 3101). Mails gehen nur ins
 * Server-Log (kein SMTP_HOST). Die Datenbank wird per psql über SSH gelesen und
 * gezielt verändert (Testzeilen dieses Laufs).
 */

const DB = "docker exec -i fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm -At";

/** SQL über stdin, damit keine Anführungszeichen durch die Shell laufen. */
function sqlAus(befehl) {
  return execFileSync("ssh", [(process.env.TEST_SSH_HOST ?? "testserver"), DB], { input: befehl }).toString().trim();
}
const sql = (befehl) => void sqlAus(befehl);

function serverLog() {
  return execFileSync("ssh", [(process.env.TEST_SSH_HOST ?? "testserver"), "docker logs --tail 1500 fortbildung-test-app-1"], {
    maxBuffer: 30 * 1024 * 1024,
  }).toString();
}

/** Letzte Log-Mail an diese Adresse mit der Marke (ohne SMTP stehen Mails nur im Log). */
function mailImLog(email, marke) {
  const teile = serverLog().split("Mail (kein SMTP_HOST gesetzt, nur geloggt)");
  return teile.filter((t) => t.includes(email) && t.includes(marke)).at(-1) ?? "";
}

const schlafe = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (text) => createHash("sha256").update(text).digest("hex");

/**
 * Hält Zeilensperren in einer zweiten Datenbanksitzung, wie ein gleichzeitig
 * laufender Admin-Vorgang: Befehle ausführen, `sekunden` schlafen, committen.
 * Gibt erst zurück, wenn die Sitzung wirklich schläft (Sperre steht), und ein
 * Promise für das Ende.
 */
async function halteSperre(befehle, sekunden) {
  const marke = `pg_sleep(${sekunden}.${Math.floor(Math.random() * 900) + 100})`;
  const kind = spawn("ssh", [(process.env.TEST_SSH_HOST ?? "testserver"), DB], { stdio: ["pipe", "ignore", "pipe"] });
  const ende = new Promise((resolve, reject) => {
    kind.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Sperr-Sitzung endete mit ${code}`))));
  });
  kind.stdin.end(`BEGIN;\n${befehle}\nSELECT ${marke};\nCOMMIT;\n`);
  for (let i = 0; i < 40; i += 1) {
    const aktiv = sqlAus(
      `SELECT count(*) FROM pg_stat_activity WHERE state='active' AND query LIKE '%${marke}%' AND pid <> pg_backend_pid()`,
    );
    if (aktiv === "1") return ende;
    await schlafe(250);
  }
  throw new Error("Die Sperr-Sitzung hat die Zeile nicht gehalten.");
}

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: admin2Kontext, seite: admin2 } = await neuerKontext(browser, seitenfehler);
const { kontext: aKontext, seite: seiteA } = await neuerKontext(browser, seitenfehler);
const { kontext: a2Kontext, seite: seiteA2 } = await neuerKontext(browser, seitenfehler);
const { kontext: dKontext, seite: seiteD } = await neuerKontext(browser, seitenfehler);
const { kontext: eKontext, seite: seiteE } = await neuerKontext(browser, seitenfehler);

const kennung = Date.now().toString(36);
const P = Object.fromEntries(["a", "b", "c", "d", "e"].map((k) => [k, testPerson(`rf21${k}-${kennung}`)]));
const titel = `RF21 Umfrage ${kennung}`;
const TAGE = ["2026-11-09", "2026-11-10", "2026-11-11"];
let umfrageId = "";
const id = {}; // Referent-IDs
const tn = {}; // Teilnehmer-IDs
const link = {}; // persönliche Umfragelinks
let terminIds = [];

async function personenlink(name) {
  const roh = await admin.getByRole("button", { name: `Link für ${name} kopieren` }).getAttribute("data-link");
  erwarte(roh, `Kein Link für ${name} gefunden.`);
  return `${BASIS}${new URL(roh).pathname}`;
}

const referentId = (email) => sqlAus(`SELECT id FROM "Referent" WHERE email='${email}'`);
const teilnehmerId = (email) =>
  sqlAus(
    `SELECT t.id FROM "UmfrageTeilnehmer" t JOIN "Referent" r ON r.id=t."referentId" WHERE t."umfrageId"='${umfrageId}' AND r.email='${email}'`,
  );
const telefon = (rid) => sqlAus(`SELECT coalesce(telefon,'-') FROM "Referent" WHERE id='${rid}'`);
const geantwortet = (tid) => sqlAus(`SELECT "geantwortetAm" IS NOT NULL FROM "UmfrageTeilnehmer" WHERE id='${tid}'`) === "t";
const antwortZahl = (tid) => Number(sqlAus(`SELECT count(*) FROM "UmfrageAntwort" WHERE "teilnehmerId"='${tid}'`));
const onboardingZeilen = (rid) => Number(sqlAus(`SELECT count(*) FROM "ReferentOnboarding" WHERE "referentId"='${rid}'`));
const offeneTokenHashes = (email) =>
  sqlAus(
    `SELECT t."tokenHash" FROM "Zugangstoken" t JOIN "User" u ON u.id=t."userId" WHERE u.email='${email}' AND t."usedAt" IS NULL ORDER BY t."createdAt"`,
  )
    .split("\n")
    .filter(Boolean);

function setzeAntworten(tid) {
  for (const terminId of terminIds) {
    sql(
      `INSERT INTO "UmfrageAntwort" (id, "teilnehmerId", "terminId", wert) VALUES (gen_random_uuid()::text, '${tid}', '${terminId}', 'JA') ON CONFLICT DO NOTHING`,
    );
  }
  sql(`UPDATE "UmfrageTeilnehmer" SET "geantwortetAm"=now(), kommentar='RF21 Kommentar' WHERE id='${tid}'`);
}

/** Wartet, bis die Nummer in der Datenbank den erwarteten Wert hat (Speichern läuft asynchron). */
async function warteTelefon(rid, erwartet, meldung) {
  for (let i = 0; i < 40; i += 1) {
    if (telefon(rid) === erwartet) return;
    await schlafe(250);
  }
  throw new Error(`${meldung}: ${telefon(rid)}`);
}

const formular = (seite) => seite.getByTestId("onboarding-formular");
async function oeffne(seite, url) {
  await seite.goto(url);
  await seite.locator("#onboarding").waitFor({ timeout: 15_000 });
}
const telefonFeld = (seite) => seite.locator("#onboarding-telefon");
const FEHLER_TELEFON = "Die Telefonnummer wurde inzwischen geändert. Bitte die Seite neu laden.";

async function onboardingSpeichern(seite, erwarteFehler = false) {
  await formular(seite).getByRole("button", { name: "Speichern" }).click();
  if (erwarteFehler) await seite.getByText(FEHLER_TELEFON).waitFor({ timeout: 15_000 });
  else await seite.getByTestId("onboarding-erfolg").waitFor({ timeout: 15_000 });
}

async function setzeKontaktweg(seite, name, an) {
  const feld = seite.getByLabel(name, { exact: true });
  if ((await feld.isChecked()) !== an) await feld.locator("xpath=ancestor::label[1]").click();
}

try {
  await adminAnmelden(admin);
  await adminAnmelden(admin2);
  for (const k of Object.keys(P)) await legePersonAn(admin, P[k]);
  for (const k of Object.keys(P)) id[k] = referentId(P[k].email);

  await admin.goto(`${BASIS}/admin/umfragen/neu`);
  await admin.getByLabel("Titel", { exact: true }).fill(titel);
  for (let i = 1; i < TAGE.length; i += 1) await admin.getByRole("button", { name: "Termin hinzufügen" }).click();
  const felder = admin.locator('input[type="date"]');
  for (const [index, tag] of TAGE.entries()) await felder.nth(index).fill(tag);
  await admin.getByRole("button", { name: "Keine auswählen" }).click();
  for (const k of Object.keys(P)) await admin.getByLabel(new RegExp(P[k].nachname)).check();
  await admin.getByRole("button", { name: "Umfrage speichern" }).click();
  await admin.waitForURL(/\/admin\/umfragen\/[^/?]+\?gespeichert=1/, { timeout: 20_000 });
  umfrageId = idAusUrl(admin.url());
  for (const k of Object.keys(P)) {
    tn[k] = teilnehmerId(P[k].email);
    link[k] = await personenlink(`${P[k].vorname} ${P[k].nachname}`);
  }
  terminIds = sqlAus(`SELECT id FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' ORDER BY reihenfolge`).split("\n");
  erwarte(terminIds.length === 3, `Erwartet 3 Termine, gefunden ${terminIds.length}.`);

  // -------------------------------------------------------------------------
  // 1 Open Redirect
  // -------------------------------------------------------------------------
  await pruefe("1 Open Redirect: Login mit fremdem Ziel bleibt auf der eigenen Seite", async () => {
    const eigeneOrigin = new URL(BASIS).origin;
    const faelle = [
      { weiter: "/admin/konto#profil", erwartePfad: "/admin/konto", erwarteHash: "#profil" },
      { weiter: "/\\evil.example", erwartePfad: "/admin" },
      { weiter: "//evil.example", erwartePfad: "/admin" },
      { weiter: "/%5Cevil.example", gleicheOrigin: true },
      { weiter: "https://evil.example/", erwartePfad: "/admin" },
      { weiter: "javascript:alert(1)", erwartePfad: "/admin" },
      { weiter: "/admin\t/x", erwartePfad: "/admin" },
    ];
    const gesehen = [];
    for (const fall of faelle) {
      const { kontext, seite } = await neuerKontext(browser, seitenfehler);
      const extern = [];
      await kontext.route(
        (url) => url.origin !== eigeneOrigin,
        (route) => {
          extern.push(route.request().url());
          return route.fulfill({ status: 200, contentType: "text/html", body: "extern" });
        },
      );
      try {
        await seite.goto(`${BASIS}/login?weiter=${encodeURIComponent(fall.weiter)}`);
        await seite.locator('input[name="email"]').fill(ADMIN_MAIL);
        await seite.locator('input[name="passwort"]').fill(ADMIN_PW);
        await seite.getByRole("button", { name: "Anmelden" }).click();
        await seite.waitForURL((u) => u.pathname !== "/login", { timeout: 15_000 });
        await seite.waitForLoadState("load");
        const ziel = new URL(seite.url());
        erwarte(extern.length === 0, `„${fall.weiter}“ hat eine fremde Adresse angefragt: ${extern.join(", ")}`);
        erwarte(ziel.origin === eigeneOrigin, `„${fall.weiter}“ landet auf ${ziel.origin}.`);
        if (fall.erwartePfad) erwarte(ziel.pathname === fall.erwartePfad, `„${fall.weiter}“ landet auf ${ziel.pathname}, erwartet ${fall.erwartePfad}.`);
        if (fall.erwarteHash) erwarte(ziel.hash === fall.erwarteHash, `„${fall.weiter}“ verliert den Hash: ${ziel.hash}.`);
        gesehen.push(`${fall.weiter} -> ${ziel.pathname}${ziel.hash}`);

        // Schon angemeldet: die Login-Seite selbst leitet nur intern weiter
        if (fall.weiter.startsWith("/\\") || fall.weiter.startsWith("//") || fall.weiter.startsWith("https:")) {
          await seite.goto(`${BASIS}/login?weiter=${encodeURIComponent(fall.weiter)}`);
          await seite.waitForURL((u) => u.pathname !== "/login", { timeout: 15_000 });
          erwarte(new URL(seite.url()).origin === eigeneOrigin, `Angemeldet führt „${fall.weiter}“ auf eine fremde Seite.`);
          erwarte(extern.length === 0, `Angemeldet: „${fall.weiter}“ hat eine fremde Adresse angefragt.`);
        }
      } finally {
        await kontext.close();
      }
    }
    return { satz: `${faelle.length} Ziele geprüft, nie fremde Origin, kein externer Aufruf: ${gesehen.join(" | ")}` };
  });

  // -------------------------------------------------------------------------
  // 4 Terminänderung nach Antworten
  // -------------------------------------------------------------------------
  await pruefe("4 Terminänderung: neuer Termin setzt „geantwortet“ zurück, Antworten und Kommentar bleiben", async () => {
    setzeAntworten(tn.a);
    setzeAntworten(tn.b);
    erwarte(geantwortet(tn.a) && geantwortet(tn.b), "Ausgangslage: A und B sollten geantwortet haben.");
    erwarte(!geantwortet(tn.c), "Ausgangslage: C hat nicht geantwortet.");

    const bearbeiten = `${BASIS}/admin/umfragen/${umfrageId}/bearbeiten`;
    // a) Speichern ohne Terminänderung lässt den Status
    await admin.goto(bearbeiten);
    await admin.getByRole("button", { name: "Umfrage speichern" }).click();
    await admin.getByText("Umfrage gespeichert.").waitFor({ timeout: 15_000 });
    erwarte(geantwortet(tn.a) && geantwortet(tn.b), "Speichern ohne Terminänderung hat „geantwortet“ zurückgesetzt.");

    // b) Neuer Termin: wer dafür keine Antwort hat, gilt wieder als offen
    await admin.goto(bearbeiten);
    await admin.getByRole("button", { name: "Termin hinzufügen" }).click();
    await admin.locator('input[type="date"]').last().fill("2026-11-12");
    await admin.getByRole("button", { name: "Umfrage speichern" }).click();
    await admin.getByText("Umfrage gespeichert.").waitFor({ timeout: 15_000 });
    erwarte(!geantwortet(tn.a) && !geantwortet(tn.b), "Nach dem neuen Termin gelten A und B noch als fertig.");
    erwarte(antwortZahl(tn.a) === 3 && antwortZahl(tn.b) === 3, "Vorhandene Antworten gingen verloren.");
    erwarte(sqlAus(`SELECT kommentar FROM "UmfrageTeilnehmer" WHERE id='${tn.a}'`) === "RF21 Kommentar", "Kommentar von A ging verloren.");

    // c) Erinnerungen erreichen sie wieder (Bedingung: eingeladen, nicht geantwortet)
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=now() WHERE id IN ('${tn.a}','${tn.b}')`);
    erwarte(
      sqlAus(
        `SELECT count(*) FROM "UmfrageTeilnehmer" WHERE id IN ('${tn.a}','${tn.b}') AND "eingeladenAm" IS NOT NULL AND "geantwortetAm" IS NULL`,
      ) === "2",
      "A und B erfüllen die Erinnerungsbedingung nicht.",
    );

    // d) Nach vollständiger Antwort (alle 4 Termine) und anschließendem Entfernen eines Termins bleibt der Status
    terminIds = sqlAus(`SELECT id FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' ORDER BY reihenfolge`).split("\n");
    erwarte(terminIds.length === 4, `Erwartet 4 Termine, gefunden ${terminIds.length}.`);
    setzeAntworten(tn.a);
    await admin.goto(bearbeiten);
    await admin.getByRole("button", { name: "Termin 4 entfernen" }).click();
    await admin.getByRole("button", { name: "Umfrage speichern" }).click();
    await admin.getByText("Umfrage gespeichert.").waitFor({ timeout: 15_000 });
    erwarte(geantwortet(tn.a), "Entfernen eines Termins hat „geantwortet“ bei vollständiger Antwort zurückgesetzt.");
    terminIds = sqlAus(`SELECT id FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' ORDER BY reihenfolge`).split("\n");
    erwarte(terminIds.length === 3, `Nach dem Entfernen erwartet 3 Termine, gefunden ${terminIds.length}.`);
    return { satz: "Ohne Terminänderung bleibt der Status, ein neuer Termin setzt A und B zurück (Antworten und Kommentar bleiben, Erinnerungsbedingung erfüllt), Entfernen eines Termins lässt vollständig Antwortende unberührt." };
  });

  // -------------------------------------------------------------------------
  // 8 Doppelte Termine
  // -------------------------------------------------------------------------
  await pruefe("8 Doppelte Termine: zwei gleichzeitige Speichern, ein Tag bleibt einmal", async () => {
    const bearbeiten = `${BASIS}/admin/umfragen/${umfrageId}/bearbeiten`;
    const runden = ["2026-12-01", "2026-12-02", "2026-12-03"];
    for (const tag of runden) {
      await Promise.all([admin.goto(bearbeiten), admin2.goto(bearbeiten)]);
      for (const seite of [admin, admin2]) {
        await seite.getByRole("button", { name: "Termin hinzufügen" }).click();
        await seite.locator('input[type="date"]').last().fill(tag);
      }
      await Promise.all(
        [admin, admin2].map((seite) => seite.getByRole("button", { name: "Umfrage speichern" }).click()),
      );
      for (const seite of [admin, admin2]) {
        await seite.getByText(/Umfrage gespeichert\.|Ein Datum kommt doppelt vor\./).waitFor({ timeout: 20_000 });
      }
      const anzahl = sqlAus(`SELECT count(*) FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' AND datum='${tag}'`);
      erwarte(anzahl === "1", `Am ${tag} gibt es ${anzahl} Termine statt 1.`);
    }
    const dubletten = sqlAus(
      `SELECT count(*) - count(DISTINCT datum) FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}'`,
    );
    erwarte(dubletten === "0", `${dubletten} doppelte Termine in der Umfrage.`);
    erwarte(
      sqlAus(`SELECT count(*) FROM pg_indexes WHERE indexname='UmfrageTermin_umfrageId_datum_key'`) === "1",
      "Der Unique-Index UmfrageTermin_umfrageId_datum_key fehlt.",
    );
    // Die Datenbank lehnt eine Dublette selbst ab (psql meldet Fehler nur mit ON_ERROR_STOP über den Exitcode)
    let abgelehnt = false;
    try {
      execFileSync("ssh", [(process.env.TEST_SSH_HOST ?? "testserver"), DB], {
        input: `\\set ON_ERROR_STOP on\nINSERT INTO "UmfrageTermin" (id, "umfrageId", datum, reihenfolge) VALUES (gen_random_uuid()::text, '${umfrageId}', '2026-12-01', 99);`,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (fehler) {
      abgelehnt = /duplicate key|unique/i.test(`${fehler.stderr ?? ""}${fehler.stdout ?? ""}`);
    }
    erwarte(
      sqlAus(`SELECT count(*) FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' AND datum='2026-12-01'`) === "1",
      "Die Datenbank hat einen doppelten Termin angenommen.",
    );
    erwarte(abgelehnt, "Die Dublette wurde nicht mit einem Unique-Fehler abgelehnt.");
    // Räumt auf: zurück auf die drei Ausgangstermine
    sql(`DELETE FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' AND datum >= '2026-12-01'`);
    terminIds = sqlAus(`SELECT id FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' ORDER BY reihenfolge`).split("\n");
    return { satz: `Drei Runden mit je zwei gleichzeitigen Speichern desselben neuen Tags: jedes Datum genau einmal, kein Seitenfehler, Unique-Index vorhanden, direkte Dublette per SQL abgelehnt.` };
  });

  // -------------------------------------------------------------------------
  // 9 Telefon im Onboarding
  // -------------------------------------------------------------------------
  await pruefe("9 Telefon: veralteter Tab überschreibt eine neuere Nummer nicht", async () => {
    sql(`UPDATE "Referent" SET telefon='+49 151 5550111' WHERE id='${id.a}'`);
    await oeffne(seiteA, link.a);
    erwarte((await telefonFeld(seiteA).inputValue()) === "+49 151 5550111", "Das Feld ist nicht mit der Nummer vorbelegt.");
    erwarte((await seiteA.locator('input[name="telefonAusgang"]').inputValue()) === "+49 151 5550111", "Das versteckte Ausgangsfeld fehlt oder hat einen anderen Wert.");

    // Jemand ändert die Nummer im Profil, der Tab bleibt offen. Nur ein Kontaktweg wird geändert.
    sql(`UPDATE "Referent" SET telefon='+49 151 5550222' WHERE id='${id.a}'`);
    await setzeKontaktweg(seiteA, "Mail", true);
    await onboardingSpeichern(seiteA);
    erwarte(telefon(id.a) === "+49 151 5550222", `Die neuere Nummer wurde überschrieben: ${telefon(id.a)}`);
    erwarte(sqlAus(`SELECT kontaktwege::text FROM "ReferentOnboarding" WHERE "referentId"='${id.a}'`).includes("MAIL"), "Der Kontaktweg wurde nicht gespeichert.");

    // Wer die Nummer selbst ändert, obwohl sie inzwischen anders in der Datenbank steht, bekommt die Meldung
    await oeffne(seiteA, link.a);
    sql(`UPDATE "Referent" SET telefon='+49 151 5550333' WHERE id='${id.a}'`);
    const vorher = sqlAus(`SELECT kontaktwege::text||"updatedAt" FROM "ReferentOnboarding" WHERE "referentId"='${id.a}'`);
    await setzeKontaktweg(seiteA, "Telefon", true);
    await telefonFeld(seiteA).fill("+49 151 5550444");
    await onboardingSpeichern(seiteA, true);
    erwarte(telefon(id.a) === "+49 151 5550333", `Bei Konflikt wurde geschrieben: ${telefon(id.a)}`);
    erwarte(
      sqlAus(`SELECT kontaktwege::text||"updatedAt" FROM "ReferentOnboarding" WHERE "referentId"='${id.a}'`) === vorher,
      "Bei Konflikt wurden die Onboarding-Angaben trotzdem gespeichert.",
    );
    return { satz: "Nur Kontaktweg geändert: neuere Nummer (…222) bleibt. Nummer selbst geändert, DB hat inzwischen …333: Fehlermeldung „Die Telefonnummer wurde inzwischen geändert. Bitte die Seite neu laden.“, weder Nummer noch Angaben geschrieben." };
  });

  await pruefe("9 Telefon: normale Änderung, wiederholtes Speichern, Leeren, fehlendes Ausgangsfeld", async () => {
    await oeffne(seiteA, link.a);
    await telefonFeld(seiteA).fill("+49 151 5550555");
    await onboardingSpeichern(seiteA);
    await warteTelefon(id.a, "+49 151 5550555", "Änderung wurde nicht gespeichert");
    // Dieselbe Seite, ohne Neuladen: der Ausgangswert ist jetzt die gespeicherte Nummer
    await telefonFeld(seiteA).fill("+49 151 5550666");
    await formular(seiteA).getByRole("button", { name: "Speichern" }).click();
    await warteTelefon(id.a, "+49 151 5550666", "Zweites Speichern ohne Neuladen scheiterte");
    // Leeren
    await telefonFeld(seiteA).fill("");
    await formular(seiteA).getByRole("button", { name: "Speichern" }).click();
    await warteTelefon(id.a, "-", "Leeren hat die Nummer nicht entfernt");
    // Altes Formular ohne Ausgangsfeld: eine geänderte Nummer wird nicht blind geschrieben
    await oeffne(seiteA, link.a);
    await seiteA.evaluate(() => document.querySelector('input[name="telefonAusgang"]')?.remove());
    await telefonFeld(seiteA).fill("+49 151 5550777");
    await onboardingSpeichern(seiteA, true);
    erwarte(telefon(id.a) === "-", `Ohne Ausgangsfeld wurde geschrieben: ${telefon(id.a)}`);
    return { satz: "Änderung wird gespeichert, ein zweites Speichern ohne Neuladen klappt, Leeren setzt NULL, ohne Ausgangsfeld wird nicht geschrieben." };
  });

  await pruefe("9 Telefon: zwei gleichzeitige Speichern mit verschiedenen Nummern, genau eines gewinnt", async () => {
    sql(`UPDATE "Referent" SET telefon='+49 151 5550800' WHERE id='${id.a}'`);
    await Promise.all([oeffne(seiteA, link.a), oeffne(seiteA2, link.a)]);
    await telefonFeld(seiteA).fill("+49 151 5550801");
    await telefonFeld(seiteA2).fill("+49 151 5550802");
    await Promise.all([
      formular(seiteA).getByRole("button", { name: "Speichern" }).click(),
      formular(seiteA2).getByRole("button", { name: "Speichern" }).click(),
    ]);
    await schlafe(4000);
    const erfolge = [];
    const fehler = [];
    for (const seite of [seiteA, seiteA2]) {
      erfolge.push(await seite.getByTestId("onboarding-erfolg").count());
      fehler.push(await seite.getByText(FEHLER_TELEFON).count());
    }
    erwarte(erfolge[0] + erfolge[1] === 1 && fehler[0] + fehler[1] === 1, `Erfolge ${erfolge}, Fehler ${fehler}: erwartet genau ein Erfolg und eine Meldung.`);
    const gewinner = erfolge[0] === 1 ? "+49 151 5550801" : "+49 151 5550802";
    erwarte(telefon(id.a) === gewinner, `In der Datenbank steht ${telefon(id.a)}, erwartet ${gewinner}.`);
    return { satz: `Parallel gespeichert: eine Seite meldet Erfolg, die andere die Konflikt-Meldung, die Datenbank hält ${gewinner}.` };
  });

  // -------------------------------------------------------------------------
  // 3 und 7 Zugangstoken
  // -------------------------------------------------------------------------
  // Seit 03.10.: „Weiter zum Profil“ behält ältere Einladungslinks (aeltereBehalten),
  // damit der Zugangslink aus der Mail gültig bleibt, bis ein Passwort steht.
  // Zwei parallele Klicks hinterlassen deshalb zwei offene Token derselben
  // Person. Der Verbrauch eines davon entwertet alle anderen (nächster Fall).
  await pruefe("3 Zugangstoken: zwei parallele „Weiter zum Profil“ führen beide auf einen gültigen Link", async () => {
    sql(`UPDATE "Referent" SET telefon=NULL WHERE id='${id.a}'`);
    erwarte(offeneTokenHashes(P.a.email).length === 0, "A sollte noch keinen Zugangstoken haben.");
    await Promise.all([oeffne(seiteA, link.a), oeffne(seiteA2, link.a)]);
    const knopf = (seite) => seite.getByTestId("onboarding-profil-knopf").getByText("Weiter zum Profil", { exact: true });
    await Promise.all([
      seiteA.waitForURL(/\/zugang\?token=/, { timeout: 25_000 }),
      seiteA2.waitForURL(/\/zugang\?token=/, { timeout: 25_000 }),
      knopf(seiteA).click(),
      knopf(seiteA2).click(),
    ]);
    const offen = offeneTokenHashes(P.a.email);
    erwarte(offen.length === 2, `Offene Token nach dem parallelen Start: ${offen.length}, erwartet 2.`);
    const tokenA = new URL(seiteA.url()).searchParams.get("token");
    const tokenA2 = new URL(seiteA2.url()).searchParams.get("token");
    const gueltig = [tokenA, tokenA2].filter((t) => offen.includes(sha(t)));
    erwarte(gueltig.length === 2, "Beide Links sollten gültig sein, bis einer benutzt ist.");
    return { satz: "Zwei gleichzeitige Anfragen: zwei offene Token derselben Person, beide Links gültig bis zum ersten Verbrauch." };
  });

  await pruefe("3 Zugangstoken: Verbrauch entwertet die anderen offenen Token desselben Zwecks", async () => {
    const offen = offeneTokenHashes(P.a.email);
    const userId = sqlAus(`SELECT "userId" FROM "Zugangstoken" WHERE "tokenHash"='${offen[0]}'`);
    // Zweiten offenen Token einschmuggeln (so wie ihn das alte Rennen hinterlassen hätte)
    const extra = randomBytes(32).toString("base64url");
    sql(
      `INSERT INTO "Zugangstoken" (id, "tokenHash", "userId", zweck, "expiresAt") VALUES (gen_random_uuid()::text, '${sha(extra)}', '${userId}', 'EINLADUNG', now() + interval '10 days')`,
    );
    erwarte(offeneTokenHashes(P.a.email).length === offen.length + 1, "Der zusätzliche Token ist nicht angelegt.");
    // Einen echten Token (aus der URL eines der Tabs) verbrauchen
    const urlToken = [seiteA.url(), seiteA2.url()].map((u) => new URL(u).searchParams.get("token")).find((t) => sha(t) === offen[0]);
    const andererTab = [seiteA.url(), seiteA2.url()].map((u) => new URL(u).searchParams.get("token")).find((t) => t !== urlToken);
    const passwort = P.a.passwort;
    await seiteA.goto(`${BASIS}/zugang?token=${encodeURIComponent(urlToken)}`);
    await seiteA.locator('input[name="passwort"]').fill(passwort);
    await seiteA.locator('input[name="wiederholung"]').fill(passwort);
    await seiteA.locator('button[type="submit"]').click();
    await seiteA.waitForURL((u) => !u.pathname.startsWith("/zugang"), { timeout: 20_000 });
    erwarte(offeneTokenHashes(P.a.email).length === 0, "Nach dem Verbrauch sind noch Token offen.");
    // Der eingeschmuggelte Link setzt kein Passwort mehr
    await seiteA2.goto(`${BASIS}/zugang?token=${encodeURIComponent(extra)}`);
    erwarte((await seiteA2.locator('input[name="passwort"]').count()) === 0, "Der zweite Token zeigt noch das Passwortformular.");
    // Der Link aus dem anderen Tab ebenso, und er schickt zur Anmeldung
    await seiteA2.goto(`${BASIS}/zugang?token=${encodeURIComponent(andererTab)}`);
    erwarte((await seiteA2.locator('input[name="passwort"]').count()) === 0, "Der Link aus dem zweiten Tab zeigt noch das Passwortformular.");
    erwarte(await seiteA2.getByText("Das Passwort ist schon gesetzt").isVisible(), "Der verbrauchte Link schickt nicht zur Anmeldung.");
    return { satz: "Nach dem Verbrauch eines Tokens sind alle anderen offenen Token des Kontos entwertet, die übrigen Links zeigen „Das Passwort ist schon gesetzt“." };
  });

  // Geändert 03.10.: Früher entwertete der Versand mit {Zugang} die älteren Token
  // nach dem Versand. Dann machte eine Erinnerung den Link aus der ersten Mail
  // unbrauchbar. Jetzt bleiben ältere Token offen, der neue kommt dazu. Der
  // Verbrauch eines Tokens entwertet ohnehin alle anderen (Fall 3).
  await pruefe("7 {Zugang}: ältere Token bleiben beim Versand offen, der Token aus der Mail kommt dazu", async () => {
    const dialogSenden = async (knopfName, text) => {
      await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
      await admin.getByRole("button", { name: knopfName }).click();
      const dialog = admin.getByRole("dialog");
      await dialog.getByLabel("Text").fill(text);
      await dialog.getByRole("button", { name: "Senden", exact: true }).click();
      await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 30_000 });
      await admin.keyboard.press("Escape");
    };
    // C hat noch kein Konto: der erste Versand legt Konto und Token an
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=NULL, "erinnertAm"=NULL, "geantwortetAm"=NULL WHERE "umfrageId"='${umfrageId}'`);
    await dialogSenden("Einladung per Mail senden", "Hallo {Vorname}, RF21Z1: {Link} Zugang: {Zugang} Ende");
    const erste = offeneTokenHashes(P.c.email);
    erwarte(erste.length === 1, `Nach dem ersten Versand sollte ein Token offen sein, sind ${erste.length}.`);
    // Zwei weitere ältere Token, dann zweiter Versand
    const userId = sqlAus(`SELECT id FROM "User" WHERE email='${P.c.email}'`);
    for (let i = 0; i < 2; i += 1) {
      sql(
        `INSERT INTO "Zugangstoken" (id, "tokenHash", "userId", zweck, "expiresAt") VALUES (gen_random_uuid()::text, '${sha(randomBytes(16).toString("hex"))}', '${userId}', 'EINLADUNG', now() + interval '10 days')`,
      );
    }
    erwarte(offeneTokenHashes(P.c.email).length === 3, "Die älteren Token sind nicht angelegt.");
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=NULL WHERE "umfrageId"='${umfrageId}'`);
    await dialogSenden("Einladung per Mail senden", "Hallo {Vorname}, RF21Z2: {Link} Zugang: {Zugang} Ende");
    const offen = offeneTokenHashes(P.c.email);
    erwarte(offen.length === 4, `Nach dem zweiten Versand sollten die drei älteren plus der neue Token offen sein (4), sind ${offen.length}.`);
    erwarte(erste.every((h) => offen.includes(h)), "Der Token aus der ersten Mail ist nicht mehr offen.");
    const treffer = mailImLog(P.c.email, "RF21Z2").match(/Zugang: \S+\/zugang\?token=([A-Za-z0-9_%.-]+) Ende/);
    erwarte(treffer, "Der Zugangslink fehlt in der Mail an C.");
    erwarte(offen.includes(sha(decodeURIComponent(treffer[1]))), "Der Token aus der Mail ist nicht offen.");
    return { satz: "Mit zwei Altlasten-Token versendet: die älteren Token bleiben offen, der Token aus der Mail kommt dazu und ist offen. (Der Fehlerpfad, also Token löschen und Vermerk zurück bei SMTP-Fehler, lässt sich ohne SMTP-Server nicht auslösen.)" };
  });

  // -------------------------------------------------------------------------
  // 5 Einladung und Erinnerung
  // -------------------------------------------------------------------------
  await pruefe("5 Einladung: Wer zwischen Lesen und Beanspruchen von anderer Seite eingeladen wird, bekommt keine zweite Mail", async () => {
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=NULL, "erinnertAm"=NULL, "geantwortetAm"=NULL WHERE "umfrageId"='${umfrageId}'`);
    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
    await admin.getByRole("button", { name: "Einladung per Mail senden" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Text").fill("Hallo {Vorname}, RF21EINL: {Link}");
    // Ein zweiter Versand hat A schon beansprucht, aber noch nicht abgeschlossen (Zeile gesperrt)
    const gehalten = await halteSperre(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=now() WHERE id='${tn.a}';`, 7);
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();
    await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 40_000 });
    await gehalten;
    await admin.keyboard.press("Escape");
    erwarte(!mailImLog(P.a.email, "RF21EINL"), "A hat eine zweite Mail bekommen, obwohl der andere Versand schon beansprucht hatte.");
    for (const k of ["b", "c", "d", "e"]) erwarte(mailImLog(P[k].email, "RF21EINL"), `${k.toUpperCase()} hat keine Einladung bekommen.`);
    erwarte(
      sqlAus(`SELECT "eingeladenAm" IS NOT NULL FROM "UmfrageTeilnehmer" WHERE id='${tn.a}'`) === "t",
      "Der Vermerk des anderen Versands bei A wurde zurückgenommen.",
    );
    erwarte(
      sqlAus(`SELECT count(*) FROM "UmfrageTeilnehmer" WHERE "umfrageId"='${umfrageId}' AND id <> '${tn.a}' AND "eingeladenAm" IS NOT NULL`) === "0",
      "Ohne SMTP sollten die Vermerke der anderen leer bleiben.",
    );
    return { satz: "A (von der anderen Sitzung beansprucht) bekommt keine Mail, B bis E schon, Vermerk von A bleibt, die übrigen bleiben ohne SMTP leer." };
  });

  await pruefe("5 Erinnerung: höchstens alle fünf Minuten, Vermerk wird ohne SMTP zurückgesetzt", async () => {
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=now(), "erinnertAm"=NULL, "geantwortetAm"=NULL WHERE "umfrageId"='${umfrageId}'`);
    sql(`UPDATE "UmfrageTeilnehmer" SET "erinnertAm"=now() - interval '1 minute' WHERE id='${tn.a}'`);
    sql(`UPDATE "UmfrageTeilnehmer" SET "erinnertAm"=now() - interval '10 minutes' WHERE id='${tn.b}'`);
    const vorherA = sqlAus(`SELECT "erinnertAm" FROM "UmfrageTeilnehmer" WHERE id='${tn.a}'`);
    const vorherB = sqlAus(`SELECT "erinnertAm" FROM "UmfrageTeilnehmer" WHERE id='${tn.b}'`);
    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
    await admin.getByRole("button", { name: "Erinnerung an alle ohne Antwort" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Text").fill("Hallo {Vorname}, RF21ERIN: {Link}");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();
    await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 30_000 });
    await admin.keyboard.press("Escape");
    erwarte(!mailImLog(P.a.email, "RF21ERIN"), "A (vor einer Minute erinnert) hat noch eine Erinnerung bekommen.");
    for (const k of ["b", "c", "d", "e"]) erwarte(mailImLog(P[k].email, "RF21ERIN"), `${k.toUpperCase()} hat keine Erinnerung bekommen.`);
    erwarte(sqlAus(`SELECT "erinnertAm" FROM "UmfrageTeilnehmer" WHERE id='${tn.a}'`) === vorherA, "Der Vermerk von A hat sich verändert.");
    erwarte(sqlAus(`SELECT "erinnertAm" FROM "UmfrageTeilnehmer" WHERE id='${tn.b}'`) === vorherB, "Der Vermerk von B wurde nicht auf den alten Wert zurückgesetzt.");
    erwarte(sqlAus(`SELECT "erinnertAm" IS NULL FROM "UmfrageTeilnehmer" WHERE id='${tn.c}'`) === "t", "Der Vermerk von C blieb gesetzt, obwohl ohne SMTP nichts rausging.");
    return { satz: "Vor einer Minute erinnert: übersprungen. Vor zehn Minuten oder nie: Mail ins Log, Vermerk danach wieder genau der alte Wert (ohne SMTP)." };
  });

  // -------------------------------------------------------------------------
  // 2 Sperren (Schließen und Stilllegen gegen öffentliches Speichern)
  // -------------------------------------------------------------------------
  // Aufräumen für den Fall, dass Test 8 vorzeitig abbrach
  sql(`DELETE FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' AND datum >= '2026-12-01'`);
  terminIds = sqlAus(`SELECT id FROM "UmfrageTermin" WHERE "umfrageId"='${umfrageId}' ORDER BY reihenfolge`).split("\n");

  await pruefe("2 Sperre: Antwort speichern wartet auf das Schließen und wird danach abgelehnt", async () => {
    sql(`UPDATE "Umfrage" SET status='OFFEN' WHERE id='${umfrageId}'`);
    await seiteD.goto(link.d);
    const gruppen = seiteD.getByRole("group", { name: /^Antwort für/ });
    erwarte((await gruppen.count()) === 3, "Es sollten drei Antwortgruppen da sein.");
    for (let i = 0; i < 3; i += 1) {
      await gruppen.nth(i).locator("label").filter({ hasText: /^\s*Ja\s*$/ }).click();
    }
    erwarte(antwortZahl(tn.d) === 0, "Ausgangslage: D hat schon Antworten.");
    const gehalten = await halteSperre(`UPDATE "Umfrage" SET status='GESCHLOSSEN' WHERE id='${umfrageId}';`, 7);
    await seiteD.getByRole("button", { name: "Speichern" }).first().click();
    await seiteD.getByText("Die Umfrage ist geschlossen. Deine Antwort wurde nicht gespeichert.").waitFor({ timeout: 40_000 });
    await gehalten;
    erwarte(antwortZahl(tn.d) === 0, "Trotz Schließen wurden Antworten gespeichert.");
    erwarte(!geantwortet(tn.d), "geantwortetAm wurde trotz Schließen gesetzt.");
    sql(`UPDATE "Umfrage" SET status='OFFEN' WHERE id='${umfrageId}'`);
    return { satz: "Das Schließen (andere Sitzung, Zeile gesperrt) kommt zuerst: die Antwort wartet, sieht danach GESCHLOSSEN, nichts wird gespeichert." };
  });

  await pruefe("2 Sperre: Onboarding speichern wartet auf das Stilllegen und legt die Zeile nicht neu an", async () => {
    await oeffne(seiteE, link.e);
    await setzeKontaktweg(seiteE, "Mail", true);
    erwarte(onboardingZeilen(id.e) === 0, "Ausgangslage: E hat schon eine Onboarding-Zeile.");
    const gehalten = await halteSperre(
      `UPDATE "Referent" SET aktiv=false WHERE id='${id.e}'; DELETE FROM "ReferentOnboarding" WHERE "referentId"='${id.e}';`,
      7,
    );
    await formular(seiteE).getByRole("button", { name: "Speichern" }).click();
    await seiteE.getByText("Der Link ist nicht mehr gültig.").waitFor({ timeout: 40_000 });
    await gehalten;
    erwarte(onboardingZeilen(id.e) === 0, "Nach dem Stilllegen ist wieder eine Onboarding-Zeile entstanden.");
    erwarte(sqlAus(`SELECT aktiv FROM "Referent" WHERE id='${id.e}'`) === "f", "E ist nicht stillgelegt.");
    sql(`UPDATE "Referent" SET aktiv=true WHERE id='${id.e}'`);
    return { satz: "Das Stilllegen (andere Sitzung, Zeile gesperrt) kommt zuerst: das Onboarding wartet, sieht aktiv=false, meldet ungültigen Link und legt keine Zeile an." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  // Testdaten dieses Laufs entfernen (Umfrage samt Termine und Teilnehmer, Personen, Konten)
  try {
    if (umfrageId) sql(`DELETE FROM "Umfrage" WHERE id='${umfrageId}'`);
  } catch (fehler) {
    melde("UNKLAR", "Aufräumen", String(fehler.message).split("\n")[0]);
  }
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  for (const k of [adminKontext, admin2Kontext, aKontext, a2Kontext, dKontext, eKontext]) await k.close();
  await browser.close();
}
