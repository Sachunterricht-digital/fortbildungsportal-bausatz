// Kettentest gegen die Testinstanz (nie gegen die Live-Seite).
//
//   scripts/testinstanz.sh tunnel   (anderes Fenster)
//   node scripts/e2e/kette.mjs
//
// Ablauf: Admin legt Person an und erzeugt den Einladungslink, die Person
// setzt ihr Passwort, füllt das Profil samt Foto, reicht ein Thema ein, der
// Admin gibt frei, das Angebot erscheint außen. Jeder Lauf nutzt eine neue
// Mailadresse, Bildschirmfotos landen in scripts/e2e/bilder/.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASIS = process.env.E2E_BASIS ?? "http://localhost:3101";
if (!/localhost|127\.0\.0\.1/.test(BASIS)) throw new Error("Nur gegen die Testinstanz über den Tunnel.");
const ADMIN_MAIL = process.env.E2E_ADMIN_MAIL ?? "admin@example.org";
const ADMIN_PW = process.env.E2E_ADMIN_PW;
if (!ADMIN_PW) throw new Error("E2E_ADMIN_PW fehlt (Passwort des Admin-Kontos der Testinstanz).");

const lauf = Date.now().toString(36);
const person = { vorname: "Erika", nachname: `Test${lauf}`, mail: `e2e-${lauf}@test.local`, pw: `E2e-${lauf}-Passwort!` };
const titel = `E2E Kettentest ${lauf}`;
const bilder = path.join(path.dirname(new URL(import.meta.url).pathname), "bilder");
mkdirSync(bilder, { recursive: true });

const browser = await chromium.launch(process.env.E2E_CHROMIUM_PFAD ? { executablePath: process.env.E2E_CHROMIUM_PFAD } : {});

const ergebnis = [];
let nr = 0;
async function schritt(name, seite, fn) {
  nr += 1;
  try {
    await fn();
    ergebnis.push(`ok    ${nr} ${name}`);
  } catch (e) {
    const bild = path.join(bilder, `fehler-${nr}.png`);
    await seite.screenshot({ path: bild, fullPage: true }).catch(() => {});
    ergebnis.push(`FEHLER ${nr} ${name}: ${e.message.split("\n").slice(0, 3).join(" | ")} (${bild})`);
    throw e;
  }
}
function beobachte(seite, fehler) {
  seite.on("pageerror", (e) => fehler.push(`JS ${e.message}`));
  seite.on("response", (r) => { if (r.status() >= 500) fehler.push(`${r.status()} ${r.url()}`); });
}
async function anmelden(seite, mail, pw) {
  await seite.goto(BASIS + "/login");
  await seite.fill("input[name=email]", mail);
  await seite.fill("input[name=passwort]", pw);
  await Promise.all([seite.waitForURL(/\/admin/, { timeout: 15000 }), seite.click("button[type=submit]")]);
}

const fehler = [];
const admin = await (await browser.newContext()).newPage();
const ref = await (await browser.newContext()).newPage();
beobachte(admin, fehler);
beobachte(ref, fehler);
let link;

try {
  await schritt("Admin meldet sich an", admin, () => anmelden(admin, ADMIN_MAIL, ADMIN_PW));

  await schritt("Admin legt Person an", admin, async () => {
    await admin.goto(BASIS + "/admin/referenten");
    await admin.getByRole("button", { name: "Neue Person anlegen" }).click();
    const d = admin.getByRole("dialog");
    await d.locator("input[name=vorname]").fill(person.vorname);
    await d.locator("input[name=nachname]").fill(person.nachname);
    await d.locator("input[name=organisation]").fill("GS Teststadt");
    await d.locator("input[name=email]").fill(person.mail);
    await d.getByRole("button", { name: "Speichern" }).click();
    await d.getByText(/gespeichert|angelegt/i).first().waitFor({ timeout: 10000 });
    await admin.keyboard.press("Escape");
    await admin.getByRole("cell", { name: new RegExp(person.nachname) }).first().waitFor();
  });

  await schritt("Admin erzeugt Einladungslink", admin, async () => {
    await admin.getByRole("button", { name: `Registrierungslink für ${person.vorname} ${person.nachname} verwalten` }).click();
    await admin.getByRole("button", { name: "Nur Link erzeugen und kopieren" }).click();
    const feld = admin.getByRole("dialog").locator("input[readonly]");
    await feld.waitFor({ timeout: 10000 });
    const echt = new URL(await feld.inputValue());
    link = BASIS + echt.pathname + echt.search;
    await admin.keyboard.press("Escape");
  });

  await schritt("Person setzt Passwort über den Link", ref, async () => {
    await ref.goto(link);
    await ref.fill("input[name=passwort]", person.pw);
    await ref.fill("input[name=wiederholung]", person.pw);
    await ref.click("button[type=submit]");
    await ref.waitForURL((u) => !u.pathname.startsWith("/zugang"), { timeout: 15000 });
  });

  await schritt("Einladungslink ist danach verbraucht", ref, async () => {
    const p = await ref.context().newPage();
    await p.goto(link);
    if (await p.locator("input[name=wiederholung]").count()) throw new Error("Link funktioniert noch ein zweites Mal");
    await p.close();
  });

  await schritt("Person ist danach direkt angemeldet", ref, async () => {
    await ref.goto(BASIS + "/admin");
    await ref.getByText(`${person.vorname} ${person.nachname}`).first().waitFor({ timeout: 10000 });
  });

  await schritt("Person füllt ihr Profil", ref, async () => {
    await ref.goto(BASIS + "/admin/konto");
    await ref.locator("input[name=telefon]").fill("08251 0000");
    await ref.locator("input[name=schwerpunkte]").fill("iPad, KI im Unterricht");
    await ref.locator("textarea[name=kurzprofil]").fill("Testprofil aus dem Kettentest.");
    await ref.getByRole("button", { name: /^(Profil speichern|Speichern und veröffentlichen)$/ }).click();
    await ref.getByText(/gespeichert/i).first().waitFor({ timeout: 10000 });
  });

  await schritt("Kaputtes Bild ergibt eine Meldung, keinen Serverfehler", ref, async () => {
    await ref.reload();
    await ref.locator("input[name=foto]").setInputFiles({ name: "kaputt.png", mimeType: "image/png", buffer: Buffer.from("kein Bild") });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.getByText("lässt sich nicht als Bild lesen").waitFor({ timeout: 15000 });
  });

  await schritt("Person lädt ein Profilfoto hoch", ref, async () => {
    const png = await ref.screenshot({ clip: { x: 0, y: 0, width: 300, height: 300 } });
    await ref.locator("input[name=foto]").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.locator('img[src^="/api/portraet/"]').waitFor({ timeout: 15000 });
  });

  await schritt("Person speichert einen Entwurf schon im ersten Schritt", ref, async () => {
    await ref.goto(BASIS + "/admin/fortbildungen/neu");
    await ref.locator("input[name=titel]").fill(`${titel} Entwurf`);
    await ref.getByRole("button", { name: "Als Entwurf speichern" }).click();
    await ref.waitForURL(/gespeichert=1/, { timeout: 15000 });
  });

  await schritt("Maske zeigt eingetragene Themen und Termine am selben Tag als Bitte", ref, async () => {
    await ref.goto(BASIS + "/admin/fortbildungen/neu");
    // Testinstanz: veröffentlichtes RLFB „Bayern Cloud …“ am 07.10.2026
    await ref.getByText(/Bereits eingetragene Themen \(\d+\)/).waitFor({ timeout: 10000 });
    await ref.locator("input[name=titel]").fill("Bayern Cloud im Kollegium");
    await ref.locator('[role=combobox]').first().click();
    await ref.getByRole("option", { name: /RLFB/ }).click();
    await ref.locator("input[name=beginn]").fill("07.10.2026 09:00");
    await ref.locator("input[name=beginn]").blur();
    await ref.getByText("Bitte möglichst einen anderen Tag wählen").first().waitFor({ timeout: 10000 });
  });

  await schritt("Person reicht ein Thema ein (SchiLf, ohne Termin)", ref, async () => {
    await ref.goto(BASIS + "/admin/fortbildungen/neu");
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w1.png") });
    await ref.locator("input[name=titel]").fill(titel);
    await ref.locator('button:has(input[name=organisationsform]), [role=combobox]').first().click();
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w2.png") });
    await ref.getByRole("option", { name: "SchiLf" }).click();
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w3.png") });
    await ref.getByRole("button", { name: "Weiter" }).click();
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w4.png") });
    await ref.locator(".ProseMirror").click();
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w5.png") });
    await ref.keyboard.type("Beschreibung aus dem Kettentest.");
    await ref.getByRole("button", { name: "Weiter" }).click();
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w6.png") });
    await ref.getByRole("button", { name: "Weiter" }).click();
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w7.png") });
    if ((await ref.locator("input[name=referenten]").count()) === 0) throw new Error("Eigene Person ist nicht als Leitung vorausgewählt");
    await ref.getByRole("button", { name: "Weiter" }).click();
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w9.png") });
    // Seit 03.10. kein Statusfeld mehr im letzten Schritt für Referenten
    if (process.env.E2E_BILDER) await ref.screenshot({ path: path.join(bilder, "w10.png") });
    await ref.getByRole("button", { name: "Zur Freigabe einreichen" }).click();
    await ref.waitForURL(/gespeichert=1/, { timeout: 15000 });
  });

  let fbId;
  await schritt("Admin sieht das Thema in den Freigaben und weist zurück", admin, async () => {
    fbId = new URL(ref.url()).pathname.split("/").pop();
    await admin.goto(BASIS + "/admin/freigaben");
    const karte = admin.locator("article, li, div.border").filter({ hasText: titel }).last();
    await karte.getByRole("button", { name: "Zurückweisen" }).click();
    await karte.locator("textarea[name=notiz]").fill("Bitte die Beschreibung ergänzen.");
    await karte.getByRole("button", { name: "Zurückweisen" }).click();
    await admin.getByRole("link", { name: titel }).waitFor({ state: "detached", timeout: 15000 });
  });

  await schritt("Person sieht die Begründung und reicht erneut ein", ref, async () => {
    await ref.goto(BASIS + "/admin/fortbildungen/" + fbId);
    await ref.getByText("Bitte die Beschreibung ergänzen.").waitFor({ timeout: 10000 });
    await ref.getByRole("tab", { name: "Beschreibung" }).click();
    await ref.locator(".ProseMirror").click();
    await ref.keyboard.press("End");
    await ref.keyboard.type(" Ergänzt nach Rückweisung.");
    await ref.getByRole("tab", { name: "Eckdaten" }).click();
    await ref.locator('[role=combobox]').filter({ hasText: /Entwurf|Eingereicht|Zurück/ }).first().click();
    await ref.getByRole("option", { name: /eingereicht/i }).click();
    await ref.locator("form:has(input[name=titel]) button[type=submit]").last().click();
    await ref.waitForURL(/gespeichert=1/, { timeout: 15000 });
  });

  await schritt("Admin ergänzt Niveaustufe und DigCompEdu", admin, async () => {
    await admin.goto(BASIS + "/admin/fortbildungen/" + fbId);
    await admin.getByRole("tab", { name: /DigCompEdu/ }).click();
    await admin.locator('[role=combobox]').filter({ hasText: /Niveau|wählen/i }).first().click();
    await admin.getByRole("option").first().click();
    await admin.getByRole("option").first().waitFor({ state: "hidden" });
    await admin.getByRole("button", { name: /KB 1/ }).click();
    await admin.getByRole("region").locator("[role=checkbox]").first().click();
    await admin.locator("form:has(input[name=titel]) button[type=submit]").last().click();
    await admin.waitForURL(/gespeichert=1/, { timeout: 15000 });
  });

  await schritt("Admin gibt frei", admin, async () => {
    await admin.goto(BASIS + "/admin/freigaben");
    const karte = admin.locator("article, li, div.border").filter({ hasText: titel }).last();
    await karte.getByRole("button", { name: "Freigeben und veröffentlichen" }).click();
    await admin.getByRole("link", { name: titel }).waitFor({ state: "detached", timeout: 15000 });
  });

  await schritt("Angebot erscheint außen, SchiLf als „Auf Abruf“", ref, async () => {
    const p = await browser.newPage();
    // Mit Suchbegriff: Die Liste zeigt höchstens 200 Angebote, auf der Testinstanz
    // stehen längst mehr, ein neues SchiLf ohne Termin stünde sonst hinter der Grenze.
    await p.goto(BASIS + "/fortbildungen?q=" + encodeURIComponent(titel));
    const zeile = p.locator("a, li, article").filter({ hasText: titel }).first();
    await zeile.waitFor({ timeout: 10000 });
    if (!(await p.getByText("Auf Abruf").count())) throw new Error("„Auf Abruf“ fehlt in der Liste");
    // Der Treffer, nicht der Filter-Chip „Suche: …“ (steht im Bild vor der Liste)
    await p.locator('a[href^="/fortbildungen/"]:not([href*="?"])').filter({ hasText: titel }).first().click();
    await p.getByText("Beschreibung aus dem Kettentest.").first().waitFor({ timeout: 10000 });
    await p.close();
  });

  await schritt("Admin sieht dieselbe Person nicht mehr unter „noch nichts eingereicht“", admin, async () => {
    await admin.goto(BASIS + "/admin/referenten");
    const liste = admin.locator("section, div").filter({ hasText: /noch nichts eingereicht/i }).last();
    if (await liste.getByText(person.nachname).count()) throw new Error("Person steht noch in der Liste");
  });
} catch {
  // Fehler steht schon in der Ergebnisliste.
  process.exitCode = 1;
} finally {
  console.log(ergebnis.join("\n"));
  if (fehler.length) console.log("Seitenfehler:\n  " + fehler.join("\n  "));
  await browser.close();
}
