import { execFileSync } from "node:child_process";

import {
  BASIS,
  adminAnmelden,
  erwarte,
  idAusUrl,
  legePersonAn,
  melde,
  neuerKontext,
  pruefe,
  setzePasswort,
  starteBrowser,
  testPerson,
} from "./hilfe.mjs";

/**
 * Terminumfrage (Zweig `umfrage`): Admin legt eine Umfrage mit 5 Terminen und
 * zwei Testpersonen an, die Personen stimmen über ihren persönlichen Link ab.
 * Geprüft werden Sichtbarkeit, Schreibschutz fremder Zeilen, manipulierte
 * Token, geschlossene Umfrage, Mailtext ohne {Link}, optionaler Platzhalter {Zugang}, Zugang-einrichten und
 * das Löschen mit Rückfrage.
 */

function serverLog() {
  return execFileSync("ssh", [(process.env.TEST_SSH_HOST ?? "testserver"), "docker logs --tail 800 fortbildung-test-app-1"], {
    maxBuffer: 20 * 1024 * 1024,
  }).toString();
}

/** SQL über stdin, damit keine Anführungszeichen durch die Shell laufen. */
function sql(befehl) {
  execFileSync(
    "ssh",
    [(process.env.TEST_SSH_HOST ?? "testserver"), "docker exec -i fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm"],
    { input: befehl },
  );
}

/** SQL mit Ausgabe: eine Zeile je Datensatz, Spalten mit | getrennt. */
function sqlAus(befehl) {
  return execFileSync(
    "ssh",
    [(process.env.TEST_SSH_HOST ?? "testserver"), "docker exec -i fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm -At"],
    { input: befehl },
  ).toString().trim();
}

/** Letzte Log-Mail an diese Adresse, die die Marke enthält (ohne SMTP stehen Mails nur im Log). */
function mailImLog(email, marke) {
  const teile = serverLog().split("Mail (kein SMTP_HOST gesetzt, nur geloggt)");
  return teile.filter((t) => t.includes(email) && t.includes(marke)).at(-1) ?? "";
}

// Seit dem Onboarding gibt es unter „Alle Antworten“ einen zweiten „Speichern“-Knopf.
// Der der Terminantwort steht im DOM zuerst, deshalb `.first()`.
const TAGE = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
const KOEPFE = ["Mo 09.11.", "Di 10.11.", "Mi 11.11.", "Do 12.11.", "Fr 13.11."];

/** Klickt wie ein Mensch auf den sichtbaren Umschalter. */
async function waehle(gruppe, wert) {
  await gruppe.locator("label").filter({ hasText: new RegExp(`^\\s*${wert}\\s*$`) }).click();
  erwarte(await gruppe.getByLabel(wert, { exact: true }).isChecked(), `„${wert}“ ist nach dem Klick nicht gewählt.`);
}

/** Trägt die Antworten in die eigene Karte ein (Reihenfolge wie die Spalten). */
async function ankreuzen(seite, werte) {
  const gruppen = seite.getByRole("group", { name: /^Antwort für/ });
  erwarte((await gruppen.count()) === werte.length, `Erwartet ${werte.length} Antwortgruppen, gefunden ${await gruppen.count()}.`);
  for (const [index, wert] of werte.entries()) {
    await waehle(gruppen.nth(index), wert);
  }
}

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: aKontext, seite: seiteA } = await neuerKontext(browser, seitenfehler);
const { kontext: bKontext, seite: seiteB } = await neuerKontext(browser, seitenfehler);

const kennung = Date.now().toString(36);
const personA = testPerson(`rf19a-${kennung}`);
const personB = testPerson(`rf19b-${kennung}`);
const nameA = `${personA.vorname} ${personA.nachname}`;
const nameB = `${personB.vorname} ${personB.nachname}`;
const titel = `RF19 Umfrage ${kennung}`;
let umfrageId = "";
let linkA = "";
let linkB = "";

/** Link aus „Link kopieren“ der Admin-Seite, auf die Testinstanz umgebogen. */
async function personenlink(name) {
  const roh = await admin
    .getByRole("button", { name: `Link für ${name} kopieren` })
    .getAttribute("data-link");
  erwarte(roh, `Kein Link für ${name} gefunden.`);
  const url = new URL(roh);
  return `${BASIS}${url.pathname}`;
}

try {
  await adminAnmelden(admin);
  await legePersonAn(admin, personA);
  await legePersonAn(admin, personB);

  await pruefe("Admin legt Umfrage mit 5 Terminen und zwei Personen an", async () => {
    await admin.goto(`${BASIS}/admin/umfragen/neu`);
    await admin.getByLabel("Titel", { exact: true }).fill(titel);
    await admin.getByLabel("Ort (optional)").fill("Schulamt, Raum 4");
    await admin.getByLabel("Uhrzeit (optional)").fill("14:00 bis 17:00 Uhr");
    await admin.getByLabel("Beschreibung (optional)").fill("Es geht um den Termin der Fachtagung.");
    for (let i = 1; i < TAGE.length; i += 1) {
      await admin.getByRole("button", { name: "Termin hinzufügen" }).click();
    }
    const felder = admin.locator('input[type="date"]');
    erwarte((await felder.count()) === 5, "Es sollten fünf Datumsfelder da sein.");
    for (const [index, tag] of TAGE.entries()) await felder.nth(index).fill(tag);
    await admin.getByRole("button", { name: "Keine auswählen" }).click();
    await admin.getByLabel(new RegExp(personA.nachname)).check();
    await admin.getByLabel(new RegExp(personB.nachname)).check();
    await admin.getByRole("button", { name: "Umfrage speichern" }).click();
    await admin.waitForURL(/\/admin\/umfragen\/[^/?]+\?gespeichert=1/, { timeout: 20_000 });
    umfrageId = idAusUrl(admin.url());

    const matrix = admin.getByTestId("umfrage-matrix");
    for (const kopf of KOEPFE) await matrix.getByRole("columnheader", { name: kopf }).waitFor();
    erwarte((await matrix.locator("tbody tr").count()) === 2, "Die Matrix sollte zwei Personen zeigen.");
    linkA = await personenlink(nameA);
    linkB = await personenlink(nameB);
    return { satz: `Umfrage ${umfrageId} mit 5 Terminen und 2 Personen angelegt, beide persönlichen Links sind da.` };
  });

  await pruefe("Admin-Maske lehnt doppelte Termine ab", async () => {
    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}/bearbeiten`);
    const felder = admin.locator('input[type="date"]');
    await felder.nth(1).fill(TAGE[0]);
    await admin.getByRole("button", { name: "Umfrage speichern" }).click();
    await admin.getByText("Ein Datum kommt doppelt vor.").waitFor({ timeout: 10_000 });
    return { satz: "Doppeltes Datum wird mit Meldung abgelehnt." };
  });

  await pruefe("Einladungsmail ohne {Link} wird abgelehnt", async () => {
    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
    await admin.getByRole("button", { name: "Einladung per Mail senden" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Text").fill("Hallo, bitte stimm ab. Aber ohne Platzhalter.");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();
    await dialog.getByText(/Im Text fehlt \{Link\}/).waitFor({ timeout: 10_000 });
    erwarte(!serverLog().includes("Aber ohne Platzhalter"), "Trotz fehlendem {Link} steht eine Mail im Server-Log.");
    return { satz: "Ohne {Link} lehnt der Server ab, keine Mail im Log." };
  });

  await pruefe("Einladungsmail mit {Link} geht je Person mit eigenem Link ins Log", async () => {
    const dialog = admin.getByRole("dialog");
    const textfeld = dialog.getByLabel("Text");
    await textfeld.fill("Hallo {Vorname}, hier ist RF19MARKE für dich: {Link}");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();
    await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 15_000 });
    const log = serverLog();
    erwarte(log.includes("Hallo Randa, hier ist RF19MARKE"), "Die Mail mit ersetztem {Vorname} fehlt im Server-Log.");
    erwarte(log.includes(new URL(linkA).pathname), "Der persönliche Link von Person A fehlt im Log.");
    erwarte(log.includes(new URL(linkB).pathname), "Der persönliche Link von Person B fehlt im Log.");
    await admin.keyboard.press("Escape");
    return { satz: "Beide Mails mit ersetztem Vornamen und eigenem Link stehen im Log, Vermerke bleiben ohne SMTP offen." };
  });

  await pruefe("Erinnerung geht nur an Eingeladene ohne Antwort und braucht {Link}", async () => {
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=now() WHERE "umfrageId"='${umfrageId}';`);
    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
    await admin.getByRole("button", { name: "Erinnerung an alle ohne Antwort" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Text").fill("Erinnerung ganz ohne Platzhalter.");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();
    await dialog.getByText(/Im Text fehlt \{Link\}/).waitFor({ timeout: 10_000 });
    await dialog.getByLabel("Text").fill("Hallo {Vorname}, RF19ERINNERUNG: {Link}");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();
    await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 15_000 });
    erwarte(serverLog().includes("RF19ERINNERUNG"), "Die Erinnerung fehlt im Server-Log.");
    await admin.keyboard.press("Escape");
    return { satz: "Erinnerung ohne {Link} abgelehnt, mit {Link} im Log." };
  });

  await pruefe("Person A stimmt ab, Dankeskasten bietet Zugang einrichten an", async () => {
    await seiteA.goto(linkA);
    await seiteA.getByRole("heading", { name: titel }).waitFor();
    erwarte(await seiteA.getByText("Schulamt, Raum 4").isVisible(), "Ort fehlt im Kopf.");
    erwarte(await seiteA.getByText("14:00 bis 17:00 Uhr").isVisible(), "Uhrzeit fehlt im Kopf.");
    // Ohne vollständige Antwort wird serverseitig abgelehnt
    await seiteA.getByRole("button", { name: "Speichern" }).first().click();
    await ankreuzen(seiteA, ["Ja", "Vielleicht", "Nein", "Ja", "Nein"]);
    await seiteA.getByLabel("Kommentar (optional)").fill("Donnerstag nur vormittags.");
    await seiteA.getByRole("button", { name: "Speichern" }).first().click();
    await seiteA.getByTestId("dankeskasten").waitFor({ timeout: 15_000 });
    await seiteA.getByRole("button", { name: "Zugang einrichten" }).waitFor();
    return { satz: "Antwort gespeichert, Dankeskasten mit „Zugang einrichten“ sichtbar." };
  });

  await pruefe("Person B sieht die Zeile von A nur lesend und die Summenzeile", async () => {
    await seiteB.goto(linkB);
    const matrix = seiteB.getByTestId("umfrage-matrix");
    const zeileA = matrix.locator(`tr[data-zeile="${nameA}"]`);
    await zeileA.waitFor();
    erwarte((await matrix.locator("input, select, textarea, button").count()) === 0, "In der Tabelle gibt es bedienbare Felder.");
    erwarte(!(await matrix.getByText(nameB).count()), "Person B ohne Antwort darf in der Tabelle nicht stehen.");
    erwarte(await matrix.getByText("Donnerstag nur vormittags.").isVisible(), "Der Kommentar von A fehlt.");
    const summen = await matrix.getByTestId("summe-ja").allInnerTexts();
    erwarte(summen.join(",") === "1,0,0,1,0", `Summenzeile stimmt nicht: ${summen.join(",")}`);
    // Nur eine Antwortkarte: die eigene
    erwarte((await seiteB.getByRole("group", { name: /^Antwort für/ }).count()) === 5, "Die eigene Karte sollte fünf Gruppen haben.");
    const seitenText = await seiteB.locator("body").innerText();
    erwarte(!seitenText.includes("@test.local") && !seitenText.includes("GS Randstadt"), "Mail oder Schule sind öffentlich sichtbar.");
    return { satz: "Zeile von A ist nur lesbar, Summe „Ja“ je Termin 1,0,0,1,0, keine Mail und keine Schule sichtbar." };
  });

  await pruefe("Person B speichert, die Antwort von A bleibt unverändert", async () => {
    await ankreuzen(seiteB, ["Nein", "Ja", "Ja", "Vielleicht", "Ja"]);
    await seiteB.getByRole("button", { name: "Speichern" }).first().click();
    await seiteB.getByTestId("dankeskasten").waitFor({ timeout: 15_000 });
    await seiteA.reload();
    const gruppen = seiteA.getByRole("group", { name: /^Antwort für/ });
    const erwartet = ["Ja", "Vielleicht", "Nein", "Ja", "Nein"];
    for (const [index, wert] of erwartet.entries()) {
      erwarte(await gruppen.nth(index).getByLabel(wert, { exact: true }).isChecked(), `Antwort ${index + 1} von A ist nicht mehr „${wert}“.`);
    }
    erwarte((await seiteA.getByLabel("Kommentar (optional)").inputValue()) === "Donnerstag nur vormittags.", "Kommentar von A verändert.");
    const matrix = seiteA.getByTestId("umfrage-matrix");
    const summen = await matrix.getByTestId("summe-ja").allInnerTexts();
    erwarte(summen.join(",") === "1,1,1,1,1", `Summenzeile nach B stimmt nicht: ${summen.join(",")}`);
    return { satz: "A behält seine fünf Antworten und den Kommentar, die Summe zählt jetzt beide." };
  });

  await pruefe("Manipulierte Token werden abgelehnt, die Seite bleibt neutral", async () => {
    const teile = new URL(linkA).pathname.split("/").pop();
    const [id, sig] = teile.split(".");
    const varianten = [
      `${id}.${sig.slice(0, -1)}${sig.at(-1) === "A" ? "B" : "A"}`,
      `${id}.`,
      `${id}`,
      `${new URL(linkB).pathname.split("/").pop().split(".")[0]}.${sig}`,
      `00000000-0000-0000-0000-000000000000.${sig}`,
    ];
    for (const variante of varianten) {
      await seiteA.goto(`${BASIS}/umfrage/${variante}`);
      await seiteA.getByText("Dieser Link funktioniert nicht").waitFor({ timeout: 10_000 });
      erwarte(!(await seiteA.getByText(titel).count()), `Variante ${variante} zeigt Inhalte.`);
    }
    // noindex im Kopf
    const robots = await seiteA.locator('meta[name="robots"]').getAttribute("content");
    erwarte(/noindex/.test(robots ?? ""), `robots-Meta fehlt: ${robots}`);
    return { satz: `${varianten.length} manipulierte Links zeigen nur die neutrale Fehlermeldung, die Seite trägt noindex.` };
  });

  await pruefe("Zugang einrichten führt auf /zugang, danach erscheint der Profil-Anstoß", async () => {
    await seiteB.goto(linkB);
    await waehle(seiteB.getByRole("group", { name: /^Antwort für/ }).first(), "Ja");
    await seiteB.getByRole("button", { name: "Speichern" }).first().click();
    await seiteB.getByTestId("dankeskasten").waitFor({ timeout: 15_000 });
    await Promise.all([
      seiteB.waitForURL(/\/zugang\?token=/, { timeout: 20_000 }),
      seiteB.getByRole("button", { name: "Zugang einrichten" }).click(),
    ]);
    await seiteB.locator('input[name="passwort"]').waitFor();
    const zugangsLink = seiteB.url();
    await setzePasswort(seiteB, zugangsLink, personB);

    await seiteB.goto(linkB);
    await seiteB.getByRole("button", { name: "Speichern" }).first().click();
    const kasten = seiteB.getByTestId("dankeskasten");
    await kasten.waitFor({ timeout: 15_000 });
    await kasten.getByText("Im Referentenbereich fehlt noch:").waitFor();
    erwarte((await kasten.getByText("ein Foto").count()) === 1, "Hinweis „ein Foto“ fehlt.");
    erwarte((await kasten.getByText("ein Kurzprofil").count()) === 1, "Hinweis „ein Kurzprofil“ fehlt.");
    erwarte((await kasten.getByText("ein eingereichtes Thema").count()) === 1, "Hinweis „ein eingereichtes Thema“ fehlt.");
    const knopf = kasten.getByRole("link", { name: "Zum Referentenbereich" });
    erwarte((await knopf.getAttribute("href")) === "/login?weiter=/admin", "Der Knopf zeigt nicht auf den Login mit Weiterleitung nach /admin.");
    erwarte((await kasten.getByRole("button", { name: "Zugang einrichten" }).count()) === 0, "Zugang einrichten wird trotz Passwort noch angeboten.");
    return { satz: "Der Knopf führte auf /zugang, mit gesetztem Passwort zeigt der Kasten die drei fehlenden Profilpunkte und „Zum Referentenbereich“." };
  });

  await pruefe("{Zugang}: ohne Platzhalter keine neuen Zugangstoken, mit Platzhalter Link je nach Konto", async () => {
    const zaehle = () => Number(sqlAus(`SELECT count(*) FROM "Zugangstoken" t JOIN "User" u ON u.id=t."userId" WHERE u.email IN ('${personA.email}','${personB.email}');`));
    const oeffneDialog = async (knopf) => {
      await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
      await admin.getByRole("button", { name: knopf }).click();
      return admin.getByRole("dialog");
    };
    const sende = async (dialog, text) => {
      await dialog.getByLabel("Text").fill(text);
      await dialog.getByRole("button", { name: "Senden", exact: true }).click();
      await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 20_000 });
      await admin.keyboard.press("Escape");
    };
    // Der Einladungsknopf erscheint nur, wenn jemand noch nicht eingeladen ist.
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=NULL WHERE "umfrageId"='${umfrageId}';`);
    const hinweis = await (await oeffneDialog("Einladung per Mail senden")).getByText(/optional \{Zugang\}/).count();
    erwarte(hinweis === 1, "Der neue Platzhalter-Hinweis fehlt im Dialog.");
    await admin.keyboard.press("Escape");

    // 1. Ohne {Zugang}: B hat ein Passwort, A nicht. Keine neuen Token, kein /login, kein /zugang
    const vorher = zaehle();
    await sende(await oeffneDialog("Einladung per Mail senden"), "Hallo {Vorname}, RF19OHNEZ: {Link}");
    erwarte(zaehle() === vorher, "Ohne {Zugang} sind Zugangstoken entstanden.");
    const ohne = mailImLog(personA.email, "RF19OHNEZ");
    erwarte(ohne.includes("RF19OHNEZ") && !ohne.includes("/zugang?token=") && !ohne.includes("/login"), "Mail ohne {Zugang} enthält einen Zugangslink.");

    // 2. Mit {Zugang}: A ohne Passwort bekommt /zugang?token=, B mit Passwort /login
    await sende(await oeffneDialog("Einladung per Mail senden"), "Hallo {Vorname}, RF19ZUGANG: {Link} Zugang: {Zugang} Ende");
    const mailA = mailImLog(personA.email, "RF19ZUGANG");
    const mailB = mailImLog(personB.email, "RF19ZUGANG");
    const treffer = mailA.match(/Zugang: (\S+\/zugang\?token=[A-Za-z0-9_%.-]+) Ende/);
    erwarte(treffer, "Mail an A ohne Passwort enthält keinen /zugang?token=-Link.");
    erwarte(!mailA.includes("{Zugang}") && !mailB.includes("{Zugang}"), "Platzhalter {Zugang} blieb stehen.");
    erwarte(/Zugang: \S+\/login Ende/.test(mailB), "Mail an B mit Passwort enthält nicht /login.");
    erwarte(!mailB.includes("/zugang?token="), "Mail an B mit Passwort enthält einen Zugangstoken.");
    erwarte(zaehle() === vorher + 1, `Erwartet genau einen neuen Token, gezählt ${zaehle() - vorher}.`);
    erwarte(sqlAus(`SELECT count(*) FROM "AuditLog" WHERE entitaet='Zugang' AND details->>'ausUmfrage'='${umfrageId}' AND details->>'mailversand'='true';`) === "1", "AuditLog-Eintrag für den Zugang fehlt oder ist doppelt.");

    // Der Link funktioniert: Passwort setzen. Danach hat auch A ein Konto mit Passwort.
    const linkZugang = `${BASIS}${new URL(treffer[1]).pathname}${new URL(treffer[1]).search}`;
    await setzePasswort(seiteA, linkZugang, personA);
    return { satz: "Ohne {Zugang} keine Token. Mit {Zugang}: A ohne Passwort bekommt /zugang?token= (Passwort setzen klappt, 1 neuer Token, AuditLog), B mit Passwort /login." };
  });

  await pruefe("{Zugang} bei Erinnerung und bei inaktivem Konto", async () => {
    // Erinnerung: beide eingeladen, ohne Antwort, A und B haben jetzt ein Passwort
    sql(`UPDATE "UmfrageTeilnehmer" SET "eingeladenAm"=now(), "geantwortetAm"=NULL WHERE "umfrageId"='${umfrageId}';`);
    try {
    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
    await admin.getByRole("button", { name: "Erinnerung an alle ohne Antwort" }).click();
    let dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Text").fill("Hallo {Vorname}, RF19ERZ: {Link} Zugang: {Zugang} Ende");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();
    await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 20_000 });
    await admin.keyboard.press("Escape");
    erwarte(/Zugang: \S+\/login Ende/.test(mailImLog(personA.email, "RF19ERZ")), "Erinnerung an A enthält nicht /login.");
    erwarte(/Zugang: \S+\/login Ende/.test(mailImLog(personB.email, "RF19ERZ")), "Erinnerung an B enthält nicht /login.");

    // Inaktives Konto bei B: keine Mail an B, A bekommt seine
    const tokenVorher = sqlAus(`SELECT count(*) FROM "Zugangstoken";`);
    sql(`UPDATE "User" SET "isActive"=false WHERE email='${personB.email}';`);
    try {
      await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
      await admin.getByRole("button", { name: "Erinnerung an alle ohne Antwort" }).click();
      dialog = admin.getByRole("dialog");
      await dialog.getByLabel("Text").fill("Hallo {Vorname}, RF19INAKTIV: {Link} Zugang: {Zugang} Ende");
      await dialog.getByRole("button", { name: "Senden", exact: true }).click();
      await dialog.getByText(/Mailversand ist aus/).waitFor({ timeout: 20_000 });
      await admin.keyboard.press("Escape");
    } finally {
      sql(`UPDATE "User" SET "isActive"=true WHERE email='${personB.email}';`);
    }
    erwarte(mailImLog(personA.email, "RF19INAKTIV"), "A hat keine Mail bekommen.");
    erwarte(!mailImLog(personB.email, "RF19INAKTIV"), "B mit inaktivem Konto hat trotzdem eine Mail bekommen.");
    erwarte(sqlAus(`SELECT count(*) FROM "Zugangstoken";`) === tokenVorher, "Bei inaktivem Konto oder Bestandskonto entstand ein Token.");
    } finally {
      // Wiederherstellen: beide haben geantwortet
      sql(`UPDATE "UmfrageTeilnehmer" SET "geantwortetAm"=now() WHERE "umfrageId"='${umfrageId}';`);
    }
    return { satz: "Erinnerung mit {Zugang} liefert /login. Inaktives Konto: keine Mail an B, kein Token, A bekommt seine Mail." };
  });

  await pruefe("Geschlossene Umfrage nimmt keine Antwort mehr an", async () => {
    // Offene Seite von A, bevor die Umfrage geschlossen wird
    const ladeAlt = seiteA;
    await seiteA.goto(linkA);
    await waehle(seiteA.getByRole("group", { name: /^Antwort für/ }).first(), "Nein");

    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
    await admin.getByRole("button", { name: "Termin festlegen" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Mi 11.11.").check();
    await dialog.getByRole("button", { name: "Festlegen und schließen" }).click();
    await admin.getByText("Festgelegt: Mi 11.11.").waitFor({ timeout: 15_000 });

    // Veraltete, noch offene Seite: Speichern wird serverseitig abgelehnt
    await ladeAlt.getByRole("button", { name: "Speichern" }).first().click();
    await ladeAlt.getByText("Die Umfrage ist geschlossen. Deine Antwort wurde nicht gespeichert.").waitFor({ timeout: 15_000 });

    // Frische Seite: nur lesbar, festgelegter Termin hervorgehoben
    await seiteA.goto(linkA);
    await seiteA.getByText("Die Umfrage ist geschlossen").waitFor();
    erwarte((await seiteA.getByRole("group", { name: /^Antwort für/ }).count()) === 0, "Bei geschlossener Umfrage gibt es noch Antwortfelder.");
    erwarte((await seiteA.getByRole("button", { name: "Speichern" }).count()) === 0, "Speichern-Knopf trotz geschlossener Umfrage.");
    await seiteA.getByText("Festgelegter Termin: Mi 11.11.").waitFor();
    const kopf = seiteA.getByTestId("umfrage-matrix").getByRole("columnheader", { name: /Mi 11\.11\./ });
    erwarte(/Festgelegt/.test(await kopf.innerText()), "Der festgelegte Termin ist in der Tabelle nicht hervorgehoben.");

    // A hat weiter „Ja“ am Montag, die abgelehnte Änderung wurde nicht gespeichert
    const matrix = seiteA.getByTestId("umfrage-matrix");
    const summen = await matrix.getByTestId("summe-ja").allInnerTexts();
    erwarte(summen.join(",") === "2,1,1,1,1", `Summe nach Schließen stimmt nicht: ${summen.join(",")}`);
    return { satz: "Nach dem Festlegen lehnt der Server das Speichern ab, die Seite ist nur lesbar und hebt „Mi 11.11.“ hervor." };
  });

  await pruefe("Löschen verlangt Bestätigung und macht die Links ungültig", async () => {
    await admin.goto(`${BASIS}/admin/umfragen/${umfrageId}`);
    await admin.getByRole("button", { name: "Löschen", exact: true }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    erwarte(admin.url().includes(umfrageId), "Abbrechen hat die Seite verlassen.");
    await admin.getByRole("button", { name: "Löschen", exact: true }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Endgültig löschen" }).click();
    await admin.waitForURL(/\/admin\/umfragen$/, { timeout: 15_000 });
    erwarte((await admin.getByText(titel).count()) === 0, "Die gelöschte Umfrage steht noch in der Liste.");
    await seiteA.goto(linkA);
    await seiteA.getByText("Dieser Link funktioniert nicht").waitFor({ timeout: 10_000 });
    return { satz: "Erst nach der Bestätigung gelöscht, der persönliche Link zeigt danach die neutrale Meldung." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await adminKontext.close();
  await aKontext.close();
  await bKontext.close();
  await browser.close();
}
