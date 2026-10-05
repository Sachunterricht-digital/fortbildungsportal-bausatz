import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  BASIS,
  adminAnmelden,
  erwarte,
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
 * Öffentlicher Referentenbereich: Navigation und Kopfzeile (auch iPad hochkant),
 * Seite „Mitglieder Digi-Team“, Steckbrief mit zwei Slidern, Verdrahtung zur
 * Startseite und zum Angebot, Sichtbarkeit (aktiv und sichtbar), Datenschutz im
 * HTML, Profil-Knopf und Foto-Hinweis, deutsche 404-Seiten, Slider per Tastatur,
 * Porträt-Ausfall vor der Hydration.
 *
 * Testpersonen: A mit Profil, Foto und Angeboten, B leer, C stillgelegt,
 * D verborgen (Notbremse). Angebote entstehen per SQL auf der Testinstanz
 * (die Maske legt RLFB-Termine nicht in dieser Menge an) und werden am Ende
 * wieder gelöscht. Die Personen bleiben wie bei den anderen Tests stehen.
 *
 * Bildschirmfotos: RF22_BILDER (Ordner), sonst scripts/e2e/bilder.
 */
const BILDER = process.env.RF22_BILDER ?? path.join(path.dirname(new URL(import.meta.url).pathname), "..", "bilder");
mkdirSync(BILDER, { recursive: true });

const lit = (wert) => `'${String(wert).replace(/'/g, "''")}'`;

/** Schreibt und liest in der Testdatenbank (nur die Testinstanz, nie live). */
function sql(text) {
  return execFileSync(
    "ssh",
    [(process.env.TEST_SSH_HOST ?? "testserver"), "docker exec -i fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm -At -v ON_ERROR_STOP=1"],
    { input: `\\set ON_ERROR_STOP on\n${text}\n`, encoding: "utf8" },
  ).trim();
}

const berlin = (opt) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hourCycle: "h23", ...opt });
const datumBerlin = (d) => berlin({ day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const zeitBerlin = (d) => berlin({ hour: "2-digit", minute: "2-digit" }).format(d);

/** Schuljahr in Kurzform wie im Kopf der Seite, Wechsel zum 1. August. */
function schuljahrKurz(heute = new Date()) {
  const jahr = Number(berlin({ year: "numeric" }).format(heute));
  const monat = Number(berlin({ month: "numeric" }).format(heute));
  const von = monat >= 8 ? jahr : jahr - 1;
  return `${von}/${String(von + 1).slice(2)}`;
}

/** Elemente, die über den Rand ragen, ohne in einem Slider zu liegen. */
async function ueberstehende(seite) {
  return seite.evaluate(() => {
    const breite = document.documentElement.clientWidth;
    const treffer = [];
    for (const el of document.querySelectorAll("body *")) {
      if (String(el.className).includes("sr-only")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left >= -0.5 && r.right <= breite + 0.5) continue;
      let eltern = el.parentElement;
      let imSlider = false;
      while (eltern) {
        const o = getComputedStyle(eltern).overflowX;
        if (o === "auto" || o === "scroll") {
          imSlider = true;
          break;
        }
        eltern = eltern.parentElement;
      }
      if (!imSlider) treffer.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    }
    return { breite, scrollBreite: document.documentElement.scrollWidth, treffer: treffer.slice(0, 5) };
  });
}

/**
 * Lage der Kopfzeile: Überlappungen zwischen Marke und Navigationspunkten, Zeilenzahl
 * (Marke und Punkte in einer Reihe oder darunter) und umgebrochene Beschriftungen.
 */
async function kopfLage(seite) {
  return seite.evaluate(() => {
    const kopf = document.querySelector("header.sticky");
    const marke = kopf.querySelector("a[aria-label]");
    const boxen = [];
    for (const el of marke.querySelectorAll("span span")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) boxen.push([`Marke „${el.textContent.trim().slice(0, 14)}“`, r]);
    }
    const punkte = [...kopf.querySelectorAll("nav > *")];
    for (const el of punkte) boxen.push([`Punkt „${(el.getAttribute("aria-label") ?? el.textContent.trim()).slice(0, 18)}“`, el.getBoundingClientRect()]);
    const ueberlappungen = [];
    for (let i = 0; i < boxen.length; i += 1) {
      for (let j = i + 1; j < boxen.length; j += 1) {
        const a = boxen[i][1];
        const b = boxen[j][1];
        const breite = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const hoehe = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (breite > 1 && hoehe > 1) ueberlappungen.push(`${boxen[i][0]} und ${boxen[j][0]} (${Math.round(breite)} x ${Math.round(hoehe)} px)`);
      }
    }
    const markeUnten = marke.getBoundingClientRect().bottom;
    const punktLinks = punkte.filter((p) => !p.className.includes("bg-primary"));
    const zweiZeilen = punktLinks.every((p) => p.getBoundingClientRect().top >= markeUnten - 1);
    const umgebrochen = punktLinks
      .map((p) => [p.getAttribute("aria-label") ?? p.textContent.trim(), p.querySelector("span:not(.sr-only)")])
      .filter(([, sp]) => sp && sp.getBoundingClientRect().width > 0 && sp.getBoundingClientRect().height > 24)
      .map(([name]) => name);
    return {
      hoehe: Math.round(kopf.getBoundingClientRect().height),
      ueberlappungen,
      zweiZeilen,
      umgebrochen,
      ueberstand: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function html(kontext, pfad) {
  const antwort = await kontext.request.get(`${BASIS}${pfad}`);
  return { status: antwort.status(), text: await antwort.text() };
}

const stamp = Date.now().toString(36);
const kennung = (suffix) => `rf22-${stamp}-${suffix}`;
const A = testPerson(kennung("a"));
const B = testPerson(kennung("b"));
const C = testPerson(kennung("c"));
const D = testPerson(kennung("d"));
A.telefon = "0151 55 44 33 22";
const PROFIL = {
  organisation: "GS Randstadt",
  telefon: A.telefon,
  schwerpunkte: "KI, ByCS, Tablets, Videos",
  kurzprofil: "Erste Zeile des Kurzprofils.\nZweite Zeile mit Umlauten: Übung, Größe.",
};

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);
const anonym = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const seite = await anonym.newPage();
seite.on("pageerror", (e) => seitenfehler.push(`JS: ${e.message}`));
seite.on("response", (a) => {
  if (a.status() >= 500) seitenfehler.push(`${a.status()} ${a.url()}`);
});

let idA;
let idB;
let idC;
let idD;
let terminTitel;
let terminSlug;
let schilfTitel1;
let gemeinsamTitel;
let gemeinsamSlug;

try {
  // ------------------------------------------------------------------ Aufbau
  await adminAnmelden(admin);
  const { link } = await personMitEinladung(admin, { kennung: kennung("a") });
  await setzePasswort(ref, link, A);
  await legePersonAn(admin, B);
  await legePersonAn(admin, C);
  await legePersonAn(admin, D);

  const idVon = (p) => sql(`select id from "Referent" where lower(email) = ${lit(p.email)};`);
  [idA, idB, idC, idD] = [idVon(A), idVon(B), idVon(C), idVon(D)];
  erwarte([idA, idB, idC, idD].every(Boolean), "Eine Testperson fehlt in der Datenbank.");

  await pruefe("Neue Personen aus dem Admin-Formular sind standardmäßig sichtbar", async () => {
    const stand = sql(`select "oeffentlichSichtbar", aktiv from "Referent" where id in (${[idA, idB, idC, idD].map(lit).join(",")}) order by "nachname";`);
    erwarte(stand.split("\n").every((z) => z === "t|t"), `Nicht alle neuen Personen stehen auf sichtbar und aktiv: ${stand}`);
    return { satz: "Admin-Formular (Haken vorbelegt) und Prisma-Default legen vier Personen als aktiv und sichtbar an." };
  });

  sql(`update "Referent" set aktiv = false where id = ${lit(idC)};`);
  sql(`update "Referent" set "oeffentlichSichtbar" = false where id = ${lit(idD)};`);

  // ---------------------------------------------------- Profil-Knopf (innen)
  await pruefe("Profil-Knopf: Referent „Speichern und veröffentlichen“ mit Hinweis, Admin „Profil speichern“ ohne Hinweis", async () => {
    // Festgelegt am 05.10.2026: Speichern stellt das Profil sofort online.
    await ref.goto(`${BASIS}/admin/konto`);
    await ref.getByRole("button", { name: "Speichern und veröffentlichen", exact: true }).waitFor({ timeout: 10_000 });
    await ref
      .getByText("Das Profil erscheint sofort im Teambereich der Webseite und lässt sich jederzeit ändern und ergänzen.", { exact: true })
      .waitFor({ timeout: 5_000 });
    await admin.goto(`${BASIS}/admin/konto`);
    await admin.getByRole("button", { name: "Profil speichern", exact: true }).waitFor({ timeout: 10_000 });
    erwarte((await admin.getByRole("button", { name: /veröffentlichen/ }).count()) === 0, "Admin sieht einen Knopf „… veröffentlichen“.");
    erwarte((await admin.getByText("erscheint sofort im Teambereich").count()) === 0, "Admin sieht den Veröffentlichungshinweis.");
    return { satz: "Referent sieht „Speichern und veröffentlichen“ samt Hinweis zum Teambereich, Admin „Profil speichern“ ohne Hinweis." };
  });

  // Profil von A mit dem Referenten-Knopf, danach Foto
  await profilSpeichern(ref, PROFIL);
  const png = await sharp({ create: { width: 240, height: 240, channels: 3, background: { r: 42, g: 89, b: 112 } } }).png().toBuffer();
  await ref.goto(`${BASIS}/admin/konto`);
  await pruefe("Gewähltes, noch nicht gespeichertes Foto: Hinweis steht auch neben „Speichern und veröffentlichen“ und verschwindet nach „Foto speichern“", async () => {
    const hinweis = ref.getByRole("status").filter({ hasText: "Das gewählte Foto ist noch nicht gespeichert. Bitte oben „Foto speichern“ klicken." });
    erwarte((await hinweis.count()) === 0, "Der Hinweis steht schon ohne gewähltes Foto da.");
    await ref.locator('input[name="foto"]').setInputFiles({ name: "rf22.png", mimeType: "image/png", buffer: png });
    await hinweis.waitFor({ timeout: 5_000 });
    const knopfOben = await ref.getByRole("button", { name: "Speichern und veröffentlichen", exact: true }).boundingBox();
    const hinweisOben = await hinweis.boundingBox();
    erwarte(knopfOben && hinweisOben && hinweisOben.y > knopfOben.y && hinweisOben.y - knopfOben.y < 120, "Der Hinweis steht nicht unter dem Knopf „Profil speichern“.");
    await ref.getByRole("button", { name: "Speichern und veröffentlichen", exact: true }).click();
    await ref.getByText(/Profil gespeichert/).first().waitFor({ timeout: 15_000 });
    erwarte((await hinweis.count()) === 1, "Der Hinweis verschwindet schon nach „Profil speichern“, obwohl das Foto noch fehlt.");
    erwarte((await ref.locator('img[src^="/api/portraet/"]').count()) === 0, "Das Foto wurde mit „Profil speichern“ gespeichert.");
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.locator('img[src^="/api/portraet/"]').waitFor({ timeout: 20_000 });
    erwarte((await hinweis.count()) === 0, "Der Hinweis bleibt nach „Foto speichern“ stehen.");
    return { satz: "Foto gewählt: Hinweis unter „Profil speichern“, bleibt nach dem Profil-Speichern (Foto fehlt noch), weg nach „Foto speichern“." };
  });

  // Angebote per SQL
  const jetzt = Date.now();
  const tag = 24 * 3600 * 1000;
  const termin = new Date(jetzt + 10 * tag);
  termin.setUTCHours(13, 0, 0, 0);
  const terminEnde = new Date(termin.getTime() + 2 * 3600 * 1000);
  const vergangen = new Date(jetzt - 10 * tag);
  terminTitel = `RF22 ${stamp} Regionale Fortbildung`;
  schilfTitel1 = `RF22 ${stamp} SchiLf 1`;
  gemeinsamTitel = `RF22 ${stamp} Gemeinsames SchiLf`;
  terminSlug = `rf22-${stamp}-termin`;
  gemeinsamSlug = `rf22-${stamp}-gemeinsam`;
  const iso = (d) => lit(d.toISOString());
  const angebot = (slug, titel, form, format, status, beginn, ende, referentIds) => `
    with f as (
      insert into "Fortbildung" (id, slug, titel, "beschreibungHtml", "beschreibungText", organisationsform, format, status, beginn, ende, "ortText", schularten, "updatedAt")
      values (gen_random_uuid()::text, ${lit(slug)}, ${lit(titel)}, '<p>Test</p>', 'Test', ${lit(form)}, ${lit(format)}, ${lit(status)},
              ${beginn ? iso(beginn) : "null"}, ${ende ? iso(ende) : "null"}, ${beginn ? lit("GS Randstadt") : "null"},
              array['GRUNDSCHULE','MITTELSCHULE'], now())
      returning id)
    insert into "FortbildungReferent" ("fortbildungId", "referentId") select f.id, r from f, unnest(array[${referentIds.map(lit).join(",")}]) as r;`;
  const befehle = [
    angebot(terminSlug, terminTitel, "REGIONAL", "PRAESENZ", "VEROEFFENTLICHT", termin, terminEnde, [idA]),
    angebot(`rf22-${stamp}-abgesagt`, `RF22 ${stamp} Abgesagt`, "REGIONAL", "PRAESENZ", "ABGESAGT", termin, terminEnde, [idA]),
    angebot(`rf22-${stamp}-vorbei`, `RF22 ${stamp} Vorbei`, "REGIONAL", "PRAESENZ", "VEROEFFENTLICHT", vergangen, new Date(vergangen.getTime() + 3600 * 1000), [idA]),
    angebot(`rf22-${stamp}-eingereicht`, `RF22 ${stamp} Eingereicht`, "REGIONAL", "PRAESENZ", "EINGEREICHT", termin, terminEnde, [idA]),
    angebot(`rf22-${stamp}-entwurf`, `RF22 ${stamp} Entwurf`, "SCHILF", "PRAESENZ", "ENTWURF", null, null, [idA]),
    angebot(`rf22-${stamp}-schilf-abgesagt`, `RF22 ${stamp} SchiLf abgesagt`, "SCHILF", "PRAESENZ", "ABGESAGT", null, null, [idA]),
    angebot(gemeinsamSlug, gemeinsamTitel, "SCHILF", "PRAESENZ", "VEROEFFENTLICHT", null, null, [idA, idC, idD]),
    angebot(`rf22-${stamp}-schilf-1`, schilfTitel1, "SCHILF", "MICRO_SCHILF", "VEROEFFENTLICHT", null, null, [idA]),
    ...[2, 3, 4, 5, 6, 7].map((n) =>
      angebot(`rf22-${stamp}-schilf-${n}`, `RF22 ${stamp} SchiLf ${n}`, "SCHILF", "PRAESENZ", "VEROEFFENTLICHT", null, null, [idA]),
    ),
  ];
  sql(befehle.join("\n"));
  // A: 7 SchiLf (1 Micro-SchiLf, 6 SchiLf) plus das gemeinsame = 8, dazu 1 Fortbildung mit Termin.

  const nameA = `${A.vorname} ${A.nachname}`;
  const nameB = `${B.vorname} ${B.nachname}`;

  // ------------------------------------------------------------- Navigation
  await pruefe("Nav-Punkt „Referenten“ steht zwischen Kalender und Kataloge, aktiv nur auf der eigenen Seite", async () => {
    await seite.goto(`${BASIS}/`);
    const reihenfolge = await seite.$$eval("header nav a, header nav span[aria-disabled]", (els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()),
    );
    erwarte(
      JSON.stringify(reihenfolge) === JSON.stringify(["Alle Fortbildungen", "Kalender", "Referenten", "Kataloge", "Referentenzugang"]),
      `Reihenfolge der Navigation: ${reihenfolge.join(" | ")}`,
    );
    erwarte((await seite.locator('header nav a[aria-current="page"]').count()) === 0, "Auf der Startseite ist ein Punkt als aktiv markiert.");
    await seite.getByRole("link", { name: "Referenten", exact: true }).click();
    await seite.waitForURL(/\/referenten$/);
    const aktiv = seite.locator('header nav a[aria-current="page"]');
    erwarte((await aktiv.count()) === 1 && (await aktiv.getAttribute("aria-label")) === "Referenten", "„Referenten“ ist nicht als aktive Seite markiert.");
    await seite.waitForTimeout(500); // die Farbe läuft 140 ms lang über
    const farbe = await aktiv.evaluate((e) => getComputedStyle(e).borderBottomColor);
    erwarte(farbe === "rgb(244, 194, 13)", `Der aktive Strich ist nicht Gelb: ${farbe}`);
    return { satz: "Reihenfolge Alle Fortbildungen, Kalender, Referenten, Kataloge, Zugang. Aktiv mit gelbem Strich und aria-current nur auf /referenten." };
  });

  await pruefe("Kopfzeile: nichts überlappt von 360 bis 1280 px, unter 920 px zwei Zeilen, ab 920 px eine Zeile, ab 640 px ohne umgebrochene Beschriftungen", async () => {
    const breiten = [360, 481, 560, 640, 641, 700, 768, 810, 820, 834, 849, 850, 900, 919, 920, 1024, 1280];
    const befunde = [];
    for (const breite of breiten) {
      const k = await browser.newContext({ viewport: { width: breite, height: 800 } });
      const s = await k.newPage();
      try {
        await s.goto(`${BASIS}/fortbildungen`, { waitUntil: "load" });
        await s.waitForTimeout(250);
        const lage = await kopfLage(s);
        if (lage.ueberlappungen.length) befunde.push(`${breite} px: ${lage.ueberlappungen[0]}`);
        if (lage.ueberstand > 0) befunde.push(`${breite} px: horizontales Scrollen (${lage.ueberstand} px)`);
        if (breite < 920 && !lage.zweiZeilen) befunde.push(`${breite} px: Punkte stehen nicht in der zweiten Zeile`);
        if (breite >= 920 && lage.zweiZeilen) befunde.push(`${breite} px: Kopf ist zweizeilig`);
        if (breite >= 640 && lage.umgebrochen.length) befunde.push(`${breite} px: Beschriftung umgebrochen: ${lage.umgebrochen.join(", ")}`);
        if (breite === 768) {
          erwarte(lage.hoehe < 130, `768 px: Kopf ist ${lage.hoehe} px hoch.`);
          await s.screenshot({ path: path.join(BILDER, "rf22-kopf-768.png"), clip: { x: 0, y: 0, width: 768, height: 140 } });
        }
      } finally {
        await k.close();
      }
    }
    erwarte(befunde.length === 0, befunde.slice(0, 3).join(" | "));
    return { satz: `${breiten.length} Breiten geprüft (iPad hochkant 768, 810, 820, 834 eingeschlossen): keine Überlappung, kein Überstand, unter 920 px liegen die Punkte in einer zweiten Zeile, ab 920 px in einer Zeile, ab 640 px bricht keine Beschriftung um.` };
  });

  // ------------------------------------------------------- Seite /referenten
  await pruefe("/referenten: Kopf nur mit Schuljahr, kein Einleitungssatz", async () => {
    await seite.goto(`${BASIS}/referenten`);
    const kopf = seite.locator("main header").first();
    erwarte((await seite.locator("h1").innerText()) === `Mitglieder Digi-Team ${schuljahrKurz()}`, `Überschrift: ${await seite.locator("h1").innerText()}`);
    erwarte((await kopf.locator("p").count()) === 0, "Im Kopf steht ein Absatz.");
    erwarte((await kopf.innerText()).trim() === `Mitglieder Digi-Team ${schuljahrKurz()}`, "Im Kopf steht mehr als die Überschrift.");
    return { satz: `Der Kopf zeigt nur „Mitglieder Digi-Team ${schuljahrKurz()}“, ohne Absatz.` };
  });

  const karteVon = (id) => seite.locator(`main a[href="/referenten/${id}"]`);

  await pruefe("/referenten: Raster zeigt A (Foto, Badge, drei Chips, Zähler) und B (Initialen), nicht C und D", async () => {
    await seite.goto(`${BASIS}/referenten`);
    const a = karteVon(idA);
    await a.waitFor({ timeout: 10_000 });
    erwarte((await a.locator("h2").innerText()) === nameA, "Name von A fehlt oder weicht ab.");
    erwarte((await a.innerText()).includes("GS Randstadt"), "Stammschule von A fehlt.");
    erwarte((await a.getByText("Referent", { exact: true }).count()) === 1, "Funktions-Badge „Referent“ fehlt bei A.");
    erwarte((await a.locator('img[src^="/api/portraet/"]').count()) === 1, "Foto von A fehlt.");
    const chips = await a.locator('ul[aria-label="Schwerpunkte"] li').allInnerTexts();
    erwarte(JSON.stringify(chips) === JSON.stringify(["KI", "ByCS", "Tablets"]), `Chips von A: ${chips.join(", ")}`);
    erwarte((await a.innerText()).includes("8 SchiLf · 1 Fortbildung"), `Zähler von A: ${(await a.innerText()).replace(/\s+/g, " ")}`);
    const b = karteVon(idB);
    erwarte((await b.locator("h2").innerText()) === nameB, "Name von B fehlt.");
    erwarte((await b.locator("img").count()) === 0, "B hat ein Foto.");
    erwarte((await b.innerText()).includes(`${B.vorname[0]}${B.nachname[0]}`.toUpperCase()), "Initialen von B fehlen.");
    erwarte(!/SchiLf|Fortbildung/.test(await b.innerText()), "B zeigt einen Zähler trotz 0 Angeboten.");
    erwarte((await karteVon(idC).count()) === 0, "Die stillgelegte Person C erscheint.");
    erwarte((await karteVon(idD).count()) === 0, "Die verborgene Person D erscheint.");
    const reihenfolge = await seite.$$eval('main ul.grid a[href^="/referenten/"]', (els) => els.map((e) => e.getAttribute("href")));
    erwarte(reihenfolge.indexOf(`/referenten/${idA}`) < reihenfolge.indexOf(`/referenten/${idB}`), "Nachname-Reihenfolge A vor B stimmt nicht.");
    return { satz: "A mit Foto, Badge Referent, genau 3 Chips und „8 SchiLf · 1 Fortbildung“. B mit Initialen und ohne Zähler. C (stillgelegt) und D (verborgen) fehlen. Sortiert nach Nachname." };
  });

  await pruefe("/referenten: nichts Abgesagtes, Vergangenes, Eingereichtes oder Entwürfe im Zähler", async () => {
    // Der Zähler 8 SchiLf + 1 Fortbildung aus dem vorigen Fall schließt die vier Ausreißer schon aus. Hier die Gegenprobe im Steckbrief.
    await seite.goto(`${BASIS}/referenten/${idA}`);
    const text = await seite.locator("main").innerText();
    for (const raus of ["Abgesagt", "Vorbei", "Eingereicht", "Entwurf", "SchiLf abgesagt"]) {
      erwarte(!text.includes(`RF22 ${stamp} ${raus}`), `„${raus}“ erscheint im Steckbrief.`);
    }
    return { satz: "Abgesagte, vergangene, eingereichte und Entwurfs-Angebote erscheinen weder im Zähler noch in den Slidern." };
  });

  // --------------------------------------------------------------- Steckbrief
  await pruefe("Steckbrief A: Kopf, Chips, Kurzprofil mit Zeilenumbruch, keine Kontaktdaten", async () => {
    await seite.goto(`${BASIS}/referenten/${idA}`);
    erwarte((await seite.locator("h1").innerText()) === nameA, "Name fehlt.");
    erwarte((await seite.locator("article header").innerText()).includes("Referent"), "Funktions-Etikett fehlt.");
    erwarte((await seite.getByText("Stammschule: GS Randstadt", { exact: true }).count()) === 1, "Zeile „Stammschule: …“ fehlt.");
    const chips = await seite.locator('article header ul[aria-label="Schwerpunkte"] li').allInnerTexts();
    erwarte(JSON.stringify(chips) === JSON.stringify(["KI", "ByCS", "Tablets", "Videos"]), `Chips im Steckbrief: ${chips.join(", ")}`);
    const profil = seite.locator("p.whitespace-pre-line");
    erwarte((await profil.innerText()).includes("Erste Zeile des Kurzprofils.\nZweite Zeile"), "Der Zeilenumbruch im Kurzprofil ging verloren.");
    erwarte((await profil.evaluate((e) => getComputedStyle(e).whiteSpace)) === "pre-line", "Das Kurzprofil bricht nicht an Zeilenwechseln um.");
    erwarte((await seite.locator('img[src^="/api/portraet/"]').count()) === 1, "Großes Foto fehlt.");
    erwarte((await seite.locator('img[src^="/api/portraet/"]').getAttribute("alt")) === `Porträt von ${nameA}`, "Alt-Text des Fotos fehlt.");
    return { satz: "Name, Etikett, Stammschule, vier Chips, Kurzprofil mit erhaltenem Zeilenumbruch und Foto mit Alt-Text." };
  });

  await pruefe("Steckbrief A: Reg. Fortbildungen mit Datum, Uhrzeit, Titel und Ort, SchiLf mit Etikett, Titel, Schularten", async () => {
    const reg = seite.locator('section[aria-labelledby="angebote-reg"]');
    erwarte((await reg.locator("h2").innerText()) === "Reg. Fortbildungen", "Überschrift Reg. Fortbildungen fehlt.");
    const karten = reg.locator("ul > li");
    erwarte((await karten.count()) === 1, `Reg. Fortbildungen: ${await karten.count()} Karten statt 1.`);
    const k = (await karten.first().innerText()).replace(/\s+/g, " ");
    erwarte(k.includes(datumBerlin(termin)), `Datum fehlt in „${k}“.`);
    erwarte(k.includes(`${zeitBerlin(termin)}–${zeitBerlin(terminEnde)}`), `Uhrzeit fehlt in „${k}“.`);
    erwarte(k.includes(terminTitel), "Titel fehlt.");
    erwarte(k.includes("GS Randstadt"), "Ort fehlt.");
    erwarte((await karten.first().locator("a").getAttribute("href")) === `/fortbildungen/${terminSlug}`, "Link zum Angebot stimmt nicht.");

    const sl = seite.locator('section[aria-labelledby="angebote-schilf"]');
    erwarte((await sl.locator("h2").innerText()) === "SchiLf", "Überschrift SchiLf fehlt.");
    const schilf = sl.locator("ul > li");
    erwarte((await schilf.count()) === 8, `SchiLf: ${await schilf.count()} Karten statt 8.`);
    const erste = (await sl.locator("ul > li", { hasText: schilfTitel1 }).innerText()).replace(/\s+/g, " ");
    erwarte(erste.includes("Micro-SchiLf"), `Etikett Micro-SchiLf fehlt: ${erste}`);
    erwarte(erste.includes("Grundschule · Mittelschule"), `Schularten fehlen: ${erste}`);
    return { satz: "Reg.-Karte: Datum, Uhrzeit von–bis, Titel, Ort, Link. SchiLf-Karten: 8 Stück, Etikett Format, Titel, Schularten." };
  });

  await pruefe("Steckbrief A: Anfrage-Zeile führt zum Kontakt-Abschnitt der Startseite", async () => {
    const link = seite.getByRole("link", { name: "Beratung digitale Bildung", exact: true });
    erwarte((await link.getAttribute("href")) === "/#kontakt", "Ziel der Anfrage-Zeile ist nicht /#kontakt.");
    await link.click();
    await seite.waitForURL(/\/#kontakt$/);
    await seite.waitForTimeout(700);
    const kontakt = seite.locator("#kontakt");
    erwarte((await kontakt.count()) === 1, "Auf der Startseite fehlt der Anker #kontakt.");
    erwarte((await kontakt.innerText()).includes("Kontakt"), "Der Anker liegt nicht am Abschnitt Kontakt.");
    const oben = await kontakt.evaluate((e) => e.getBoundingClientRect().top);
    erwarte(oben >= 0 && oben < 400, `Kontakt liegt nach dem Sprung nicht im Blick (top ${Math.round(oben)}).`);
    return { satz: "„Anfragen zu SchiLf über die Beratung digitale Bildung“ springt auf /#kontakt und der Abschnitt steht im Blick." };
  });

  await pruefe("Slider: Pfeile erscheinen nur bei Überlauf und blättern bis zum Ende und zurück", async () => {
    await seite.goto(`${BASIS}/referenten/${idA}`);
    const reg = seite.locator('section[aria-labelledby="angebote-reg"]');
    const sl = seite.locator('section[aria-labelledby="angebote-schilf"]');
    await seite.waitForTimeout(400);
    erwarte(!(await reg.getByRole("button", { name: "Weiter" }).isVisible()), "Pfeile sichtbar, obwohl nur eine Karte da ist.");
    const weiter = sl.getByRole("button", { name: "Weiter" });
    const zurueck = sl.getByRole("button", { name: "Zurück" });
    await weiter.waitFor({ state: "visible", timeout: 5_000 });
    erwarte(await zurueck.isDisabled(), "Zurück ist am Anfang nicht gesperrt.");
    const spur = sl.locator("ul").first();
    await weiter.click();
    await seite.waitForFunction((el) => el.scrollLeft > 50, await spur.elementHandle(), { timeout: 5_000 });
    erwarte(!(await zurueck.isDisabled()), "Zurück bleibt nach dem Weiterblättern gesperrt.");
    for (let i = 0; i < 8 && !(await weiter.isDisabled()); i += 1) {
      await weiter.click();
      await seite.waitForTimeout(450);
    }
    erwarte(await weiter.isDisabled(), "Weiter wird am Ende nicht gesperrt.");
    const ende = await spur.evaluate((e) => e.scrollLeft);
    await zurueck.click();
    await seite.waitForTimeout(500);
    erwarte((await spur.evaluate((e) => e.scrollLeft)) < ende, "Zurück blättert nicht.");
    return { satz: "Eine Karte: Pfeile unsichtbar. Acht Karten: Zurück am Anfang gesperrt, Weiter blättert, am Ende gesperrt, Zurück geht wieder zurück." };
  });

  await pruefe("Slider per Tastatur: Der Pfeil ist am Ende gesperrt, behält aber den Fokus (aria-disabled statt disabled)", async () => {
    await seite.goto(`${BASIS}/referenten/${idA}`);
    const sl = seite.locator('section[aria-labelledby="angebote-schilf"]');
    const weiter = sl.getByRole("button", { name: "Weiter" });
    const zurueck = sl.getByRole("button", { name: "Zurück" });
    const spur = sl.locator("ul").first();
    await weiter.waitFor({ state: "visible", timeout: 5_000 });
    erwarte((await zurueck.getAttribute("aria-disabled")) === "true", "Zurück trägt am Anfang kein aria-disabled.");
    erwarte((await zurueck.getAttribute("disabled")) === null, "Zurück trägt das Attribut disabled.");
    erwarte((await spur.evaluate((e) => e.scrollLeft)) === 0, "Die Reihe startet nicht am Anfang.");
    await zurueck.focus();
    await seite.keyboard.press("Enter");
    await seite.waitForTimeout(300);
    erwarte((await spur.evaluate((e) => e.scrollLeft)) === 0, "Der gesperrte Zurück-Pfeil blättert trotzdem.");
    await weiter.focus();
    for (let i = 0; i < 12 && (await weiter.getAttribute("aria-disabled")) !== "true"; i += 1) {
      await seite.keyboard.press("Enter");
      await seite.waitForTimeout(500);
    }
    erwarte((await weiter.getAttribute("aria-disabled")) === "true", "Weiter wird am Ende nicht als gesperrt gemeldet.");
    const fokus = await seite.evaluate(() => `${document.activeElement?.tagName}${document.activeElement?.getAttribute("aria-label") ? ` „${document.activeElement.getAttribute("aria-label")}“` : ""}`);
    erwarte(fokus === "BUTTON „Weiter“", `Der Fokus ist am Ende der Reihe nicht beim Pfeil geblieben: ${fokus}.`);
    const ende = await spur.evaluate((e) => e.scrollLeft);
    await seite.keyboard.press("Enter");
    await seite.waitForTimeout(400);
    erwarte((await spur.evaluate((e) => e.scrollLeft)) === ende, "Der gesperrte Weiter-Pfeil blättert trotzdem.");
    await seite.keyboard.press("Shift+Tab");
    const davor = await seite.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
    erwarte(davor !== "BODY", `Die Tastatur ist nach dem Ende der Reihe an den Seitenanfang gefallen (${davor}).`);
    return { satz: "Mit Enter bis ans Ende geblättert: Weiter meldet aria-disabled, der Fokus bleibt auf dem Pfeil, ein weiterer Druck tut nichts, Shift+Tab geht normal weiter. Der gesperrte Zurück-Pfeil am Anfang blättert nicht." };
  });

  await pruefe("Steckbrief B: leeres Profil, beide Leerzustände mit Weg zu allen Fortbildungen", async () => {
    await seite.goto(`${BASIS}/referenten/${idB}`);
    erwarte((await seite.locator("h1").innerText()) === nameB, "Name von B fehlt.");
    erwarte((await seite.getByText("Das Profil wird gerade ergänzt.", { exact: true }).count()) === 1, "Hinweis auf das leere Profil fehlt.");
    erwarte((await seite.getByText("Derzeit keine regionalen Fortbildungen.", { exact: true }).count()) === 1, "Leerzustand Reg. Fortbildungen fehlt.");
    erwarte((await seite.getByText("Derzeit keine SchiLf-Angebote.", { exact: true }).count()) === 1, "Leerzustand SchiLf fehlt.");
    erwarte((await seite.getByRole("link", { name: "Alle Fortbildungen" }).count()) >= 2, "Link „Alle Fortbildungen“ fehlt im Leerzustand.");
    erwarte((await seite.locator("article header ul[aria-label]").count()) === 0, "B zeigt leere Chips.");
    erwarte((await seite.getByText(/Stammschule:/).count()) === 1, "Stammschule von B fehlt.");
    return { satz: "B zeigt „Das Profil wird gerade ergänzt.“ und zwei Leerzustände mit Link, keine leeren Chips." };
  });

  await pruefe("404 für stillgelegte, verborgene und unbekannte Personen", async () => {
    for (const [name, id] of [["stillgelegt", idC], ["verborgen", idD], ["unbekannt", "00000000-0000-4000-8000-000000000000"], ["Unsinn", "../../etc/passwd"]]) {
      const antwort = await seite.goto(`${BASIS}/referenten/${encodeURIComponent(id)}`);
      erwarte(antwort?.status() === 404, `${name}: Status ${antwort?.status()} statt 404.`);
      erwarte(!(await seite.content()).includes(C.nachname), `${name}: Der Name steht trotzdem im HTML.`);
    }
    return { satz: "Stillgelegte und verborgene Person, unbekannte ID und Unsinn-ID ergeben 404 ohne Namen im HTML." };
  });

  await pruefe("404-Seiten auf Deutsch: Mitglied, Fortbildung und unbekannte Adresse mit Weg zurück", async () => {
    const faelle = [
      ["stillgelegtes Mitglied", `/referenten/${idC}`, "Dieses Mitglied wurde nicht gefunden.", "Zurück zu allen Mitgliedern", "/referenten", true],
      ["verborgenes Mitglied", `/referenten/${idD}`, "Dieses Mitglied wurde nicht gefunden.", "Zurück zu allen Mitgliedern", "/referenten", true],
      ["unbekanntes Mitglied", "/referenten/gibtesnicht", "Dieses Mitglied wurde nicht gefunden.", "Zurück zu allen Mitgliedern", "/referenten", true],
      ["unbekannte Fortbildung", `/fortbildungen/rf22-${stamp}-gibtesnicht`, "Diese Fortbildung wurde nicht gefunden.", "Alle Fortbildungen", "/fortbildungen", true],
      ["unbekannte Adresse", `/rf22-${stamp}-gibtesnicht`, "Diese Seite wurde nicht gefunden.", "Zur Startseite", "/", false],
    ];
    for (const [name, pfad, titel, weg, ziel, mitKopf] of faelle) {
      const antwort = await seite.goto(`${BASIS}${pfad}`);
      erwarte(antwort?.status() === 404, `${name}: Status ${antwort?.status()} statt 404.`);
      erwarte((await seite.locator("h1").innerText()) === titel, `${name}: Überschrift „${await seite.locator("h1").innerText()}“ statt „${titel}“.`);
      erwarte(!/could not be found|Not Found/i.test(await seite.locator("body").innerText()), `${name}: Es steht noch englischer Text da.`);
      erwarte((await seite.locator(`main a[href="${ziel}"]`, { hasText: weg }).count()) === 1, `${name}: Der Weg „${weg}“ fehlt.`);
      erwarte((await seite.locator("header nav a").count() > 0) === mitKopf, `${name}: Kopfzeile ${mitKopf ? "fehlt" : "steht"}.`);
      erwarte((await seite.locator("html").getAttribute("lang")) === "de", `${name}: lang ist nicht de.`);
    }
    await seite.goto(`${BASIS}/referenten/gibtesnicht`);
    await seite.getByRole("link", { name: "Zurück zu allen Mitgliedern" }).click();
    await seite.waitForURL(/\/referenten$/);
    erwarte((await seite.locator("h1").innerText()).startsWith("Mitglieder Digi-Team"), "Der Weg zurück führt nicht zur Mitgliederseite.");
    return { satz: "Stillgelegt, verborgen, unbekannt, unbekannte Fortbildung und unbekannte Adresse: 404 mit deutscher Überschrift und Weg zurück, Kopfzeile bei allen Seiten im öffentlichen Bereich, Link führt zur Mitgliederseite." };
  });

  await pruefe("Porträt: öffentliches Profil liefert das Foto ohne Anmeldung als WebP", async () => {
    const antwort = await anonym.request.get(`${BASIS}/api/portraet/${idA}`);
    erwarte(antwort.status() === 200 && (antwort.headers()["content-type"] ?? "").includes("image/webp"), `Foto von A: ${antwort.status()}`);
    sql(`update "Referent" set "oeffentlichSichtbar" = false where id = ${lit(idA)};`);
    const verborgen = await anonym.request.get(`${BASIS}/api/portraet/${idA}`);
    sql(`update "Referent" set "oeffentlichSichtbar" = true where id = ${lit(idA)};`);
    erwarte(verborgen.status() === 404, `Verborgenes Foto liefert ${verborgen.status()} statt 404.`);
    const wieder = await anonym.request.get(`${BASIS}/api/portraet/${idA}`);
    erwarte(wieder.status() === 200, "Das Foto kommt nach dem Wiedereinblenden nicht zurück.");
    return { satz: "Sichtbar: 200 image/webp ohne Login. Verborgen: 404. Wieder sichtbar: 200 (Notbremse greift auch beim Foto)." };
  });

  await pruefe("Porträt: fehlt die Bilddatei schon vor der Hydration, zeigt der Steckbrief die Initialen statt eines kaputten Bildes", async () => {
    // Die Route liefert 404 und die Skripte kommen verzögert: Der Bildfehler passiert, bevor React
    // das onError-Ereignis kennt. Nach dem Start muss die Seite das Bild selbst als kaputt erkennen.
    const k = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const s = await k.newPage();
    try {
      await s.route("**/api/portraet/**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
      // Nur die Skripte, nicht das Stylesheet: Ohne Stylesheet lädt der Browser das Bild gar nicht erst.
      await s.route((u) => u.pathname.startsWith("/_next/static/chunks/") && u.pathname.endsWith(".js"), async (route) => {
        await new Promise((fertig) => setTimeout(fertig, 3500));
        await route.continue();
      });
      await s.goto(`${BASIS}/referenten/${idA}`, { waitUntil: "commit" });
      const bild = s.locator('article img[src^="/api/portraet/"]');
      await bild.waitFor({ state: "attached", timeout: 10_000 });
      await s.waitForFunction(() => {
        const img = document.querySelector('article img[src^="/api/portraet/"]');
        return Boolean(img && img.complete && img.naturalWidth === 0);
      }, null, { timeout: 3_000 });
      // Noch vor der Hydration steht das kaputte Bild da. Danach muss es verschwinden.
      await s.waitForFunction(() => !document.querySelector('article img[src^="/api/portraet/"]'), null, { timeout: 20_000 });
      const initialen = s.getByRole("img", { name: `Porträt von ${nameA}` });
      erwarte((await initialen.count()) === 1, "Die Initialen fehlen nach dem Ausfall des Bildes.");
      erwarte((await initialen.evaluate((e) => e.tagName)) === "SPAN", "Statt der Initialen steht noch ein Bild da.");
      erwarte((await initialen.innerText()).trim().length > 0, "Die Initialen sind leer.");
    } finally {
      await k.close();
    }
    return { satz: "Bilddatei 404 und Skripte 3,5 s verzögert: Das kaputte Bild steht vor der Hydration da und wird danach durch die Initialen ersetzt (Alt-Text bleibt)." };
  });

  // ------------------------------------------------------------- Verdrahtung
  await pruefe("Startseite: Slider ohne altes Team, Karte führt zum Steckbrief, „Alle Mitglieder“ zur Seite", async () => {
    await seite.goto(`${BASIS}/`);
    const text = await seite.locator("main").innerText();
    erwarte(!text.includes("Das Team") && !text.includes("Schulen im Team"), "Der alte Team-Abschnitt steht noch auf der Startseite.");
    erwarte((await seite.locator('main img[src="/bilder/banner-kollegium.webp"]').count()) === 0, "Das Kollegium-Bild steht noch auf der Startseite.");
    erwarte(text.includes("Das Digi-Team für den Landkreis Aichach-Friedberg umfasst"), "Der Text „Wer wir sind“ fehlt.");
    const slider = seite.locator('ul[aria-label="Mitglieder Digi-Team"]');
    erwarte((await slider.count()) === 1, "Der Slider fehlt.");
    erwarte((await slider.locator(`a[href="/referenten/${idC}"], a[href="/referenten/${idD}"]`).count()) === 0, "C oder D stehen im Slider.");
    // Natürliche Höhe je Karte (ohne Strecken auf die höchste). Die Testinstanz enthält Sonderfälle
    // mit Fantasienamen und überlangen Schulnamen. Für das Maß zählt die übliche Karte (Median),
    // die Ausreißer dürfen höher sein, sprengen aber nichts.
    const karten = await slider.evaluate((ul) => {
      ul.style.alignItems = "flex-start";
      const liste = [...ul.children].map((li) => ({ text: li.innerText, h: li.getBoundingClientRect().height }));
      ul.style.alignItems = "";
      return liste;
    });
    const sortiert = karten.map((k) => k.h).sort((x, y) => x - y);
    const hoehe = sortiert[Math.floor(sortiert.length / 2)];
    erwarte(hoehe <= 240, `Die übliche Karte ist ${Math.round(hoehe)} px hoch (höchstens ca. 240).`);
    erwarte(Math.max(...karten.map((k) => k.h)) <= 320, "Selbst sperrige Namen sprengen die Karte.");
    const kartenBreite = await slider.locator("li").first().evaluate((e) => e.getBoundingClientRect().width);
    erwarte(Math.abs(kartenBreite - 180) < 2, `Kartenbreite ${kartenBreite} statt 180.`);
    erwarte((await seite.getByRole("link", { name: "Alle Mitglieder" }).getAttribute("href")) === "/referenten", "„Alle Mitglieder“ zeigt nicht auf /referenten.");
    await slider.locator(`a[href="/referenten/${idA}"]`).click();
    await seite.waitForURL(new RegExp(`/referenten/${idA}$`));
    erwarte((await seite.locator("h1").innerText()) === nameA, "Der Steckbrief von A öffnet sich nicht.");
    return { satz: `Kein Team-Abschnitt und kein Kollegium-Bild mehr, Slider (übliche Karte ${Math.round(hoehe)} px hoch, höchste ${Math.round(sortiert[sortiert.length - 1])} px, 180 px breit) ohne C und D, Karte öffnet den Steckbrief, „Alle Mitglieder“ führt zu /referenten.` };
  });

  await pruefe("Steckbrief → Angebot → Steckbrief: Karte öffnet das Angebot, der Referenten-Name führt zurück", async () => {
    await seite.goto(`${BASIS}/referenten/${idA}`);
    await seite.locator('section[aria-labelledby="angebote-reg"] a').first().click();
    await seite.waitForURL(new RegExp(`/fortbildungen/${terminSlug}$`));
    erwarte((await seite.locator("h1").innerText()) === terminTitel, "Die Detailseite zeigt ein anderes Angebot.");
    const nameLink = seite.locator(`article a[href="/referenten/${idA}"]`);
    erwarte((await nameLink.innerText()) === nameA, "Der Referenten-Name ist kein Link zum Steckbrief.");
    const optik = await nameLink.evaluate((e) => ({ linie: getComputedStyle(e).textDecorationLine, farbe: getComputedStyle(e).color, umgebung: getComputedStyle(e.parentElement).color }));
    erwarte(optik.linie === "underline", `Der Referenten-Name ist nicht unterstrichen (${optik.linie}).`);
    erwarte(optik.farbe !== optik.umgebung, "Der Referenten-Name hat dieselbe Farbe wie der Text daneben.");
    await nameLink.click();
    await seite.waitForURL(new RegExp(`/referenten/${idA}$`));
    erwarte((await seite.locator("h1").innerText()) === nameA, "Der Rückweg landet nicht im Steckbrief.");
    await seite.locator('section[aria-labelledby="angebote-schilf"] a', { hasText: schilfTitel1 }).click();
    await seite.waitForURL(/\/fortbildungen\/rf22-.*-schilf-1$/);
    return { satz: "Steckbrief → Reg.-Karte → Detailseite → Name (unterstrichen, eigene Farbe) → Steckbrief, außerdem SchiLf-Karte → Detailseite." };
  });

  await pruefe("Detailseite: nur öffentliche Personen verlinkt, stillgelegte und verborgene fehlen", async () => {
    await seite.goto(`${BASIS}/fortbildungen/${gemeinsamSlug}`);
    const bereich = await seite.locator("article").innerText();
    erwarte((await seite.locator(`article a[href="/referenten/${idA}"]`).count()) === 1, "A ist nicht verlinkt.");
    erwarte(!bereich.includes(C.nachname) && !bereich.includes(D.nachname), "C oder D stehen auf der Detailseite.");
    erwarte((await seite.locator(`article a[href="/referenten/${idC}"], article a[href="/referenten/${idD}"]`).count()) === 0, "Links auf C oder D.");
    return { satz: "Bei einem Angebot mit drei Referenten erscheint nur A, verlinkt auf den Steckbrief." };
  });

  await pruefe("Startseite: Reiter zeigen Referenten-Namen als Text, ohne Link in Link", async () => {
    await seite.goto(`${BASIS}/`);
    const verschachtelt = await seite.locator("main a a").count();
    erwarte(verschachtelt === 0, `${verschachtelt} Links stecken in Links.`);
    const karte = seite.locator("#start-feld-schilf li", { hasText: gemeinsamTitel });
    if ((await karte.count()) > 0) {
      erwarte((await karte.first().locator('a[href^="/referenten/"]').count()) === 0, "Der Name in der SchiLf-Karte ist ein Link.");
    }
    return { satz: "Keine verschachtelten Links, Namen in den Startseiten-Karten bleiben Text." };
  });

  // -------------------------------------------------------------- Datenschutz
  await pruefe("Keine Mail und kein Telefon im HTML von Startseite, Raster, Steckbrief und Detailseite", async () => {
    for (const pfad of ["/", "/referenten", `/referenten/${idA}`, `/referenten/${idB}`, `/fortbildungen/${gemeinsamSlug}`, `/fortbildungen`]) {
      const { status, text } = await html(anonym, pfad);
      erwarte(status === 200, `${pfad}: Status ${status}.`);
      erwarte(!text.includes(A.email) && !text.includes("@test.local"), `${pfad}: Mailadresse im HTML.`);
      erwarte(!text.includes("55 44 33 22") && !text.includes(A.telefon), `${pfad}: Telefonnummer im HTML.`);
    }
    return { satz: "In sechs Seiten, auch in den eingebetteten Seitendaten, stehen weder die Mailadresse noch die Telefonnummer von A." };
  });

  // ---------------------------------------------------------------- Responsiv
  for (const breite of [320, 390, 768, 820, 1280]) {
    await pruefe(`Responsiv ${breite} px: kein Überstand, Navigation passt`, async () => {
      const k = await browser.newContext({ viewport: { width: breite, height: 800 } });
      const s = await k.newPage();
      s.on("pageerror", (e) => seitenfehler.push(`JS: ${e.message}`));
      try {
        for (const pfad of ["/", "/referenten", `/referenten/${idA}`, `/referenten/${idB}`, `/fortbildungen/${gemeinsamSlug}`]) {
          await s.goto(`${BASIS}${pfad}`, { waitUntil: "load" });
          await s.waitForTimeout(250);
          const r = await ueberstehende(s);
          erwarte(r.treffer.length === 0, `${pfad}: ragt über den Rand (${r.treffer.join(" | ")}).`);
          erwarte(r.scrollBreite <= r.breite, `${pfad}: horizontales Scrollen (${r.scrollBreite} > ${r.breite}).`);
        }
        if (breite < 920) {
          await s.goto(`${BASIS}/referenten`);
          const kopf = await s.locator("header.sticky").boundingBox();
          const punkte = await s.locator("header nav > :not(.bg-primary)").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
          erwarte(new Set(punkte).size === 1, `Die Navigationspunkte liegen nicht in einer Reihe: ${punkte.join(", ")}`);
          erwarte(kopf && kopf.height > 60, "Die Navigation ist nicht in die zweite Zeile gerutscht.");
        }
      } finally {
        await k.close();
      }
      return { satz: `Bei ${breite} px ragt nichts über den Rand und es gibt kein horizontales Scrollen auf Startseite, Raster, zwei Steckbriefen und Detailseite.` };
    });
  }

  await pruefe("Steckbrief: ein sehr langer Schwerpunkt bricht bei 390 px um und wird nicht abgeschnitten", async () => {
    const lang = "Mediendidaktik und Unterrichtsentwicklung im Zusammenhang mit Lernplattformen und Supercalifragilisticexpialidocious_Lernplattformintegration";
    sql(`update "Referent" set schwerpunkte = ${lit(`${lang}, KI`)} where id = ${lit(idA)};`);
    const k = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const s = await k.newPage();
    try {
      await s.goto(`${BASIS}/referenten/${idA}`, { waitUntil: "load" });
      const chip = s.locator('article header ul[aria-label="Schwerpunkte"] li > span').first();
      erwarte((await chip.innerText()) === lang, "Der lange Schwerpunkt steht nicht vollständig im Steckbrief.");
      const maße = await chip.evaluate((e) => ({ breit: e.scrollWidth, sichtbar: e.clientWidth, hoch: e.getBoundingClientRect().height, rechts: e.getBoundingClientRect().right }));
      erwarte(maße.breit <= maße.sichtbar + 1, `Der Schwerpunkt ist abgeschnitten (${maße.breit} > ${maße.sichtbar} px).`);
      erwarte(maße.hoch > 24, `Der Schwerpunkt ist nicht umgebrochen (${Math.round(maße.hoch)} px hoch).`);
      erwarte(maße.rechts <= 390, "Der Schwerpunkt ragt über den Rand.");
      const r = await ueberstehende(s);
      erwarte(r.scrollBreite <= r.breite && r.treffer.length === 0, `Überstand im Steckbrief: ${r.treffer.join(" | ")}`);
      await s.goto(`${BASIS}/referenten`, { waitUntil: "load" });
      const karte = s.locator(`main a[href="/referenten/${idA}"]`);
      erwarte((await karte.locator('ul[aria-label="Schwerpunkte"] li').count()) === 2, "Raster: Die Chips fehlen.");
      erwarte((await karte.locator("li span.truncate").first().evaluate((e) => e.scrollWidth > e.clientWidth)), "Raster: Der lange Schwerpunkt wird dort nicht gekürzt.");
    } finally {
      await k.close();
      sql(`update "Referent" set schwerpunkte = ${lit(PROFIL.schwerpunkte)} where id = ${lit(idA)};`);
    }
    return { satz: "Steckbrief: der lange Schwerpunkt steht ganz da, umgebrochen und ohne Überstand. Auf der Raster-Karte bleibt er gekürzt (Kartenhöhe)." };
  });

  // ---------------------------------------------------------- Bildschirmfotos
  await pruefe("Bildschirmfotos (Startseite, Raster, Steckbriefe bei 1280 und 390 px, dunkel)", async () => {
    const dateien = [];
    for (const breite of [1280, 390]) {
      const k = await browser.newContext({ viewport: { width: breite, height: 900 } });
      const s = await k.newPage();
      const foto = async (name, optionen = {}) => {
        const datei = path.join(BILDER, `rf22-${name}-${breite}.png`);
        await s.screenshot({ path: datei, ...optionen });
        dateien.push(datei);
      };
      await s.goto(`${BASIS}/`, { waitUntil: "load" });
      await s.waitForTimeout(400);
      await s.locator('ul[aria-label="Mitglieder Digi-Team"]').scrollIntoViewIfNeeded();
      await s.locator(`ul[aria-label="Mitglieder Digi-Team"] a[href="/referenten/${idA}"]`).scrollIntoViewIfNeeded();
      await s.waitForTimeout(500);
      await foto("start", { fullPage: true });

      await s.goto(`${BASIS}/referenten`, { waitUntil: "load" });
      const kasten = await s.locator(`main a[href="/referenten/${idA}"]`).boundingBox();
      await s.waitForTimeout(500);
      const y = Math.max(0, Math.round((kasten?.y ?? 0) - 330));
      await foto("raster", { fullPage: true, clip: { x: 0, y: breite === 1280 ? y : Math.max(0, y - 40), width: breite, height: breite === 1280 ? 760 : 900 } });

      for (const [name, id] of [["steckbrief", idA], ["steckbrief-leer", idB]]) {
        await s.goto(`${BASIS}/referenten/${id}`, { waitUntil: "load" });
        await s.waitForTimeout(500);
        await foto(name, { fullPage: true });
      }
      if (breite === 1280) {
        await s.goto(`${BASIS}/referenten/${idA}`, { waitUntil: "load" });
        await s.evaluate(() => document.documentElement.classList.add("dark"));
        await s.waitForTimeout(300);
        await foto("steckbrief-dunkel", { fullPage: true });
      }
      await k.close();
    }
    return { satz: `${dateien.length} Bilder in ${BILDER}.` };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  // Die Angebote dieses Laufs wieder entfernen: Die öffentliche Liste zeigt höchstens
  // 200 Angebote, viele veröffentlichte Testangebote verdrängen sonst andere Tests.
  try {
    sql(`delete from "Fortbildung" where slug like ${lit(`rf22-${stamp}-%`)};`);
  } catch (error) {
    melde("UNKLAR", "Aufräumen", error instanceof Error ? error.message.split("\n")[0] : String(error));
  }
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.slice(0, 5).join("; "));
  await anonym.close();
  await adminKontext.close();
  await refKontext.close();
  await browser.close();
}
